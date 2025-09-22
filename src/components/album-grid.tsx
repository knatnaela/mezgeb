"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useToast } from "@/components/toast";

export type AlbumMedia = {
    id: string;
    fileName: string;
    thumbnailLink: string | null;
    webViewLink: string | null;
    driveFileId: string;
    mimeType: string | null;
};

export default function AlbumGrid({ media, isOwner = false, albumId }: { media: AlbumMedia[]; isOwner?: boolean; albumId?: string }) {
    const [openIdx, setOpenIdx] = useState<number | null>(null);
    const [scale, setScale] = useState(1);
    const [tx, setTx] = useState(0);
    const [ty, setTy] = useState(0);
    const [isPanning, setIsPanning] = useState(false);
    const [lastX, setLastX] = useState(0);
    const [lastY, setLastY] = useState(0);
    const [lastPinchDist, setLastPinchDist] = useState<number | null>(null);
    const [touchStartX, setTouchStartX] = useState<number | null>(null);
    const [touchStartY, setTouchStartY] = useState<number | null>(null);

    const open = useCallback((idx: number) => setOpenIdx(idx), []);
    const close = useCallback(() => setOpenIdx(null), []);
    const prev = useCallback(() => setOpenIdx((i) => (i == null ? i : Math.max(0, i - 1))), []);
    const next = useCallback(() => setOpenIdx((i) => (i == null ? i : Math.min(media.length - 1, i + 1))), [media.length]);
    const resetView = useCallback(() => { setScale(1); setTx(0); setTy(0); }, []);

    useEffect(() => {
        function onKey(e: KeyboardEvent) {
            if (openIdx == null) return;
            if (e.key === "Escape") close();
            else if (e.key === "ArrowLeft") prev();
            else if (e.key === "ArrowRight") next();
        }
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [openIdx, close, prev, next]);

    const current = openIdx != null ? media[openIdx] : null;
    const { addToast } = useToast();
    const [settingCover, setSettingCover] = useState(false);

    function onWheel(e: React.WheelEvent) {
        if (!current) return;
        if (!e.ctrlKey && Math.abs(e.deltaY) < 10) return;
        e.preventDefault();
        const delta = -e.deltaY * 0.001;
        setScale((s) => Math.min(4, Math.max(1, s + delta)));
    }

    function onMouseDown(e: React.MouseEvent) {
        if (scale === 1) return;
        setIsPanning(true);
        setLastX(e.clientX);
        setLastY(e.clientY);
    }
    function onMouseMove(e: React.MouseEvent) {
        if (!isPanning) return;
        const dx = e.clientX - lastX;
        const dy = e.clientY - lastY;
        setLastX(e.clientX);
        setLastY(e.clientY);
        setTx((v) => v + dx);
        setTy((v) => v + dy);
    }
    function onMouseUp() {
        setIsPanning(false);
    }

    function distance(a: { clientX: number; clientY: number }, b: { clientX: number; clientY: number }) {
        const dx = a.clientX - b.clientX;
        const dy = a.clientY - b.clientY;
        return Math.hypot(dx, dy);
    }

    function onTouchStart(e: React.TouchEvent) {
        if (!current) return;
        if (e.touches.length === 1) {
            setTouchStartX(e.touches[0].clientX);
            setTouchStartY(e.touches[0].clientY);
            if (scale > 1) {
                setIsPanning(true);
                setLastX(e.touches[0].clientX);
                setLastY(e.touches[0].clientY);
            }
        } else if (e.touches.length === 2) {
            setLastPinchDist(distance(e.touches[0], e.touches[1]));
        }
    }
    function onTouchMove(e: React.TouchEvent) {
        if (e.touches.length === 2) {
            const d = distance(e.touches[0], e.touches[1]);
            if (lastPinchDist != null) {
                const delta = (d - lastPinchDist) / 200;
                setScale((s) => Math.min(4, Math.max(1, s + delta)));
            }
            setLastPinchDist(d);
        } else if (e.touches.length === 1) {
            const t = e.touches[0];
            if (scale > 1 && isPanning) {
                const dx = t.clientX - lastX;
                const dy = t.clientY - lastY;
                setLastX(t.clientX);
                setLastY(t.clientY);
                setTx((v) => v + dx);
                setTy((v) => v + dy);
            }
        }
    }
    function onTouchEnd(e: React.TouchEvent) {
        if (e.touches.length === 0) {
            setIsPanning(false);
            setLastPinchDist(null);
            // swipe to navigate when not zoomed
            if (scale === 1 && touchStartX != null && touchStartY != null) {
                const changed = e.changedTouches[0];
                const dx = changed.clientX - touchStartX;
                const dy = changed.clientY - touchStartY;
                if (Math.abs(dx) > 50 && Math.abs(dy) < 60) {
                    if (dx < 0) next(); else prev();
                }
            }
            setTouchStartX(null);
            setTouchStartY(null);
        }
    }

    function onDoubleClick() {
        setScale((s) => (s === 1 ? 2 : 1));
        if (scale !== 1) { setTx(0); setTy(0); }
    }

    return (
        <>
            <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 2xl:grid-cols-10">
                {media.map((m, idx) => (
                    <button key={m.id} className="block rounded overflow-hidden bg-white/5 text-left" onClick={() => open(idx)}>
                        <div className="aspect-square flex items-center justify-center text-xs text-zinc-300">
                            {m.thumbnailLink ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={m.thumbnailLink} alt={m.fileName} className="w-full h-full object-cover" />
                            ) : (
                                <span className="p-2 line-clamp-2 text-center">{m.fileName}</span>
                            )}
                        </div>
                    </button>
                ))}
            </div>

            {current && (
                <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={close}>
                    <div
                        className="relative max-w-6xl w-full select-none"
                        onClick={(e) => e.stopPropagation()}
                        onWheel={onWheel}
                        onMouseDown={onMouseDown}
                        onMouseMove={onMouseMove}
                        onMouseUp={onMouseUp}
                        onMouseLeave={onMouseUp}
                        onTouchStart={onTouchStart}
                        onTouchMove={onTouchMove}
                        onTouchEnd={onTouchEnd}
                        onDoubleClick={onDoubleClick}
                    >
                        <div className="absolute top-2 right-2 flex gap-2">
                            <button className="rounded bg-white/10 px-3 py-2" onClick={close}>Close</button>
                            {current.webViewLink && (
                                <a className="rounded bg-white/10 px-3 py-2" href={current.webViewLink} target="_blank">Open</a>
                            )}
                            <button className="rounded bg-white/10 px-3 py-2" onClick={resetView}>Reset</button>
                            {isOwner && albumId && (
                                <button
                                    className="rounded bg-white/10 px-3 py-2 disabled:opacity-50"
                                    disabled={settingCover}
                                    onClick={async () => {
                                        try {
                                            setSettingCover(true);
                                            const res = await fetch(`/api/albums/${albumId}`, {
                                                method: "PATCH",
                                                headers: { "Content-Type": "application/json" },
                                                body: JSON.stringify({ coverMediaId: current.id }),
                                            });
                                            addToast({ message: res.ok ? "Cover set" : "Failed to set cover", type: res.ok ? "success" : "error" });
                                        } catch {
                                            addToast({ message: "Failed to set cover", type: "error" });
                                        } finally {
                                            setSettingCover(false);
                                        }
                                    }}
                                >
                                    Set as cover
                                </button>
                            )}
                            <button
                                className="rounded bg-white/10 px-3 py-2"
                                onClick={() => {
                                    const link = current.webViewLink ?? `https://drive.google.com/file/d/${current.driveFileId}/view`;
                                    navigator.clipboard.writeText(link).then(() => addToast({ message: "Link copied", type: "success" })).catch(() => addToast({ message: "Copy failed", type: "error" }));
                                }}
                            >
                                Copy link
                            </button>
                            <a
                                className="rounded bg-white/10 px-3 py-2"
                                href={`https://drive.google.com/uc?export=download&id=${current.driveFileId}`}
                            >
                                Download
                            </a>
                        </div>
                        <div className="flex items-center justify-center">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={current.thumbnailLink ?? `https://drive.google.com/thumbnail?authuser=0&sz=w1000&id=${current.driveFileId}`}
                                alt={current.fileName}
                                className="max-h-[80vh] w-auto object-contain"
                                style={{ transform: `translate(${tx}px, ${ty}px) scale(${scale})`, transition: isPanning ? "none" : "transform 0.05s linear" }}
                                draggable={false}
                            />
                        </div>
                        <div className="absolute inset-y-0 left-0 flex items-center">
                            <button className="rounded bg-white/10 px-2 py-2 ml-2" onClick={prev} disabled={openIdx === 0}>‹</button>
                        </div>
                        <div className="absolute inset-y-0 right-0 flex items-center">
                            <button className="rounded bg-white/10 px-2 py-2 mr-2" onClick={next} disabled={openIdx === media.length - 1}>›</button>
                        </div>
                        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-xs text-zinc-300 bg-black/40 px-2 py-1 rounded">
                            {current.fileName}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}


