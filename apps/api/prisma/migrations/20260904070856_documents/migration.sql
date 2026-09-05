-- CreateEnum
CREATE TYPE "document_type" AS ENUM ('SECURITY_CLEARANCE', 'AWB_STICKER', 'ADF', 'AWB', 'CDN');

-- CreateEnum
CREATE TYPE "document_status" AS ENUM ('DRAFT', 'ISSUED');

-- CreateTable
CREATE TABLE "shipment_document" (
    "id" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "type" "document_type" NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "document_status" NOT NULL DEFAULT 'DRAFT',
    "fieldData" JSONB NOT NULL,
    "snapshot" JSONB,
    "storageKey" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "issuedByUserId" TEXT,
    "issuedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shipment_document_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "shipment_document_shipmentId_type_idx" ON "shipment_document"("shipmentId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "shipment_document_shipmentId_type_version_key" ON "shipment_document"("shipmentId", "type", "version");

-- AddForeignKey
ALTER TABLE "shipment_document" ADD CONSTRAINT "shipment_document_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "shipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipment_document" ADD CONSTRAINT "shipment_document_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipment_document" ADD CONSTRAINT "shipment_document_issuedByUserId_fkey" FOREIGN KEY ("issuedByUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Automatic audit capture (ARCHITECTURE §10 layer 1), attaching the
-- audit_capture() trigger function (created in the Phase 1
-- audit_capture_triggers migration) to this phase's new table — same
-- hand-written pattern as every prior phase's own new tables.
CREATE TRIGGER audit_capture_shipment_document
  AFTER INSERT OR UPDATE OR DELETE ON "shipment_document"
  FOR EACH ROW EXECUTE FUNCTION audit_capture();
