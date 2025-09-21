import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";

export default async function QrPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;
    const event = await prisma.event.findUnique({ where: { slug } });
    if (!event) return notFound();
    const base = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "";
    const galleryUrl = `${base}/g/${event.slug}`;

    const svgUrl = `/api/qr?slug=${encodeURIComponent(event.slug)}&format=svg`;
    const pngUrl = `/api/qr?slug=${encodeURIComponent(event.slug)}&format=png`;

    return (
        <main className="mx-auto max-w-3xl p-6">
            <h1 className="text-2xl font-semibold">QR for {event.name}</h1>
            <p className="text-zinc-400 text-sm">Share this QR with guests to open the gallery.</p>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <div className="rounded border border-white/10 p-4">
                    <div className="text-sm text-zinc-400">Gallery URL</div>
                    <div className="mt-1 break-all">{galleryUrl}</div>
                </div>
                <div className="rounded border border-white/10 p-4">
                    <div className="text-sm text-zinc-400">Downloads</div>
                    <div className="mt-2 flex gap-3">
                        <a className="rounded bg-white/10 px-3 py-2" href={svgUrl} download>Download SVG</a>
                        <a className="rounded bg-white/10 px-3 py-2" href={pngUrl} download>Download PNG</a>
                    </div>
                </div>
            </div>

            <div className="mt-8 flex items-center justify-center rounded border border-white/10 p-6 bg-white">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={svgUrl} alt="QR" className="h-56 w-56" />
            </div>

            <div className="mt-6">
                <Link href="/dashboard" className="rounded bg-white/10 px-3 py-2">Back to dashboard</Link>
            </div>
        </main>
    );
}


