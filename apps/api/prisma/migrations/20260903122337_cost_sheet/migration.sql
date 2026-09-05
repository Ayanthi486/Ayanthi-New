-- CreateEnum
CREATE TYPE "cost_sheet_status" AS ENUM ('DRAFT', 'RELEASED', 'APPROVED');

-- CreateEnum
CREATE TYPE "cost_sheet_line_type" AS ENUM ('SL_CUSTOMS_RECEIPTS', 'SRILANKAN_SECURITY_CHARGES_RECEIPTS', 'ANIMAL_QUARANTINE', 'PLANT_QUARANTINE', 'TRANSPORT', 'AASL_VEHICLE_PASS', 'LABOUR', 'SRILANKAN_SECURITY_OFFICER_EXPENSES', 'INSPECTION', 'OPERATIONAL', 'OTHER');

-- CreateTable
CREATE TABLE "cost_sheet" (
    "id" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "snNo" TEXT,
    "status" "cost_sheet_status" NOT NULL DEFAULT 'DRAFT',
    "remarks" TEXT,
    "shiftLeaderSignature" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdByUserId" TEXT NOT NULL,
    "releasedByUserId" TEXT,
    "releasedAt" TIMESTAMP(3),
    "approvedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cost_sheet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cost_sheet_line" (
    "id" TEXT NOT NULL,
    "costSheetId" TEXT NOT NULL,
    "lineType" "cost_sheet_line_type" NOT NULL,
    "amount" DECIMAL(12,2),

    CONSTRAINT "cost_sheet_line_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cost_sheet_shipmentId_key" ON "cost_sheet"("shipmentId");

-- CreateIndex
CREATE UNIQUE INDEX "cost_sheet_line_costSheetId_lineType_key" ON "cost_sheet_line"("costSheetId", "lineType");

-- AddForeignKey
ALTER TABLE "cost_sheet" ADD CONSTRAINT "cost_sheet_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "shipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_sheet" ADD CONSTRAINT "cost_sheet_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_sheet" ADD CONSTRAINT "cost_sheet_releasedByUserId_fkey" FOREIGN KEY ("releasedByUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_sheet" ADD CONSTRAINT "cost_sheet_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_sheet_line" ADD CONSTRAINT "cost_sheet_line_costSheetId_fkey" FOREIGN KEY ("costSheetId") REFERENCES "cost_sheet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Automatic audit capture (ARCHITECTURE §10 layer 1), attaching the
-- audit_capture() trigger function (created in the Phase 1
-- audit_capture_triggers migration) to this phase's two new tables — same
-- hand-written pattern as every prior phase's own new tables. PRD §11
-- explicitly lists "Cost Sheet release, edit and approval" as always-audited.
CREATE TRIGGER audit_capture_cost_sheet
  AFTER INSERT OR UPDATE OR DELETE ON "cost_sheet"
  FOR EACH ROW EXECUTE FUNCTION audit_capture();

CREATE TRIGGER audit_capture_cost_sheet_line
  AFTER INSERT OR UPDATE OR DELETE ON "cost_sheet_line"
  FOR EACH ROW EXECUTE FUNCTION audit_capture();
