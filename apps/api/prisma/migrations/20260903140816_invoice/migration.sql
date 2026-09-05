-- CreateEnum
CREATE TYPE "invoice_status" AS ENUM ('DRAFT', 'ISSUED');

-- CreateEnum
CREATE TYPE "invoice_line_weight_basis" AS ENUM ('CHARGEABLE', 'GROSS', 'FLAT');

-- CreateTable
CREATE TABLE "invoice" (
    "id" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "invoiceNo" TEXT,
    "invoiceDate" DATE,
    "exchangeRate" DECIMAL(12,4),
    "termDays" INTEGER,
    "chargeableWeightKg" DECIMAL(10,3),
    "status" "invoice_status" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 0,
    "issueIdempotencyKey" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "issuedByUserId" TEXT,
    "issuedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_line" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "weightBasis" "invoice_line_weight_basis" NOT NULL,
    "rateUsd" DECIMAL(12,4) NOT NULL,
    "amountUsd" DECIMAL(12,2) NOT NULL,
    "amountLkr" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "invoice_line_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "invoice_shipmentId_key" ON "invoice"("shipmentId");

-- CreateIndex
CREATE UNIQUE INDEX "invoice_issueIdempotencyKey_key" ON "invoice"("issueIdempotencyKey");

-- CreateIndex
CREATE INDEX "invoice_line_invoiceId_idx" ON "invoice_line"("invoiceId");

-- AddForeignKey
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "shipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_issuedByUserId_fkey" FOREIGN KEY ("issuedByUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_line" ADD CONSTRAINT "invoice_line_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Automatic audit capture (ARCHITECTURE §10 layer 1), attaching the
-- audit_capture() trigger function (created in the Phase 1
-- audit_capture_triggers migration) to this phase's two new tables — same
-- hand-written pattern as every prior phase's own new tables. PRD §11
-- explicitly lists "invoice create/edit" as always-audited.
CREATE TRIGGER audit_capture_invoice
  AFTER INSERT OR UPDATE OR DELETE ON "invoice"
  FOR EACH ROW EXECUTE FUNCTION audit_capture();

CREATE TRIGGER audit_capture_invoice_line
  AFTER INSERT OR UPDATE OR DELETE ON "invoice_line"
  FOR EACH ROW EXECUTE FUNCTION audit_capture();
