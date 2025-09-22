import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import CaptureUploader from "@/app/g/[slug]/upload";
import AlbumGrid from "@/components/album-grid";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

const PAGE_SIZE = 40;

export default async function AlbumPage({ params, searchParams }: { params: Promise<{ slug: string; album: string }>; searchParams?: Promise<{ cursor?: string }> }) {
    const { slug, album } = await params;
    const { cursor } = (await (searchParams ?? Promise.resolve({}))) as { cursor?: string };

    const event = await prisma.event.findUnique({ where: { slug } });
    if (!event) return notFound();

    const albumRow = await prisma.album.findFirst({ where: { eventId: event.id, slug: album } });
    if (!albumRow) return notFound();

    const session = await getServerSession(authOptions as never);
    const isOwner = !!(session?.user?.id && event.ownerId === session.user.id);

    const media = await prisma.media.findMany({
        where: { eventId: event.id, albumId: albumRow.id, status: "APPROVED" },
        orderBy: { createdAt: "desc" },
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        take: PAGE_SIZE,
    });
    const nextCursor = media.length === PAGE_SIZE ? media[media.length - 1].id : null;

    const albumOptions = await prisma.album.findMany({ where: { eventId: event.id }, select: { slug: true, name: true } });

    return (
        <main className="mx-auto max-w-5xl p-4">
            <h1 className="text-xl font-semibold">{event.name} · {albumRow.name}</h1>
            <p className="text-zinc-400">Share your moments.</p>
            <CaptureUploader eventSlug={slug} albumSlug={album} albumOptions={albumOptions} />

            <AlbumGrid media={media} isOwner={isOwner} albumId={albumRow.id} />

            {nextCursor && (
                <div className="mt-4 flex justify-center">
                    <a href={`/g/${slug}/a/${album}?cursor=${nextCursor}`} className="rounded bg-white/10 px-3 py-2 text-sm">Load more</a>
                </div>
            )}
        </main>
    );
}


