"use client";

import { useEffect, useState } from "react";
import Header from "@/components/header";
import { useToast } from "@/components/toast";

type Event = {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
};

type Album = {
  id: string;
  name: string;
  slug: string;
  _count?: { media: number };
  media?: { thumbnailLink: string | null }[];
};

export default function DashboardPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");

  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [albumName, setAlbumName] = useState("");
  const [albumSlug, setAlbumSlug] = useState("");
  const [albumsLoading, setAlbumsLoading] = useState(false);
  const { addToast } = useToast();
  const [creatingEvent, setCreatingEvent] = useState(false);
  const [creatingAlbum, setCreatingAlbum] = useState(false);
  const [deletingAlbumId, setDeletingAlbumId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/events");
      if (res.ok) {
        const data = await res.json();
        setEvents(data.events);
      }
      setLoading(false);
    })();
  }, []);

  async function createEvent(e: React.FormEvent) {
    e.preventDefault();
    setCreatingEvent(true);
    const res = await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, slug }),
    });
    if (res.ok) {
      const data = await res.json();
      setEvents((prev) => [data.event, ...prev]);
      setName("");
      setSlug("");
    }
    setCreatingEvent(false);
  }

  async function loadAlbums(ev: Event) {
    setSelectedEvent(ev);
    setAlbumsLoading(true);
    const res = await fetch(`/api/albums?eventSlug=${encodeURIComponent(ev.slug)}`, { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      setAlbums(data.albums);
    }
    setAlbumsLoading(false);
  }

  async function createAlbum(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedEvent) return;
    // optimistic: add temp album
    const tempId = `temp-${Date.now()}`;
    const optimistic = { id: tempId, name: albumName, slug: albumSlug, _count: { media: 0 }, media: [] } as Album;
    setAlbums((prev) => [optimistic, ...prev]);
    setCreatingAlbum(true);
    const res = await fetch("/api/albums", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventSlug: selectedEvent.slug, name: albumName, slug: albumSlug }),
    });
    if (res.ok) {
      setAlbumName("");
      setAlbumSlug("");
      addToast({ message: "Album created", type: "success" });
      // replace optimistic
      const data = await res.json();
      setAlbums((prev) => {
        const next = prev.filter((a) => a.id !== tempId);
        next.unshift({ ...data.album, _count: { media: 0 }, media: [] });
        return next;
      });
    } else {
      addToast({ message: "Failed to create album", type: "error" });
      // rollback
      setAlbums((prev) => prev.filter((a) => a.id !== tempId));
    }
    setCreatingAlbum(false);
  }

  async function renameAlbum(id: string, newName: string) {
    // optimistic
    setAlbums((prev) => prev.map((a) => (a.id === id ? { ...a, name: newName } : a)));
    const res = await fetch(`/api/albums/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName }),
    });
    if (res.ok) {
      addToast({ message: "Album renamed", type: "success" });
    } else {
      addToast({ message: "Rename failed", type: "error" });
      // reload to restore from server
      if (selectedEvent) await loadAlbums(selectedEvent);
    }
  }

  async function deleteAlbum(id: string) {
    if (!confirm("Delete this album?")) return;
    // optimistic remove
    const prev = albums;
    setAlbums((cur) => cur.filter((a) => a.id !== id));
    setDeletingAlbumId(id);
    const res = await fetch(`/api/albums/${id}`, { method: "DELETE" });
    if (res.ok) {
      addToast({ message: "Album deleted", type: "success" });
    } else {
      addToast({ message: "Delete failed", type: "error" });
      // rollback
      setAlbums(prev);
    }
    setDeletingAlbumId(null);
  }

  return (
    <main className="mx-auto max-w-5xl">
      <Header />
      <div className="p-6">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="mt-2 text-sm text-zinc-400">Create and manage your events and albums.</p>

        <form onSubmit={createEvent} className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Event name" className="rounded bg-white/10 px-3 py-2 sm:col-span-1" required />
          <input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="slug" className="rounded bg-white/10 px-3 py-2 sm:col-span-1" required />
          <button className={`rounded bg-white px-3 py-2 text-black sm:col-span-1 ${creatingEvent ? "cursor-wait opacity-70" : "cursor-pointer"}`} disabled={creatingEvent}>
            {creatingEvent ? "Creating…" : "Create"}
          </button>
        </form>

        <div className="mt-8">
          <h2 className="font-medium">Your events</h2>
          {loading ? (
            <p className="text-zinc-400">Loading...</p>
          ) : events.length === 0 ? (
            <p className="text-zinc-400">No events yet.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {events.map((e) => (
                <li key={e.id} className="rounded border border-white/10 p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{e.name}</div>
                      <div className="text-xs text-zinc-400">/{e.slug}</div>
                    </div>
                    <div className="flex gap-2">
                      <a href={`/g/${e.slug}`} className="rounded bg-white/10 px-3 py-1 text-sm">Open gallery</a>
                      <a href={`/dashboard/q/${e.slug}`} className="rounded bg-white/10 px-3 py-1 text-sm">QR</a>
                      <button className="rounded bg-white px-3 py-1 text-black text-sm" onClick={() => loadAlbums(e)}>Manage albums</button>
                    </div>
                  </div>

                  {selectedEvent?.id === e.id && (
                    <div className="mt-4 rounded bg-white/5 p-3">
                      <div className="flex items-center justify-between">
                        <h3 className="font-medium">Albums</h3>
                        <form onSubmit={createAlbum} className="flex gap-2">
                          <input value={albumName} onChange={(ev) => setAlbumName(ev.target.value)} placeholder="Album name" className="rounded bg-white/10 px-3 py-1 text-sm" required />
                          <input value={albumSlug} onChange={(ev) => setAlbumSlug(ev.target.value)} placeholder="slug" className="rounded bg-white/10 px-3 py-1 text-sm" required />
                          <button className={`rounded bg-white px-3 py-1 text-black text-sm ${creatingAlbum ? "cursor-wait opacity-70" : "cursor-pointer"}`} disabled={creatingAlbum}>
                            {creatingAlbum ? "Adding…" : "Add"}
                          </button>
                        </form>
                      </div>
                      {albumsLoading ? (
                        <p className="text-zinc-400 mt-2">Loading albums…</p>
                      ) : albums.length === 0 ? (
                        <p className="text-zinc-400 mt-2">No albums.</p>
                      ) : (
                        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                          {albums.map((a) => (
                            <div key={a.id} className="rounded overflow-hidden border border-white/10">
                              <div className="aspect-square bg-white/5 flex items-center justify-center text-xs text-zinc-300">
                                {a.media?.[0]?.thumbnailLink ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={a.media[0].thumbnailLink!} alt={a.name} className="w-full h-full object-cover" />
                                ) : (
                                  <span className="p-2 text-center">{a.name}</span>
                                )}
                              </div>
                              <div className="p-2">
                                <div className="flex items-center justify-between">
                                  <input defaultValue={a.name} className="w-2/3 bg-transparent outline-none" onBlur={(ev) => renameAlbum(a.id, ev.target.value)} />
                                  <div className="text-xs text-zinc-400">{a._count?.media ?? 0} items</div>
                                </div>
                                <div className="mt-2 flex gap-2">
                                  <a href={`/g/${selectedEvent?.slug}/a/${a.slug}`} className="rounded bg-white/10 px-2 py-1 text-xs cursor-pointer">Open</a>
                                  <a href={`/dashboard/a/${a.id}`} className="rounded bg-white/10 px-2 py-1 text-xs cursor-pointer">Manage media</a>
                                  <button onClick={() => deleteAlbum(a.id)} className={`rounded bg-red-500/80 px-2 py-1 text-xs ${deletingAlbumId === a.id ? "cursor-wait opacity-70" : "cursor-pointer"}`} disabled={deletingAlbumId === a.id}>
                                    {deletingAlbumId === a.id ? "Deleting…" : "Delete"}
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </main>
  );
}


