-- Shipment status rework: replaces the fixed 3-value status
-- (PENDING/COMPLETED/CANCELLED) with a direct, no-approval 6-value set
-- (PENDING/CONFIRMED/CANCELLED/DEPARTED/PAYMENT_PENDING/PAYMENT_RECEIVED),
-- and drops the two-step cancellation-request/approve workflow entirely
-- (replaced by the new status endpoint).

-- shipment_report_v selects s.status, so it blocks any type change on that
-- column until dropped; recreated verbatim (only the underlying enum
-- changed, not this view's own SQL) at the end of this migration.
DROP VIEW "shipment_report_v";

-- Postgres enums can't rename/drop values in place — swap the type via a
-- temp column, backfilling COMPLETED -> DEPARTED (closest existing
-- analogue: a completed shipment had already flown).
CREATE TYPE "shipment_status_new" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED', 'DEPARTED', 'PAYMENT_PENDING', 'PAYMENT_RECEIVED');

ALTER TABLE "shipment" ADD COLUMN "status_new" "shipment_status_new";

UPDATE "shipment" SET "status_new" = CASE status::text
  WHEN 'PENDING' THEN 'PENDING'::"shipment_status_new"
  WHEN 'COMPLETED' THEN 'DEPARTED'::"shipment_status_new"
  WHEN 'CANCELLED' THEN 'CANCELLED'::"shipment_status_new"
END;

ALTER TABLE "shipment" ALTER COLUMN "status_new" SET NOT NULL;
ALTER TABLE "shipment" ALTER COLUMN "status_new" SET DEFAULT 'PENDING';

DROP INDEX "shipment_status_idx";
ALTER TABLE "shipment" DROP COLUMN "status";
ALTER TABLE "shipment" RENAME COLUMN "status_new" TO "status";

DROP TYPE "shipment_status";
ALTER TYPE "shipment_status_new" RENAME TO "shipment_status";

CREATE INDEX "shipment_status_idx" ON "shipment"("status");

-- Recreate the analytics view, unchanged, now against the new enum.
CREATE VIEW "shipment_report_v" AS
SELECT
  s.id AS shipment_id,
  s."shipmentNo" AS shipment_no,
  s."flightDate" AS flight_date,
  s.status AS status,
  s."weightKg" AS weight_kg,
  s."commodityId" AS commodity_id,
  c.name AS commodity_name,
  s."airlineId" AS airline_id,
  al.name AS airline_name,
  s."shipperId" AS shipper_id,
  sh.name AS shipper_name,
  i."chargeableWeightKg" AS chargeable_weight_kg,
  i."exchangeRate" AS invoice_exchange_rate,
  COALESCE(il.total_usd, 0) AS revenue_usd,
  COALESCE(il.total_lkr, 0) AS revenue_lkr,
  CASE
    WHEN i."chargeableWeightKg" IS NOT NULL AND s."appliedBuyingRate" IS NOT NULL
      THEN ROUND(i."chargeableWeightKg" * s."appliedBuyingRate", 2)
    ELSE 0
  END AS buying_cost_usd,
  COALESCE(cl.total_opex_lkr, 0) AS opex_lkr
FROM "shipment" s
JOIN "commodity" c ON c.id = s."commodityId"
JOIN "airline" al ON al.id = s."airlineId"
JOIN "shipper" sh ON sh.id = s."shipperId"
LEFT JOIN "invoice" i ON i."shipmentId" = s.id
LEFT JOIN (
  SELECT "invoiceId", SUM("amountUsd") AS total_usd, SUM("amountLkr") AS total_lkr
  FROM "invoice_line"
  GROUP BY "invoiceId"
) il ON il."invoiceId" = i.id
LEFT JOIN "cost_sheet" cs ON cs."shipmentId" = s.id
LEFT JOIN (
  SELECT "costSheetId", SUM(amount) AS total_opex_lkr
  FROM "cost_sheet_line"
  GROUP BY "costSheetId"
) cl ON cl."costSheetId" = cs.id
WHERE s.status <> 'CANCELLED' AND s."isDeleted" = false;

-- Drop the retired two-step cancellation-request/approve workflow (replaced
-- by the direct status endpoint) — cascades its audit-capture trigger.
DROP TABLE "shipment_cancellation_request";
DROP TYPE "cancellation_request_status";
