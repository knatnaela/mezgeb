import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import CaptureUploader from "./upload";

export default async function GalleryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const event = await prisma.event.findUnique({ where: { slug } });
  if (!event) return notFound();

  const media = await prisma.media.findMany({
    where: { eventId: event.id, status: "APPROVED" },
    orderBy: { createdAt: "desc" },
  });

  return (
    <main className="mx-auto max-w-5xl p-4">
      <h1 className="text-xl font-semibold">{event.name}</h1>
      <p className="text-zinc-400">Share your moments. Approved media below.</p>
      <CaptureUploader eventSlug={slug} />

      <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
        {media.map((m) => (
          <a key={m.id} href={m.webViewLink ?? `https://drive.google.com/file/d/${m.driveFileId}/view`} target="_blank" className="block rounded overflow-hidden bg-white/5">
            {/* Thumbnail via Drive link if available; fallback to filename */}
            <div className="aspect-square flex items-center justify-center text-xs text-zinc-300">
              {m.thumbnailLink ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.thumbnailLink} alt={m.fileName} className="w-full h-full object-cover" />
              ) : (
                <span className="p-2 line-clamp-2 text-center">{m.fileName}</span>
              )}
            </div>
          </a>
        ))}
      </div>
    </main>
  );
}


