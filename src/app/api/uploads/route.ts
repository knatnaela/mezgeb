import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOAuthClientForUser, driveFromClient, ensureEventDriveFolders } from "@/lib/google";
import { Readable } from "node:stream";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
    const contentType = req.headers.get("content-type") || "";
    if (!contentType.includes("multipart/form-data"))
        return NextResponse.json({ error: "Invalid content type" }, { status: 400 });

    const formData = await req.formData();
    const slug = String(formData.get("slug") || "");
    const file = formData.get("file");
    if (!slug || !(file instanceof File))
        return NextResponse.json({ error: "Missing file or slug" }, { status: 400 });

    const event = await prisma.event.findUnique({ where: { slug } });
    if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });

    try {
        // Ensure Approved folder exists (auto-approve)
        let approvedFolderId = event.driveApprovedFolderId || null;
        if (!approvedFolderId) {
            const folders = await ensureEventDriveFolders({
                userId: event.ownerId,
                eventName: event.name,
                slug: event.slug,
            });
            if (folders) {
                approvedFolderId = folders.approvedId;
                await prisma.event.update({
                    where: { id: event.id },
                    data: {
                        driveRootFolderId: folders.eventFolderId,
                        driveUploadsFolderId: folders.uploadsId,
                        driveApprovedFolderId: folders.approvedId,
                        driveOriginalsFolderId: folders.originalsId,
                        driveExportsFolderId: folders.exportsId,
                    },
                });
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
                driveFileId: created.id!,
                fileName: file.name,
                mimeType: created.mimeType || file.type || "application/octet-stream",
                sizeBytes: created.size ? BigInt(created.size) : BigInt(file.size),
                status: "APPROVED",
                approvedAt: new Date(),
                webViewLink: created.webViewLink || null,
                thumbnailLink: created.thumbnailLink || null,
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


