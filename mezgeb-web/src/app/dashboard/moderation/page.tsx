"use client";

import Header from "@/components/header";

export default function ModerationPage() {
    return (
        <main className="mx-auto max-w-5xl">
            <Header />
            <div className="p-6">
                <h1 className="text-2xl font-semibold">Moderation</h1>
                <p className="text-zinc-400">Moderation is disabled. Uploads are auto-approved.</p>
            </div>
        </main>
    );
}


