"use client";

import { useEffect, useState } from "react";
import Header from "@/components/header";

type Event = {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
};

export default function DashboardPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");

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
  }

  return (
    <main className="mx-auto max-w-3xl">
      <Header />
      <div className="p-6">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="mt-2 text-sm text-zinc-400">Create and manage your events.</p>

        <form onSubmit={createEvent} className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Event name" className="rounded bg-white/10 px-3 py-2 sm:col-span-1" required />
          <input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="slug" className="rounded bg-white/10 px-3 py-2 sm:col-span-1" required />
          <button className="rounded bg-white px-3 py-2 text-black sm:col-span-1">Create</button>
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
                <li key={e.id} className="flex items-center justify-between rounded border border-white/10 p-3">
                  <div>
                    <div className="font-medium">{e.name}</div>
                    <div className="text-xs text-zinc-400">/{e.slug}</div>
                  </div>
                  <div className="flex gap-2">
                    <a href={`/g/${e.slug}`} className="rounded bg-white/10 px-3 py-1 text-sm">Open gallery</a>
                    <a href={`/dashboard/q/${e.slug}`} className="rounded bg-white/10 px-3 py-1 text-sm">QR</a>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </main>
  );
}


