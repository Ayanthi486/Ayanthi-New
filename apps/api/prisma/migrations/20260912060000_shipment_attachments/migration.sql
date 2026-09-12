-- CreateTable
CREATE TABLE "shipment_attachment" (
    "id" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "uploadedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shipment_attachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "shipment_attachment_shipmentId_idx" ON "shipment_attachment"("shipmentId");

-- AddForeignKey
ALTER TABLE "shipment_attachment" ADD CONSTRAINT "shipment_attachment_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "shipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipment_attachment" ADD CONSTRAINT "shipment_attachment_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Automatic audit capture (ARCHITECTURE §10 layer 1) — same hand-written
-- pattern as every other phase's new tables (see e.g. the
-- 20260904070856_documents migration).
CREATE TRIGGER audit_capture_shipment_attachment
  AFTER INSERT OR UPDATE OR DELETE ON "shipment_attachment"
  FOR EACH ROW EXECUTE FUNCTION audit_capture();
