-- AlterTable
ALTER TABLE "airline" ADD COLUMN "code" TEXT;

-- Backfill existing rows: earlier data used `name` itself as a 2-letter
-- code (before airline gained its own Name field) — derive a starting
-- code from it so no row is left without one. Real codes can be corrected
-- by hand afterwards; this only needs to satisfy the NOT NULL below.
UPDATE "airline" SET "code" = UPPER(LEFT("name", 2)) WHERE "code" IS NULL;

-- AlterTable
ALTER TABLE "airline" ALTER COLUMN "code" SET NOT NULL;
