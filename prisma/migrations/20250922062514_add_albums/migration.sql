-- DropIndex
DROP INDEX "public"."Media_eventId_status_createdAt_idx";

-- AlterTable
ALTER TABLE "public"."Media" ADD COLUMN     "albumId" TEXT;

-- CreateTable
CREATE TABLE "public"."Album" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "coverMediaId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "driveAlbumFolderId" TEXT,
    "driveUploadsFolderId" TEXT,
    "driveApprovedFolderId" TEXT,
    "driveOriginalsFolderId" TEXT,
    "driveExportsFolderId" TEXT,

    CONSTRAINT "Album_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Album_eventId_idx" ON "public"."Album"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "Album_eventId_slug_key" ON "public"."Album"("eventId", "slug");

-- CreateIndex
CREATE INDEX "Media_eventId_albumId_status_createdAt_idx" ON "public"."Media"("eventId", "albumId", "status", "createdAt");

-- AddForeignKey
ALTER TABLE "public"."Media" ADD CONSTRAINT "Media_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "public"."Album"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Album" ADD CONSTRAINT "Album_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "public"."Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
