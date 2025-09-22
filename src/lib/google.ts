import { google, drive_v3 } from "googleapis";
import { OAuth2Client } from "google-auth-library";
import { prisma } from "@/lib/prisma";

export async function getOAuthClientForUser(userId: string): Promise<OAuth2Client | null> {
  const account = await prisma.account.findFirst({
    where: { userId, provider: "google" },
  });
  if (!account?.refresh_token && !account?.access_token) return null;

  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.NEXTAUTH_URL
  );

  if (account.access_token) client.setCredentials({ access_token: account.access_token });
  if (account.refresh_token) client.setCredentials({ refresh_token: account.refresh_token });
  return client;
}

export function driveFromClient(oauth: OAuth2Client): drive_v3.Drive {
  return google.drive({ version: "v3", auth: oauth });
}

async function findFolderId(drive: drive_v3.Drive, name: string, parentId?: string) {
  const qParts = [
    "mimeType = 'application/vnd.google-apps.folder'",
    `name = '${name.replace(/'/g, "\\'")}'`,
    "trashed = false",
  ];
  if (parentId) {
    qParts.push(`'${parentId}' in parents`);
  } else {
    qParts.push(`'root' in parents`);
  }
  const res = await drive.files.list({ q: qParts.join(" and "), fields: "files(id,name)" });
  return res.data.files?.[0]?.id ?? null;
}

async function createFolder(drive: drive_v3.Drive, name: string, parentId?: string) {
  const fileMetadata: drive_v3.Schema$File = {
    name,
    mimeType: "application/vnd.google-apps.folder",
    parents: parentId ? [parentId] : undefined,
  };
  const res = await drive.files.create({ requestBody: fileMetadata, fields: "id" });
  return res.data.id as string;
}

export async function ensureEventDriveFolders(params: {
  userId: string;
  eventName: string;
  slug: string;
}) {
  const oauth = await getOAuthClientForUser(params.userId);
  if (!oauth) return null;
  const drive = driveFromClient(oauth);

  // Root: Mezgeb
  const rootName = "Mezgeb";
  let rootId = await findFolderId(drive, rootName);
  if (!rootId) rootId = await createFolder(drive, rootName);

  // Event folder: include slug to avoid duplicates
  const eventFolderName = `${params.eventName} (${params.slug})`;
  let eventFolderId = await findFolderId(drive, eventFolderName, rootId);
  if (!eventFolderId) eventFolderId = await createFolder(drive, eventFolderName, rootId);

  // Subfolders
  const names = ["Uploads", "Approved", "Originals", "Exports"] as const;
  const results: Record<(typeof names)[number], string> = {
    Uploads: "",
    Approved: "",
    Originals: "",
    Exports: "",
  };
  for (const name of names) {
    let id = await findFolderId(drive, name, eventFolderId);
    if (!id) id = await createFolder(drive, name, eventFolderId);
    results[name] = id;
  }

  return {
    rootId,
    eventFolderId,
    uploadsId: results.Uploads,
    approvedId: results.Approved,
    originalsId: results.Originals,
    exportsId: results.Exports,
  };
}

export async function moveFileToFolder(
  drive: drive_v3.Drive,
  params: { fileId: string; destinationFolderId: string }
) {
  const meta = await drive.files.get({ fileId: params.fileId, fields: "parents" });
  const currentParents = meta.data.parents ?? [];
  const removeParents = currentParents.filter((p) => p !== params.destinationFolderId).join(",");
  await drive.files.update({
    fileId: params.fileId,
    addParents: params.destinationFolderId,
    removeParents: removeParents || undefined,
    fields: "id, parents",
  });
}

export async function ensureAlbumDriveFolders(params: {
  userId: string;
  eventName: string;
  eventSlug: string;
  albumName: string;
  albumSlug: string;
  eventRootFolderId?: string | null;
}) {
  const oauth = await getOAuthClientForUser(params.userId);
  if (!oauth) return null;
  const drive = driveFromClient(oauth);

  // Ensure event root exists
  let eventRootId = params.eventRootFolderId || null;
  if (!eventRootId) {
    const eventFolders = await ensureEventDriveFolders({
      userId: params.userId,
      eventName: params.eventName,
      slug: params.eventSlug,
    });
    eventRootId = eventFolders?.eventFolderId || null;
  }
  if (!eventRootId) return null;

  // Albums parent folder under event
  let albumsRootId = await findFolderId(drive, "Albums", eventRootId);
  if (!albumsRootId) albumsRootId = await createFolder(drive, "Albums", eventRootId);

  // Album folder with slug for uniqueness
  const albumFolderName = `${params.albumName} (${params.albumSlug})`;
  let albumFolderId = await findFolderId(drive, albumFolderName, albumsRootId);
  if (!albumFolderId) albumFolderId = await createFolder(drive, albumFolderName, albumsRootId);

  // Subfolders
  const names = ["Uploads", "Approved", "Originals", "Exports"] as const;
  const results: Record<(typeof names)[number], string> = {
    Uploads: "",
    Approved: "",
    Originals: "",
    Exports: "",
  };
  for (const name of names) {
    let id = await findFolderId(drive, name, albumFolderId);
    if (!id) id = await createFolder(drive, name, albumFolderId);
    results[name] = id;
  }

  return {
    albumFolderId,
    uploadsId: results.Uploads,
    approvedId: results.Approved,
    originalsId: results.Originals,
    exportsId: results.Exports,
  };
}


