DROP VIEW "shipment_report_v";

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
    s."consigneeId" AS consignee_id,
    co.name AS consignee_name,
    s."destinationAirportId" AS destination_airport_id,
    da.code AS destination_airport_code,
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
  JOIN "consignee" co ON co.id = s."consigneeId"
  JOIN "airport" da ON da.id = s."destinationAirportId"
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