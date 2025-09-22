-- Add missing column used by NextAuth Google provider
-- Prisma datasource: PostgreSQL

ALTER TABLE "Account"
ADD COLUMN IF NOT EXISTS "refresh_token_expires_in" INTEGER;


