export const USER_ROLES = [
  "DEV",
  "ADMIN",
  "FOH",
  "KITCHEN",
  "PRINTER",
  "CUSTOMER",
] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const STAFF_ROLES = [
  "DEV",
  "ADMIN",
  "FOH",
  "KITCHEN",
  "PRINTER",
] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export const ORDER_STATUSES = ["SUBMITTED", "CLOSED", "CANCELED"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_ITEM_STATUSES = ["PENDING", "DONE", "CANCELED"] as const;
export type OrderItemStatus = (typeof ORDER_ITEM_STATUSES)[number];

export const SERVICE_REQUEST_TYPES = [
  "WATER",
  "CALL_STAFF",
  "FOLLOW_UP",
] as const;
export type ServiceRequestType = (typeof SERVICE_REQUEST_TYPES)[number];

export const SERVICE_REQUEST_STATUSES = [
  "PENDING",
  "HANDLED",
  "CANCELED",
] as const;
export type ServiceRequestStatus = (typeof SERVICE_REQUEST_STATUSES)[number];

export const TABLE_STATUSES = [
  "EMPTY",
  "DINING",
  "URGENT",
  "CHECKOUT",
] as const;
export type TableStatus = (typeof TABLE_STATUSES)[number];

export const PRINT_JOB_TYPES = ["ORDER_TICKET", "REPRINT"] as const;
export type PrintJobType = (typeof PRINT_JOB_TYPES)[number];

export const PRINT_JOB_STATUSES = [
  "PENDING",
  "PRINTING",
  "PRINTED",
  "FAILED",
] as const;
export type PrintJobStatus = (typeof PRINT_JOB_STATUSES)[number];

export const STORE_MARKETS = ["CANADA", "CHINA", "OTHER"] as const;
export type StoreMarket = (typeof STORE_MARKETS)[number];

export const LANGUAGE_CODES = ["en", "fr-CA", "zh-CN"] as const;
export type LanguageCode = (typeof LANGUAGE_CODES)[number];

export const PAYMENT_METHODS = [
  "CASH",
  "CARD",
  "INTERAC",
  "STRIPE",
  "WECHAT_PAY",
  "ALIPAY",
  "UNIONPAY",
  "GIFT_CARD",
  "OTHER",
] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export const PAYMENT_METHOD_OPTIONS = PAYMENT_METHODS;
export type PaymentMethodOption = PaymentMethod;

export type LocalizedText = {
  en?: string | null;
  "fr-CA"?: string | null;
  "zh-CN"?: string | null;
};

export type TaxRule = {
  id: string;
  label: string;
  rateBps: number;
  appliesTo: string;
  compoundOnPrevious?: boolean;
};

export type TaxLine = {
  label: string;
  rateBps: number;
  amountCents: number;
};

export type MenuModifierOption = {
  id: string;
  name: string;
  nameLocalized?: LocalizedText | null;
  priceDeltaCents: number;
  isDefault?: boolean;
};

export type MenuModifierGroup = {
  id: string;
  name: string;
  nameLocalized?: LocalizedText | null;
  required: boolean;
  minSelect: number;
  maxSelect: number;
  options: MenuModifierOption[];
};

export type SelectedModifier = {
  groupId: string;
  optionId: string;
  name: string;
  priceDeltaCents: number;
};

export type StoreSummary = {
  id: string;
  name: string;
  currency: string;
  locale: string;
  timezone: string;
};

export type StoreSettings = StoreSummary & {
  market: StoreMarket;
  region?: string | null;
  defaultLanguage: LanguageCode;
  supportedLanguages: LanguageCode[];
  address?: string | null;
  phone?: string | null;
  taxNumber?: string | null;
  taxMode: "SINGLE" | "CANADA" | "CHINA";
  priceIncludesTax: boolean;
  taxRules: TaxRule[];
  taxLabel: string;
  taxRateBps: number;
  serviceChargeLabel: string;
  serviceChargeRateBps: number;
  enabledPaymentMethods: PaymentMethodOption[];
  invoiceInstructions?: string | null;
  tipEnabled: boolean;
  receiptFooter?: string | null;
};

export type StoreSettingsResponse = {
  store: StoreSettings;
};

export type UpdateStoreSettingsRequest = Partial<
  Pick<
    StoreSettings,
    | "name"
    | "market"
    | "region"
    | "currency"
    | "locale"
    | "timezone"
    | "defaultLanguage"
    | "supportedLanguages"
    | "address"
    | "phone"
    | "taxNumber"
    | "taxMode"
    | "priceIncludesTax"
    | "taxRules"
    | "taxLabel"
    | "taxRateBps"
    | "serviceChargeLabel"
    | "serviceChargeRateBps"
    | "enabledPaymentMethods"
    | "invoiceInstructions"
    | "tipEnabled"
    | "receiptFooter"
  >
>;

export type OrderTotals = {
  subtotalCents: number;
  serviceChargeCents: number;
  taxCents: number;
  taxLines: TaxLine[];
  includedTaxCents: number;
  totalCents: number;
  serviceChargeRateBps: number;
  taxRateBps: number;
  serviceChargeLabel: string;
  taxLabel: string;
};

export type AuthUser = {
  id: string;
  storeId: string;
  email: string;
  name?: string | null;
  role: StaffRole;
};

export type ManageStaffUser = AuthUser & {
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ManageStaffResponse = {
  store: StoreSummary;
  users: ManageStaffUser[];
};

export type CreateStaffUserRequest = {
  email: string;
  password: string;
  name?: string | null;
  role: StaffRole;
};

export type UpdateStaffUserRequest = Partial<
  Pick<CreateStaffUserRequest, "email" | "password" | "name" | "role">
> & {
  isActive?: boolean;
};

export type LoginResponse = {
  user: AuthUser;
};

export type MeResponse = {
  user: AuthUser | null;
};

export type DiningTable = {
  id: string;
  number: string;
  name?: string | null;
  qrToken: string;
  isActive: boolean;
};

export type ManageTablesResponse = {
  store: StoreSummary;
  tables: DiningTable[];
};

export type CreateDiningTableRequest = {
  number: string;
  name?: string | null;
  qrToken?: string;
  isActive?: boolean;
};

export type UpdateDiningTableRequest = Partial<CreateDiningTableRequest>;

export type MenuItem = {
  id: string;
  categoryId: string;
  name: string;
  nameLocalized?: LocalizedText | null;
  description?: string | null;
  descriptionLocalized?: LocalizedText | null;
  imageUrl?: string | null;
  allergens: string[];
  spiceLevel: number;
  taxCategory: string;
  kitchenStation: string;
  modifierGroups: MenuModifierGroup[];
  priceCents: number;
  isAvailable: boolean;
  stockQuantity?: number | null;
  lowStockThreshold: number;
  isSoldOut: boolean;
  isLowStock: boolean;
  sortOrder: number;
};

export type MenuCategory = {
  id: string;
  name: string;
  sortOrder: number;
  items: MenuItem[];
};

export type CreateMenuCategoryRequest = {
  name: string;
  sortOrder?: number;
};

export type UpdateMenuCategoryRequest = Partial<CreateMenuCategoryRequest>;

export type OrderItem = {
  id: string;
  orderId: string;
  menuItemId: string;
  nameSnapshot: string;
  priceCentsSnapshot: number;
  modifierTotalCentsSnapshot: number;
  modifiers: SelectedModifier[];
  note?: string | null;
  quantity: number;
  status: OrderItemStatus;
  createdAt: string;
};

export type Order = {
  id: string;
  tableId: string;
  status: OrderStatus;
  createdAt: string;
  submittedAt: string;
  closedAt?: string | null;
  items: OrderItem[];
};

export type CustomerOrder = Order & {
  totals: OrderTotals;
};

export type Payment = {
  id: string;
  tableId: string;
  tableNumber?: string | null;
  method: PaymentMethod;
  status: "PAID" | "PARTIALLY_REFUNDED" | "REFUNDED";
  amountCents: number;
  refundedCents: number;
  currency: string;
  reference?: string | null;
  note?: string | null;
  orderIds: string[];
  paidAt: string;
  createdAt: string;
};

export type CheckoutTableRequest = {
  paymentMethod?: PaymentMethodOption;
  amountCents?: number;
  tipCents?: number;
  discountCents?: number;
  reference?: string | null;
  note?: string | null;
};

export type RefundPaymentRequest = {
  amountCents: number;
  reason?: string | null;
};

export type CheckoutTableResponse = {
  tableId: string;
  closedOrderIds: string[];
  closedAt: string;
  payment?: Payment | null;
};

export type PaymentsResponse = {
  store: StoreSummary;
  payments: Payment[];
};

export type PrintJob = {
  id: string;
  type: PrintJobType;
  status: PrintJobStatus;
  orderId?: string | null;
  tableId?: string | null;
  tableNumber?: string | null;
  attempts: number;
  payload: unknown;
  createdAt: string;
  printedAt?: string | null;
  failedAt?: string | null;
};

export type PrintJobsResponse = {
  store: StoreSummary;
  jobs: PrintJob[];
};

export type ServiceRequest = {
  id: string;
  tableId: string;
  type: ServiceRequestType;
  status: ServiceRequestStatus;
  note?: string | null;
  createdAt: string;
  handledAt?: string | null;
};

export type PublicMenuResponse = {
  store: StoreSummary;
  table: DiningTable;
  categories: MenuCategory[];
};

export type PublicOrdersResponse = {
  store: StoreSummary;
  table: DiningTable;
  orders: CustomerOrder[];
  serviceRequests: ServiceRequest[];
  openTotals: OrderTotals;
};

export type CreateOrderRequest = {
  qrToken: string;
  items: Array<{
    menuItemId: string;
    quantity: number;
    modifiers?: SelectedModifier[];
    note?: string | null;
  }>;
  customerLanguage?: LanguageCode;
  customerName?: string | null;
};

export type CreateOrderResponse = {
  orderId: string;
};

export type CreateMenuItemRequest = {
  categoryId: string;
  name: string;
  nameLocalized?: LocalizedText | null;
  description?: string | null;
  descriptionLocalized?: LocalizedText | null;
  imageUrl?: string | null;
  allergens?: string[];
  spiceLevel?: number;
  taxCategory?: string;
  kitchenStation?: string;
  modifierGroups?: MenuModifierGroup[];
  priceCents: number;
  isAvailable?: boolean;
  stockQuantity?: number | null;
  lowStockThreshold?: number;
  sortOrder?: number;
};

export type UpdateMenuItemInventoryRequest = {
  isAvailable?: boolean;
  stockQuantity?: number | null;
  lowStockThreshold?: number;
};

export type UpdateMenuItemRequest = Partial<CreateMenuItemRequest>;

export type CreateServiceRequestRequest = {
  qrToken: string;
  type: ServiceRequestType;
  note?: string;
};

export type FohPendingItem = OrderItem & {
  orderCreatedAt: string;
};

export type FohTable = {
  table: DiningTable;
  tableStatus: TableStatus;
  openTotalCents: number;
  totals: OrderTotals;
  pendingItems: FohPendingItem[];
  recentlyDoneItems: FohPendingItem[];
  serviceRequests: ServiceRequest[];
};

export type FohTablesResponse = {
  store: StoreSummary;
  tables: FohTable[];
};

export type KitchenPendingItem = {
  menuItemId: string;
  name: string;
  kitchenStation: string;
  quantity: number;
  earliestSubmittedAt: string;
  tables: Array<{
    tableId: string;
    tableNumber: string;
    tableName?: string | null;
    quantity: number;
    earliestSubmittedAt: string;
  }>;
};

export type KitchenPendingResponse = {
  store: StoreSummary;
  items: KitchenPendingItem[];
};

export type ManageMenuResponse = {
  store: StoreSummary;
  categories: MenuCategory[];
};

export type AnalyticsDailyRevenue = {
  date: string;
  revenueCents: number;
  paymentCount: number;
};

export type AnalyticsPaymentMethod = {
  method: PaymentMethod;
  amountCents: number;
  paymentCount: number;
};

export type AnalyticsTopItem = {
  name: string;
  quantity: number;
  salesCents: number;
};

export type ManageAnalyticsResponse = {
  store: StoreSummary;
  range: {
    start: string;
    end: string;
    days: number;
  };
  totals: {
    revenueCents: number;
    paymentCount: number;
    averagePaymentCents: number;
    submittedOrderCount: number;
    closedOrderCount: number;
    openOrderCount: number;
  };
  dailyRevenue: AnalyticsDailyRevenue[];
  paymentMethods: AnalyticsPaymentMethod[];
  topItems: AnalyticsTopItem[];
};

export type Supplier = {
  id: string;
  name: string;
  contactName?: string | null;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
  isActive: boolean;
  createdAt: string;
};

export type InventoryAdjustment = {
  id: string;
  menuItemId: string;
  menuItemName: string;
  quantityDelta: number;
  reason: string;
  note?: string | null;
  createdAt: string;
};

export type Member = {
  id: string;
  name?: string | null;
  phone: string;
  email?: string | null;
  points: number;
  createdAt: string;
};

export type Coupon = {
  id: string;
  code: string;
  discountType: "PERCENT" | "AMOUNT";
  discountValue: number;
  isActive: boolean;
  startsAt?: string | null;
  endsAt?: string | null;
};

export type KdsDevice = {
  id: string;
  name: string;
  station?: string | null;
  token: string;
  isActive: boolean;
  lastSeenAt?: string | null;
};

export type AuditLog = {
  id: string;
  actorEmail?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  createdAt: string;
};

export type ManageOperationsResponse = {
  store: StoreSummary;
  suppliers: Supplier[];
  inventoryAdjustments: InventoryAdjustment[];
  members: Member[];
  coupons: Coupon[];
  kdsDevices: KdsDevice[];
  auditLogs: AuditLog[];
};

export const P0_SMOKE_STATUSES = ["READY", "WATCH", "NEEDS_SETUP"] as const;
export type P0SmokeStatus = (typeof P0_SMOKE_STATUSES)[number];

export type P0SmokeCheck = {
  id: string;
  label: string;
  status: P0SmokeStatus;
  detail: string;
  href?: string;
};

export type P0SmokeStage = {
  id: string;
  title: string;
  checks: P0SmokeCheck[];
};

export type P0SmokeCockpitResponse = {
  store: StoreSummary;
  generatedAt: string;
  overallStatus: P0SmokeStatus;
  summary: {
    activeTables: number;
    availableItems: number;
    openTables: number;
    pendingKitchenItems: number;
    pendingServiceRequests: number;
    pendingPrintJobs: number;
    failedPrintJobs: number;
    recentPayments: number;
  };
  demo: {
    table?: DiningTable | null;
    customerPath?: string | null;
    item?: {
      id: string;
      name: string;
      priceCents: number;
    } | null;
  };
  stages: P0SmokeStage[];
  routes: Array<{
    label: string;
    href: string;
    role: "CUSTOMER" | StaffRole;
  }>;
};

export type CreateSupplierRequest = Pick<
  Supplier,
  "name" | "contactName" | "phone" | "email" | "notes"
>;
export type UpdateSupplierRequest = Partial<
  Pick<
    Supplier,
    "name" | "contactName" | "phone" | "email" | "notes" | "isActive"
  >
>;

export type CreateInventoryAdjustmentRequest = {
  menuItemId: string;
  quantityDelta: number;
  reason: string;
  note?: string | null;
};

export type CreateMemberRequest = Pick<Member, "name" | "phone" | "email"> & {
  points?: number;
};
export type UpdateMemberRequest = Partial<
  Pick<Member, "name" | "phone" | "email" | "points">
>;

export type CreateCouponRequest = Pick<
  Coupon,
  "code" | "discountType" | "discountValue" | "isActive" | "startsAt" | "endsAt"
>;
export type UpdateCouponRequest = Partial<CreateCouponRequest>;

export type CreateKdsDeviceRequest = Pick<
  KdsDevice,
  "name" | "station" | "isActive"
> & {
  token?: string;
};
export type UpdateKdsDeviceRequest = Partial<CreateKdsDeviceRequest>;

export function formatCents(
  amountCents: number,
  currency = "USD",
  locale = "en-US",
) {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
  }).format(amountCents / 100);
}
