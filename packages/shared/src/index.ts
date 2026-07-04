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

export const PAYMENT_METHODS = ["CASH", "CARD", "OTHER"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export type StoreSummary = {
  id: string;
  name: string;
  currency: string;
  locale: string;
  timezone: string;
};

export type StoreSettings = StoreSummary & {
  address?: string | null;
  phone?: string | null;
  taxLabel: string;
  taxRateBps: number;
  serviceChargeLabel: string;
  serviceChargeRateBps: number;
  receiptFooter?: string | null;
};

export type StoreSettingsResponse = {
  store: StoreSettings;
};

export type UpdateStoreSettingsRequest = Partial<
  Pick<
    StoreSettings,
    | "name"
    | "currency"
    | "locale"
    | "timezone"
    | "address"
    | "phone"
    | "taxLabel"
    | "taxRateBps"
    | "serviceChargeLabel"
    | "serviceChargeRateBps"
    | "receiptFooter"
  >
>;

export type OrderTotals = {
  subtotalCents: number;
  serviceChargeCents: number;
  taxCents: number;
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
  description?: string | null;
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
  amountCents: number;
  currency: string;
  reference?: string | null;
  note?: string | null;
  orderIds: string[];
  paidAt: string;
  createdAt: string;
};

export type CheckoutTableRequest = {
  paymentMethod?: PaymentMethod;
  amountCents?: number;
  reference?: string | null;
  note?: string | null;
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
  }>;
};

export type CreateOrderResponse = {
  orderId: string;
};

export type CreateMenuItemRequest = {
  categoryId: string;
  name: string;
  description?: string | null;
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
  quantity: number;
  earliestSubmittedAt: string;
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
