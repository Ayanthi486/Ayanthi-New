-- AlterTable
ALTER TABLE "airline" ADD COLUMN     "awbPrefix" TEXT;

-- AlterTable
ALTER TABLE "shipment_attachment" ADD COLUMN     "category" TEXT NOT NULL DEFAULT 'OTHER';

-- AlterTable
ALTER TABLE "user" ADD COLUMN     "signatureStorageKey" TEXT;
