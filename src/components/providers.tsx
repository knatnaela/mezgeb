"use client";

import { SessionProvider } from "next-auth/react";
import type { ReactNode } from "react";

type SessionLike = {
    user?: { id: string; name?: string | null; email?: string | null; image?: string | null } | null;
    expires?: string;
} | null;

export default function Providers({ children, session }: { children: ReactNode; session?: SessionLike }) {
    return <SessionProvider session={session as unknown as never}>{children}</SessionProvider>;
}


