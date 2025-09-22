import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { ensureAlbumDriveFolders } from "@/lib/google";

const createSchema = z.object({
    eventSlug: z.string().min(2),
    name: z.string().min(1).max(100),
    slug: z.string().regex(/^[a-z0-9-]+$/).min(2).max(64),
});

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { searchParams } = new URL(req.url);
    const eventSlug = searchParams.get("eventSlug");
    if (!eventSlug) return NextResponse.json({ error: "Missing eventSlug" }, { status: 400 });
    const event = await prisma.event.findUnique({ where: { slug: eventSlug } });
    if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (event.ownerId !== session.user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const albums = await prisma.album.findMany({
        where: { eventId: event.id },
        orderBy: { createdAt: "asc" },
        include: {
            _count: { select: { media: true } },
            media: {
                where: { status: "APPROVED" },
                orderBy: { createdAt: "desc" },
                take: 1,
                select: { thumbnailLink: true },
            },
        },
    });
    return NextResponse.json({ albums });
}

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const json = await req.json();
    const parsed = createSchema.safeParse(json);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const event = await prisma.event.findUnique({ where: { slug: parsed.data.eventSlug } });
    if (!event || event.ownerId !== session.user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const exists = await prisma.album.findFirst({ where: { eventId: event.id, slug: parsed.data.slug } });
    if (exists) return NextResponse.json({ error: "Album slug already in use" }, { status: 409 });
    const album = await prisma.album.create({ data: { eventId: event.id, name: parsed.data.name, slug: parsed.data.slug } });
    try {
        const folders = await ensureAlbumDriveFolders({
            userId: event.ownerId,
            eventName: event.name,
            eventSlug: event.slug,
            albumName: album.name,
            albumSlug: album.slug,
            eventRootFolderId: event.driveRootFolderId || null,
        });
        if (folders) {
            await prisma.album.update({
                where: { id: album.id },
                data: {
                    driveAlbumFolderId: folders.albumFolderId,
                    driveUploadsFolderId: folders.uploadsId,
                    driveApprovedFolderId: folders.approvedId,
                    driveOriginalsFolderId: folders.originalsId,
                    driveExportsFolderId: folders.exportsId,
                },
            });
        }
    } catch (e) {
        console.error("Album folder ensure failed", e);
    }
    const updated = await prisma.album.findUnique({ where: { id: album.id } });
    return NextResponse.json({ album: updated ?? album });
}


