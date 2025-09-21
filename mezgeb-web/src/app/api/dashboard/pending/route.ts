import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function GET() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const session = (await getServerSession(authOptions as any)) as any;
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const media = await prisma.media.findMany({
        where: { status: "PENDING", event: { ownerId: session.user.id } },
        orderBy: { createdAt: "desc" },
        select: { id: true, fileName: true, webViewLink: true, thumbnailLink: true },
    });

    return NextResponse.json({ media });
}


