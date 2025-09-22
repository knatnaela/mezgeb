import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
    const album = await prisma.album.findUnique({ where: { id }, include: { event: true } });
    if (!album || album.event.ownerId !== session.user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const albums = await prisma.album.findMany({ where: { eventId: album.eventId }, select: { id: true, name: true } });
    return NextResponse.json({ album: { id: album.id, name: album.name, slug: album.slug, eventSlug: album.event.slug }, albums });
}


