-- Phase 3 — master data, Rate Table, and shipment normalization.
--
-- Hand-sequenced (not a raw `prisma migrate dev` output — Prisma refuses to
-- generate one automatically here because it would add required columns to
-- a non-empty `shipment` table). Follows DEVELOPMENT_RULES.md §9's
-- multi-step pattern (add nullable -> backfill -> set not null -> drop
-- old) within a single migration file/transaction, which is safe here
-- because nothing has shipped yet (see the Phase 3 report's decision #1)
-- — a later, post-launch phase would need to split this across releases.

-- ============================================================
-- 1. Master data + Rate Table tables
-- ============================================================

CREATE TABLE "shipper" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shipper_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "consignee" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "consignee_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "airline" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "airline_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "commodity" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "commodity_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "airport" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "airport_pkey" PRIMARY KEY ("id")
);

-- BR-45: effective-period history. No "update rate value" mutation exists
-- anywhere above this table — see the model comment in schema.prisma.
CREATE TABLE "rate_table" (
    "id" TEXT NOT NULL,
    "airlineId" TEXT NOT NULL,
    "rateUsdPerKg" DECIMAL(12,4) NOT NULL,
    "effectiveFrom" DATE NOT NULL,
    "effectiveTo" DATE,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rate_table_pkey" PRIMARY KEY ("id")
);

-- ============================================================
-- 2. Additive: nullable FK columns on shipment alongside the old
--    plain-text ones (DEVELOPMENT_RULES.md §9 step 1).
-- ============================================================

ALTER TABLE "shipment"
  ADD COLUMN "airlineId" TEXT,
  ADD COLUMN "shipperId" TEXT,
  ADD COLUMN "consigneeId" TEXT,
  ADD COLUMN "commodityId" TEXT,
  ADD COLUMN "destinationAirportId" TEXT,
  ADD COLUMN "appliedBuyingRate" DECIMAL(12,4),
  ADD COLUMN "appliedBuyingRateId" TEXT;

-- ============================================================
-- 3. Backfill: create master rows from the existing distinct plain-text
--    values and point the new FK columns at them (step 2).
-- ============================================================

INSERT INTO "airline" ("id", "name", "updatedAt")
SELECT gen_random_uuid(), t."airlineName", now()
FROM (SELECT DISTINCT "airlineName" FROM "shipment" WHERE "airlineName" IS NOT NULL) t;

UPDATE "shipment" s SET "airlineId" = a."id"
FROM "airline" a WHERE a."name" = s."airlineName";

INSERT INTO "shipper" ("id", "name", "updatedAt")
SELECT gen_random_uuid(), t."shipperName", now()
FROM (SELECT DISTINCT "shipperName" FROM "shipment" WHERE "shipperName" IS NOT NULL) t;

UPDATE "shipment" s SET "shipperId" = sh."id"
FROM "shipper" sh WHERE sh."name" = s."shipperName";

INSERT INTO "consignee" ("id", "name", "updatedAt")
SELECT gen_random_uuid(), t."consigneeName", now()
FROM (SELECT DISTINCT "consigneeName" FROM "shipment" WHERE "consigneeName" IS NOT NULL) t;

UPDATE "shipment" s SET "consigneeId" = c."id"
FROM "consignee" c WHERE c."name" = s."consigneeName";

-- One existing user (the shipment's own creator) attributed as the
-- backfilled commodity's createdByUserId — a reasonable best-effort
-- placeholder attribution, not a claim about who actually first typed it.
INSERT INTO "commodity" ("id", "name", "createdByUserId", "updatedAt")
SELECT gen_random_uuid(), t."commodityName", t."createdByUserId", now()
FROM (
  SELECT DISTINCT ON ("commodityName") "commodityName", "createdByUserId"
  FROM "shipment" WHERE "commodityName" IS NOT NULL
) t;

UPDATE "shipment" s SET "commodityId" = co."id"
FROM "commodity" co WHERE co."name" = s."commodityName";

-- destination was free text (e.g. "DXB"); best-effort backfill uses it as
-- both the Airport's code and name until a real master-data pass corrects
-- it (flagged in the Phase 3 report).
INSERT INTO "airport" ("id", "code", "name", "updatedAt")
SELECT gen_random_uuid(), d."destination", d."destination", now()
FROM (SELECT DISTINCT "destination" FROM "shipment" WHERE "destination" IS NOT NULL) d;

UPDATE "shipment" s SET "destinationAirportId" = ap."id"
FROM "airport" ap WHERE ap."code" = s."destination";

-- ============================================================
-- 4. Switch: enforce NOT NULL now that every row is backfilled, then drop
--    the old plain-text columns (steps 3-4).
-- ============================================================

ALTER TABLE "shipment"
  ALTER COLUMN "airlineId" SET NOT NULL,
  ALTER COLUMN "shipperId" SET NOT NULL,
  ALTER COLUMN "consigneeId" SET NOT NULL,
  ALTER COLUMN "commodityId" SET NOT NULL;

ALTER TABLE "shipment"
  DROP COLUMN "airlineName",
  DROP COLUMN "shipperName",
  DROP COLUMN "consigneeName",
  DROP COLUMN "commodityName",
  DROP COLUMN "destination";

-- ============================================================
-- 5. Indexes and foreign keys
-- ============================================================

CREATE INDEX "rate_table_airlineId_effectiveFrom_idx" ON "rate_table"("airlineId", "effectiveFrom");
CREATE INDEX "shipment_airlineId_idx" ON "shipment"("airlineId");

ALTER TABLE "shipment" ADD CONSTRAINT "shipment_airlineId_fkey" FOREIGN KEY ("airlineId") REFERENCES "airline"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "shipment" ADD CONSTRAINT "shipment_destinationAirportId_fkey" FOREIGN KEY ("destinationAirportId") REFERENCES "airport"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "shipment" ADD CONSTRAINT "shipment_shipperId_fkey" FOREIGN KEY ("shipperId") REFERENCES "shipper"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "shipment" ADD CONSTRAINT "shipment_consigneeId_fkey" FOREIGN KEY ("consigneeId") REFERENCES "consignee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "shipment" ADD CONSTRAINT "shipment_commodityId_fkey" FOREIGN KEY ("commodityId") REFERENCES "commodity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "shipment" ADD CONSTRAINT "shipment_appliedBuyingRateId_fkey" FOREIGN KEY ("appliedBuyingRateId") REFERENCES "rate_table"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "commodity" ADD CONSTRAINT "commodity_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "rate_table" ADD CONSTRAINT "rate_table_airlineId_fkey" FOREIGN KEY ("airlineId") REFERENCES "airline"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "rate_table" ADD CONSTRAINT "rate_table_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================
-- 6. Automatic audit capture (ARCHITECTURE §10 layer 1) on every new
--    table, same pattern as Phase 1/2's own migrations.
-- ============================================================

CREATE TRIGGER audit_capture_shipper
  AFTER INSERT OR UPDATE OR DELETE ON "shipper"
  FOR EACH ROW EXECUTE FUNCTION audit_capture();

CREATE TRIGGER audit_capture_consignee
  AFTER INSERT OR UPDATE OR DELETE ON "consignee"
  FOR EACH ROW EXECUTE FUNCTION audit_capture();

CREATE TRIGGER audit_capture_airline
  AFTER INSERT OR UPDATE OR DELETE ON "airline"
  FOR EACH ROW EXECUTE FUNCTION audit_capture();

CREATE TRIGGER audit_capture_commodity
  AFTER INSERT OR UPDATE OR DELETE ON "commodity"
  FOR EACH ROW EXECUTE FUNCTION audit_capture();

CREATE TRIGGER audit_capture_airport
  AFTER INSERT OR UPDATE OR DELETE ON "airport"
  FOR EACH ROW EXECUTE FUNCTION audit_capture();

CREATE TRIGGER audit_capture_rate_table
  AFTER INSERT OR UPDATE OR DELETE ON "rate_table"
  FOR EACH ROW EXECUTE FUNCTION audit_capture();
