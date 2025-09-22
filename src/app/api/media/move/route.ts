import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { ensureAlbumDriveFolders, getOAuthClientForUser, driveFromClient, moveFileToFolder } from "@/lib/google";

const bodySchema = z.object({ mediaId: z.string(), targetAlbumId: z.string() });

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const json = await req.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

    const media = await prisma.media.findUnique({ where: { id: parsed.data.mediaId } });
    if (!media) return NextResponse.json({ error: "Media not found" }, { status: 404 });
    const event = await prisma.event.findUnique({ where: { id: media.eventId } });
    if (!event || event.ownerId !== session.user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const targetAlbum = await prisma.album.findUnique({ where: { id: parsed.data.targetAlbumId } });
    if (!targetAlbum || targetAlbum.eventId !== event.id) return NextResponse.json({ error: "Invalid target" }, { status: 400 });

    let approvedFolderId = targetAlbum.driveApprovedFolderId || null;
    if (!approvedFolderId) {
        const folders = await ensureAlbumDriveFolders({
            userId: event.ownerId,
            eventName: event.name,
            eventSlug: event.slug,
            albumName: targetAlbum.name,
            albumSlug: targetAlbum.slug,
            eventRootFolderId: event.driveRootFolderId || null,
        });
        if (folders) {
            approvedFolderId = folders.approvedId;
            await prisma.album.update({
                where: { id: targetAlbum.id },
                data: {
                    driveAlbumFolderId: folders.albumFolderId,
                    driveUploadsFolderId: folders.uploadsId,
                    driveApprovedFolderId: folders.approvedId,
                    driveOriginalsFolderId: folders.originalsId,
                    driveExportsFolderId: folders.exportsId,
                },
            });
        }
    }
    if (!approvedFolderId) return NextResponse.json({ error: "Target folder unavailable" }, { status: 500 });

    const oauth = await getOAuthClientForUser(event.ownerId);
    if (!oauth) return NextResponse.json({ error: "Owner not connected to Google" }, { status: 400 });
    const drive = driveFromClient(oauth);

    await moveFileToFolder(drive, { fileId: media.driveFileId, destinationFolderId: approvedFolderId });
    const updated = await prisma.media.update({ where: { id: media.id }, data: { albumId: targetAlbum.id } });
    return NextResponse.json({ media: updated });
}


