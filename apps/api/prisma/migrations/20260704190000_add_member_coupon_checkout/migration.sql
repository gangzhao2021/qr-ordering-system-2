-- AlterTable
ALTER TABLE "Order"
ADD COLUMN "customerName" TEXT,
ADD COLUMN "customerPhone" TEXT,
ADD COLUMN "memberId" TEXT,
ADD COLUMN "couponId" TEXT,
ADD COLUMN "couponCodeSnapshot" TEXT,
ADD COLUMN "couponDiscountCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "couponDiscountLabel" TEXT;

-- AlterTable
ALTER TABLE "Payment"
ADD COLUMN "memberId" TEXT,
ADD COLUMN "memberPhoneSnapshot" TEXT,
ADD COLUMN "memberNameSnapshot" TEXT,
ADD COLUMN "couponId" TEXT,
ADD COLUMN "couponCodeSnapshot" TEXT,
ADD COLUMN "manualDiscountCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "couponDiscountCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "tipCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "pointsEarned" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Coupon"
ADD COLUMN "minimumSubtotalCents" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "CouponRedemption" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "couponId" TEXT NOT NULL,
    "memberId" TEXT,
    "orderId" TEXT,
    "paymentId" TEXT,
    "codeSnapshot" TEXT NOT NULL,
    "discountCents" INTEGER NOT NULL,
    "subtotalCents" INTEGER NOT NULL,
    "redeemedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CouponRedemption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemberPointLedger" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "paymentId" TEXT,
    "pointsDelta" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemberPointLedger_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Order_memberId_idx" ON "Order"("memberId");

-- CreateIndex
CREATE INDEX "Order_couponId_idx" ON "Order"("couponId");

-- CreateIndex
CREATE INDEX "Payment_memberId_idx" ON "Payment"("memberId");

-- CreateIndex
CREATE INDEX "Payment_couponId_idx" ON "Payment"("couponId");

-- CreateIndex
CREATE INDEX "CouponRedemption_storeId_idx" ON "CouponRedemption"("storeId");

-- CreateIndex
CREATE INDEX "CouponRedemption_couponId_idx" ON "CouponRedemption"("couponId");

-- CreateIndex
CREATE INDEX "CouponRedemption_memberId_idx" ON "CouponRedemption"("memberId");

-- CreateIndex
CREATE INDEX "CouponRedemption_orderId_idx" ON "CouponRedemption"("orderId");

-- CreateIndex
CREATE INDEX "CouponRedemption_paymentId_idx" ON "CouponRedemption"("paymentId");

-- CreateIndex
CREATE INDEX "MemberPointLedger_storeId_idx" ON "MemberPointLedger"("storeId");

-- CreateIndex
CREATE INDEX "MemberPointLedger_memberId_idx" ON "MemberPointLedger"("memberId");

-- CreateIndex
CREATE INDEX "MemberPointLedger_paymentId_idx" ON "MemberPointLedger"("paymentId");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CouponRedemption" ADD CONSTRAINT "CouponRedemption_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CouponRedemption" ADD CONSTRAINT "CouponRedemption_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CouponRedemption" ADD CONSTRAINT "CouponRedemption_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CouponRedemption" ADD CONSTRAINT "CouponRedemption_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CouponRedemption" ADD CONSTRAINT "CouponRedemption_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberPointLedger" ADD CONSTRAINT "MemberPointLedger_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberPointLedger" ADD CONSTRAINT "MemberPointLedger_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberPointLedger" ADD CONSTRAINT "MemberPointLedger_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
