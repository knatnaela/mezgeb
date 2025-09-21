"use client";

import Link from "next/link";
import { signIn, signOut, useSession } from "next-auth/react";

export default function Header() {
    const { status } = useSession();
    const authed = status === "authenticated";
    return (
        <header className="flex items-center justify-between px-4 py-3 border-b border-white/10">
            <Link href="/" className="font-semibold">Mezgeb</Link>
            <nav className="flex items-center gap-3 text-sm">
                <Link href="/dashboard" className="text-zinc-300 hover:text-white">Dashboard</Link>
                {authed ? (
                    <button onClick={() => signOut()} className="rounded bg-white/10 px-3 py-1">Sign out</button>
                ) : (
                    <button onClick={() => signIn("google")} className="rounded bg-white/10 px-3 py-1">Sign in</button>
                )}
            </nav>
        </header>
    );
}


