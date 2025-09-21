import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getServerSession } from "next-auth/next";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { ensureEventDriveFolders } from "@/lib/google";

const createEventSchema = z.object({
  name: z.string().min(2).max(100),
  slug: z.string().regex(/^[a-z0-9-]+$/).min(2).max(64),
  description: z.string().max(1000).optional(),
  accentColor: z.string().regex(/^#?[0-9a-fA-F]{6}$/).optional(),
  date: z.string().datetime().optional(),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const json = await req.json();
  const parsed = createEventSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const exists = await prisma.event.findUnique({ where: { slug: parsed.data.slug } });
  if (exists) return NextResponse.json({ error: "Slug already in use" }, { status: 409 });

  const event = await prisma.event.create({
    data: {
      ownerId: session.user.id,
      name: parsed.data.name,
      slug: parsed.data.slug,
      description: parsed.data.description,
      accentColor: parsed.data.accentColor,
      date: parsed.data.date ? new Date(parsed.data.date) : null,
    },
  });

  // Provision Google Drive folders (best-effort)
  try {
    const folders = await ensureEventDriveFolders({
      userId: session.user.id,
      eventName: event.name,
      slug: event.slug,
    });
    if (folders) {
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
  } catch (err) {
    console.error("Drive provisioning failed", err);
  }

  const updated = await prisma.event.findUnique({ where: { id: event.id } });
  return NextResponse.json({ event: updated ?? event });
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const events = await prisma.event.findMany({
    where: { ownerId: session.user.id },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ events });
}


