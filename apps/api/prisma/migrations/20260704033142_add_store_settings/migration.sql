-- AlterTable
ALTER TABLE "Store" ADD COLUMN     "address" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "receiptFooter" TEXT,
ADD COLUMN     "serviceChargeLabel" TEXT NOT NULL DEFAULT 'Service charge',
ADD COLUMN     "serviceChargeRateBps" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "taxLabel" TEXT NOT NULL DEFAULT 'Tax',
ADD COLUMN     "taxRateBps" INTEGER NOT NULL DEFAULT 0;
