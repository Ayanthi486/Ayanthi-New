-- Phase 10 hardening: CHECK constraints for the core positive-value
-- invariants that ARCHITECTURE §5 / CONTEXT.md §22 already state as a
-- requirement ("Foreign keys and CHECK constraints enforced in the
-- database, not only in application code") but that no prior migration
-- actually added — every one of these fields was validated only by the
-- Zod DTOs at the API boundary until now. Hand-written raw SQL, the same
-- convention already used for the audit triggers and grant-restriction
-- migrations, since Prisma's schema DSL has no first-class CHECK syntax.
--
-- Every constraint mirrors an existing, already-enforced application-layer
-- rule (PRD §7's validation table) so no legitimate existing row can
-- violate it — this is defence-in-depth, not a behaviour change.

-- Shipment: BOX/WEIGHT are "positive integer/decimal, nullable until cargo
-- handling" (PRD §7); the applied buying rate is "positive decimal, USD".
ALTER TABLE "shipment"
  ADD CONSTRAINT "shipment_box_count_positive" CHECK ("boxCount" IS NULL OR "boxCount" > 0),
  ADD CONSTRAINT "shipment_weight_kg_positive" CHECK ("weightKg" IS NULL OR "weightKg" > 0),
  ADD CONSTRAINT "shipment_applied_buying_rate_positive" CHECK ("appliedBuyingRate" IS NULL OR "appliedBuyingRate" > 0);

-- Rate Table: BR-39/BR-42, "positive decimal, USD".
ALTER TABLE "rate_table"
  ADD CONSTRAINT "rate_table_rate_usd_per_kg_positive" CHECK ("rateUsdPerKg" > 0);

-- Invoice: chargeable weight is "positive decimal; may exceed gross weight"
-- (PRD §7); the exchange rate is a conversion factor and must be positive.
ALTER TABLE "invoice"
  ADD CONSTRAINT "invoice_chargeable_weight_kg_positive" CHECK ("chargeableWeightKg" IS NULL OR "chargeableWeightKg" > 0),
  ADD CONSTRAINT "invoice_exchange_rate_positive" CHECK ("exchangeRate" IS NULL OR "exchangeRate" > 0);

-- Invoice lines: rates/amounts are never negative (a $0 flat line is
-- tolerated — e.g. a waived charge — but a negative one is always a
-- data-entry error, never a real Hub Lanka charge).
ALTER TABLE "invoice_line"
  ADD CONSTRAINT "invoice_line_rate_usd_nonnegative" CHECK ("rateUsd" >= 0),
  ADD CONSTRAINT "invoice_line_amount_usd_nonnegative" CHECK ("amountUsd" >= 0),
  ADD CONSTRAINT "invoice_line_amount_lkr_nonnegative" CHECK ("amountLkr" >= 0);

-- Cost Sheet lines: PRD §6 lists all eleven lines as optional LKR amounts;
-- an entered amount is a receipt/expense value and is never negative.
ALTER TABLE "cost_sheet_line"
  ADD CONSTRAINT "cost_sheet_line_amount_nonnegative" CHECK ("amount" IS NULL OR "amount" >= 0);

-- Payment: PRD §7, "Payment amount: Positive."
ALTER TABLE "payment"
  ADD CONSTRAINT "payment_amount_positive" CHECK ("amount" > 0);
