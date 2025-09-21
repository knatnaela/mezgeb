"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

export default function CaptureUploader({ eventSlug }: { eventSlug: string }) {
    const inputRef = useRef<HTMLInputElement | null>(null);
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState(0);
    const router = useRouter();

    async function onPick(file: File) {
        setUploading(true);
        setProgress(0);

        const form = new FormData();
        form.append("file", file);
        form.append("slug", eventSlug);

        const xhr = new XMLHttpRequest();
        xhr.open("POST", "/api/uploads");
        xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
        };
        await new Promise<void>((resolve) => {
            xhr.onload = () => resolve();
            xhr.send(form);
        });

        setUploading(false);
        // Refresh page content to show the newly uploaded item immediately
        router.refresh();
    }

    return (
        <div className="mt-4 space-y-2">
            <input
                ref={inputRef}
                type="file"
                accept="image/*,video/*"
                capture="environment"
                hidden
                onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) onPick(f);
                }}
            />
            <div className="flex gap-2">
                <button className="rounded bg-white/10 px-3 py-2" onClick={() => inputRef.current?.click()}>
                    Camera or Library
                </button>
            </div>
            {uploading && (
                <div className="text-sm text-zinc-300">Uploading… {progress}%</div>
            )}
        </div>
    );
}
