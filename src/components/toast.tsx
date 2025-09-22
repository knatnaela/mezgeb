"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

type Toast = { id: string; message: string; type?: "success" | "error" | "info" };

const ToastContext = createContext<{ addToast: (t: Omit<Toast, "id">) => void } | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const addToast = useCallback((t: Omit<Toast, "id">) => {
        const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
        const toast: Toast = { id, ...t };
        setToasts((prev) => [...prev, toast]);
        setTimeout(() => {
            setToasts((prev) => prev.filter((x) => x.id !== id));
        }, 3000);
    }, []);

    const value = useMemo(() => ({ addToast }), [addToast]);

    return (
        <ToastContext.Provider value={value}>
            {children}
            <div className="fixed top-4 right-4 z-50 space-y-2">
                {toasts.map((t) => (
                    <div key={t.id} className={`rounded px-3 py-2 text-sm shadow-md ${t.type === "error" ? "bg-red-600" : t.type === "success" ? "bg-emerald-600" : "bg-white/10"}`}>
                        {t.message}
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
}

export function useToast() {
    const ctx = useContext(ToastContext);
    if (!ctx) throw new Error("useToast must be used within ToastProvider");
    return ctx;
}


