-- CreateEnum
CREATE TYPE "payment_currency" AS ENUM ('USD', 'LKR');

-- CreateTable
CREATE TABLE "payment" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" "payment_currency" NOT NULL,
    "paymentDate" DATE NOT NULL,
    "method" TEXT,
    "reference" TEXT,
    "receiptStorageKey" TEXT,
    "receiptOriginalFilename" TEXT,
    "receiptContentType" TEXT,
    "idempotencyKey" TEXT,
    "recordedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payment_idempotencyKey_key" ON "payment"("idempotencyKey");

-- CreateIndex
CREATE INDEX "payment_invoiceId_idx" ON "payment"("invoiceId");

-- AddForeignKey
ALTER TABLE "payment" ADD CONSTRAINT "payment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment" ADD CONSTRAINT "payment_recordedByUserId_fkey" FOREIGN KEY ("recordedByUserId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Automatic audit capture (ARCHITECTURE §10 layer 1), attaching the
-- audit_capture() trigger function (created in the Phase 1
-- audit_capture_triggers migration) to this phase's new table — same
-- hand-written pattern as every prior phase's own new tables. PRD §11
-- explicitly lists "payment records" as always-audited.
CREATE TRIGGER audit_capture_payment
  AFTER INSERT OR UPDATE OR DELETE ON "payment"
  FOR EACH ROW EXECUTE FUNCTION audit_capture();
