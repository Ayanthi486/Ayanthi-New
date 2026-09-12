-- Add Shipment.serviceType — chosen on the Add Shipment form (Only Booking /
-- Only Handling / Booking & Handling). Existing rows are backfilled to
-- BOOKING_AND_HANDLING (the broadest, safest default), then the column's
-- default is dropped so every new shipment must supply a real choice.
CREATE TYPE "service_type" AS ENUM ('BOOKING_ONLY', 'HANDLING_ONLY', 'BOOKING_AND_HANDLING');

ALTER TABLE "shipment" ADD COLUMN "serviceType" "service_type" NOT NULL DEFAULT 'BOOKING_AND_HANDLING';
ALTER TABLE "shipment" ALTER COLUMN "serviceType" DROP DEFAULT;
