import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const updateSchema = z.object({ name: z.string().min(1).max(100).optional(), slug: z.string().regex(/^[a-z0-9-]+$/).min(2).max(64).optional(), coverMediaId: z.string().optional() });

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;
    const json = await req.json();
    const parsed = updateSchema.safeParse(json);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const album = await prisma.album.findUnique({ where: { id } });
    if (!album) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const event = await prisma.event.findUnique({ where: { id: album.eventId } });
    if (!event || event.ownerId !== session.user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (parsed.data.slug) {
        const exists = await prisma.album.findFirst({ where: { eventId: event.id, slug: parsed.data.slug, NOT: { id } } });
        if (exists) return NextResponse.json({ error: "Album slug already in use" }, { status: 409 });
    }
    const updated = await prisma.album.update({ where: { id }, data: parsed.data });
    return NextResponse.json({ album: updated });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;
    const album = await prisma.album.findUnique({ where: { id } });
    if (!album) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const event = await prisma.event.findUnique({ where: { id: album.eventId } });
    if (!event || event.ownerId !== session.user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    await prisma.album.delete({ where: { id } });
    return NextResponse.json({ ok: true });
}


