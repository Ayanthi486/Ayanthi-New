-- CreateEnum
CREATE TYPE "cutoff_state" AS ENUM ('APPROACHING', 'URGENT', 'PASSED');

-- AlterTable
ALTER TABLE "shipment" ADD COLUMN     "actualDepartureAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "cutoff_alert" (
    "id" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "state" "cutoff_state" NOT NULL,
    "raisedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledgedAt" TIMESTAMP(3),
    "acknowledgedByUserId" TEXT,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "cutoff_alert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cutoff_alert_shipmentId_key" ON "cutoff_alert"("shipmentId");

-- AddForeignKey
ALTER TABLE "cutoff_alert" ADD CONSTRAINT "cutoff_alert_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "shipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cutoff_alert" ADD CONSTRAINT "cutoff_alert_acknowledgedByUserId_fkey" FOREIGN KEY ("acknowledgedByUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Automatic audit capture (ARCHITECTURE §10 layer 1), attaching the
-- audit_capture() trigger function (created in the Phase 1
-- audit_capture_triggers migration) to this phase's new table — same
-- hand-written pattern as every prior phase's own new tables.
CREATE TRIGGER audit_capture_cutoff_alert
  AFTER INSERT OR UPDATE OR DELETE ON "cutoff_alert"
  FOR EACH ROW EXECUTE FUNCTION audit_capture();
