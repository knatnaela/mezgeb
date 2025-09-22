import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { searchParams } = new URL(req.url);
    const albumId = searchParams.get("albumId");
    if (!albumId) return NextResponse.json({ error: "Missing albumId" }, { status: 400 });
    const album = await prisma.album.findUnique({ where: { id: albumId } });
    if (!album) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const event = await prisma.event.findUnique({ where: { id: album.eventId } });
    if (!event || event.ownerId !== session.user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const media = await prisma.media.findMany({ where: { albumId: album.id }, orderBy: { createdAt: "desc" } });
    const safe = media.map((m) => ({
        ...m,
        // Serialize BigInt
        sizeBytes: m.sizeBytes ? m.sizeBytes.toString() : null,
    }));
    return NextResponse.json({ media: safe });
}

export async function GET_byId(req: NextRequest) {
    return GET(req);
}


