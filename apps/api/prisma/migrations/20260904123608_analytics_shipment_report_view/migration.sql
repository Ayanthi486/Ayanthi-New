-- Phase 9 (Analytics and Reports). ARCHITECTURE §17: "Views for report
-- definitions so a report change is not a code change." One view, per-
-- shipment grain, joining every source of a report figure this phase needs:
-- weight (shipment), revenue (invoice_line, summed), airline buying cost
-- (shipment.appliedBuyingRate x invoice.chargeableWeightKg, BR-41/BR-66),
-- and operational expenses (cost_sheet_line, summed). Deliberately exposes
-- raw components only, not a computed profit figure — the USD buying cost
-- still needs an LKR exchange rate to net against opex, and that resolution
-- (OQ-5: the shipment's own invoice.exchangeRate, else a configurable
-- fallback) is an application-config concern a static view cannot express.
--
-- Cancelled and soft-deleted shipments are excluded (no revenue or cost was
-- ever realized for them) — same treatment Cut-off gave Cancelled shipments
-- in Phase 8.
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
