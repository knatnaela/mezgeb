import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import CaptureUploader from "./upload";

export default async function GalleryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const event = await prisma.event.findUnique({ where: { slug } });
  if (!event) return notFound();

  // Ensure at least one default album exists
  const albums = await prisma.album.findMany({
    where: { eventId: event.id },
    orderBy: { createdAt: "asc" },
    include: {
      media: {
        where: { status: "APPROVED" },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      _count: { select: { media: true } },
    },
  });
  // If no albums exist, create a default one and reload
  if (albums.length === 0) {
    await prisma.album.create({ data: { eventId: event.id, name: "General", slug: "general", isDefault: true } });
    return GalleryPage({ params: Promise.resolve({ slug }) });
  }

  return (
    <main className="mx-auto max-w-5xl p-4">
      <h1 className="text-xl font-semibold">{event.name}</h1>
      <p className="text-zinc-400">Share your moments.</p>
      <CaptureUploader
        eventSlug={slug}
        albumOptions={albums.map((a) => ({ slug: a.slug, name: a.name }))}
      />

      <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 2xl:grid-cols-10">
        {albums.map((a) => (
          <a key={a.id} href={`/g/${slug}/a/${a.slug}`} className="block rounded overflow-hidden bg-white/5">
            <div className="relative aspect-square bg-white/5 flex items-center justify-center text-xs text-zinc-300">
              {a.media[0]?.thumbnailLink ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={a.media[0].thumbnailLink!} alt={a.name} className="w-full h-full object-cover" />
              ) : (
                <span className="p-2 text-center">{a.name}</span>
              )}
              {a.coverMediaId && (
                <span className="absolute top-2 left-2 rounded bg-white/80 text-black text-[10px] px-2 py-0.5">Cover</span>
              )}
            </div>
            <div className="p-2">
              <div className="text-sm font-medium line-clamp-1">{a.name}</div>
              <div className="text-xs text-zinc-400">{a._count.media} items</div>
            </div>
          </a>
        ))}
      </div>
    </main>
  );
}


