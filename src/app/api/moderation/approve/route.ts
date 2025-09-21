import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { driveFromClient, getOAuthClientForUser, ensureEventDriveFolders, moveFileToFolder } from "@/lib/google";

export async function POST(req: NextRequest) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const session = (await getServerSession(authOptions as any)) as any;
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { mediaId } = await req.json();
    if (!mediaId) return NextResponse.json({ error: "Missing mediaId" }, { status: 400 });

    const media = await prisma.media.findUnique({ where: { id: mediaId } });
    if (!media) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const event = await prisma.event.findUnique({ where: { id: media.eventId } });
    if (!event || event.ownerId !== session.user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const oauth = await getOAuthClientForUser(session.user.id);
    if (!oauth) return NextResponse.json({ error: "Owner not connected" }, { status: 400 });
    const drive = driveFromClient(oauth);

    let approvedFolderId = event.driveApprovedFolderId;
    if (!approvedFolderId) {
        const folders = await ensureEventDriveFolders({ userId: session.user.id, eventName: event.name, slug: event.slug });
        if (!folders) return NextResponse.json({ error: "Folders unavailable" }, { status: 500 });
        approvedFolderId = folders.approvedId;
        await prisma.event.update({
            where: { id: event.id },
            data: {
                driveRootFolderId: folders.eventFolderId,
                driveUploadsFolderId: folders.uploadsId,
                driveApprovedFolderId: folders.approvedId,
                driveOriginalsFolderId: folders.originalsId,
                driveExportsFolderId: folders.exportsId,
            },
        });
    }

    await moveFileToFolder(drive, { fileId: media.driveFileId, destinationFolderId: approvedFolderId! });

    const updated = await prisma.media.update({ where: { id: media.id }, data: { status: "APPROVED", approvedAt: new Date() } });
    const safe = { ...updated, sizeBytes: updated.sizeBytes ? updated.sizeBytes.toString() : null };
    return NextResponse.json({ media: safe });
}


