import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { driveFromClient, getOAuthClientForUser } from "@/lib/google";
import { Readable as NodeReadable } from "node:stream";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return new Response("Missing id", { status: 400 });

    const media = await prisma.media.findUnique({ where: { id } });
    if (!media) return new Response("Not found", { status: 404 });

    try {
        const event = await prisma.event.findUnique({ where: { id: media.eventId } });
        if (!event) return new Response("Event missing", { status: 404 });

        const oauth = await getOAuthClientForUser(event.ownerId);
        if (!oauth) return new Response("Owner not connected to Google", { status: 400 });
        const drive = driveFromClient(oauth);

        const range = req.headers.get("range") || undefined;
        const driveRes = await drive.files.get(
            { fileId: media.driveFileId, alt: "media" as const, supportsAllDrives: true },
            {
                responseType: "stream",
                headers: range ? { Range: range } : undefined,
            }
        );

        const nodeStream = driveRes.data as unknown as NodeJS.ReadableStream;

        function toWeb(stream: NodeJS.ReadableStream): ReadableStream {
            const maybeToWeb: unknown = (NodeReadable as unknown as { toWeb?: (s: NodeJS.ReadableStream) => ReadableStream }).toWeb;
            if (typeof maybeToWeb === "function") return maybeToWeb(stream);
            // Fallback: wrap Node stream into a Web ReadableStream
            return new ReadableStream<Uint8Array>({
                start(controller) {
                    stream.on("data", (chunk: Buffer) => controller.enqueue(new Uint8Array(chunk)));
                    stream.on("end", () => controller.close());
                    stream.on("error", (err: Error) => controller.error(err));
                },
                cancel() {
                    const s = stream as unknown as { destroy?: () => void };
                    if (typeof s.destroy === "function") s.destroy();
                },
            });
        }

        const webStream = toWeb(nodeStream);

        const headers = new Headers();
        let contentType = media.mimeType || (driveRes.headers["content-type"] as string | undefined) || "application/octet-stream";
        // Safari requires exact type for video to enable playback controls; default to video/mp4 if hintable
        if (!contentType.startsWith("video/") && media.mimeType?.startsWith("video/")) {
            contentType = media.mimeType;
        }
        headers.set("Content-Type", contentType);
        headers.set("Accept-Ranges", "bytes");
        const contentLength = driveRes.headers["content-length"] as string | undefined;
        if (contentLength) headers.set("Content-Length", contentLength);
        const contentRange = driveRes.headers["content-range"] as string | undefined;
        if (contentRange) headers.set("Content-Range", contentRange);
        headers.set("Cache-Control", "private, max-age=3600");

        const status = driveRes.status ?? (range ? 206 : 200);
        return new Response(webStream as unknown as ReadableStream, { status, headers });
    } catch (e) {
        console.error("content stream failed", e);
        return new Response("Failed", { status: 500 });
    }
}


