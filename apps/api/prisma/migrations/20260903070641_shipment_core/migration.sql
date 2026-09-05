-- Backs "shipment"."shipmentNo"'s DEFAULT below. Created by hand — Prisma's
-- generated diff never emits CREATE SEQUENCE for a dbgenerated() default,
-- and the sequence must exist before the table default that references it
-- (ARCHITECTURE §5: shipment_no is "allocated from a PostgreSQL sequence
-- inside the insert transaction. Never generated in application code").
CREATE SEQUENCE "shipment_no_seq" START 1;

-- CreateEnum
CREATE TYPE "shipment_status" AS ENUM ('PENDING', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "cancellation_request_status" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "shipment" (
    "id" TEXT NOT NULL,
    "shipmentNo" TEXT NOT NULL DEFAULT ('HUB '::text || lpad((nextval('shipment_no_seq'::regclass))::text, 6, '0'::text)),
    "mawbNo" TEXT,
    "houseAwbNo" TEXT,
    "airlineName" TEXT NOT NULL,
    "flightNo" TEXT,
    "destination" TEXT,
    "shipperName" TEXT NOT NULL,
    "consigneeName" TEXT NOT NULL,
    "commodityName" TEXT NOT NULL,
    "flightDate" DATE NOT NULL,
    "handlingDate" DATE,
    "depTime" TIME NOT NULL,
    "cusdecNo" TEXT,
    "boxCount" INTEGER,
    "weightKg" DECIMAL(10,3),
    "status" "shipment_status" NOT NULL DEFAULT 'PENDING',
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdByUserId" TEXT NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipment_cancellation_request" (
    "id" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "cancellation_request_status" NOT NULL DEFAULT 'PENDING',
    "requestedByUserId" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedByUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,

    CONSTRAINT "shipment_cancellation_request_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "shipment_shipmentNo_key" ON "shipment"("shipmentNo");

-- CreateIndex
CREATE INDEX "shipment_flightDate_depTime_idx" ON "shipment"("flightDate", "depTime");

-- CreateIndex
CREATE INDEX "shipment_mawbNo_idx" ON "shipment"("mawbNo");

-- CreateIndex
CREATE INDEX "shipment_status_idx" ON "shipment"("status");

-- CreateIndex
CREATE INDEX "shipment_cancellation_request_shipmentId_idx" ON "shipment_cancellation_request"("shipmentId");

-- CreateIndex
CREATE INDEX "shipment_cancellation_request_status_idx" ON "shipment_cancellation_request"("status");

-- AddForeignKey
ALTER TABLE "shipment" ADD CONSTRAINT "shipment_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipment_cancellation_request" ADD CONSTRAINT "shipment_cancellation_request_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "shipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipment_cancellation_request" ADD CONSTRAINT "shipment_cancellation_request_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipment_cancellation_request" ADD CONSTRAINT "shipment_cancellation_request_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Automatic audit capture (ARCHITECTURE §10 layer 1), attaching the
-- audit_capture() trigger function created in the Phase 1
-- audit_capture_triggers migration to this phase's two new tables.
-- Hand-written for the same reason as that migration: Prisma's diff has no
-- concept of this trigger.
CREATE TRIGGER audit_capture_shipment
  AFTER INSERT OR UPDATE OR DELETE ON "shipment"
  FOR EACH ROW EXECUTE FUNCTION audit_capture();

CREATE TRIGGER audit_capture_shipment_cancellation_request
  AFTER INSERT OR UPDATE OR DELETE ON "shipment_cancellation_request"
  FOR EACH ROW EXECUTE FUNCTION audit_capture();
