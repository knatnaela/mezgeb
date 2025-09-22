"use client";

import { useEffect, useMemo, useState } from "react";
import Header from "@/components/header";
import { useToast } from "@/components/toast";
import { useParams } from "next/navigation";

type Media = {
    id: string;
    fileName: string;
    thumbnailLink: string | null;
    webViewLink: string | null;
};

export default function ManageAlbumPage() {
    const p = useParams() as { id: string };
    const id = p.id;
    const [album, setAlbum] = useState<{ id: string; name: string; slug: string; eventSlug: string } | null>(null);
    const [media, setMedia] = useState<Media[]>([]);
    const [albums, setAlbums] = useState<{ id: string; name: string }[]>([]);
    const [loading, setLoading] = useState(true);
    const { addToast } = useToast();

    useEffect(() => {
        (async () => {
            // Fetch album details and its event slug
            const resAlbums = await fetch(`/api/albums/by-id?id=${encodeURIComponent(id)}`);
            if (resAlbums.ok) {
                const d = await resAlbums.json();
                setAlbum(d.album);
                setAlbums(d.albums);
            }
            // Fetch media for album
            const resMedia = await fetch(`/api/media?albumId=${encodeURIComponent(id)}`);
            if (resMedia.ok) {
                const d = await resMedia.json();
                setMedia(d.media);
            }
            setLoading(false);
        })();
    }, [id]);

    const otherAlbums = useMemo(() => albums.filter((a) => a.id !== id), [albums, id]);

    async function setCover(mediaId: string) {
        const res = await fetch(`/api/albums/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ coverMediaId: mediaId }) });
        addToast({ message: res.ok ? "Cover updated" : "Failed to update cover", type: res.ok ? "success" : "error" });
    }

    async function moveTo(mediaId: string, targetAlbumId: string) {
        const res = await fetch(`/api/media/move`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mediaId, targetAlbumId }) });
        addToast({ message: res.ok ? "Moved" : "Move failed", type: res.ok ? "success" : "error" });
        // refresh list
        const resMedia = await fetch(`/api/media?albumId=${encodeURIComponent(id)}`);
        if (resMedia.ok) {
            const d = await resMedia.json();
            setMedia(d.media);
        }
    }

    return (
        <main className="mx-auto max-w-5xl">
            <Header />
            <div className="p-6">
                <h1 className="text-2xl font-semibold">Manage album</h1>
                {loading ? (
                    <p className="text-zinc-400">Loading…</p>
                ) : !album ? (
                    <p className="text-zinc-400">Album not found.</p>
                ) : (
                    <>
                        <div className="text-zinc-300">{album.name}</div>
                        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                            {media.map((m) => (
                                <div key={m.id} className="rounded overflow-hidden bg-white/5">
                                    <a href={m.webViewLink ?? `https://drive.google.com/file/d/${m.id}/view`} target="_blank">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img src={m.thumbnailLink ?? ""} alt={m.fileName} className="w-full h-full object-cover aspect-square" />
                                    </a>
                                    <div className="p-2 flex items-center justify-between gap-2">
                                        <button className="rounded bg-white/10 px-2 py-1 text-xs" onClick={() => setCover(m.id)}>Set as cover</button>
                                        {otherAlbums.length > 0 && (
                                            <select className="bg-white/10 text-xs rounded px-2 py-1" onChange={(e) => e.target.value && moveTo(m.id, e.target.value)} defaultValue="">
                                                <option value="" disabled>Move to…</option>
                                                {otherAlbums.map((a) => (
                                                    <option key={a.id} value={a.id}>{a.name}</option>
                                                ))}
                                            </select>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>
        </main>
    );
}


