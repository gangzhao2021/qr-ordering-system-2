ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'INTERAC';
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'STRIPE';
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'WECHAT_PAY';
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'ALIPAY';
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'UNIONPAY';
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'GIFT_CARD';

ALTER TABLE "Store"
ADD COLUMN "market" TEXT NOT NULL DEFAULT 'CANADA',
ADD COLUMN "region" TEXT,
ADD COLUMN "defaultLanguage" TEXT NOT NULL DEFAULT 'en',
ADD COLUMN "supportedLanguages" JSONB NOT NULL DEFAULT '["en"]',
ADD COLUMN "taxNumber" TEXT,
ADD COLUMN "taxMode" TEXT NOT NULL DEFAULT 'SINGLE',
ADD COLUMN "priceIncludesTax" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "taxRules" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN "enabledPaymentMethods" JSONB NOT NULL DEFAULT '["CASH","CARD","OTHER"]',
ADD COLUMN "invoiceInstructions" TEXT,
ADD COLUMN "tipEnabled" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "MenuItem"
ADD COLUMN "nameLocalized" JSONB,
ADD COLUMN "descriptionLocalized" JSONB,
ADD COLUMN "imageUrl" TEXT,
ADD COLUMN "allergens" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN "spiceLevel" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "taxCategory" TEXT NOT NULL DEFAULT 'PREPARED_FOOD',
ADD COLUMN "kitchenStation" TEXT NOT NULL DEFAULT 'HOT',
ADD COLUMN "modifierGroups" JSONB NOT NULL DEFAULT '[]';

ALTER TABLE "OrderItem"
ADD COLUMN "modifierTotalCentsSnapshot" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "modifiers" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN "note" TEXT;

ALTER TABLE "Payment"
ADD COLUMN "status" TEXT NOT NULL DEFAULT 'PAID',
ADD COLUMN "refundedCents" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "Supplier" (
  "id" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "contactName" TEXT,
  "phone" TEXT,
  "email" TEXT,
  "notes" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InventoryAdjustment" (
  "id" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "menuItemId" TEXT NOT NULL,
  "quantityDelta" INTEGER NOT NULL,
  "reason" TEXT NOT NULL,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InventoryAdjustment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Member" (
  "id" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "name" TEXT,
  "phone" TEXT NOT NULL,
  "email" TEXT,
  "points" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Member_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Coupon" (
  "id" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "discountType" TEXT NOT NULL DEFAULT 'PERCENT',
  "discountValue" INTEGER NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "startsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Coupon_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "KdsDevice" (
  "id" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "station" TEXT,
  "token" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "lastSeenAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "KdsDevice_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuditLog" (
  "id" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "actorId" TEXT,
  "actorEmail" TEXT,
  "action" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Feedback" (
  "id" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "tableId" TEXT,
  "rating" INTEGER NOT NULL,
  "comment" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Supplier_storeId_idx" ON "Supplier"("storeId");
CREATE UNIQUE INDEX "Supplier_storeId_name_key" ON "Supplier"("storeId", "name");

CREATE INDEX "InventoryAdjustment_storeId_idx" ON "InventoryAdjustment"("storeId");
CREATE INDEX "InventoryAdjustment_menuItemId_idx" ON "InventoryAdjustment"("menuItemId");

CREATE INDEX "Member_storeId_idx" ON "Member"("storeId");
CREATE UNIQUE INDEX "Member_storeId_phone_key" ON "Member"("storeId", "phone");

CREATE INDEX "Coupon_storeId_idx" ON "Coupon"("storeId");
CREATE UNIQUE INDEX "Coupon_storeId_code_key" ON "Coupon"("storeId", "code");

CREATE UNIQUE INDEX "KdsDevice_token_key" ON "KdsDevice"("token");
CREATE INDEX "KdsDevice_storeId_idx" ON "KdsDevice"("storeId");

CREATE INDEX "AuditLog_storeId_idx" ON "AuditLog"("storeId");
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

CREATE INDEX "Feedback_storeId_idx" ON "Feedback"("storeId");
CREATE INDEX "Feedback_tableId_idx" ON "Feedback"("tableId");

ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InventoryAdjustment" ADD CONSTRAINT "InventoryAdjustment_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InventoryAdjustment" ADD CONSTRAINT "InventoryAdjustment_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Member" ADD CONSTRAINT "Member_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Coupon" ADD CONSTRAINT "Coupon_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KdsDevice" ADD CONSTRAINT "KdsDevice_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "DiningTable"("id") ON DELETE SET NULL ON UPDATE CASCADE;
