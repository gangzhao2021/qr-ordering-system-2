-- AlterTable
ALTER TABLE "Feedback" ADD COLUMN "orderId" TEXT;
ALTER TABLE "Feedback" ADD COLUMN "memberId" TEXT;
ALTER TABLE "Feedback" ADD COLUMN "tags" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "Feedback" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'NEW';
ALTER TABLE "Feedback" ADD COLUMN "customerName" TEXT;
ALTER TABLE "Feedback" ADD COLUMN "customerPhone" TEXT;
ALTER TABLE "Feedback" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Feedback" ADD COLUMN "handledAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "Feedback_orderId_key" ON "Feedback"("orderId");

-- CreateIndex
CREATE INDEX "Feedback_memberId_idx" ON "Feedback"("memberId");

-- CreateIndex
CREATE INDEX "Feedback_status_idx" ON "Feedback"("status");

-- CreateIndex
CREATE INDEX "Feedback_createdAt_idx" ON "Feedback"("createdAt");

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;
