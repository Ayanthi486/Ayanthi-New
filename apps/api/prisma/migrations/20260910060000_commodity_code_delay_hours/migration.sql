-- AlterTable
ALTER TABLE "commodity" ADD COLUMN "code" TEXT NOT NULL DEFAULT '000000';
ALTER TABLE "commodity" ADD COLUMN "delayHours" TIME NOT NULL DEFAULT '00:00:00';

-- Existing rows get placeholder values above; new inserts must supply real
-- ones (createCommodityRequestSchema requires both), so drop the defaults.
ALTER TABLE "commodity" ALTER COLUMN "code" DROP DEFAULT;
ALTER TABLE "commodity" ALTER COLUMN "delayHours" DROP DEFAULT;
