import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOAuthClientForUser, driveFromClient, ensureEventDriveFolders, ensureAlbumDriveFolders } from "@/lib/google";
import { Readable } from "node:stream";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Upload constraints
const MAX_IMAGE_BYTES = 50 * 1024 * 1024; // 50 MB
const MAX_VIDEO_BYTES = 500 * 1024 * 1024; // 500 MB
const ALLOWED_PREFIXES = ["image/", "video/"];

// Best-effort in-memory rate limiting (per instance)
const WINDOW_MS = 60 * 60 * 1000; // 1 hour
const MAX_UPLOADS_PER_IP = 30;
const MAX_UPLOADS_PER_FP = 15;
const ipHits = new Map<string, number[]>();
const fpHits = new Map<string, number[]>();

function consumeToken(map: Map<string, number[]>, key: string, max: number, windowMs: number): boolean {
    const now = Date.now();
    const windowStart = now - windowMs;
    const arr = (map.get(key) || []).filter((t) => t >= windowStart);
    if (arr.length >= max) return false;
    arr.push(now);
    map.set(key, arr);
    return true;
}

export async function POST(req: NextRequest) {
    // Capture IP early; enforce after we know album
    const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || req.headers.get("x-real-ip") || "unknown";

    const contentType = req.headers.get("content-type") || "";
    if (!contentType.includes("multipart/form-data"))
        return NextResponse.json({ error: "Invalid content type" }, { status: 400 });

    const formData = await req.formData();
    const slug = String(formData.get("slug") || "");
    const albumSlug = String(formData.get("album") || "") || "default";
    const file = formData.get("file");
    const fingerprint = String(formData.get("fingerprint") || "").slice(0, 128);
    if (!slug || !(file instanceof File))
        return NextResponse.json({ error: "Missing file or slug" }, { status: 400 });

    // Type validation
    const mime = file.type || "application/octet-stream";
    if (!ALLOWED_PREFIXES.some((p) => mime.startsWith(p))) {
        return NextResponse.json({ error: "Only image and video uploads are allowed" }, { status: 415 });
    }

    // Size validation
    const isImage = mime.startsWith("image/");
    const isVideo = mime.startsWith("video/");
    const maxBytes = isImage ? MAX_IMAGE_BYTES : isVideo ? MAX_VIDEO_BYTES : 0;
    if (maxBytes > 0 && file.size > maxBytes) {
        return NextResponse.json({
            error: `File too large. Max ${isImage ? Math.round(MAX_IMAGE_BYTES / 1024 / 1024) : Math.round(MAX_VIDEO_BYTES / 1024 / 1024)} MB allowed`,
        }, { status: 413 });
    }

    // Rate limit by IP & fingerprint (album-scoped)
    if (ip && !consumeToken(ipHits, `${albumSlug}:${String(ip)}`, MAX_UPLOADS_PER_IP, WINDOW_MS)) {
        return NextResponse.json({ error: "Too many uploads from this IP for this album. Try later." }, { status: 429 });
    }
    // Rate limit by fingerprint when available and album-scoped
    if (fingerprint) {
        const fpKey = `${albumSlug}:${fingerprint}`;
        if (!consumeToken(fpHits, fpKey, MAX_UPLOADS_PER_FP, WINDOW_MS)) {
            return NextResponse.json({ error: "Too many uploads from this device for this album. Try later." }, { status: 429 });
        }
    }

    const event = await prisma.event.findUnique({ where: { slug } });
    if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });

    try {
        // Resolve album and ensure album Drive folders (auto-approve)
        let album = await prisma.album.findFirst({ where: { eventId: event.id, slug: albumSlug } });
        if (!album) {
            // Create album if not exists (no backward compat required)
            album = await prisma.album.create({
                data: { eventId: event.id, name: albumSlug, slug: albumSlug },
            });
        }

        let approvedFolderId = album.driveApprovedFolderId || null;
        if (!approvedFolderId) {
            const folders = await ensureAlbumDriveFolders({
                userId: event.ownerId,
                eventName: event.name,
                eventSlug: event.slug,
                albumName: album.name,
                albumSlug: album.slug,
                eventRootFolderId: event.driveRootFolderId || null,
            });
            if (folders) {
                approvedFolderId = folders.approvedId;
                await prisma.album.update({
                    where: { id: album.id },
                    data: {
                        driveAlbumFolderId: folders.albumFolderId,
                        driveUploadsFolderId: folders.uploadsId,
                        driveApprovedFolderId: folders.approvedId,
                        driveOriginalsFolderId: folders.originalsId,
                        driveExportsFolderId: folders.exportsId,
                    },
                });
                // Also persist event root if not yet stored
                if (!event.driveRootFolderId) {
                    const eventFolders = await ensureEventDriveFolders({ userId: event.ownerId, eventName: event.name, slug: event.slug });
                    if (eventFolders) {
                        await prisma.event.update({
                            where: { id: event.id },
                            data: {
                                driveRootFolderId: eventFolders.eventFolderId,
                                driveUploadsFolderId: eventFolders.uploadsId,
                                driveApprovedFolderId: eventFolders.approvedId,
                                driveOriginalsFolderId: eventFolders.originalsId,
                                driveExportsFolderId: eventFolders.exportsId,
                            },
                        });
                    }
                }
            }
        }

        if (!approvedFolderId) {
            return NextResponse.json({ error: "Approved folder not available" }, { status: 500 });
        }

        // Use couple's Google tokens to upload
        const oauth = await getOAuthClientForUser(event.ownerId);
        if (!oauth) return NextResponse.json({ error: "Owner is not connected to Google" }, { status: 400 });
        const drive = driveFromClient(oauth);

        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const bodyStream = Readable.from(buffer);

        const createRes = await drive.files.create({
            requestBody: {
                name: file.name,
                parents: [approvedFolderId],
            },
            media: {
                mimeType: file.type || "application/octet-stream",
                body: bodyStream,
            },
            fields: "id, webViewLink, thumbnailLink, mimeType, size",
        });

        const created = createRes.data;
        const media = await prisma.media.create({
            data: {
                eventId: event.id,
                albumId: album.id,
                driveFileId: created.id!,
                fileName: file.name,
                mimeType: created.mimeType || file.type || "application/octet-stream",
                sizeBytes: created.size ? BigInt(created.size) : BigInt(file.size),
                status: "APPROVED",
                approvedAt: new Date(),
                webViewLink: created.webViewLink || null,
                thumbnailLink: created.thumbnailLink || null,
                uploaderFingerprint: fingerprint || null,
            },
        });

        // Serialize BigInt fields for JSON response
        const safe = {
            ...media,
            sizeBytes: media.sizeBytes ? media.sizeBytes.toString() : null,
        };

        return NextResponse.json({ ok: true, media: safe });
    } catch (err) {
        console.error("Upload failed", err);
        return NextResponse.json({ error: "Upload failed" }, { status: 500 });
    }
}


