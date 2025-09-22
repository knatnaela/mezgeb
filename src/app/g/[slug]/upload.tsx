"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/toast";

type UploadStatus = "queued" | "uploading" | "done" | "error" | "cancelled";
type UploadItem = {
    id: string;
    fileName: string;
    mimeType: string;
    previewUrl: string | null;
    progress: number;
    status: UploadStatus;
    error?: string;
    xhr?: XMLHttpRequest | null;
    file: File;
};

function CircleProgress({ value }: { value: number }) {
    const radius = 16;
    const circumference = 2 * Math.PI * radius;
    const clamped = Math.max(0, Math.min(100, value));
    const offset = circumference - (clamped / 100) * circumference;
    return (
        <svg width="40" height="40" viewBox="0 0 40 40" className="text-zinc-500">
            <circle cx="20" cy="20" r={radius} stroke="currentColor" strokeWidth="4" fill="none" className="opacity-30" />
            <circle
                cx="20"
                cy="20"
                r={radius}
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                className="text-white transition-[stroke-dashoffset] duration-200 ease-linear"
            />
        </svg>
    );
}

export default function CaptureUploader({ eventSlug, albumSlug, albumOptions }: { eventSlug: string; albumSlug?: string; albumOptions?: { slug: string; name: string }[] }) {
    const inputRef = useRef<HTMLInputElement | null>(null);
    const router = useRouter();
    const [uploads, setUploads] = useState<UploadItem[]>([]);
    const deviceFpRef = useRef<string | null>(null);
    const [selectedAlbum, setSelectedAlbum] = useState<string | undefined>(albumSlug);
    const MAX_CONCURRENT = 3;
    const { addToast } = useToast();

    useEffect(() => {
        return () => {
            uploads.forEach((u) => u.previewUrl && URL.revokeObjectURL(u.previewUrl));
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    async function getFingerprint(): Promise<string | null> {
        if (deviceFpRef.current) return deviceFpRef.current;
        try {
            const fp = [
                navigator.userAgent,
                navigator.language,
                String(screen.width),
                String(screen.height),
                String(screen.colorDepth),
                Intl.DateTimeFormat().resolvedOptions().timeZone || "",
            ].join("|");
            const enc = new TextEncoder();
            const data = enc.encode(fp);
            const digest = await crypto.subtle.digest("SHA-256", data);
            const hashArray = Array.from(new Uint8Array(digest));
            const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
            deviceFpRef.current = hashHex;
            return hashHex;
        } catch {
            return null;
        }
    }

    function beginUpload(itemId: string) {
        if (!selectedAlbum) {
            addToast({ message: "Please choose an album first", type: "error" });
            return;
        }
        setUploads((arr) => {
            const item = arr.find((u) => u.id === itemId);
            if (!item || item.status !== "queued") return arr;
            const form = new FormData();
            form.append("file", item.file);
            form.append("slug", eventSlug);
            form.append("album", selectedAlbum);
            form.append("slug", eventSlug);
            if (selectedAlbum) form.append("album", selectedAlbum);
            const xhr = new XMLHttpRequest();
            xhr.open("POST", "/api/uploads");
            xhr.upload.onprogress = (e) => {
                if (e.lengthComputable) {
                    const pct = Math.round((e.loaded / e.total) * 100);
                    setUploads((a) => a.map((it) => (it.id === itemId ? { ...it, progress: pct } : it)));
                }
            };
            xhr.onload = () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    setUploads((a) => {
                        const it = a.find((x) => x.id === itemId);
                        if (it?.previewUrl) URL.revokeObjectURL(it.previewUrl);
                        return a.filter((x) => x.id !== itemId);
                    });
                    addToast({ message: "Uploaded", type: "success" });
                    router.refresh();
                } else {
                    const msg = (() => {
                        try {
                            const j = JSON.parse(xhr.responseText);
                            return j?.error || `Upload failed (${xhr.status})`;
                        } catch {
                            return `Upload failed (${xhr.status})`;
                        }
                    })();
                    setUploads((a) => a.map((it) => (it.id === itemId ? { ...it, status: "error" as UploadStatus, error: msg, xhr: null } : it)));
                    addToast({ message: msg, type: "error" });
                }
                maybeStartNext();
            };
            xhr.onerror = () => {
                setUploads((a) => a.map((it) => (it.id === itemId ? { ...it, status: "error" as UploadStatus, error: "Network error", xhr: null } : it)));
                addToast({ message: "Network error", type: "error" });
                maybeStartNext();
            };
            xhr.onabort = () => {
                setUploads((a) => a.map((it) => (it.id === itemId ? { ...it, status: "cancelled" as UploadStatus, xhr: null } : it)));
                maybeStartNext();
            };
            const next = arr.map((u) => (u.id === itemId ? { ...u, status: "uploading" as UploadStatus, xhr } : u));
            getFingerprint().then((fp) => {
                if (fp) form.append("fingerprint", fp);
                try {
                    xhr.send(form);
                } catch {
                    setUploads((a) => a.map((it) => (it.id === itemId ? { ...it, status: "error" as UploadStatus, error: "Failed to start upload", xhr: null } : it)));
                    maybeStartNext();
                }
            });
            return next;
        });
    }

    function maybeStartNext() {
        setUploads((arr) => {
            const uploadingCount = arr.filter((u) => u.status === "uploading").length;
            if (uploadingCount >= MAX_CONCURRENT) return arr;
            const available = MAX_CONCURRENT - uploadingCount;
            const queued = arr.filter((u) => u.status === "queued").slice(0, available);
            queued.forEach((u) => beginUpload(u.id));
            return arr;
        });
    }

    function enqueueFile(file: File) {
        if (!selectedAlbum) {
            addToast({ message: "Please choose an album first", type: "error" });
            return;
        }
        const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
        const previewUrl = file.type.startsWith("image/") ? URL.createObjectURL(file) : null;
        const item: UploadItem = {
            id,
            fileName: file.name,
            mimeType: file.type || "application/octet-stream",
            previewUrl,
            progress: 0,
            status: "queued",
            xhr: null,
            file,
        };
        setUploads((u) => [item, ...u]);
        // Attempt to start if there is capacity
        setTimeout(maybeStartNext, 0);
    }

    function cancelUpload(id: string) {
        setUploads((arr) => {
            const it = arr.find((x) => x.id === id);
            if (it?.xhr) {
                try { it.xhr.abort(); } catch { }
            }
            const next = arr.map((x) => (x.id === id ? { ...x, status: "cancelled" as UploadStatus, xhr: null } : x));
            setTimeout(maybeStartNext, 0);
            return next;
        });
    }

    return (
        <div className="mt-4 space-y-2">
            <input
                ref={inputRef}
                type="file"
                accept="image/*,video/*"
                capture="environment"
                multiple
                hidden
                onChange={(e) => {
                    const files = e.target.files ? Array.from(e.target.files) : [];
                    if (files.length > 0) files.forEach((f) => enqueueFile(f));
                }}
            />
            <div className="flex flex-wrap items-center gap-2">
                {albumOptions && albumOptions.length > 0 && (
                    <select
                        className="rounded bg-white/10 px-3 py-2 text-sm"
                        value={selectedAlbum ?? ""}
                        onChange={(e) => setSelectedAlbum(e.target.value || undefined)}
                    >
                        <option value="">Choose album…</option>
                        {albumOptions.map((o) => (
                            <option key={o.slug} value={o.slug}>{o.name}</option>
                        ))}
                    </select>
                )}
                <button
                    className={`rounded px-3 py-2 ${selectedAlbum ? "bg-white/10 cursor-pointer" : "bg-white/5 opacity-60 cursor-not-allowed"}`}
                    onClick={() => selectedAlbum && inputRef.current?.click()}
                    disabled={!selectedAlbum}
                >
                    Camera or Library
                </button>
                {!selectedAlbum && (
                    <span className="text-xs text-zinc-400">Choose an album to enable upload</span>
                )}
            </div>

            {uploads.length > 0 && (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 2xl:grid-cols-10 mt-3">
                    {uploads.map((u) => (
                        <div key={u.id} className="relative rounded overflow-hidden bg-white/5">
                            {u.previewUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={u.previewUrl} alt={u.fileName} className="w-full h-full object-cover aspect-square" />
                            ) : (
                                <div className="aspect-square flex items-center justify-center text-xs text-zinc-300 p-2 text-center">
                                    {u.fileName}
                                </div>
                            )}
                            {(u.status === "uploading" || u.status === "queued") && (
                                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                    <div className="flex items-center gap-2">
                                        <CircleProgress value={u.progress} />
                                        <span className="text-sm">{u.progress}%</span>
                                        <button
                                            className="ml-2 rounded bg-white/20 px-2 py-1 text-xs"
                                            onClick={() => cancelUpload(u.id)}
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            )}
                            {u.status === "error" && (
                                <div className="absolute inset-x-0 bottom-0 bg-red-600/80 text-white text-xs p-1 text-center">
                                    {u.error || "Upload failed"}
                                </div>
                            )}
                            {u.status === "cancelled" && (
                                <div className="absolute inset-x-0 bottom-0 bg-zinc-700/80 text-white text-xs p-1 text-center">
                                    Cancelled
                                </div>
                            )}
                            {u.status === "done" && (
                                <div className="absolute inset-x-0 bottom-0 bg-emerald-600/80 text-white text-xs p-1 text-center">
                                    Uploaded
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
