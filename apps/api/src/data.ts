import { randomBytes } from "node:crypto";
import type { Prisma } from "@prisma/client";
import type {
  AuditLog,
  CheckoutTableRequest,
  CheckoutTableResponse,
  Coupon,
  CreateFeedbackRequest,
  CreateCouponRequest,
  CreateDiningTableRequest,
  CreateIngredientRequest,
  CreateInventoryAdjustmentRequest,
  CreateKdsDeviceRequest,
  CreateMemberRequest,
  CreateMenuCategoryRequest,
  CreateMenuItemRequest,
  CreateOrderRequest,
  CreatePurchaseOrderRequest,
  CreateServiceRequestRequest,
  CreateStaffUserRequest,
  CreateStocktakeRequest,
  CreateSupplierRequest,
  CustomerFeedback,
  CustomerOrder,
  DiningTable,
  FohPendingItem,
  FohTable,
  InventoryAdjustment,
  Ingredient,
  KitchenPendingItem,
  KdsDevice,
  LanguageCode,
  LocalizedText,
  ManageAnalyticsResponse,
  ManageOperationsResponse,
  ManageStaffUser,
  Member,
  MenuCategory,
  MenuItem,
  MenuRecipe,
  MenuModifierGroup,
  Order,
  OrderItem,
  OrderItemStatus,
  OrderStatus,
  OrderTotals,
  Payment,
  PaymentMethod,
  PaymentMethodOption,
  PaymentsResponse,
  P0SmokeCockpitResponse,
  P0SmokeCheck,
  P0SmokeStatus,
  PrintJob,
  PurchaseOrder,
  RefundPaymentRequest,
  ReceivePurchaseOrderRequest,
  ServiceRequest,
  ServiceRequestStatus,
  Stocktake,
  StoreMarket,
  StoreSettings,
  StoreSummary,
  Supplier,
  TableStatus,
  TaxRule,
  UpdateDiningTableRequest,
  UpdateCouponRequest,
  UpdateFeedbackRequest,
  UpdateIngredientRequest,
  UpdateKdsDeviceRequest,
  UpdateMenuCategoryRequest,
  UpdateMenuItemInventoryRequest,
  UpdateMenuItemRequest,
  UpdateMemberRequest,
  UpdateStaffUserRequest,
  UpdateStoreSettingsRequest,
  UpdateSupplierRequest,
  UpsertRecipeRequest,
} from "@qr2/shared";
import { STAFF_ROLES } from "@qr2/shared";
import { hashPassword } from "./auth.js";
import { prisma } from "./db.js";
import { HttpError } from "./http.js";

const LANGUAGE_SET = new Set<LanguageCode>(["en", "fr-CA", "zh-CN"]);
const PAYMENT_METHOD_SET = new Set<PaymentMethodOption>([
  "CASH",
  "CARD",
  "INTERAC",
  "STRIPE",
  "WECHAT_PAY",
  "ALIPAY",
  "UNIONPAY",
  "GIFT_CARD",
  "OTHER",
]);

type StoreRecord = {
  id: string;
  name: string;
  market: string;
  region: string | null;
  currency: string;
  locale: string;
  timezone: string;
  defaultLanguage: string;
  supportedLanguages: unknown;
  address: string | null;
  phone: string | null;
  taxNumber: string | null;
  taxMode: string;
  priceIncludesTax: boolean;
  taxRules: unknown;
  taxLabel: string;
  taxRateBps: number;
  serviceChargeLabel: string;
  serviceChargeRateBps: number;
  enabledPaymentMethods: unknown;
  invoiceInstructions: string | null;
  tipEnabled: boolean;
  receiptFooter: string | null;
};

type UserRecord = {
  id: string;
  storeId: string;
  email: string;
  name: string | null;
  role: ManageStaffUser["role"];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type TableRecord = {
  id: string;
  number: string;
  name: string | null;
  qrToken: string;
  isActive: boolean;
};

type MenuItemRecord = {
  id: string;
  categoryId: string;
  name: string;
  nameLocalized: unknown;
  description: string | null;
  descriptionLocalized: unknown;
  imageUrl: string | null;
  allergens: unknown;
  spiceLevel: number;
  taxCategory: string;
  kitchenStation: string;
  modifierGroups: unknown;
  priceCents: number;
  isAvailable: boolean;
  stockQuantity: number | null;
  lowStockThreshold: number;
  sortOrder: number;
};

type MenuCategoryRecord = {
  id: string;
  name: string;
  sortOrder: number;
  items: MenuItemRecord[];
};

type OrderItemRecord = {
  id: string;
  orderId: string;
  menuItemId: string;
  nameSnapshot: string;
  priceCentsSnapshot: number;
  modifierTotalCentsSnapshot: number;
  modifiers: unknown;
  note: string | null;
  quantity: number;
  status: OrderItemStatus;
  createdAt: Date;
};

type OrderRecord = {
  id: string;
  tableId: string;
  status: OrderStatus;
  createdAt: Date;
  submittedAt: Date;
  closedAt: Date | null;
  customerName: string | null;
  customerPhone: string | null;
  memberId: string | null;
  couponId: string | null;
  couponCodeSnapshot: string | null;
  couponDiscountCents: number;
  couponDiscountLabel: string | null;
  items: OrderItemRecord[];
  feedback?: FeedbackRecord[];
};

type FeedbackRecord = {
  id: string;
  tableId: string | null;
  orderId: string | null;
  memberId: string | null;
  rating: number;
  comment: string | null;
  tags: unknown;
  status: string;
  customerName: string | null;
  customerPhone: string | null;
  createdAt: Date;
  handledAt: Date | null;
  table?: { number: string } | null;
  member?: { phone: string; name: string | null } | null;
};

type ServiceRequestRecord = {
  id: string;
  tableId: string;
  type: ServiceRequest["type"];
  status: ServiceRequestStatus;
  note: string | null;
  createdAt: Date;
  handledAt: Date | null;
};

type PrintJobRecord = {
  id: string;
  type: PrintJob["type"];
  status: PrintJob["status"];
  orderId: string | null;
  tableId: string | null;
  attempts: number;
  payload: unknown;
  createdAt: Date;
  printedAt: Date | null;
  failedAt: Date | null;
  table?: { number: string } | null;
};

type PaymentRecord = {
  id: string;
  tableId: string;
  method: Payment["method"];
  status: string;
  amountCents: number;
  refundedCents: number;
  currency: string;
  reference: string | null;
  note: string | null;
  orderIds: unknown;
  memberId: string | null;
  memberPhoneSnapshot: string | null;
  memberNameSnapshot: string | null;
  couponId: string | null;
  couponCodeSnapshot: string | null;
  manualDiscountCents: number;
  couponDiscountCents: number;
  tipCents: number;
  pointsEarned: number;
  paidAt: Date;
  createdAt: Date;
  table?: { number: string } | null;
};

function toIso(date: Date) {
  return date.toISOString();
}

function optionalIso(date: Date | null | undefined) {
  return date ? date.toISOString() : null;
}

function jsonObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function jsonArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function localizedText(value: unknown): LocalizedText | null {
  const object = jsonObject(value);
  const result: LocalizedText = {};
  for (const language of LANGUAGE_SET) {
    const candidate = object[language];
    if (typeof candidate === "string" && candidate.trim()) {
      result[language] = candidate;
    }
  }
  return Object.keys(result).length > 0 ? result : null;
}

function stringArray(value: unknown): string[] {
  return jsonArray(value)
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function languages(value: unknown, fallback: LanguageCode): LanguageCode[] {
  const parsed = stringArray(value).filter((entry): entry is LanguageCode =>
    LANGUAGE_SET.has(entry as LanguageCode),
  );
  return parsed.length > 0 ? parsed : [fallback];
}

function language(value: string): LanguageCode {
  return LANGUAGE_SET.has(value as LanguageCode)
    ? (value as LanguageCode)
    : "en";
}

function storeMarket(value: string): StoreMarket {
  if (value === "CHINA" || value === "OTHER") return value;
  return "CANADA";
}

function paymentMethods(value: unknown): PaymentMethodOption[] {
  const parsed = stringArray(value).filter(
    (entry): entry is PaymentMethodOption =>
      PAYMENT_METHOD_SET.has(entry as PaymentMethodOption),
  );
  return parsed.length > 0 ? parsed : ["CASH", "CARD", "OTHER"];
}

function taxRules(
  value: unknown,
  store: Pick<StoreRecord, "taxLabel" | "taxRateBps">,
): TaxRule[] {
  const parsed: TaxRule[] = [];
  for (const entry of jsonArray(value)) {
    const object = jsonObject(entry);
    const id = typeof object.id === "string" ? object.id.trim() : "";
    const label =
      typeof object.label === "string" ? object.label.trim() : store.taxLabel;
    const rateBps =
      typeof object.rateBps === "number" && Number.isFinite(object.rateBps)
        ? Math.max(0, Math.round(object.rateBps))
        : 0;
    const appliesTo =
      typeof object.appliesTo === "string"
        ? object.appliesTo.trim() || "ALL"
        : "ALL";
    if (id && label && rateBps > 0) {
      parsed.push({
        id,
        label,
        rateBps,
        appliesTo,
        compoundOnPrevious: object.compoundOnPrevious === true,
      });
    }
  }

  if (parsed.length > 0) return parsed;
  return store.taxRateBps > 0
    ? [
        {
          id: "default",
          label: store.taxLabel,
          rateBps: store.taxRateBps,
          appliesTo: "ALL",
        },
      ]
    : [];
}

function modifierGroups(value: unknown): MenuModifierGroup[] {
  const groups: MenuModifierGroup[] = [];
  for (const entry of jsonArray(value)) {
    const object = jsonObject(entry);
    const id = typeof object.id === "string" ? object.id.trim() : "";
    const name = typeof object.name === "string" ? object.name.trim() : "";
    const options: MenuModifierGroup["options"] = [];
    for (const optionEntry of jsonArray(object.options)) {
      const option = jsonObject(optionEntry);
      const optionId = typeof option.id === "string" ? option.id.trim() : "";
      const optionName =
        typeof option.name === "string" ? option.name.trim() : "";
      const priceDeltaCents =
        typeof option.priceDeltaCents === "number" &&
        Number.isFinite(option.priceDeltaCents)
          ? Math.round(option.priceDeltaCents)
          : 0;
      if (optionId && optionName) {
        options.push({
          id: optionId,
          name: optionName,
          nameLocalized: localizedText(option.nameLocalized),
          priceDeltaCents,
          isDefault: option.isDefault === true,
        });
      }
    }
    if (!id || !name || options.length === 0) continue;
    const maxSelect =
      typeof object.maxSelect === "number"
        ? Math.max(1, Math.round(object.maxSelect))
        : 1;
    const minSelect =
      typeof object.minSelect === "number"
        ? Math.max(0, Math.min(maxSelect, Math.round(object.minSelect)))
        : object.required === true
          ? 1
          : 0;
    groups.push({
      id,
      name,
      nameLocalized: localizedText(object.nameLocalized),
      required: object.required === true || minSelect > 0,
      minSelect,
      maxSelect,
      options,
    });
  }
  return groups;
}

function selectedModifiers(value: unknown): OrderItem["modifiers"] {
  return jsonArray(value)
    .map((entry) => {
      const object = jsonObject(entry);
      const groupId = typeof object.groupId === "string" ? object.groupId : "";
      const optionId =
        typeof object.optionId === "string" ? object.optionId : "";
      const name = typeof object.name === "string" ? object.name : "";
      const priceDeltaCents =
        typeof object.priceDeltaCents === "number" &&
        Number.isFinite(object.priceDeltaCents)
          ? Math.round(object.priceDeltaCents)
          : 0;
      return groupId && optionId && name
        ? { groupId, optionId, name, priceDeltaCents }
        : null;
    })
    .filter((entry): entry is OrderItem["modifiers"][number] => entry !== null);
}

function mapStore(store: StoreRecord): StoreSummary {
  return {
    id: store.id,
    name: store.name,
    currency: store.currency,
    locale: store.locale,
    timezone: store.timezone,
  };
}

function mapStoreSettings(store: StoreRecord): StoreSettings {
  const defaultLanguage = language(store.defaultLanguage);
  return {
    ...mapStore(store),
    market: storeMarket(store.market),
    region: store.region,
    defaultLanguage,
    supportedLanguages: languages(store.supportedLanguages, defaultLanguage),
    address: store.address,
    phone: store.phone,
    taxNumber: store.taxNumber,
    taxMode:
      store.taxMode === "CANADA" || store.taxMode === "CHINA"
        ? store.taxMode
        : "SINGLE",
    priceIncludesTax: store.priceIncludesTax,
    taxRules: taxRules(store.taxRules, store),
    taxLabel: store.taxLabel,
    taxRateBps: store.taxRateBps,
    serviceChargeLabel: store.serviceChargeLabel,
    serviceChargeRateBps: store.serviceChargeRateBps,
    enabledPaymentMethods: paymentMethods(store.enabledPaymentMethods),
    invoiceInstructions: store.invoiceInstructions,
    tipEnabled: store.tipEnabled,
    receiptFooter: store.receiptFooter,
  };
}

function mapStaffUser(user: UserRecord): ManageStaffUser {
  return {
    id: user.id,
    storeId: user.storeId,
    email: user.email,
    name: user.name,
    role: user.role,
    isActive: user.isActive,
    createdAt: toIso(user.createdAt),
    updatedAt: toIso(user.updatedAt),
  };
}

function mapTable(table: TableRecord): DiningTable {
  return {
    id: table.id,
    number: table.number,
    name: table.name,
    qrToken: table.qrToken,
    isActive: table.isActive,
  };
}

function mapMenuItem(item: MenuItemRecord): MenuItem {
  const isSoldOut = item.stockQuantity !== null && item.stockQuantity <= 0;
  const isLowStock =
    item.stockQuantity !== null &&
    item.stockQuantity > 0 &&
    item.stockQuantity <= item.lowStockThreshold;

  return {
    id: item.id,
    categoryId: item.categoryId,
    name: item.name,
    nameLocalized: localizedText(item.nameLocalized),
    description: item.description,
    descriptionLocalized: localizedText(item.descriptionLocalized),
    imageUrl: item.imageUrl,
    allergens: stringArray(item.allergens),
    spiceLevel: item.spiceLevel,
    taxCategory: item.taxCategory,
    kitchenStation: item.kitchenStation,
    modifierGroups: modifierGroups(item.modifierGroups),
    priceCents: item.priceCents,
    isAvailable: item.isAvailable,
    stockQuantity: item.stockQuantity,
    lowStockThreshold: item.lowStockThreshold,
    isSoldOut,
    isLowStock,
    sortOrder: item.sortOrder,
  };
}

function mapMenuCategory(category: MenuCategoryRecord): MenuCategory {
  return {
    id: category.id,
    name: category.name,
    sortOrder: category.sortOrder,
    items: category.items.map(mapMenuItem),
  };
}

function mapOrderItem(item: OrderItemRecord): OrderItem {
  return {
    id: item.id,
    orderId: item.orderId,
    menuItemId: item.menuItemId,
    nameSnapshot: item.nameSnapshot,
    priceCentsSnapshot: item.priceCentsSnapshot,
    modifierTotalCentsSnapshot: item.modifierTotalCentsSnapshot,
    modifiers: selectedModifiers(item.modifiers),
    note: item.note,
    quantity: item.quantity,
    status: item.status,
    createdAt: toIso(item.createdAt),
  };
}

function mapOrder(order: OrderRecord): Order {
  return {
    id: order.id,
    tableId: order.tableId,
    status: order.status,
    createdAt: toIso(order.createdAt),
    submittedAt: toIso(order.submittedAt),
    closedAt: optionalIso(order.closedAt),
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    memberId: order.memberId,
    couponCode: order.couponCodeSnapshot,
    couponDiscountCents: order.couponDiscountCents,
    couponDiscountLabel: order.couponDiscountLabel,
    items: order.items.map(mapOrderItem),
    feedback: order.feedback?.[0] ? mapFeedback(order.feedback[0]) : null,
  };
}

function feedbackStatus(value: string): CustomerFeedback["status"] {
  if (value === "REVIEWED" || value === "RESOLVED") return value;
  return "NEW";
}

function mapFeedback(feedback: FeedbackRecord): CustomerFeedback {
  return {
    id: feedback.id,
    tableId: feedback.tableId,
    tableNumber: feedback.table?.number ?? null,
    orderId: feedback.orderId,
    memberId: feedback.memberId,
    memberPhone: feedback.member?.phone ?? feedback.customerPhone,
    memberName: feedback.member?.name ?? feedback.customerName,
    customerName: feedback.customerName,
    customerPhone: feedback.customerPhone,
    rating: feedback.rating,
    comment: feedback.comment,
    tags: stringArray(feedback.tags),
    status: feedbackStatus(feedback.status),
    createdAt: toIso(feedback.createdAt),
    handledAt: optionalIso(feedback.handledAt),
  };
}

function mapServiceRequest(request: ServiceRequestRecord): ServiceRequest {
  return {
    id: request.id,
    tableId: request.tableId,
    type: request.type,
    status: request.status,
    note: request.note,
    createdAt: toIso(request.createdAt),
    handledAt: optionalIso(request.handledAt),
  };
}

function mapPrintJob(job: PrintJobRecord): PrintJob {
  return {
    id: job.id,
    type: job.type,
    status: job.status,
    orderId: job.orderId,
    tableId: job.tableId,
    tableNumber: job.table?.number ?? null,
    attempts: job.attempts,
    payload: job.payload,
    createdAt: toIso(job.createdAt),
    printedAt: optionalIso(job.printedAt),
    failedAt: optionalIso(job.failedAt),
  };
}

function mapPayment(payment: PaymentRecord): Payment {
  const orderIds = Array.isArray(payment.orderIds)
    ? payment.orderIds.filter((id): id is string => typeof id === "string")
    : [];
  return {
    id: payment.id,
    tableId: payment.tableId,
    tableNumber: payment.table?.number ?? null,
    method: payment.method,
    status:
      payment.status === "REFUNDED" || payment.status === "PARTIALLY_REFUNDED"
        ? payment.status
        : "PAID",
    amountCents: payment.amountCents,
    refundedCents: payment.refundedCents,
    currency: payment.currency,
    reference: payment.reference,
    note: payment.note,
    orderIds,
    memberId: payment.memberId,
    memberPhone: payment.memberPhoneSnapshot,
    memberName: payment.memberNameSnapshot,
    couponCode: payment.couponCodeSnapshot,
    manualDiscountCents: payment.manualDiscountCents,
    couponDiscountCents: payment.couponDiscountCents,
    tipCents: payment.tipCents,
    pointsEarned: payment.pointsEarned,
    paidAt: toIso(payment.paidAt),
    createdAt: toIso(payment.createdAt),
  };
}

function mapSupplier(supplier: {
  id: string;
  name: string;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: Date;
}): Supplier {
  return {
    id: supplier.id,
    name: supplier.name,
    contactName: supplier.contactName,
    phone: supplier.phone,
    email: supplier.email,
    notes: supplier.notes,
    isActive: supplier.isActive,
    createdAt: toIso(supplier.createdAt),
  };
}

function mapInventoryAdjustment(adjustment: {
  id: string;
  menuItemId: string;
  purchaseOrderId: string | null;
  stocktakeId: string | null;
  quantityDelta: number;
  reason: string;
  note: string | null;
  createdAt: Date;
  menuItem: { name: string };
  purchaseOrder?: { orderNumber: string } | null;
  stocktake?: { name: string } | null;
}): InventoryAdjustment {
  return {
    id: adjustment.id,
    menuItemId: adjustment.menuItemId,
    menuItemName: adjustment.menuItem.name,
    purchaseOrderId: adjustment.purchaseOrderId,
    purchaseOrderNumber: adjustment.purchaseOrder?.orderNumber ?? null,
    stocktakeId: adjustment.stocktakeId,
    stocktakeName: adjustment.stocktake?.name ?? null,
    quantityDelta: adjustment.quantityDelta,
    reason: adjustment.reason,
    note: adjustment.note,
    createdAt: toIso(adjustment.createdAt),
  };
}

function mapStocktake(stocktake: {
  id: string;
  name: string;
  status: string;
  note: string | null;
  countedAt: Date;
  appliedAt: Date;
  createdAt: Date;
  lines: Array<{
    id: string;
    menuItemId: string;
    expectedQuantity: number;
    countedQuantity: number;
    differenceQuantity: number;
    note: string | null;
    menuItem: { name: string };
  }>;
}): Stocktake {
  return {
    id: stocktake.id,
    name: stocktake.name,
    status: stocktake.status === "CANCELED" ? "CANCELED" : "APPLIED",
    note: stocktake.note,
    countedAt: toIso(stocktake.countedAt),
    appliedAt: optionalIso(stocktake.appliedAt),
    createdAt: toIso(stocktake.createdAt),
    lines: stocktake.lines.map((line) => ({
      id: line.id,
      menuItemId: line.menuItemId,
      menuItemName: line.menuItem.name,
      expectedQuantity: line.expectedQuantity,
      countedQuantity: line.countedQuantity,
      differenceQuantity: line.differenceQuantity,
      note: line.note,
    })),
  };
}

function mapIngredient(ingredient: {
  id: string;
  name: string;
  unit: string;
  stockQuantity: number;
  unitCostCents: number;
  lowStockThreshold: number;
  isActive: boolean;
  createdAt: Date;
}): Ingredient {
  return {
    id: ingredient.id,
    name: ingredient.name,
    unit: ingredient.unit,
    stockQuantity: ingredient.stockQuantity,
    unitCostCents: ingredient.unitCostCents,
    lowStockThreshold: ingredient.lowStockThreshold,
    isActive: ingredient.isActive,
    isLowStock:
      ingredient.stockQuantity > 0 &&
      ingredient.stockQuantity <= ingredient.lowStockThreshold,
    createdAt: toIso(ingredient.createdAt),
  };
}

function mapRecipe(recipe: {
  id: string;
  menuItemId: string;
  yieldQuantity: number;
  note: string | null;
  createdAt: Date;
  updatedAt: Date;
  menuItem: { name: string; priceCents: number };
  lines: Array<{
    id: string;
    ingredientId: string;
    quantity: number;
    note: string | null;
    ingredient: {
      name: string;
      unit: string;
      unitCostCents: number;
    };
  }>;
}): MenuRecipe {
  const lines = recipe.lines.map((line) => {
    const costCents = line.quantity * line.ingredient.unitCostCents;
    return {
      id: line.id,
      ingredientId: line.ingredientId,
      ingredientName: line.ingredient.name,
      unit: line.ingredient.unit,
      quantity: line.quantity,
      unitCostCents: line.ingredient.unitCostCents,
      costCents,
      note: line.note,
    };
  });
  const totalLineCostCents = lines.reduce(
    (sum, line) => sum + line.costCents,
    0,
  );
  const costCents = Math.round(
    totalLineCostCents / Math.max(recipe.yieldQuantity, 1),
  );
  const marginCents = recipe.menuItem.priceCents - costCents;
  return {
    id: recipe.id,
    menuItemId: recipe.menuItemId,
    menuItemName: recipe.menuItem.name,
    menuItemPriceCents: recipe.menuItem.priceCents,
    yieldQuantity: recipe.yieldQuantity,
    note: recipe.note,
    costCents,
    marginCents,
    marginBps:
      recipe.menuItem.priceCents > 0
        ? Math.round((marginCents / recipe.menuItem.priceCents) * 10000)
        : 0,
    createdAt: toIso(recipe.createdAt),
    updatedAt: toIso(recipe.updatedAt),
    lines,
  };
}

function mapPurchaseOrder(order: {
  id: string;
  supplierId: string;
  orderNumber: string;
  status: PurchaseOrder["status"];
  expectedAt: Date | null;
  orderedAt: Date | null;
  receivedAt: Date | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  supplier: { name: string };
  lines: Array<{
    id: string;
    menuItemId: string;
    quantityOrdered: number;
    quantityReceived: number;
    unitCostCents: number | null;
    note: string | null;
    menuItem: { name: string };
  }>;
}): PurchaseOrder {
  return {
    id: order.id,
    supplierId: order.supplierId,
    supplierName: order.supplier.name,
    orderNumber: order.orderNumber,
    status: order.status,
    expectedAt: order.expectedAt ? toIso(order.expectedAt) : null,
    orderedAt: order.orderedAt ? toIso(order.orderedAt) : null,
    receivedAt: order.receivedAt ? toIso(order.receivedAt) : null,
    notes: order.notes,
    createdAt: toIso(order.createdAt),
    updatedAt: toIso(order.updatedAt),
    lines: order.lines.map((line) => ({
      id: line.id,
      menuItemId: line.menuItemId,
      menuItemName: line.menuItem.name,
      quantityOrdered: line.quantityOrdered,
      quantityReceived: line.quantityReceived,
      unitCostCents: line.unitCostCents,
      note: line.note,
    })),
  };
}

function mapMember(member: {
  id: string;
  name: string | null;
  phone: string;
  email: string | null;
  points: number;
  createdAt: Date;
  orderCount?: number;
  paymentCount?: number;
  totalSpendCents?: number;
  lastPaidAt?: Date | string | null;
  feedbackCount?: number;
  lastFeedbackRating?: number | null;
  recentOrders?: Member["recentOrders"];
  recentPayments?: Member["recentPayments"];
  recentCoupons?: Member["recentCoupons"];
  recentFeedback?: Member["recentFeedback"];
}): Member {
  return {
    id: member.id,
    name: member.name,
    phone: member.phone,
    email: member.email,
    points: member.points,
    orderCount: member.orderCount,
    paymentCount: member.paymentCount,
    totalSpendCents: member.totalSpendCents,
    lastPaidAt:
      member.lastPaidAt instanceof Date
        ? toIso(member.lastPaidAt)
        : (member.lastPaidAt ?? null),
    feedbackCount: member.feedbackCount,
    lastFeedbackRating: member.lastFeedbackRating,
    recentOrders: member.recentOrders,
    recentPayments: member.recentPayments,
    recentCoupons: member.recentCoupons,
    recentFeedback: member.recentFeedback,
    createdAt: toIso(member.createdAt),
  };
}

function mapCoupon(coupon: {
  id: string;
  code: string;
  discountType: string;
  discountValue: number;
  minimumSubtotalCents: number;
  isActive: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
  redemptionCount?: number;
}): Coupon {
  return {
    id: coupon.id,
    code: coupon.code,
    discountType: coupon.discountType === "AMOUNT" ? "AMOUNT" : "PERCENT",
    discountValue: coupon.discountValue,
    minimumSubtotalCents: coupon.minimumSubtotalCents,
    isActive: coupon.isActive,
    startsAt: optionalIso(coupon.startsAt),
    endsAt: optionalIso(coupon.endsAt),
    redemptionCount: coupon.redemptionCount,
  };
}

function mapKdsDevice(device: {
  id: string;
  name: string;
  station: string | null;
  token: string;
  isActive: boolean;
  lastSeenAt: Date | null;
}): KdsDevice {
  return {
    id: device.id,
    name: device.name,
    station: device.station,
    token: device.token,
    isActive: device.isActive,
    lastSeenAt: optionalIso(device.lastSeenAt),
  };
}

function mapAuditLog(log: {
  id: string;
  actorEmail: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  createdAt: Date;
}): AuditLog {
  return {
    id: log.id,
    actorEmail: log.actorEmail,
    action: log.action,
    entityType: log.entityType,
    entityId: log.entityId,
    createdAt: toIso(log.createdAt),
  };
}

function buildOrderTicketPayload(input: {
  store: StoreRecord;
  table: TableRecord;
  order: {
    id: string;
    createdAt: Date;
    submittedAt: Date;
    couponDiscountCents?: number;
    couponDiscountLabel?: string | null;
    couponCodeSnapshot?: string | null;
    items: OrderItemRecord[];
  };
}) {
  return {
    store: {
      id: input.store.id,
      name: input.store.name,
      currency: input.store.currency,
      locale: input.store.locale,
      timezone: input.store.timezone,
      address: input.store.address,
      phone: input.store.phone,
      taxNumber: input.store.taxNumber,
      receiptFooter: input.store.receiptFooter,
    },
    table: {
      id: input.table.id,
      number: input.table.number,
      name: input.table.name,
    },
    order: {
      id: input.order.id,
      createdAt: toIso(input.order.createdAt),
      submittedAt: toIso(input.order.submittedAt),
      items: input.order.items.map((item) => ({
        id: item.id,
        name: item.nameSnapshot,
        quantity: item.quantity,
        modifiers: selectedModifiers(item.modifiers),
        note: item.note,
        status: item.status,
      })),
      totals: calculateTotals(
        input.order.items,
        input.store,
        input.order.couponDiscountCents ?? 0,
        input.order.couponDiscountLabel ?? input.order.couponCodeSnapshot,
      ),
    },
  };
}

type TotalsLine = Pick<
  OrderItemRecord,
  "priceCentsSnapshot" | "modifierTotalCentsSnapshot" | "quantity" | "status"
>;

function itemSubtotal(item: TotalsLine) {
  if (item.status === "CANCELED") return 0;
  return (
    (item.priceCentsSnapshot + item.modifierTotalCentsSnapshot) * item.quantity
  );
}

function calculateTotals(
  items: TotalsLine[],
  store: StoreRecord,
  discountCents = 0,
  discountLabel?: string | null,
): OrderTotals {
  const subtotalCents = items.reduce(
    (sum, item) => sum + itemSubtotal(item),
    0,
  );
  const serviceChargeCents = Math.round(
    (subtotalCents * store.serviceChargeRateBps) / 10000,
  );
  const taxableCents = subtotalCents + serviceChargeCents;
  const rules = taxRules(store.taxRules, store);
  let runningTaxBase = taxableCents;
  let includedTaxCents = 0;
  const taxLines = rules.map((rule) => {
    const base = rule.compoundOnPrevious ? runningTaxBase : taxableCents;
    const amountCents = store.priceIncludesTax
      ? Math.round((base * rule.rateBps) / (10000 + rule.rateBps))
      : Math.round((base * rule.rateBps) / 10000);
    if (!store.priceIncludesTax && rule.compoundOnPrevious) {
      runningTaxBase += amountCents;
    }
    if (store.priceIncludesTax) includedTaxCents += amountCents;
    return {
      label: rule.label,
      rateBps: rule.rateBps,
      amountCents,
    };
  });
  const taxCents = store.priceIncludesTax
    ? includedTaxCents
    : taxLines.reduce((sum, line) => sum + line.amountCents, 0);
  const grossTotalCents =
    subtotalCents +
    serviceChargeCents +
    (store.priceIncludesTax ? 0 : taxCents);
  const cappedDiscountCents = Math.min(
    Math.max(Math.round(discountCents), 0),
    grossTotalCents,
  );
  return {
    subtotalCents,
    serviceChargeCents,
    taxCents,
    taxLines,
    includedTaxCents,
    discountCents: cappedDiscountCents,
    discountLabel: cappedDiscountCents > 0 ? (discountLabel ?? null) : null,
    totalCents: grossTotalCents - cappedDiscountCents,
    serviceChargeRateBps: store.serviceChargeRateBps,
    taxRateBps: store.taxRateBps,
    serviceChargeLabel: store.serviceChargeLabel,
    taxLabel: store.taxLabel,
  };
}

function mapCustomerOrder(
  order: OrderRecord,
  store: StoreRecord,
): CustomerOrder {
  return {
    ...mapOrder(order),
    totals: calculateTotals(
      order.items,
      store,
      order.couponDiscountCents,
      order.couponDiscountLabel ?? order.couponCodeSnapshot,
    ),
  };
}

function resolveTableStatus(
  hasOpenOrders: boolean,
  pendingItems: OrderItemRecord[],
  activeRequests: ServiceRequestRecord[],
): TableStatus {
  if (
    activeRequests.some(
      (request) =>
        request.type === "FOLLOW_UP" || request.type === "CALL_STAFF",
    )
  ) {
    return "URGENT";
  }
  if (!hasOpenOrders && activeRequests.length === 0) return "EMPTY";
  if (hasOpenOrders && pendingItems.length === 0) return "CHECKOUT";
  return "DINING";
}

async function getDefaultStore() {
  const store = await prisma.store.findFirst({ orderBy: { createdAt: "asc" } });
  if (!store) {
    throw new HttpError(
      500,
      "STORE_NOT_CONFIGURED",
      "Run pnpm -C apps/api db:seed before using the API",
    );
  }
  return store;
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function normalizePhone(phone: string | null | undefined) {
  const trimmed = phone?.trim();
  return trimmed ? trimmed : null;
}

function normalizeCouponCode(code: string | null | undefined) {
  const trimmed = code?.trim().toUpperCase();
  return trimmed ? trimmed : null;
}

function isManagerRole(role: string | null | undefined) {
  return role === "DEV" || role === "ADMIN";
}

async function findOrCreateMember(input: {
  tx: Prisma.TransactionClient;
  storeId: string;
  phone?: string | null;
  name?: string | null;
}) {
  const phone = normalizePhone(input.phone);
  if (!phone) return null;
  const name = input.name?.trim() || null;
  return input.tx.member.upsert({
    where: {
      storeId_phone: {
        storeId: input.storeId,
        phone,
      },
    },
    update: name ? { name } : {},
    create: {
      storeId: input.storeId,
      name,
      phone,
      points: 0,
    },
  });
}

type CouponRuleRecord = {
  id: string;
  code: string;
  discountType: string;
  discountValue: number;
  minimumSubtotalCents: number;
  isActive: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
};

function calculateCouponDiscount(input: {
  coupon: CouponRuleRecord;
  subtotalCents: number;
  totalBeforeDiscountCents: number;
}) {
  const rawDiscount =
    input.coupon.discountType === "AMOUNT"
      ? input.coupon.discountValue
      : Math.round(
          (input.subtotalCents *
            Math.min(Math.max(input.coupon.discountValue, 0), 100)) /
            100,
        );
  return Math.min(
    Math.max(rawDiscount, 0),
    Math.max(input.totalBeforeDiscountCents, 0),
  );
}

async function resolveCouponDiscount(input: {
  tx: Prisma.TransactionClient;
  storeId: string;
  code?: string | null;
  subtotalCents: number;
  totalBeforeDiscountCents: number;
  memberId?: string | null;
  skipOpenOrderCheck?: boolean;
}) {
  const code = normalizeCouponCode(input.code);
  if (!code) return null;

  const coupon = await input.tx.coupon.findFirst({
    where: { storeId: input.storeId, code },
  });
  if (!coupon) {
    throw new HttpError(404, "COUPON_NOT_FOUND", "Coupon not found");
  }

  const now = new Date();
  if (
    !coupon.isActive ||
    (coupon.startsAt && coupon.startsAt > now) ||
    (coupon.endsAt && coupon.endsAt < now)
  ) {
    throw new HttpError(400, "COUPON_INACTIVE", "Coupon is not active");
  }

  if (input.subtotalCents < coupon.minimumSubtotalCents) {
    throw new HttpError(
      400,
      "COUPON_MINIMUM_NOT_MET",
      "Order subtotal does not meet the coupon minimum",
    );
  }

  if (input.memberId) {
    const existingRedemption = await input.tx.couponRedemption.findFirst({
      where: {
        storeId: input.storeId,
        couponId: coupon.id,
        memberId: input.memberId,
      },
      select: { id: true },
    });
    if (existingRedemption) {
      throw new HttpError(
        409,
        "COUPON_ALREADY_REDEEMED",
        "This member has already used this coupon",
      );
    }
    if (!input.skipOpenOrderCheck) {
      const existingOpenOrder = await input.tx.order.findFirst({
        where: {
          storeId: input.storeId,
          memberId: input.memberId,
          couponId: coupon.id,
          status: "SUBMITTED",
        },
        select: { id: true },
      });
      if (existingOpenOrder) {
        throw new HttpError(
          409,
          "COUPON_ALREADY_APPLIED",
          "This member already has an open order using this coupon",
        );
      }
    }
  }

  const discountCents = calculateCouponDiscount({
    coupon,
    subtotalCents: input.subtotalCents,
    totalBeforeDiscountCents: input.totalBeforeDiscountCents,
  });
  if (discountCents <= 0) {
    throw new HttpError(400, "COUPON_NO_VALUE", "Coupon has no value here");
  }

  return {
    coupon,
    discountCents,
    label: coupon.code,
  };
}

function memberPointsForPayment(amountCents: number, tipCents: number) {
  return Math.max(0, Math.floor((amountCents - tipCents) / 100));
}

function tableCouponDiscount(
  orders: Array<{
    couponDiscountCents: number;
    couponDiscountLabel: string | null;
    couponCodeSnapshot: string | null;
  }>,
) {
  const discountCents = orders.reduce(
    (sum, order) => sum + order.couponDiscountCents,
    0,
  );
  const labels = Array.from(
    new Set(
      orders
        .map((order) => order.couponDiscountLabel ?? order.couponCodeSnapshot)
        .filter((label): label is string => Boolean(label)),
    ),
  );
  return {
    discountCents,
    label:
      labels.length === 0
        ? null
        : labels.length === 1
          ? labels[0]
          : "Order coupons",
  };
}

async function assertCanChangeManagerAccess(input: {
  storeId: string;
  userId: string;
  nextRole?: string;
  nextIsActive?: boolean;
}) {
  const existing = await prisma.user.findFirst({
    where: { id: input.userId, storeId: input.storeId },
    select: { role: true, isActive: true },
  });
  if (!existing) throw new HttpError(404, "USER_NOT_FOUND", "User not found");

  const willBeActive = input.nextIsActive ?? existing.isActive;
  const willBeManager = isManagerRole(input.nextRole ?? existing.role);
  const wasActiveManager = existing.isActive && isManagerRole(existing.role);
  if (!wasActiveManager || (willBeActive && willBeManager)) return;

  const otherActiveManagers = await prisma.user.count({
    where: {
      storeId: input.storeId,
      id: { not: input.userId },
      isActive: true,
      role: { in: ["DEV", "ADMIN"] },
    },
  });
  if (otherActiveManagers === 0) {
    throw new HttpError(
      409,
      "LAST_MANAGER",
      "At least one active DEV or ADMIN user is required",
    );
  }
}

function normalizeQrTokenBase(value: string) {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "table"
  );
}

async function generateUniqueQrToken(tableNumber: string) {
  const base = normalizeQrTokenBase(`table-${tableNumber}`);
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const token = `${base}-${randomBytes(4).toString("hex")}`;
    const existing = await prisma.diningTable.findUnique({
      where: { qrToken: token },
      select: { id: true },
    });
    if (!existing) return token;
  }
  throw new HttpError(
    500,
    "QR_TOKEN_GENERATION_FAILED",
    "Could not generate a unique table token",
  );
}

async function assertTableNumberAvailable(input: {
  storeId: string;
  number: string;
  excludeId?: string;
}) {
  const existing = await prisma.diningTable.findUnique({
    where: {
      storeId_number: {
        storeId: input.storeId,
        number: input.number,
      },
    },
    select: { id: true },
  });
  if (existing && existing.id !== input.excludeId) {
    throw new HttpError(
      409,
      "TABLE_NUMBER_EXISTS",
      `Table ${input.number} already exists`,
    );
  }
}

async function assertQrTokenAvailable(input: {
  qrToken: string;
  excludeId?: string;
}) {
  const existing = await prisma.diningTable.findUnique({
    where: { qrToken: input.qrToken },
    select: { id: true },
  });
  if (existing && existing.id !== input.excludeId) {
    throw new HttpError(
      409,
      "QR_TOKEN_EXISTS",
      "Table QR token already exists",
    );
  }
}

async function assertMenuCategoryNameAvailable(input: {
  storeId: string;
  name: string;
  excludeId?: string;
}) {
  const existing = await prisma.menuCategory.findFirst({
    where: { storeId: input.storeId, name: input.name },
    select: { id: true },
  });
  if (existing && existing.id !== input.excludeId) {
    throw new HttpError(
      409,
      "MENU_CATEGORY_EXISTS",
      `Menu category ${input.name} already exists`,
    );
  }
}

async function getMenuCategoryForStore(categoryId: string, storeId: string) {
  const category = await prisma.menuCategory.findFirst({
    where: { id: categoryId, storeId },
  });
  if (!category) {
    throw new HttpError(404, "CATEGORY_NOT_FOUND", "Category not found");
  }
  return category;
}

async function getMenuItemForStore(itemId: string, storeId: string) {
  const item = await prisma.menuItem.findFirst({
    where: { id: itemId, storeId },
  });
  if (!item) {
    throw new HttpError(404, "MENU_ITEM_NOT_FOUND", "Menu item not found");
  }
  return item;
}

async function getMenuCategories(storeId: string, onlyAvailable: boolean) {
  const categories = await prisma.menuCategory.findMany({
    where: { storeId },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      items: {
        where: onlyAvailable ? { isAvailable: true } : undefined,
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      },
    },
  });
  const mapped = categories.map(mapMenuCategory);
  return onlyAvailable
    ? mapped.filter((category) => category.items.length > 0)
    : mapped;
}

function resolveOrderModifiers(
  menuItem: MenuItemRecord,
  requestedModifiers: CreateOrderRequest["items"][number]["modifiers"] = [],
) {
  const groups = modifierGroups(menuItem.modifierGroups);
  const requestedByKey = new Map(
    requestedModifiers.map((modifier) => [
      `${modifier.groupId}:${modifier.optionId}`,
      modifier,
    ]),
  );
  const resolved: OrderItem["modifiers"] = [];

  for (const group of groups) {
    const selectedForGroup = group.options.filter((option) =>
      requestedByKey.has(`${group.id}:${option.id}`),
    );
    const effectiveSelection =
      selectedForGroup.length > 0
        ? selectedForGroup
        : group.options.filter((option) => option.isDefault);

    if (effectiveSelection.length < group.minSelect) {
      throw new HttpError(
        400,
        "REQUIRED_MODIFIER_MISSING",
        `${menuItem.name} requires ${group.name}`,
      );
    }
    if (effectiveSelection.length > group.maxSelect) {
      throw new HttpError(
        400,
        "TOO_MANY_MODIFIERS",
        `${group.name} allows at most ${group.maxSelect}`,
      );
    }

    for (const option of effectiveSelection) {
      resolved.push({
        groupId: group.id,
        optionId: option.id,
        name: `${group.name}: ${option.name}`,
        priceDeltaCents: option.priceDeltaCents,
      });
    }
  }

  const allowedKeys = new Set(
    groups.flatMap((group) =>
      group.options.map((option) => `${group.id}:${option.id}`),
    ),
  );
  for (const modifier of requestedModifiers) {
    const key = `${modifier.groupId}:${modifier.optionId}`;
    if (!allowedKeys.has(key)) {
      throw new HttpError(
        400,
        "INVALID_MODIFIER",
        `Invalid modifier for ${menuItem.name}`,
      );
    }
  }

  return resolved;
}

export async function getPublicMenu(qrToken: string) {
  const table = await prisma.diningTable.findUnique({
    where: { qrToken },
    include: { store: true },
  });
  if (!table || !table.isActive)
    throw new HttpError(404, "TABLE_NOT_FOUND", "Table not found");

  return {
    store: mapStore(table.store),
    table: mapTable(table),
    categories: await getMenuCategories(table.storeId, true),
  };
}

export async function getPublicOrders(qrToken: string) {
  const table = await prisma.diningTable.findUnique({
    where: { qrToken },
    include: { store: true },
  });
  if (!table || !table.isActive)
    throw new HttpError(404, "TABLE_NOT_FOUND", "Table not found");

  const [orders, serviceRequests] = await Promise.all([
    prisma.order.findMany({
      where: { tableId: table.id },
      orderBy: { submittedAt: "desc" },
      take: 20,
      include: {
        items: { orderBy: { createdAt: "asc" } },
        feedback: {
          orderBy: { createdAt: "desc" },
          take: 1,
          include: {
            member: { select: { phone: true, name: true } },
          },
        },
      },
    }),
    prisma.serviceRequest.findMany({
      where: { tableId: table.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);
  const openOrders = orders.filter((order) => order.status === "SUBMITTED");
  const openItems = openOrders.flatMap((order) => order.items);
  const openCoupon = tableCouponDiscount(openOrders);

  return {
    store: mapStore(table.store),
    table: mapTable(table),
    orders: orders.map((order) => mapCustomerOrder(order, table.store)),
    serviceRequests: serviceRequests.map(mapServiceRequest),
    openTotals: calculateTotals(
      openItems,
      table.store,
      openCoupon.discountCents,
      openCoupon.label,
    ),
  };
}

export async function createOrder(input: CreateOrderRequest) {
  if (input.items.length === 0) {
    throw new HttpError(
      400,
      "EMPTY_CART",
      "Cart must include at least one item",
    );
  }

  const order = await prisma.$transaction(async (tx) => {
    const table = await tx.diningTable.findUnique({
      where: { qrToken: input.qrToken },
      include: { store: true },
    });
    if (!table || !table.isActive)
      throw new HttpError(404, "TABLE_NOT_FOUND", "Table not found");

    const requestedByMenuItem = new Map<string, number>();
    for (const requested of input.items) {
      if (
        !Number.isInteger(requested.quantity) ||
        requested.quantity < 1 ||
        requested.quantity > 20
      ) {
        throw new HttpError(
          400,
          "INVALID_QUANTITY",
          "Quantity must be between 1 and 20",
        );
      }
      requestedByMenuItem.set(
        requested.menuItemId,
        (requestedByMenuItem.get(requested.menuItemId) ?? 0) +
          requested.quantity,
      );
    }

    const itemIds = Array.from(requestedByMenuItem.keys());
    const menuItems = await tx.menuItem.findMany({
      where: {
        id: { in: itemIds },
        storeId: table.storeId,
        isAvailable: true,
      },
    });
    const menuItemsById = new Map(menuItems.map((item) => [item.id, item]));

    for (const [menuItemId, quantity] of requestedByMenuItem.entries()) {
      const menuItem = menuItemsById.get(menuItemId);
      if (!menuItem) {
        throw new HttpError(
          400,
          "INVALID_MENU_ITEM",
          `Invalid menu item: ${menuItemId}`,
        );
      }
      if (
        menuItem.stockQuantity !== null &&
        menuItem.stockQuantity < quantity
      ) {
        throw new HttpError(
          409,
          "OUT_OF_STOCK",
          `${menuItem.name} has only ${Math.max(menuItem.stockQuantity, 0)} left`,
        );
      }
    }

    for (const [menuItemId, quantity] of requestedByMenuItem.entries()) {
      const menuItem = menuItemsById.get(menuItemId);
      if (!menuItem || menuItem.stockQuantity === null) continue;
      const updated = await tx.menuItem.updateMany({
        where: { id: menuItem.id, stockQuantity: { gte: quantity } },
        data: { stockQuantity: { decrement: quantity } },
      });
      if (updated.count !== 1) {
        throw new HttpError(
          409,
          "OUT_OF_STOCK",
          `${menuItem.name} no longer has enough stock`,
        );
      }
    }

    const orderItems = input.items.map((requested) => {
      const menuItem = menuItemsById.get(requested.menuItemId);
      if (!menuItem) {
        throw new HttpError(
          400,
          "INVALID_MENU_ITEM",
          `Invalid menu item: ${requested.menuItemId}`,
        );
      }
      const modifiers = resolveOrderModifiers(menuItem, requested.modifiers);
      return {
        menuItemId: menuItem.id,
        nameSnapshot: menuItem.name,
        priceCentsSnapshot: menuItem.priceCents,
        modifierTotalCentsSnapshot: modifiers.reduce(
          (sum, modifier) => sum + modifier.priceDeltaCents,
          0,
        ),
        modifiers,
        note: requested.note?.trim() || null,
        quantity: requested.quantity,
        status: "PENDING" as const,
      };
    });
    const customerName = input.customerName?.trim() || null;
    const customerPhone = normalizePhone(input.customerPhone);
    const member = await findOrCreateMember({
      tx,
      storeId: table.storeId,
      phone: customerPhone,
      name: customerName,
    });
    const preDiscountTotals = calculateTotals(orderItems, table.store);
    const couponDiscount = await resolveCouponDiscount({
      tx,
      storeId: table.storeId,
      code: input.couponCode,
      subtotalCents: preDiscountTotals.subtotalCents,
      totalBeforeDiscountCents: preDiscountTotals.totalCents,
      memberId: member?.id,
    });

    const order = await tx.order.create({
      data: {
        storeId: table.storeId,
        tableId: table.id,
        status: "SUBMITTED",
        customerName,
        customerPhone,
        memberId: member?.id ?? null,
        couponId: couponDiscount?.coupon.id ?? null,
        couponCodeSnapshot: couponDiscount?.coupon.code ?? null,
        couponDiscountCents: couponDiscount?.discountCents ?? 0,
        couponDiscountLabel: couponDiscount?.label ?? null,
        items: { create: orderItems },
      },
      include: { items: { orderBy: { createdAt: "asc" } } },
    });

    await tx.printJob.create({
      data: {
        storeId: table.storeId,
        tableId: table.id,
        orderId: order.id,
        type: "ORDER_TICKET",
        status: "PENDING",
        payload: buildOrderTicketPayload({
          store: table.store,
          table,
          order,
        }),
      },
    });

    return order;
  });

  return mapOrder(order);
}

export async function createServiceRequest(input: CreateServiceRequestRequest) {
  const table = await prisma.diningTable.findUnique({
    where: { qrToken: input.qrToken },
  });
  if (!table || !table.isActive)
    throw new HttpError(404, "TABLE_NOT_FOUND", "Table not found");

  const request = await prisma.serviceRequest.create({
    data: {
      storeId: table.storeId,
      tableId: table.id,
      type: input.type,
      status: "PENDING",
      note: input.note ?? null,
    },
  });
  return mapServiceRequest(request);
}

export async function createCustomerFeedback(input: CreateFeedbackRequest) {
  if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) {
    throw new HttpError(
      400,
      "INVALID_FEEDBACK_RATING",
      "Feedback rating must be between 1 and 5",
    );
  }

  return prisma.$transaction(async (tx) => {
    const table = await tx.diningTable.findUnique({
      where: { qrToken: input.qrToken },
      include: { store: true },
    });
    if (!table || !table.isActive) {
      throw new HttpError(404, "TABLE_NOT_FOUND", "Table not found");
    }

    const order = await tx.order.findFirst({
      where: {
        id: input.orderId,
        storeId: table.storeId,
        tableId: table.id,
      },
      select: {
        id: true,
        storeId: true,
        tableId: true,
        status: true,
        customerName: true,
        customerPhone: true,
        memberId: true,
      },
    });
    if (!order) {
      throw new HttpError(404, "ORDER_NOT_FOUND", "Order not found");
    }
    if (order.status !== "CLOSED") {
      throw new HttpError(
        409,
        "ORDER_NOT_CLOSED",
        "Feedback can be submitted after checkout",
      );
    }

    const customerName = input.customerName?.trim() || order.customerName;
    const customerPhone =
      normalizePhone(input.customerPhone) ?? order.customerPhone;
    const member =
      order.memberId || !customerPhone
        ? order.memberId
          ? await tx.member.findFirst({
              where: { id: order.memberId, storeId: table.storeId },
            })
          : null
        : await findOrCreateMember({
            tx,
            storeId: table.storeId,
            phone: customerPhone,
            name: customerName,
          });

    if (member && !order.memberId) {
      await tx.order.update({
        where: { id: order.id },
        data: {
          memberId: member.id,
          customerName,
          customerPhone: member.phone,
        },
      });
    }

    const tags = (input.tags ?? [])
      .map((tag) => tag.trim())
      .filter(Boolean)
      .slice(0, 8);
    const feedback = await tx.feedback.upsert({
      where: { orderId: order.id },
      update: {
        rating: input.rating,
        comment: input.comment?.trim() || null,
        tags,
        status: "NEW",
        handledAt: null,
        customerName,
        customerPhone: member?.phone ?? customerPhone,
        memberId: member?.id ?? order.memberId,
      },
      create: {
        storeId: table.storeId,
        tableId: table.id,
        orderId: order.id,
        memberId: member?.id ?? order.memberId,
        rating: input.rating,
        comment: input.comment?.trim() || null,
        tags,
        status: "NEW",
        customerName,
        customerPhone: member?.phone ?? customerPhone,
      },
      include: {
        table: { select: { number: true } },
        member: { select: { phone: true, name: true } },
      },
    });

    await tx.auditLog.create({
      data: {
        storeId: table.storeId,
        action: "CUSTOMER_FEEDBACK_SUBMITTED",
        entityType: "Feedback",
        entityId: feedback.id,
        metadata: {
          orderId: order.id,
          tableId: table.id,
          rating: feedback.rating,
          tags,
        },
      },
    });

    return mapFeedback(feedback);
  });
}

export async function getFohTables() {
  const store = await getDefaultStore();
  const tables = await prisma.diningTable.findMany({
    where: { storeId: store.id, isActive: true },
    orderBy: [{ number: "asc" }, { createdAt: "asc" }],
    include: {
      orders: {
        where: { status: "SUBMITTED" },
        orderBy: { createdAt: "desc" },
        include: { items: { orderBy: { createdAt: "asc" } } },
      },
      serviceRequests: {
        where: { status: "PENDING" },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  const summaries: FohTable[] = tables.map((table) => {
    const tableItems = table.orders.flatMap((order) =>
      order.items.map((item) => ({
        ...mapOrderItem(item),
        orderCreatedAt: toIso(order.createdAt),
      })),
    );
    const pendingItems = tableItems.filter((item) => item.status === "PENDING");
    const recentlyDoneItems = tableItems
      .filter((item) => item.status === "DONE")
      .slice(0, 5);
    const allOrderItems = table.orders.flatMap((order) => order.items);
    const coupon = tableCouponDiscount(table.orders);
    const totals = calculateTotals(
      allOrderItems,
      store,
      coupon.discountCents,
      coupon.label,
    );

    return {
      table: mapTable(table),
      tableStatus: resolveTableStatus(
        table.orders.length > 0,
        table.orders
          .flatMap((order) => order.items)
          .filter((item) => item.status === "PENDING"),
        table.serviceRequests,
      ),
      openTotalCents: totals.totalCents,
      totals,
      pendingItems,
      recentlyDoneItems,
      serviceRequests: table.serviceRequests.map(mapServiceRequest),
    };
  });

  return { store: mapStore(store), tables: summaries };
}

export async function updateOrderItemStatus(
  itemId: string,
  status: OrderItemStatus,
) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.orderItem.findUnique({
      where: { id: itemId },
      include: {
        menuItem: { select: { id: true, name: true, stockQuantity: true } },
      },
    });
    if (!existing)
      throw new HttpError(404, "ORDER_ITEM_NOT_FOUND", "Order item not found");

    const tracked = existing.menuItem.stockQuantity !== null;
    const movingToCanceled =
      existing.status !== "CANCELED" && status === "CANCELED";
    const restoringFromCanceled =
      existing.status === "CANCELED" && status !== "CANCELED";

    if (tracked && movingToCanceled) {
      await tx.menuItem.update({
        where: { id: existing.menuItemId },
        data: { stockQuantity: { increment: existing.quantity } },
      });
    }

    if (tracked && restoringFromCanceled) {
      const updated = await tx.menuItem.updateMany({
        where: {
          id: existing.menuItemId,
          stockQuantity: { gte: existing.quantity },
        },
        data: { stockQuantity: { decrement: existing.quantity } },
      });
      if (updated.count !== 1) {
        throw new HttpError(
          409,
          "OUT_OF_STOCK",
          `${existing.menuItem.name} no longer has enough stock`,
        );
      }
    }

    const item = await tx.orderItem.update({
      where: { id: itemId },
      data: { status },
    });
    return mapOrderItem(item);
  });
}

export async function updateServiceRequestStatus(
  requestId: string,
  status: ServiceRequestStatus,
) {
  const existing = await prisma.serviceRequest.findUnique({
    where: { id: requestId },
  });
  if (!existing)
    throw new HttpError(
      404,
      "SERVICE_REQUEST_NOT_FOUND",
      "Service request not found",
    );

  const request = await prisma.serviceRequest.update({
    where: { id: requestId },
    data: {
      status,
      handledAt: status === "HANDLED" ? new Date() : existing.handledAt,
    },
  });
  return mapServiceRequest(request);
}

export async function checkoutTable(
  tableId: string,
  input: CheckoutTableRequest = {},
): Promise<CheckoutTableResponse> {
  return prisma.$transaction(async (tx) => {
    const table = await tx.diningTable.findUnique({
      where: { id: tableId },
      include: { store: true },
    });
    if (!table) throw new HttpError(404, "TABLE_NOT_FOUND", "Table not found");

    const tableOrders = await tx.order.findMany({
      where: { tableId, status: "SUBMITTED" },
      include: { items: true },
    });
    if (tableOrders.length === 0)
      throw new HttpError(400, "NO_OPEN_ORDERS", "No open orders");

    const pendingCount = tableOrders.reduce(
      (sum, order) =>
        sum + order.items.filter((item) => item.status === "PENDING").length,
      0,
    );
    if (pendingCount > 0) {
      throw new HttpError(
        400,
        "PENDING_ITEMS",
        "Cannot checkout while items are pending",
      );
    }

    const orderItems = tableOrders.flatMap((order) => order.items);
    const preDiscountTotals = calculateTotals(orderItems, table.store);
    const requestedMember = await findOrCreateMember({
      tx,
      storeId: table.storeId,
      phone: input.memberPhone,
      name: input.memberName,
    });
    const orderMemberId =
      tableOrders.find((order) => order.memberId)?.memberId ?? null;
    const member =
      requestedMember ??
      (orderMemberId
        ? await tx.member.findFirst({
            where: { id: orderMemberId, storeId: table.storeId },
          })
        : null);
    const requestedCoupon = normalizeCouponCode(input.couponCode);
    const orderCoupon = tableCouponDiscount(tableOrders);
    const checkoutCoupon = requestedCoupon
      ? await resolveCouponDiscount({
          tx,
          storeId: table.storeId,
          code: requestedCoupon,
          subtotalCents: preDiscountTotals.subtotalCents,
          totalBeforeDiscountCents: preDiscountTotals.totalCents,
          memberId: member?.id,
          skipOpenOrderCheck: true,
        })
      : null;
    const couponDiscountCents =
      checkoutCoupon?.discountCents ?? orderCoupon.discountCents;
    const couponLabel = checkoutCoupon?.label ?? orderCoupon.label;
    const totals = calculateTotals(
      orderItems,
      table.store,
      couponDiscountCents,
      couponLabel,
    );
    const paymentMethod = input.paymentMethod ?? "CASH";
    if (!PAYMENT_METHOD_SET.has(paymentMethod)) {
      throw new HttpError(
        400,
        "INVALID_PAYMENT_METHOD",
        "Unsupported payment method",
      );
    }
    const tipCents = input.tipCents ?? 0;
    const manualDiscountCents = input.discountCents ?? 0;
    const amountCents =
      input.amountCents ??
      Math.max(0, totals.totalCents + tipCents - manualDiscountCents);
    if (amountCents < 0) {
      throw new HttpError(
        400,
        "INVALID_PAYMENT_AMOUNT",
        "Payment amount cannot be negative",
      );
    }

    const closedAt = new Date();
    const closedOrderIds = tableOrders.map((order) => order.id);
    const closeData: Prisma.OrderUncheckedUpdateManyInput = {
      status: "CLOSED",
      closedAt,
    };
    if (member) {
      closeData.memberId = member.id;
      closeData.customerPhone = member.phone;
      if (input.memberName?.trim()) {
        closeData.customerName = input.memberName.trim();
      }
    }
    await tx.order.updateMany({
      where: { id: { in: closedOrderIds } },
      data: closeData,
    });

    const payment =
      amountCents > 0
        ? await tx.payment.create({
            data: {
              storeId: table.storeId,
              tableId,
              method: paymentMethod as PaymentMethod,
              amountCents,
              currency: table.store.currency,
              reference: input.reference?.trim() || null,
              note:
                input.note?.trim() ||
                [
                  tipCents ? `tip=${tipCents}` : null,
                  manualDiscountCents
                    ? `manualDiscount=${manualDiscountCents}`
                    : null,
                  couponDiscountCents
                    ? `couponDiscount=${couponDiscountCents}`
                    : null,
                  member ? `member=${member.phone}` : null,
                ]
                  .filter(Boolean)
                  .join("; ") ||
                null,
              orderIds: closedOrderIds,
              memberId: member?.id ?? null,
              memberPhoneSnapshot: member?.phone ?? null,
              memberNameSnapshot:
                member?.name ?? input.memberName?.trim() ?? null,
              couponId:
                checkoutCoupon?.coupon.id ??
                tableOrders.find((order) => order.couponId)?.couponId ??
                null,
              couponCodeSnapshot:
                checkoutCoupon?.coupon.code ??
                tableOrders.find((order) => order.couponCodeSnapshot)
                  ?.couponCodeSnapshot ??
                null,
              manualDiscountCents,
              couponDiscountCents,
              tipCents,
              pointsEarned: member
                ? memberPointsForPayment(amountCents, tipCents)
                : 0,
              paidAt: closedAt,
            },
          })
        : null;

    if (payment && member && payment.pointsEarned > 0) {
      await tx.member.update({
        where: { id: member.id },
        data: { points: { increment: payment.pointsEarned } },
      });
      await tx.memberPointLedger.create({
        data: {
          storeId: table.storeId,
          memberId: member.id,
          paymentId: payment.id,
          pointsDelta: payment.pointsEarned,
          reason: "PAYMENT_EARNED",
        },
      });
    }

    if (payment && couponDiscountCents > 0) {
      if (checkoutCoupon) {
        await tx.couponRedemption.create({
          data: {
            storeId: table.storeId,
            couponId: checkoutCoupon.coupon.id,
            memberId: member?.id ?? null,
            orderId: closedOrderIds[0] ?? null,
            paymentId: payment.id,
            codeSnapshot: checkoutCoupon.coupon.code,
            discountCents: checkoutCoupon.discountCents,
            subtotalCents: preDiscountTotals.subtotalCents,
          },
        });
      } else {
        for (const order of tableOrders) {
          if (!order.couponId || order.couponDiscountCents <= 0) continue;
          const orderTotals = calculateTotals(order.items, table.store);
          await tx.couponRedemption.create({
            data: {
              storeId: table.storeId,
              couponId: order.couponId,
              memberId: member?.id ?? order.memberId ?? null,
              orderId: order.id,
              paymentId: payment.id,
              codeSnapshot: order.couponCodeSnapshot ?? couponLabel ?? "COUPON",
              discountCents: order.couponDiscountCents,
              subtotalCents: orderTotals.subtotalCents,
            },
          });
        }
      }
    }

    return {
      tableId,
      closedOrderIds,
      closedAt: toIso(closedAt),
      payment: payment ? mapPayment(payment) : null,
    };
  });
}

export async function refundPayment(
  paymentId: string,
  input: RefundPaymentRequest,
) {
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) {
    throw new HttpError(
      400,
      "INVALID_REFUND_AMOUNT",
      "Refund amount must be positive",
    );
  }

  return prisma.$transaction(async (tx) => {
    const existing = await tx.payment.findUnique({
      where: { id: paymentId },
      include: { table: { select: { number: true } } },
    });
    if (!existing) {
      throw new HttpError(404, "PAYMENT_NOT_FOUND", "Payment not found");
    }
    const refundableCents = existing.amountCents - existing.refundedCents;
    if (input.amountCents > refundableCents) {
      throw new HttpError(
        409,
        "REFUND_EXCEEDS_PAYMENT",
        "Refund exceeds remaining payment amount",
      );
    }

    const refundedCents = existing.refundedCents + input.amountCents;
    const payment = await tx.payment.update({
      where: { id: paymentId },
      data: {
        refundedCents,
        status:
          refundedCents >= existing.amountCents
            ? "REFUNDED"
            : "PARTIALLY_REFUNDED",
        note:
          [existing.note, input.reason ? `refund: ${input.reason}` : null]
            .filter(Boolean)
            .join("; ") || null,
      },
      include: { table: { select: { number: true } } },
    });

    await tx.auditLog.create({
      data: {
        storeId: existing.storeId,
        action: "PAYMENT_REFUNDED",
        entityType: "Payment",
        entityId: paymentId,
        metadata: {
          amountCents: input.amountCents,
          reason: input.reason ?? null,
        },
      },
    });

    return mapPayment(payment);
  });
}

export async function getKitchenPendingItems() {
  const store = await getDefaultStore();
  const pendingItems = await prisma.orderItem.findMany({
    where: {
      status: "PENDING",
      order: {
        storeId: store.id,
        status: "SUBMITTED",
      },
    },
    include: {
      order: {
        select: {
          submittedAt: true,
          table: {
            select: { id: true, number: true, name: true },
          },
        },
      },
      menuItem: {
        select: { kitchenStation: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const grouped = new Map<string, KitchenPendingItem>();
  for (const item of pendingItems) {
    const earliestSubmittedAt = toIso(item.order.submittedAt);
    const kitchenStation = item.menuItem.kitchenStation || "HOT";
    const groupKey = `${kitchenStation}:${item.menuItemId}`;
    const existing = grouped.get(groupKey);
    if (!existing) {
      grouped.set(groupKey, {
        menuItemId: item.menuItemId,
        name: item.nameSnapshot,
        kitchenStation,
        quantity: item.quantity,
        earliestSubmittedAt,
        tables: [
          {
            tableId: item.order.table.id,
            tableNumber: item.order.table.number,
            tableName: item.order.table.name,
            quantity: item.quantity,
            earliestSubmittedAt,
          },
        ],
      });
    } else {
      existing.quantity += item.quantity;
      if (earliestSubmittedAt < existing.earliestSubmittedAt) {
        existing.earliestSubmittedAt = earliestSubmittedAt;
      }
      const tableEntry = existing.tables.find(
        (entry) => entry.tableId === item.order.table.id,
      );
      if (tableEntry) {
        tableEntry.quantity += item.quantity;
        if (earliestSubmittedAt < tableEntry.earliestSubmittedAt) {
          tableEntry.earliestSubmittedAt = earliestSubmittedAt;
        }
      } else {
        existing.tables.push({
          tableId: item.order.table.id,
          tableNumber: item.order.table.number,
          tableName: item.order.table.name,
          quantity: item.quantity,
          earliestSubmittedAt,
        });
      }
    }
  }

  const items = Array.from(grouped.values()).map((item) => ({
    ...item,
    tables: item.tables.sort((a, b) =>
      a.earliestSubmittedAt.localeCompare(b.earliestSubmittedAt),
    ),
  }));

  return { store: mapStore(store), items };
}

export async function getManageMenu() {
  const store = await getDefaultStore();
  return {
    store: mapStore(store),
    categories: await getMenuCategories(store.id, false),
  };
}

export async function getManageStaff() {
  const store = await getDefaultStore();
  const users = await prisma.user.findMany({
    where: { storeId: store.id, role: { in: [...STAFF_ROLES] } },
    orderBy: [{ role: "asc" }, { email: "asc" }],
  });
  return {
    store: mapStore(store),
    users: users.map((user) =>
      mapStaffUser({ ...user, role: user.role as ManageStaffUser["role"] }),
    ),
  };
}

export async function createStaffUser(input: CreateStaffUserRequest) {
  const store = await getDefaultStore();
  const email = normalizeEmail(input.email);
  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (existing) {
    throw new HttpError(409, "USER_EMAIL_EXISTS", "User email already exists");
  }

  const user = await prisma.user.create({
    data: {
      storeId: store.id,
      email,
      name: input.name?.trim() || null,
      role: input.role,
      passwordHash: await hashPassword(input.password),
      isActive: true,
    },
  });

  return mapStaffUser({ ...user, role: user.role as ManageStaffUser["role"] });
}

export async function updateStaffUser(
  userId: string,
  input: UpdateStaffUserRequest,
) {
  const store = await getDefaultStore();
  const existing = await prisma.user.findFirst({
    where: { id: userId, storeId: store.id },
  });
  if (!existing) throw new HttpError(404, "USER_NOT_FOUND", "User not found");

  const email =
    input.email !== undefined ? normalizeEmail(input.email) : undefined;
  if (email && email !== existing.email) {
    const duplicate = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (duplicate && duplicate.id !== userId) {
      throw new HttpError(
        409,
        "USER_EMAIL_EXISTS",
        "User email already exists",
      );
    }
  }

  await assertCanChangeManagerAccess({
    storeId: store.id,
    userId,
    nextRole: input.role,
    nextIsActive: input.isActive,
  });

  const shouldInvalidateSession =
    input.password !== undefined ||
    input.role !== undefined ||
    input.isActive !== undefined;

  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(email !== undefined ? { email } : {}),
      ...(input.name !== undefined ? { name: input.name?.trim() || null } : {}),
      ...(input.role !== undefined ? { role: input.role } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      ...(input.password !== undefined
        ? { passwordHash: await hashPassword(input.password) }
        : {}),
      ...(shouldInvalidateSession ? { sessionVersion: { increment: 1 } } : {}),
    },
  });

  return mapStaffUser({ ...user, role: user.role as ManageStaffUser["role"] });
}

export async function getManageAnalytics(
  days = 7,
): Promise<ManageAnalyticsResponse> {
  const clampedDays = Math.min(Math.max(days, 1), 31);
  const store = await getDefaultStore();
  const end = new Date();
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - clampedDays + 1);
  start.setUTCHours(0, 0, 0, 0);

  const [payments, orders, orderItems] = await Promise.all([
    prisma.payment.findMany({
      where: { storeId: store.id, paidAt: { gte: start, lte: end } },
      orderBy: { paidAt: "asc" },
    }),
    prisma.order.findMany({
      where: { storeId: store.id, submittedAt: { gte: start, lte: end } },
      select: { status: true },
    }),
    prisma.orderItem.findMany({
      where: {
        status: { not: "CANCELED" },
        order: {
          storeId: store.id,
          submittedAt: { gte: start, lte: end },
        },
      },
      select: {
        nameSnapshot: true,
        priceCentsSnapshot: true,
        quantity: true,
      },
    }),
  ]);

  const daily = new Map<
    string,
    { revenueCents: number; paymentCount: number }
  >();
  for (let index = 0; index < clampedDays; index += 1) {
    const day = new Date(start);
    day.setUTCDate(start.getUTCDate() + index);
    daily.set(day.toISOString().slice(0, 10), {
      revenueCents: 0,
      paymentCount: 0,
    });
  }

  const methodMap = new Map<
    Payment["method"],
    { amountCents: number; paymentCount: number }
  >();
  for (const payment of payments) {
    const date = payment.paidAt.toISOString().slice(0, 10);
    const dailyRow = daily.get(date) ?? { revenueCents: 0, paymentCount: 0 };
    dailyRow.revenueCents += payment.amountCents;
    dailyRow.paymentCount += 1;
    daily.set(date, dailyRow);

    const methodRow = methodMap.get(payment.method) ?? {
      amountCents: 0,
      paymentCount: 0,
    };
    methodRow.amountCents += payment.amountCents;
    methodRow.paymentCount += 1;
    methodMap.set(payment.method, methodRow);
  }

  const itemMap = new Map<string, { quantity: number; salesCents: number }>();
  for (const item of orderItems) {
    const existing = itemMap.get(item.nameSnapshot) ?? {
      quantity: 0,
      salesCents: 0,
    };
    existing.quantity += item.quantity;
    existing.salesCents += item.priceCentsSnapshot * item.quantity;
    itemMap.set(item.nameSnapshot, existing);
  }

  const revenueCents = payments.reduce(
    (sum, payment) => sum + payment.amountCents,
    0,
  );
  const paymentCount = payments.length;

  return {
    store: mapStore(store),
    range: {
      start: start.toISOString(),
      end: end.toISOString(),
      days: clampedDays,
    },
    totals: {
      revenueCents,
      paymentCount,
      averagePaymentCents:
        paymentCount > 0 ? Math.round(revenueCents / paymentCount) : 0,
      submittedOrderCount: orders.length,
      closedOrderCount: orders.filter((order) => order.status === "CLOSED")
        .length,
      openOrderCount: orders.filter((order) => order.status === "SUBMITTED")
        .length,
    },
    dailyRevenue: Array.from(daily.entries()).map(([date, row]) => ({
      date,
      revenueCents: row.revenueCents,
      paymentCount: row.paymentCount,
    })),
    paymentMethods: Array.from(methodMap.entries())
      .map(([method, row]) => ({ method, ...row }))
      .sort((a, b) => b.amountCents - a.amountCents),
    topItems: Array.from(itemMap.entries())
      .map(([name, row]) => ({ name, ...row }))
      .sort((a, b) => b.quantity - a.quantity || b.salesCents - a.salesCents)
      .slice(0, 10),
  };
}

export async function getManageOperations(): Promise<ManageOperationsResponse> {
  const store = await getDefaultStore();
  const [
    suppliers,
    purchaseOrders,
    inventoryAdjustments,
    stocktakes,
    ingredients,
    recipes,
    members,
    memberPaymentStats,
    memberOrderStats,
    memberFeedbackStats,
    coupons,
    couponRedemptionStats,
    feedback,
    kdsDevices,
    auditLogs,
  ] = await Promise.all([
    prisma.supplier.findMany({
      where: { storeId: store.id },
      orderBy: { name: "asc" },
      take: 100,
    }),
    prisma.purchaseOrder.findMany({
      where: { storeId: store.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        supplier: { select: { name: true } },
        lines: {
          orderBy: { createdAt: "asc" },
          include: { menuItem: { select: { name: true } } },
        },
      },
    }),
    prisma.inventoryAdjustment.findMany({
      where: { storeId: store.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        menuItem: { select: { name: true } },
        purchaseOrder: { select: { orderNumber: true } },
        stocktake: { select: { name: true } },
      },
    }),
    prisma.stocktake.findMany({
      where: { storeId: store.id },
      orderBy: { countedAt: "desc" },
      take: 30,
      include: {
        lines: {
          orderBy: { id: "asc" },
          include: { menuItem: { select: { name: true } } },
        },
      },
    }),
    prisma.ingredient.findMany({
      where: { storeId: store.id },
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
      take: 200,
    }),
    prisma.recipe.findMany({
      where: { storeId: store.id },
      orderBy: { updatedAt: "desc" },
      take: 100,
      include: {
        menuItem: { select: { name: true, priceCents: true } },
        lines: {
          orderBy: { id: "asc" },
          include: {
            ingredient: {
              select: { name: true, unit: true, unitCostCents: true },
            },
          },
        },
      },
    }),
    prisma.member.findMany({
      where: { storeId: store.id },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.payment.groupBy({
      by: ["memberId"],
      where: { storeId: store.id, memberId: { not: null } },
      _count: { _all: true },
      _sum: { amountCents: true },
      _max: { paidAt: true },
    }),
    prisma.order.groupBy({
      by: ["memberId"],
      where: { storeId: store.id, memberId: { not: null } },
      _count: { _all: true },
    }),
    prisma.feedback.groupBy({
      by: ["memberId"],
      where: { storeId: store.id, memberId: { not: null } },
      _count: { _all: true },
      _max: { createdAt: true },
    }),
    prisma.coupon.findMany({
      where: { storeId: store.id },
      orderBy: { code: "asc" },
      take: 100,
    }),
    prisma.couponRedemption.groupBy({
      by: ["couponId"],
      where: { storeId: store.id },
      _count: { _all: true },
    }),
    prisma.feedback.findMany({
      where: { storeId: store.id },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      take: 100,
      include: {
        table: { select: { number: true } },
        member: { select: { phone: true, name: true } },
      },
    }),
    prisma.kdsDevice.findMany({
      where: { storeId: store.id },
      orderBy: { name: "asc" },
      take: 100,
    }),
    prisma.auditLog.findMany({
      where: { storeId: store.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);
  const memberStats = new Map(
    memberPaymentStats
      .filter((row) => row.memberId)
      .map((row) => [
        row.memberId as string,
        {
          paymentCount: row._count._all,
          totalSpendCents: row._sum.amountCents ?? 0,
          lastPaidAt: row._max.paidAt ?? null,
        },
      ]),
  );
  const couponStats = new Map(
    couponRedemptionStats.map((row) => [row.couponId, row._count._all]),
  );
  const orderStats = new Map(
    memberOrderStats
      .filter((row) => row.memberId)
      .map((row) => [row.memberId as string, row._count._all]),
  );
  const feedbackStats = new Map(
    memberFeedbackStats
      .filter((row) => row.memberId)
      .map((row) => [row.memberId as string, row._count._all]),
  );
  const memberIds = members.map((member) => member.id);
  const [memberOrders, memberPayments, memberCoupons, memberFeedback] =
    memberIds.length > 0
      ? await Promise.all([
          prisma.order.findMany({
            where: { storeId: store.id, memberId: { in: memberIds } },
            orderBy: { submittedAt: "desc" },
            take: 300,
            include: {
              table: { select: { number: true } },
              items: { orderBy: { createdAt: "asc" } },
            },
          }),
          prisma.payment.findMany({
            where: { storeId: store.id, memberId: { in: memberIds } },
            orderBy: { paidAt: "desc" },
            take: 300,
            include: { table: { select: { number: true } } },
          }),
          prisma.couponRedemption.findMany({
            where: { storeId: store.id, memberId: { in: memberIds } },
            orderBy: { redeemedAt: "desc" },
            take: 300,
          }),
          prisma.feedback.findMany({
            where: { storeId: store.id, memberId: { in: memberIds } },
            orderBy: { createdAt: "desc" },
            take: 300,
            include: {
              table: { select: { number: true } },
              member: { select: { phone: true, name: true } },
            },
          }),
        ])
      : [[], [], [], []];

  const recentOrdersByMember = new Map<string, Member["recentOrders"]>();
  for (const order of memberOrders) {
    if (!order.memberId) continue;
    const rows = recentOrdersByMember.get(order.memberId) ?? [];
    if (rows.length >= 5) continue;
    rows.push({
      id: order.id,
      tableNumber: order.table.number,
      status: order.status,
      totalCents: calculateTotals(
        order.items,
        store,
        order.couponDiscountCents,
        order.couponDiscountLabel ?? order.couponCodeSnapshot,
      ).totalCents,
      submittedAt: toIso(order.submittedAt),
      closedAt: optionalIso(order.closedAt),
    });
    recentOrdersByMember.set(order.memberId, rows);
  }

  const recentPaymentsByMember = new Map<string, Member["recentPayments"]>();
  for (const payment of memberPayments) {
    if (!payment.memberId) continue;
    const rows = recentPaymentsByMember.get(payment.memberId) ?? [];
    if (rows.length >= 5) continue;
    rows.push({
      id: payment.id,
      tableNumber: payment.table.number,
      method: payment.method,
      amountCents: payment.amountCents,
      couponDiscountCents: payment.couponDiscountCents,
      tipCents: payment.tipCents,
      pointsEarned: payment.pointsEarned,
      paidAt: toIso(payment.paidAt),
      orderIds: Array.isArray(payment.orderIds)
        ? payment.orderIds.filter((id): id is string => typeof id === "string")
        : [],
    });
    recentPaymentsByMember.set(payment.memberId, rows);
  }

  const recentCouponsByMember = new Map<string, Member["recentCoupons"]>();
  for (const redemption of memberCoupons) {
    if (!redemption.memberId) continue;
    const rows = recentCouponsByMember.get(redemption.memberId) ?? [];
    if (rows.length >= 5) continue;
    rows.push({
      id: redemption.id,
      code: redemption.codeSnapshot,
      discountCents: redemption.discountCents,
      subtotalCents: redemption.subtotalCents,
      orderId: redemption.orderId,
      paymentId: redemption.paymentId,
      redeemedAt: toIso(redemption.redeemedAt),
    });
    recentCouponsByMember.set(redemption.memberId, rows);
  }

  const recentFeedbackByMember = new Map<string, Member["recentFeedback"]>();
  const lastFeedbackRatingByMember = new Map<string, number>();
  for (const entry of memberFeedback) {
    if (!entry.memberId) continue;
    if (!lastFeedbackRatingByMember.has(entry.memberId)) {
      lastFeedbackRatingByMember.set(entry.memberId, entry.rating);
    }
    const rows = recentFeedbackByMember.get(entry.memberId) ?? [];
    if (rows.length >= 5) continue;
    rows.push(mapFeedback(entry));
    recentFeedbackByMember.set(entry.memberId, rows);
  }

  return {
    store: mapStore(store),
    suppliers: suppliers.map(mapSupplier),
    purchaseOrders: purchaseOrders.map(mapPurchaseOrder),
    inventoryAdjustments: inventoryAdjustments.map(mapInventoryAdjustment),
    stocktakes: stocktakes.map(mapStocktake),
    ingredients: ingredients.map(mapIngredient),
    recipes: recipes.map(mapRecipe),
    members: members.map((member) =>
      mapMember({
        ...member,
        ...(memberStats.get(member.id) ?? {}),
        orderCount: orderStats.get(member.id) ?? 0,
        feedbackCount: feedbackStats.get(member.id) ?? 0,
        lastFeedbackRating: lastFeedbackRatingByMember.get(member.id) ?? null,
        recentOrders: recentOrdersByMember.get(member.id) ?? [],
        recentPayments: recentPaymentsByMember.get(member.id) ?? [],
        recentCoupons: recentCouponsByMember.get(member.id) ?? [],
        recentFeedback: recentFeedbackByMember.get(member.id) ?? [],
      }),
    ),
    feedback: feedback.map(mapFeedback),
    coupons: coupons.map((coupon) =>
      mapCoupon({
        ...coupon,
        redemptionCount: couponStats.get(coupon.id) ?? 0,
      }),
    ),
    kdsDevices: kdsDevices.map(mapKdsDevice),
    auditLogs: auditLogs.map(mapAuditLog),
  };
}

function smokeCheck(
  id: string,
  label: string,
  status: P0SmokeStatus,
  detail: string,
  href?: string,
): P0SmokeCheck {
  return { id, label, status, detail, ...(href ? { href } : {}) };
}

function smokeOverall(checks: P0SmokeCheck[]): P0SmokeStatus {
  if (checks.some((check) => check.status === "NEEDS_SETUP")) {
    return "NEEDS_SETUP";
  }
  if (checks.some((check) => check.status === "WATCH")) {
    return "WATCH";
  }
  return "READY";
}

export async function getP0SmokeCockpit(): Promise<P0SmokeCockpitResponse> {
  const store = await getDefaultStore();
  const oneWeekAgo = new Date();
  oneWeekAgo.setUTCDate(oneWeekAgo.getUTCDate() - 7);

  const availableItemWhere = {
    storeId: store.id,
    isAvailable: true,
    OR: [{ stockQuantity: null }, { stockQuantity: { gt: 0 } }],
  };

  const [
    tables,
    categoryCount,
    menuItemCount,
    availableItemCount,
    demoItem,
    openOrderTableRows,
    pendingKitchenItems,
    pendingServiceRequests,
    serviceRequestTableRows,
    printJobStatusRows,
    recentPayments,
    activeRoleRows,
    supplierCount,
    kdsDeviceCount,
    auditLogCount,
  ] = await Promise.all([
    prisma.diningTable.findMany({
      where: { storeId: store.id },
      orderBy: [{ number: "asc" }, { createdAt: "asc" }],
    }),
    prisma.menuCategory.count({ where: { storeId: store.id } }),
    prisma.menuItem.count({ where: { storeId: store.id } }),
    prisma.menuItem.count({ where: availableItemWhere }),
    prisma.menuItem.findFirst({
      where: availableItemWhere,
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: { id: true, name: true, priceCents: true },
    }),
    prisma.order.groupBy({
      by: ["tableId"],
      where: { storeId: store.id, status: "SUBMITTED" },
    }),
    prisma.orderItem.count({
      where: {
        status: "PENDING",
        order: { storeId: store.id, status: "SUBMITTED" },
      },
    }),
    prisma.serviceRequest.count({
      where: { storeId: store.id, status: "PENDING" },
    }),
    prisma.serviceRequest.groupBy({
      by: ["tableId"],
      where: { storeId: store.id, status: "PENDING" },
    }),
    prisma.printJob.groupBy({
      by: ["status"],
      where: { storeId: store.id },
      _count: { _all: true },
    }),
    prisma.payment.count({
      where: { storeId: store.id, paidAt: { gte: oneWeekAgo } },
    }),
    prisma.user.groupBy({
      by: ["role"],
      where: { storeId: store.id, isActive: true },
      _count: { _all: true },
    }),
    prisma.supplier.count({ where: { storeId: store.id, isActive: true } }),
    prisma.kdsDevice.count({ where: { storeId: store.id, isActive: true } }),
    prisma.auditLog.count({ where: { storeId: store.id } }),
  ]);

  const activeTables = tables.filter((table) => table.isActive);
  const demoTable = activeTables[0] ? mapTable(activeTables[0]) : null;
  const openTableIds = new Set(openOrderTableRows.map((row) => row.tableId));
  for (const row of serviceRequestTableRows) {
    openTableIds.add(row.tableId);
  }

  const printJobCounts = Object.fromEntries(
    printJobStatusRows.map((row) => [row.status, row._count._all]),
  ) as Partial<Record<PrintJob["status"], number>>;
  const pendingPrintJobs =
    (printJobCounts.PENDING ?? 0) + (printJobCounts.PRINTING ?? 0);
  const failedPrintJobs = printJobCounts.FAILED ?? 0;

  const roleCounts = Object.fromEntries(
    activeRoleRows.map((row) => [row.role, row._count._all]),
  ) as Partial<Record<(typeof STAFF_ROLES)[number], number>>;
  const managerCount = (roleCounts.ADMIN ?? 0) + (roleCounts.DEV ?? 0);
  const paymentMethodCount = paymentMethods(store.enabledPaymentMethods).length;
  const checks = {
    customer: [
      smokeCheck(
        "customer-table",
        "QR table entry",
        activeTables.length > 0 ? "READY" : "NEEDS_SETUP",
        activeTables.length > 0
          ? `${activeTables.length} active table QR entries`
          : "No active tables",
        "/manage/tables",
      ),
      smokeCheck(
        "customer-menu",
        "Orderable menu",
        availableItemCount > 0 ? "READY" : "NEEDS_SETUP",
        `${availableItemCount} available items across ${categoryCount} categories`,
        "/manage/menu",
      ),
      smokeCheck(
        "customer-status",
        "Table status view",
        activeTables.length > 0 ? "READY" : "NEEDS_SETUP",
        "Customer order status is token scoped",
        demoTable ? `/c?t=${encodeURIComponent(demoTable.qrToken)}` : "/c",
      ),
      smokeCheck(
        "customer-service",
        "Service requests",
        activeTables.length > 0 ? "READY" : "NEEDS_SETUP",
        pendingServiceRequests > 0
          ? `${pendingServiceRequests} pending requests visible to FOH`
          : "Water, call staff, and follow-up requests are available",
        "/foh",
      ),
    ],
    foh: [
      smokeCheck(
        "foh-access",
        "FOH access",
        (roleCounts.FOH ?? 0) > 0 ? "READY" : "NEEDS_SETUP",
        `${roleCounts.FOH ?? 0} active FOH accounts`,
        "/manage/staff",
      ),
      smokeCheck(
        "foh-board",
        "Live table board",
        openTableIds.size > 0 ? "WATCH" : "READY",
        openTableIds.size > 0
          ? `${openTableIds.size} tables need FOH attention`
          : "No open table work right now",
        "/foh",
      ),
      smokeCheck(
        "foh-checkout",
        "Checkout methods",
        paymentMethodCount > 0 ? "READY" : "NEEDS_SETUP",
        `${paymentMethodCount} payment methods enabled`,
        "/manage/settings",
      ),
      smokeCheck(
        "foh-payments",
        "Payments and refunds",
        "READY",
        `${recentPayments} payments recorded in the last 7 days`,
        "/foh",
      ),
    ],
    kitchenPrinter: [
      smokeCheck(
        "kitchen-access",
        "Kitchen read-only access",
        (roleCounts.KITCHEN ?? 0) > 0 ? "READY" : "NEEDS_SETUP",
        `${roleCounts.KITCHEN ?? 0} active kitchen accounts`,
        "/manage/staff",
      ),
      smokeCheck(
        "kitchen-items",
        "Pending kitchen items",
        pendingKitchenItems > 0 ? "WATCH" : "READY",
        pendingKitchenItems > 0
          ? `${pendingKitchenItems} pending items on kitchen board`
          : "Kitchen board is clear",
        "/kitchen",
      ),
      smokeCheck(
        "printer-account",
        "Printer service account",
        (roleCounts.PRINTER ?? 0) > 0 ? "READY" : "NEEDS_SETUP",
        `${roleCounts.PRINTER ?? 0} active printer accounts`,
        "/manage/staff",
      ),
      smokeCheck(
        "printer-queue",
        "Ticket queue",
        failedPrintJobs > 0
          ? "NEEDS_SETUP"
          : pendingPrintJobs > 0
            ? "WATCH"
            : "READY",
        failedPrintJobs > 0
          ? `${failedPrintJobs} failed print jobs`
          : pendingPrintJobs > 0
            ? `${pendingPrintJobs} jobs waiting or printing`
            : "No blocked print jobs",
        "/manage/print-jobs",
      ),
    ],
    management: [
      smokeCheck(
        "management-access",
        "Manager access",
        managerCount > 0 ? "READY" : "NEEDS_SETUP",
        `${managerCount} active admin/dev managers`,
        "/manage/staff",
      ),
      smokeCheck(
        "management-menu",
        "Menu management",
        menuItemCount > 0 && categoryCount > 0 ? "READY" : "NEEDS_SETUP",
        `${menuItemCount} menu items in ${categoryCount} categories`,
        "/manage/menu",
      ),
      smokeCheck(
        "management-tables",
        "Tables and QR cards",
        activeTables.length > 0 ? "READY" : "NEEDS_SETUP",
        `${activeTables.length}/${tables.length} tables active`,
        "/manage/tables",
      ),
      smokeCheck(
        "management-ops",
        "Operations records",
        supplierCount > 0 || kdsDeviceCount > 0 || auditLogCount > 0
          ? "READY"
          : "WATCH",
        `${supplierCount} suppliers, ${kdsDeviceCount} KDS devices, ${auditLogCount} audit entries`,
        "/manage/operations",
      ),
    ],
  };

  const allChecks = Object.values(checks).flat();

  return {
    store: mapStore(store),
    generatedAt: new Date().toISOString(),
    overallStatus: smokeOverall(allChecks),
    summary: {
      activeTables: activeTables.length,
      availableItems: availableItemCount,
      openTables: openTableIds.size,
      pendingKitchenItems,
      pendingServiceRequests,
      pendingPrintJobs,
      failedPrintJobs,
      recentPayments,
    },
    demo: {
      table: demoTable,
      customerPath: demoTable
        ? `/c?t=${encodeURIComponent(demoTable.qrToken)}`
        : null,
      item: demoItem,
    },
    stages: [
      { id: "customer", title: "Customer QR flow", checks: checks.customer },
      { id: "foh", title: "FOH operating loop", checks: checks.foh },
      {
        id: "kitchen-printer",
        title: "Kitchen and printer handoff",
        checks: checks.kitchenPrinter,
      },
      {
        id: "management",
        title: "Management readiness",
        checks: checks.management,
      },
    ],
    routes: [
      {
        label: "Customer menu",
        href: demoTable ? `/c?t=${demoTable.qrToken}` : "/c",
        role: "CUSTOMER",
      },
      { label: "FOH board", href: "/foh", role: "FOH" },
      { label: "Kitchen board", href: "/kitchen", role: "KITCHEN" },
      { label: "Print jobs", href: "/manage/print-jobs", role: "ADMIN" },
      { label: "Menu setup", href: "/manage/menu", role: "ADMIN" },
      { label: "Tables and QR", href: "/manage/tables", role: "ADMIN" },
    ],
  };
}

export async function createSupplier(input: CreateSupplierRequest) {
  const store = await getDefaultStore();
  const supplier = await prisma.supplier.create({
    data: {
      storeId: store.id,
      name: input.name.trim(),
      contactName: input.contactName?.trim() || null,
      phone: input.phone?.trim() || null,
      email: input.email?.trim() || null,
      notes: input.notes?.trim() || null,
    },
  });
  return mapSupplier(supplier);
}

export async function updateSupplier(
  supplierId: string,
  input: UpdateSupplierRequest,
) {
  const store = await getDefaultStore();
  const existing = await prisma.supplier.findFirst({
    where: { id: supplierId, storeId: store.id },
  });
  if (!existing) {
    throw new HttpError(404, "SUPPLIER_NOT_FOUND", "Supplier not found");
  }

  const supplier = await prisma.supplier.update({
    where: { id: existing.id },
    data: {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.contactName !== undefined
        ? { contactName: input.contactName?.trim() || null }
        : {}),
      ...(input.phone !== undefined
        ? { phone: input.phone?.trim() || null }
        : {}),
      ...(input.email !== undefined
        ? { email: input.email?.trim() || null }
        : {}),
      ...(input.notes !== undefined
        ? { notes: input.notes?.trim() || null }
        : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    },
  });
  return mapSupplier(supplier);
}

function assertPurchaseOrderLines(input: CreatePurchaseOrderRequest["lines"]) {
  const itemIds = new Set<string>();
  for (const line of input) {
    const itemId = line.menuItemId.trim();
    if (itemIds.has(itemId)) {
      throw new HttpError(
        400,
        "DUPLICATE_PURCHASE_ITEM",
        "Each menu item can appear only once on a purchase order",
      );
    }
    itemIds.add(itemId);
  }
  return Array.from(itemIds);
}

export async function createPurchaseOrder(input: CreatePurchaseOrderRequest) {
  const store = await getDefaultStore();
  const itemIds = assertPurchaseOrderLines(input.lines);
  const orderNumber =
    input.orderNumber?.trim() ||
    `PO-${new Date().toISOString().slice(0, 10)}-${Date.now()}`;
  const expectedAt = input.expectedAt ? new Date(input.expectedAt) : null;

  return prisma.$transaction(async (tx) => {
    const [supplier, items] = await Promise.all([
      tx.supplier.findFirst({
        where: {
          id: input.supplierId,
          storeId: store.id,
          isActive: true,
        },
      }),
      tx.menuItem.findMany({
        where: { storeId: store.id, id: { in: itemIds } },
        select: { id: true },
      }),
    ]);

    if (!supplier) {
      throw new HttpError(404, "SUPPLIER_NOT_FOUND", "Supplier not found");
    }
    if (items.length !== itemIds.length) {
      throw new HttpError(404, "MENU_ITEM_NOT_FOUND", "Menu item not found");
    }

    const purchaseOrder = await tx.purchaseOrder.create({
      data: {
        storeId: store.id,
        supplierId: supplier.id,
        orderNumber,
        status: "ORDERED",
        expectedAt,
        orderedAt: new Date(),
        notes: input.notes?.trim() || null,
        lines: {
          create: input.lines.map((line) => ({
            menuItemId: line.menuItemId.trim(),
            quantityOrdered: line.quantityOrdered,
            unitCostCents: line.unitCostCents ?? null,
            note: line.note?.trim() || null,
          })),
        },
      },
      include: {
        supplier: { select: { name: true } },
        lines: {
          orderBy: { createdAt: "asc" },
          include: { menuItem: { select: { name: true } } },
        },
      },
    });

    await tx.auditLog.create({
      data: {
        storeId: store.id,
        action: "PURCHASE_ORDER_CREATED",
        entityType: "PurchaseOrder",
        entityId: purchaseOrder.id,
        metadata: {
          orderNumber: purchaseOrder.orderNumber,
          supplierId: supplier.id,
          lineCount: purchaseOrder.lines.length,
        },
      },
    });

    return mapPurchaseOrder(purchaseOrder);
  });
}

export async function receivePurchaseOrder(
  purchaseOrderId: string,
  input: ReceivePurchaseOrderRequest,
) {
  const store = await getDefaultStore();
  return prisma.$transaction(async (tx) => {
    const purchaseOrder = await tx.purchaseOrder.findFirst({
      where: { id: purchaseOrderId, storeId: store.id },
      include: {
        supplier: { select: { name: true } },
        lines: {
          include: {
            menuItem: { select: { id: true, name: true, stockQuantity: true } },
          },
        },
      },
    });
    if (!purchaseOrder) {
      throw new HttpError(
        404,
        "PURCHASE_ORDER_NOT_FOUND",
        "Purchase order not found",
      );
    }
    if (
      purchaseOrder.status === "RECEIVED" ||
      purchaseOrder.status === "CANCELED"
    ) {
      throw new HttpError(
        400,
        "PURCHASE_ORDER_CLOSED",
        "Purchase order cannot receive more items",
      );
    }

    const receiveByLine = new Map(
      input.lines.map((line) => [line.lineId, line.quantityReceived]),
    );
    const knownLineIds = new Set(purchaseOrder.lines.map((line) => line.id));
    for (const lineId of receiveByLine.keys()) {
      if (!knownLineIds.has(lineId)) {
        throw new HttpError(
          404,
          "PURCHASE_ORDER_LINE_NOT_FOUND",
          "Purchase order line not found",
        );
      }
    }
    let receivedAny = false;
    const projected = purchaseOrder.lines.map((line) => {
      const quantityReceived = receiveByLine.get(line.id) ?? 0;
      if (quantityReceived <= 0) {
        return {
          id: line.id,
          quantityOrdered: line.quantityOrdered,
          quantityReceived: line.quantityReceived,
        };
      }
      const remaining = line.quantityOrdered - line.quantityReceived;
      if (quantityReceived > remaining) {
        throw new HttpError(
          400,
          "RECEIVE_QUANTITY_TOO_HIGH",
          `${line.menuItem.name} has only ${remaining} remaining on this purchase order`,
        );
      }
      receivedAny = true;
      return {
        id: line.id,
        quantityOrdered: line.quantityOrdered,
        quantityReceived: line.quantityReceived + quantityReceived,
      };
    });

    if (!receivedAny) {
      throw new HttpError(
        400,
        "NO_RECEIVE_LINES",
        "At least one purchase order line must be received",
      );
    }

    for (const line of purchaseOrder.lines) {
      const quantityReceived = receiveByLine.get(line.id) ?? 0;
      if (quantityReceived <= 0) continue;
      await tx.purchaseOrderLine.update({
        where: { id: line.id },
        data: { quantityReceived: { increment: quantityReceived } },
      });
      await tx.menuItem.update({
        where: { id: line.menuItemId },
        data: {
          stockQuantity: (line.menuItem.stockQuantity ?? 0) + quantityReceived,
        },
      });
      await tx.inventoryAdjustment.create({
        data: {
          storeId: store.id,
          menuItemId: line.menuItemId,
          purchaseOrderId: purchaseOrder.id,
          quantityDelta: quantityReceived,
          reason: "Purchase order received",
          note: `${purchaseOrder.orderNumber} / ${line.menuItem.name}`,
        },
      });
    }

    const status = projected.every(
      (line) => line.quantityReceived >= line.quantityOrdered,
    )
      ? "RECEIVED"
      : "PARTIALLY_RECEIVED";

    await tx.purchaseOrder.update({
      where: { id: purchaseOrder.id },
      data: {
        status,
        receivedAt: status === "RECEIVED" ? new Date() : null,
      },
    });

    await tx.auditLog.create({
      data: {
        storeId: store.id,
        action: "PURCHASE_ORDER_RECEIVED",
        entityType: "PurchaseOrder",
        entityId: purchaseOrder.id,
        metadata: {
          orderNumber: purchaseOrder.orderNumber,
          receivedLines: input.lines.length,
          status,
        },
      },
    });

    const updated = await tx.purchaseOrder.findUniqueOrThrow({
      where: { id: purchaseOrder.id },
      include: {
        supplier: { select: { name: true } },
        lines: {
          orderBy: { createdAt: "asc" },
          include: { menuItem: { select: { name: true } } },
        },
      },
    });
    return mapPurchaseOrder(updated);
  });
}

export async function createInventoryAdjustment(
  input: CreateInventoryAdjustmentRequest,
) {
  const store = await getDefaultStore();
  return prisma.$transaction(async (tx) => {
    const item = await tx.menuItem.findFirst({
      where: { id: input.menuItemId, storeId: store.id },
    });
    if (!item) {
      throw new HttpError(404, "MENU_ITEM_NOT_FOUND", "Menu item not found");
    }
    const nextStock = Math.max(
      0,
      (item.stockQuantity ?? 0) + input.quantityDelta,
    );
    await tx.menuItem.update({
      where: { id: item.id },
      data: { stockQuantity: nextStock },
    });
    const adjustment = await tx.inventoryAdjustment.create({
      data: {
        storeId: store.id,
        menuItemId: item.id,
        quantityDelta: input.quantityDelta,
        reason: input.reason.trim(),
        note: input.note?.trim() || null,
      },
      include: { menuItem: { select: { name: true } } },
    });
    await tx.auditLog.create({
      data: {
        storeId: store.id,
        action: "INVENTORY_ADJUSTED",
        entityType: "MenuItem",
        entityId: item.id,
        metadata: {
          quantityDelta: input.quantityDelta,
          reason: input.reason,
        },
      },
    });
    return mapInventoryAdjustment(adjustment);
  });
}

export async function createStocktake(input: CreateStocktakeRequest) {
  const store = await getDefaultStore();
  if (!input.lines.length) {
    throw new HttpError(
      400,
      "EMPTY_STOCKTAKE",
      "Stocktake must include at least one counted item",
    );
  }

  const countedByItem = new Map<
    string,
    { countedQuantity: number; note: string | null }
  >();
  for (const line of input.lines) {
    const menuItemId = line.menuItemId.trim();
    if (!menuItemId) {
      throw new HttpError(400, "INVALID_STOCKTAKE_LINE", "Menu item required");
    }
    if (!Number.isInteger(line.countedQuantity) || line.countedQuantity < 0) {
      throw new HttpError(
        400,
        "INVALID_COUNTED_QUANTITY",
        "Counted quantity must be zero or greater",
      );
    }
    countedByItem.set(menuItemId, {
      countedQuantity: line.countedQuantity,
      note: line.note?.trim() || null,
    });
  }

  return prisma.$transaction(async (tx) => {
    const menuItems = await tx.menuItem.findMany({
      where: {
        storeId: store.id,
        id: { in: Array.from(countedByItem.keys()) },
      },
      select: { id: true, name: true, stockQuantity: true },
    });
    if (menuItems.length !== countedByItem.size) {
      throw new HttpError(404, "MENU_ITEM_NOT_FOUND", "Menu item not found");
    }
    const untracked = menuItems.find((item) => item.stockQuantity === null);
    if (untracked) {
      throw new HttpError(
        400,
        "UNTRACKED_STOCK_ITEM",
        `${untracked.name} does not track stock`,
      );
    }

    const countedAt = input.countedAt ? new Date(input.countedAt) : new Date();
    const appliedAt = new Date();
    const stocktake = await tx.stocktake.create({
      data: {
        storeId: store.id,
        name: input.name.trim(),
        status: "APPLIED",
        note: input.note?.trim() || null,
        countedAt,
        appliedAt,
      },
    });

    for (const item of menuItems) {
      const counted = countedByItem.get(item.id);
      if (!counted) continue;
      const expectedQuantity = item.stockQuantity ?? 0;
      const differenceQuantity = counted.countedQuantity - expectedQuantity;
      await tx.stocktakeLine.create({
        data: {
          stocktakeId: stocktake.id,
          menuItemId: item.id,
          expectedQuantity,
          countedQuantity: counted.countedQuantity,
          differenceQuantity,
          note: counted.note,
        },
      });
      await tx.menuItem.update({
        where: { id: item.id },
        data: { stockQuantity: counted.countedQuantity },
      });
      if (differenceQuantity !== 0) {
        await tx.inventoryAdjustment.create({
          data: {
            storeId: store.id,
            menuItemId: item.id,
            stocktakeId: stocktake.id,
            quantityDelta: differenceQuantity,
            reason: "Stocktake applied",
            note:
              counted.note ||
              `${stocktake.name}: ${expectedQuantity} -> ${counted.countedQuantity}`,
          },
        });
      }
    }

    await tx.auditLog.create({
      data: {
        storeId: store.id,
        action: "STOCKTAKE_APPLIED",
        entityType: "Stocktake",
        entityId: stocktake.id,
        metadata: {
          name: stocktake.name,
          lineCount: menuItems.length,
        },
      },
    });

    const saved = await tx.stocktake.findUniqueOrThrow({
      where: { id: stocktake.id },
      include: {
        lines: {
          orderBy: { id: "asc" },
          include: { menuItem: { select: { name: true } } },
        },
      },
    });
    return mapStocktake(saved);
  });
}

export async function createIngredient(input: CreateIngredientRequest) {
  const store = await getDefaultStore();
  const name = input.name.trim();
  return prisma.$transaction(async (tx) => {
    const ingredient = await tx.ingredient.upsert({
      where: {
        storeId_name: {
          storeId: store.id,
          name,
        },
      },
      update: {
        unit: input.unit.trim() || "unit",
        stockQuantity: input.stockQuantity,
        unitCostCents: input.unitCostCents,
        lowStockThreshold: input.lowStockThreshold,
        isActive: input.isActive,
      },
      create: {
        storeId: store.id,
        name,
        unit: input.unit.trim() || "unit",
        stockQuantity: input.stockQuantity,
        unitCostCents: input.unitCostCents,
        lowStockThreshold: input.lowStockThreshold,
        isActive: input.isActive,
      },
    });
    await tx.auditLog.create({
      data: {
        storeId: store.id,
        action: "INGREDIENT_SAVED",
        entityType: "Ingredient",
        entityId: ingredient.id,
        metadata: {
          name: ingredient.name,
          unit: ingredient.unit,
          stockQuantity: ingredient.stockQuantity,
          unitCostCents: ingredient.unitCostCents,
        },
      },
    });
    return mapIngredient(ingredient);
  });
}

export async function updateIngredient(
  ingredientId: string,
  input: UpdateIngredientRequest,
) {
  const store = await getDefaultStore();
  const existing = await prisma.ingredient.findFirst({
    where: { id: ingredientId, storeId: store.id },
  });
  if (!existing) {
    throw new HttpError(404, "INGREDIENT_NOT_FOUND", "Ingredient not found");
  }

  return prisma.$transaction(async (tx) => {
    const ingredient = await tx.ingredient.update({
      where: { id: existing.id },
      data: {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.unit !== undefined
          ? { unit: input.unit.trim() || "unit" }
          : {}),
        ...(input.stockQuantity !== undefined
          ? { stockQuantity: input.stockQuantity }
          : {}),
        ...(input.unitCostCents !== undefined
          ? { unitCostCents: input.unitCostCents }
          : {}),
        ...(input.lowStockThreshold !== undefined
          ? { lowStockThreshold: input.lowStockThreshold }
          : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
    });
    await tx.auditLog.create({
      data: {
        storeId: store.id,
        action: "INGREDIENT_UPDATED",
        entityType: "Ingredient",
        entityId: ingredient.id,
        metadata: {
          name: ingredient.name,
          unit: ingredient.unit,
          stockQuantity: ingredient.stockQuantity,
          unitCostCents: ingredient.unitCostCents,
        },
      },
    });
    return mapIngredient(ingredient);
  });
}

export async function upsertRecipe(input: UpsertRecipeRequest) {
  const store = await getDefaultStore();
  if (input.lines.length === 0) {
    throw new HttpError(
      400,
      "EMPTY_RECIPE",
      "Recipe must include at least one ingredient",
    );
  }

  const ingredientIds = input.lines.map((line) => line.ingredientId.trim());
  const uniqueIngredientIds = new Set(ingredientIds);
  if (uniqueIngredientIds.size !== ingredientIds.length) {
    throw new HttpError(
      400,
      "DUPLICATE_RECIPE_INGREDIENT",
      "Recipe cannot include the same ingredient twice",
    );
  }

  for (const line of input.lines) {
    if (!Number.isInteger(line.quantity) || line.quantity <= 0) {
      throw new HttpError(
        400,
        "INVALID_RECIPE_QUANTITY",
        "Recipe ingredient quantity must be positive",
      );
    }
  }

  return prisma.$transaction(async (tx) => {
    const [menuItem, ingredients] = await Promise.all([
      tx.menuItem.findFirst({
        where: { id: input.menuItemId, storeId: store.id },
        select: { id: true },
      }),
      tx.ingredient.findMany({
        where: {
          storeId: store.id,
          id: { in: Array.from(uniqueIngredientIds) },
          isActive: true,
        },
        select: { id: true },
      }),
    ]);
    if (!menuItem) {
      throw new HttpError(404, "MENU_ITEM_NOT_FOUND", "Menu item not found");
    }
    if (ingredients.length !== uniqueIngredientIds.size) {
      throw new HttpError(
        404,
        "INGREDIENT_NOT_FOUND",
        "Recipe ingredient not found",
      );
    }

    const recipe = await tx.recipe.upsert({
      where: { menuItemId: input.menuItemId },
      update: {
        yieldQuantity: input.yieldQuantity ?? 1,
        note: input.note?.trim() || null,
      },
      create: {
        storeId: store.id,
        menuItemId: input.menuItemId,
        yieldQuantity: input.yieldQuantity ?? 1,
        note: input.note?.trim() || null,
      },
    });

    await tx.recipeLine.deleteMany({ where: { recipeId: recipe.id } });
    await tx.recipeLine.createMany({
      data: input.lines.map((line) => ({
        recipeId: recipe.id,
        ingredientId: line.ingredientId.trim(),
        quantity: line.quantity,
        note: line.note?.trim() || null,
      })),
    });

    const saved = await tx.recipe.findUniqueOrThrow({
      where: { id: recipe.id },
      include: {
        menuItem: { select: { name: true, priceCents: true } },
        lines: {
          orderBy: { id: "asc" },
          include: {
            ingredient: {
              select: { name: true, unit: true, unitCostCents: true },
            },
          },
        },
      },
    });
    await tx.auditLog.create({
      data: {
        storeId: store.id,
        action: "RECIPE_SAVED",
        entityType: "Recipe",
        entityId: recipe.id,
        metadata: {
          menuItemId: saved.menuItemId,
          menuItemName: saved.menuItem.name,
          yieldQuantity: saved.yieldQuantity,
          lineCount: saved.lines.length,
        },
      },
    });
    return mapRecipe(saved);
  });
}

export async function updateCustomerFeedbackStatus(
  feedbackId: string,
  input: UpdateFeedbackRequest,
) {
  const store = await getDefaultStore();
  const existing = await prisma.feedback.findFirst({
    where: { id: feedbackId, storeId: store.id },
  });
  if (!existing) {
    throw new HttpError(404, "FEEDBACK_NOT_FOUND", "Feedback not found");
  }

  return prisma.$transaction(async (tx) => {
    const feedback = await tx.feedback.update({
      where: { id: existing.id },
      data: {
        status: input.status,
        handledAt: input.status === "NEW" ? null : new Date(),
      },
      include: {
        table: { select: { number: true } },
        member: { select: { phone: true, name: true } },
      },
    });
    await tx.auditLog.create({
      data: {
        storeId: store.id,
        action: "CUSTOMER_FEEDBACK_UPDATED",
        entityType: "Feedback",
        entityId: feedback.id,
        metadata: {
          status: feedback.status,
          orderId: feedback.orderId,
          rating: feedback.rating,
        },
      },
    });
    return mapFeedback(feedback);
  });
}

export async function createMember(input: CreateMemberRequest) {
  const store = await getDefaultStore();
  const phone = normalizePhone(input.phone);
  if (!phone) {
    throw new HttpError(400, "INVALID_MEMBER_PHONE", "Member phone required");
  }
  const member = await prisma.member.upsert({
    where: {
      storeId_phone: {
        storeId: store.id,
        phone,
      },
    },
    update: {
      name: input.name?.trim() || null,
      email: input.email?.trim() || null,
      ...(input.points !== undefined ? { points: input.points } : {}),
    },
    create: {
      storeId: store.id,
      name: input.name?.trim() || null,
      phone,
      email: input.email?.trim() || null,
      points: input.points ?? 0,
    },
  });
  return mapMember(member);
}

export async function updateMember(
  memberId: string,
  input: UpdateMemberRequest,
) {
  const store = await getDefaultStore();
  const existing = await prisma.member.findFirst({
    where: { id: memberId, storeId: store.id },
  });
  if (!existing) {
    throw new HttpError(404, "MEMBER_NOT_FOUND", "Member not found");
  }

  const member = await prisma.member.update({
    where: { id: existing.id },
    data: {
      ...(input.name !== undefined ? { name: input.name?.trim() || null } : {}),
      ...(input.phone !== undefined
        ? { phone: normalizePhone(input.phone) ?? existing.phone }
        : {}),
      ...(input.email !== undefined
        ? { email: input.email?.trim() || null }
        : {}),
      ...(input.points !== undefined ? { points: input.points } : {}),
    },
  });
  return mapMember(member);
}

export async function createCoupon(input: CreateCouponRequest) {
  const store = await getDefaultStore();
  const coupon = await prisma.coupon.upsert({
    where: {
      storeId_code: {
        storeId: store.id,
        code: input.code.trim().toUpperCase(),
      },
    },
    update: {
      discountType: input.discountType,
      discountValue: input.discountValue,
      minimumSubtotalCents: input.minimumSubtotalCents ?? 0,
      isActive: input.isActive,
      startsAt: input.startsAt ? new Date(input.startsAt) : null,
      endsAt: input.endsAt ? new Date(input.endsAt) : null,
    },
    create: {
      storeId: store.id,
      code: input.code.trim().toUpperCase(),
      discountType: input.discountType,
      discountValue: input.discountValue,
      minimumSubtotalCents: input.minimumSubtotalCents ?? 0,
      isActive: input.isActive,
      startsAt: input.startsAt ? new Date(input.startsAt) : null,
      endsAt: input.endsAt ? new Date(input.endsAt) : null,
    },
  });
  return mapCoupon(coupon);
}

export async function updateCoupon(
  couponId: string,
  input: UpdateCouponRequest,
) {
  const store = await getDefaultStore();
  const existing = await prisma.coupon.findFirst({
    where: { id: couponId, storeId: store.id },
  });
  if (!existing) {
    throw new HttpError(404, "COUPON_NOT_FOUND", "Coupon not found");
  }

  const coupon = await prisma.coupon.update({
    where: { id: existing.id },
    data: {
      ...(input.code !== undefined
        ? { code: input.code.trim().toUpperCase() }
        : {}),
      ...(input.discountType !== undefined
        ? { discountType: input.discountType }
        : {}),
      ...(input.discountValue !== undefined
        ? { discountValue: input.discountValue }
        : {}),
      ...(input.minimumSubtotalCents !== undefined
        ? { minimumSubtotalCents: input.minimumSubtotalCents }
        : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      ...(input.startsAt !== undefined
        ? { startsAt: input.startsAt ? new Date(input.startsAt) : null }
        : {}),
      ...(input.endsAt !== undefined
        ? { endsAt: input.endsAt ? new Date(input.endsAt) : null }
        : {}),
    },
  });
  return mapCoupon(coupon);
}

export async function createKdsDevice(input: CreateKdsDeviceRequest) {
  const store = await getDefaultStore();
  const device = await prisma.kdsDevice.create({
    data: {
      storeId: store.id,
      name: input.name.trim(),
      station: input.station?.trim() || null,
      token: input.token?.trim() || `kds_${randomBytes(12).toString("hex")}`,
      isActive: input.isActive,
    },
  });
  return mapKdsDevice(device);
}

export async function updateKdsDevice(
  deviceId: string,
  input: UpdateKdsDeviceRequest,
) {
  const store = await getDefaultStore();
  const existing = await prisma.kdsDevice.findFirst({
    where: { id: deviceId, storeId: store.id },
  });
  if (!existing) {
    throw new HttpError(404, "KDS_DEVICE_NOT_FOUND", "KDS device not found");
  }

  const token = input.token?.trim();
  const device = await prisma.kdsDevice.update({
    where: { id: existing.id },
    data: {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.station !== undefined
        ? { station: input.station?.trim() || null }
        : {}),
      ...(input.token !== undefined && token ? { token } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    },
  });
  return mapKdsDevice(device);
}

export async function getManageTables() {
  const store = await getDefaultStore();
  const tables = await prisma.diningTable.findMany({
    where: { storeId: store.id },
    orderBy: [{ number: "asc" }, { createdAt: "asc" }],
  });
  return { store: mapStore(store), tables: tables.map(mapTable) };
}

export async function createDiningTable(input: CreateDiningTableRequest) {
  const store = await getDefaultStore();
  const number = input.number.trim();
  await assertTableNumberAvailable({ storeId: store.id, number });
  const qrToken =
    input.qrToken?.trim() || (await generateUniqueQrToken(number));
  await assertQrTokenAvailable({ qrToken });

  const table = await prisma.diningTable.create({
    data: {
      storeId: store.id,
      number,
      name: input.name?.trim() || null,
      qrToken,
      isActive: input.isActive ?? true,
    },
  });

  return mapTable(table);
}

export async function updateDiningTable(
  tableId: string,
  input: UpdateDiningTableRequest,
) {
  const store = await getDefaultStore();
  const existing = await prisma.diningTable.findFirst({
    where: { id: tableId, storeId: store.id },
  });
  if (!existing) throw new HttpError(404, "TABLE_NOT_FOUND", "Table not found");

  const number = input.number?.trim();
  if (number && number !== existing.number) {
    await assertTableNumberAvailable({
      storeId: store.id,
      number,
      excludeId: tableId,
    });
  }

  const qrToken = input.qrToken?.trim();
  if (qrToken && qrToken !== existing.qrToken) {
    await assertQrTokenAvailable({ qrToken, excludeId: tableId });
  }

  const table = await prisma.diningTable.update({
    where: { id: tableId },
    data: {
      ...(number !== undefined ? { number } : {}),
      ...(input.name !== undefined ? { name: input.name?.trim() || null } : {}),
      ...(qrToken !== undefined ? { qrToken } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    },
  });

  return mapTable(table);
}

export async function rotateDiningTableQrToken(tableId: string) {
  const store = await getDefaultStore();
  const existing = await prisma.diningTable.findFirst({
    where: { id: tableId, storeId: store.id },
  });
  if (!existing) throw new HttpError(404, "TABLE_NOT_FOUND", "Table not found");

  const table = await prisma.diningTable.update({
    where: { id: tableId },
    data: { qrToken: await generateUniqueQrToken(existing.number) },
  });

  return mapTable(table);
}

export async function deleteDiningTable(tableId: string) {
  const store = await getDefaultStore();
  const existing = await prisma.diningTable.findFirst({
    where: { id: tableId, storeId: store.id },
  });
  if (!existing) throw new HttpError(404, "TABLE_NOT_FOUND", "Table not found");

  const [orders, serviceRequests, printJobs] = await Promise.all([
    prisma.order.count({ where: { tableId } }),
    prisma.serviceRequest.count({ where: { tableId } }),
    prisma.printJob.count({ where: { tableId } }),
  ]);
  if (orders > 0 || serviceRequests > 0 || printJobs > 0) {
    throw new HttpError(
      409,
      "TABLE_HAS_HISTORY",
      "Deactivate tables with order, request, or print history instead of deleting them",
    );
  }

  await prisma.diningTable.delete({ where: { id: tableId } });
  return { tableId, deleted: true };
}

export async function getStoreSettings() {
  const store = await getDefaultStore();
  return { store: mapStoreSettings(store) };
}

export async function updateStoreSettings(input: UpdateStoreSettingsRequest) {
  const store = await getDefaultStore();
  const updated = await prisma.store.update({
    where: { id: store.id },
    data: {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.market !== undefined ? { market: input.market } : {}),
      ...(input.region !== undefined
        ? { region: input.region?.trim() || null }
        : {}),
      ...(input.currency !== undefined
        ? { currency: input.currency.trim().toUpperCase() }
        : {}),
      ...(input.locale !== undefined ? { locale: input.locale.trim() } : {}),
      ...(input.timezone !== undefined
        ? { timezone: input.timezone.trim() }
        : {}),
      ...(input.defaultLanguage !== undefined
        ? { defaultLanguage: input.defaultLanguage }
        : {}),
      ...(input.supportedLanguages !== undefined
        ? { supportedLanguages: input.supportedLanguages }
        : {}),
      ...(input.address !== undefined
        ? { address: input.address?.trim() || null }
        : {}),
      ...(input.phone !== undefined
        ? { phone: input.phone?.trim() || null }
        : {}),
      ...(input.taxNumber !== undefined
        ? { taxNumber: input.taxNumber?.trim() || null }
        : {}),
      ...(input.taxMode !== undefined ? { taxMode: input.taxMode } : {}),
      ...(input.priceIncludesTax !== undefined
        ? { priceIncludesTax: input.priceIncludesTax }
        : {}),
      ...(input.taxRules !== undefined ? { taxRules: input.taxRules } : {}),
      ...(input.taxLabel !== undefined
        ? { taxLabel: input.taxLabel.trim() }
        : {}),
      ...(input.taxRateBps !== undefined
        ? { taxRateBps: input.taxRateBps }
        : {}),
      ...(input.serviceChargeLabel !== undefined
        ? { serviceChargeLabel: input.serviceChargeLabel.trim() }
        : {}),
      ...(input.serviceChargeRateBps !== undefined
        ? { serviceChargeRateBps: input.serviceChargeRateBps }
        : {}),
      ...(input.enabledPaymentMethods !== undefined
        ? { enabledPaymentMethods: input.enabledPaymentMethods }
        : {}),
      ...(input.invoiceInstructions !== undefined
        ? { invoiceInstructions: input.invoiceInstructions?.trim() || null }
        : {}),
      ...(input.tipEnabled !== undefined
        ? { tipEnabled: input.tipEnabled }
        : {}),
      ...(input.receiptFooter !== undefined
        ? { receiptFooter: input.receiptFooter?.trim() || null }
        : {}),
    },
  });
  return { store: mapStoreSettings(updated) };
}

export async function createMenuCategory(input: CreateMenuCategoryRequest) {
  const store = await getDefaultStore();
  const name = input.name.trim();
  await assertMenuCategoryNameAvailable({ storeId: store.id, name });

  const maxSort = await prisma.menuCategory.aggregate({
    where: { storeId: store.id },
    _max: { sortOrder: true },
  });
  const category = await prisma.menuCategory.create({
    data: {
      storeId: store.id,
      name,
      sortOrder: input.sortOrder ?? (maxSort._max.sortOrder ?? 0) + 1,
    },
    include: { items: true },
  });

  return mapMenuCategory(category);
}

export async function updateMenuCategory(
  categoryId: string,
  input: UpdateMenuCategoryRequest,
) {
  const store = await getDefaultStore();
  const existing = await getMenuCategoryForStore(categoryId, store.id);
  const name = input.name?.trim();
  if (name && name !== existing.name) {
    await assertMenuCategoryNameAvailable({
      storeId: store.id,
      name,
      excludeId: categoryId,
    });
  }

  const category = await prisma.menuCategory.update({
    where: { id: categoryId },
    data: {
      ...(name !== undefined ? { name } : {}),
      ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
    },
    include: { items: { orderBy: [{ sortOrder: "asc" }, { name: "asc" }] } },
  });

  return mapMenuCategory(category);
}

export async function deleteMenuCategory(categoryId: string) {
  const store = await getDefaultStore();
  await getMenuCategoryForStore(categoryId, store.id);
  const itemCount = await prisma.menuItem.count({ where: { categoryId } });
  if (itemCount > 0) {
    throw new HttpError(
      409,
      "CATEGORY_HAS_ITEMS",
      "Move or delete menu items before deleting this category",
    );
  }

  await prisma.menuCategory.delete({ where: { id: categoryId } });
  return { categoryId, deleted: true };
}

export async function addMenuItem(input: CreateMenuItemRequest) {
  const store = await getDefaultStore();
  const category = await getMenuCategoryForStore(input.categoryId, store.id);

  const maxSort = await prisma.menuItem.aggregate({
    where: { categoryId: input.categoryId },
    _max: { sortOrder: true },
  });
  const item = await prisma.menuItem.create({
    data: {
      storeId: category.storeId,
      categoryId: input.categoryId,
      name: input.name.trim(),
      nameLocalized: input.nameLocalized ?? undefined,
      description: input.description?.trim() || null,
      descriptionLocalized: input.descriptionLocalized ?? undefined,
      imageUrl: input.imageUrl?.trim() || null,
      allergens: input.allergens ?? [],
      spiceLevel: input.spiceLevel ?? 0,
      taxCategory: input.taxCategory?.trim() || "PREPARED_FOOD",
      kitchenStation: input.kitchenStation?.trim() || "HOT",
      modifierGroups: input.modifierGroups ?? [],
      priceCents: input.priceCents,
      isAvailable: input.isAvailable ?? true,
      stockQuantity: input.stockQuantity ?? null,
      lowStockThreshold: input.lowStockThreshold ?? 0,
      sortOrder: input.sortOrder ?? (maxSort._max.sortOrder ?? 0) + 1,
    },
  });

  return mapMenuItem(item);
}

export async function updateMenuItem(
  itemId: string,
  input: UpdateMenuItemRequest,
) {
  const store = await getDefaultStore();
  await getMenuItemForStore(itemId, store.id);

  if (input.categoryId !== undefined) {
    await getMenuCategoryForStore(input.categoryId, store.id);
  }

  const item = await prisma.menuItem.update({
    where: { id: itemId },
    data: {
      ...(input.categoryId !== undefined
        ? { category: { connect: { id: input.categoryId } } }
        : {}),
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.nameLocalized !== undefined
        ? { nameLocalized: input.nameLocalized ?? undefined }
        : {}),
      ...(input.description !== undefined
        ? { description: input.description?.trim() || null }
        : {}),
      ...(input.descriptionLocalized !== undefined
        ? { descriptionLocalized: input.descriptionLocalized ?? undefined }
        : {}),
      ...(input.imageUrl !== undefined
        ? { imageUrl: input.imageUrl?.trim() || null }
        : {}),
      ...(input.allergens !== undefined ? { allergens: input.allergens } : {}),
      ...(input.spiceLevel !== undefined
        ? { spiceLevel: input.spiceLevel }
        : {}),
      ...(input.taxCategory !== undefined
        ? { taxCategory: input.taxCategory.trim() || "PREPARED_FOOD" }
        : {}),
      ...(input.kitchenStation !== undefined
        ? { kitchenStation: input.kitchenStation.trim() || "HOT" }
        : {}),
      ...(input.modifierGroups !== undefined
        ? { modifierGroups: input.modifierGroups }
        : {}),
      ...(input.priceCents !== undefined
        ? { priceCents: input.priceCents }
        : {}),
      ...(input.isAvailable !== undefined
        ? { isAvailable: input.isAvailable }
        : {}),
      ...(input.stockQuantity !== undefined
        ? { stockQuantity: input.stockQuantity }
        : {}),
      ...(input.lowStockThreshold !== undefined
        ? { lowStockThreshold: input.lowStockThreshold }
        : {}),
      ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
    },
  });

  return mapMenuItem(item);
}

export async function updateMenuItemInventory(
  itemId: string,
  input: UpdateMenuItemInventoryRequest,
) {
  return updateMenuItem(itemId, input);
}

export async function deleteMenuItem(itemId: string) {
  const store = await getDefaultStore();
  await getMenuItemForStore(itemId, store.id);
  const orderItemCount = await prisma.orderItem.count({
    where: { menuItemId: itemId },
  });
  if (orderItemCount > 0) {
    throw new HttpError(
      409,
      "MENU_ITEM_HAS_HISTORY",
      "Mark menu items unavailable instead of deleting items with order history",
    );
  }

  await prisma.menuItem.delete({ where: { id: itemId } });
  return { itemId, deleted: true };
}

export async function getFohPrintJobs() {
  const store = await getDefaultStore();
  const jobs = await prisma.printJob.findMany({
    where: { storeId: store.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { table: { select: { number: true } } },
  });
  return { store: mapStore(store), jobs: jobs.map(mapPrintJob) };
}

export async function getFohPayments(): Promise<PaymentsResponse> {
  const store = await getDefaultStore();
  const payments = await prisma.payment.findMany({
    where: { storeId: store.id },
    orderBy: { paidAt: "desc" },
    take: 30,
    include: { table: { select: { number: true } } },
  });
  return { store: mapStore(store), payments: payments.map(mapPayment) };
}

export async function reprintOrder(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      store: true,
      table: true,
      items: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!order) throw new HttpError(404, "ORDER_NOT_FOUND", "Order not found");

  const job = await prisma.printJob.create({
    data: {
      storeId: order.storeId,
      tableId: order.tableId,
      orderId: order.id,
      type: "REPRINT",
      status: "PENDING",
      payload: buildOrderTicketPayload({
        store: order.store,
        table: order.table,
        order,
      }),
    },
    include: { table: { select: { number: true } } },
  });
  return mapPrintJob(job);
}

export async function claimPrinterJobs(limit = 5) {
  const store = await getDefaultStore();
  const take = Math.max(1, Math.min(limit, 20));

  const jobs = await prisma.$transaction(async (tx) => {
    const pending = await tx.printJob.findMany({
      where: { storeId: store.id, status: "PENDING" },
      orderBy: { createdAt: "asc" },
      take,
      include: { table: { select: { number: true } } },
    });

    for (const job of pending) {
      await tx.printJob.update({
        where: { id: job.id },
        data: { status: "PRINTING", attempts: { increment: 1 } },
      });
    }

    return pending.map((job) => ({
      ...job,
      status: "PRINTING" as const,
      attempts: job.attempts + 1,
    }));
  });

  return { store: mapStore(store), jobs: jobs.map(mapPrintJob) };
}

export async function markPrintJobPrinted(jobId: string) {
  const existing = await prisma.printJob.findUnique({ where: { id: jobId } });
  if (!existing)
    throw new HttpError(404, "PRINT_JOB_NOT_FOUND", "Print job not found");

  const job = await prisma.printJob.update({
    where: { id: jobId },
    data: { status: "PRINTED", printedAt: new Date(), failedAt: null },
    include: { table: { select: { number: true } } },
  });
  return mapPrintJob(job);
}

export async function markPrintJobFailed(jobId: string) {
  const existing = await prisma.printJob.findUnique({ where: { id: jobId } });
  if (!existing)
    throw new HttpError(404, "PRINT_JOB_NOT_FOUND", "Print job not found");

  const job = await prisma.printJob.update({
    where: { id: jobId },
    data: { status: "FAILED", failedAt: new Date() },
    include: { table: { select: { number: true } } },
  });
  return mapPrintJob(job);
}
