import { randomBytes } from "node:crypto";
import type {
  CheckoutTableRequest,
  CheckoutTableResponse,
  CreateDiningTableRequest,
  CreateMenuCategoryRequest,
  CreateMenuItemRequest,
  CreateOrderRequest,
  CreateServiceRequestRequest,
  CreateStaffUserRequest,
  CustomerOrder,
  DiningTable,
  FohPendingItem,
  FohTable,
  KitchenPendingItem,
  ManageAnalyticsResponse,
  ManageStaffUser,
  MenuCategory,
  MenuItem,
  Order,
  OrderItem,
  OrderItemStatus,
  OrderStatus,
  OrderTotals,
  Payment,
  PaymentsResponse,
  PrintJob,
  ServiceRequest,
  ServiceRequestStatus,
  StoreSettings,
  StoreSummary,
  TableStatus,
  UpdateDiningTableRequest,
  UpdateMenuCategoryRequest,
  UpdateMenuItemInventoryRequest,
  UpdateMenuItemRequest,
  UpdateStaffUserRequest,
  UpdateStoreSettingsRequest,
} from "@qr2/shared";
import { STAFF_ROLES } from "@qr2/shared";
import { hashPassword } from "./auth.js";
import { prisma } from "./db.js";
import { HttpError } from "./http.js";

type StoreRecord = {
  id: string;
  name: string;
  currency: string;
  locale: string;
  timezone: string;
  address: string | null;
  phone: string | null;
  taxLabel: string;
  taxRateBps: number;
  serviceChargeLabel: string;
  serviceChargeRateBps: number;
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
  description: string | null;
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
  items: OrderItemRecord[];
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
  amountCents: number;
  currency: string;
  reference: string | null;
  note: string | null;
  orderIds: unknown;
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
  return {
    ...mapStore(store),
    address: store.address,
    phone: store.phone,
    taxLabel: store.taxLabel,
    taxRateBps: store.taxRateBps,
    serviceChargeLabel: store.serviceChargeLabel,
    serviceChargeRateBps: store.serviceChargeRateBps,
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
    description: item.description,
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
    items: order.items.map(mapOrderItem),
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
    amountCents: payment.amountCents,
    currency: payment.currency,
    reference: payment.reference,
    note: payment.note,
    orderIds,
    paidAt: toIso(payment.paidAt),
    createdAt: toIso(payment.createdAt),
  };
}

function buildOrderTicketPayload(input: {
  store: StoreRecord;
  table: TableRecord;
  order: {
    id: string;
    createdAt: Date;
    submittedAt: Date;
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
        status: item.status,
      })),
      totals: calculateTotals(input.order.items, input.store),
    },
  };
}

function itemSubtotal(item: OrderItemRecord) {
  if (item.status === "CANCELED") return 0;
  return item.priceCentsSnapshot * item.quantity;
}

function calculateTotals(
  items: OrderItemRecord[],
  store: StoreRecord,
): OrderTotals {
  const subtotalCents = items.reduce(
    (sum, item) => sum + itemSubtotal(item),
    0,
  );
  const serviceChargeCents = Math.round(
    (subtotalCents * store.serviceChargeRateBps) / 10000,
  );
  const taxableCents = subtotalCents + serviceChargeCents;
  const taxCents = Math.round((taxableCents * store.taxRateBps) / 10000);
  return {
    subtotalCents,
    serviceChargeCents,
    taxCents,
    totalCents: subtotalCents + serviceChargeCents + taxCents,
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
    totals: calculateTotals(order.items, store),
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

function isManagerRole(role: string | null | undefined) {
  return role === "DEV" || role === "ADMIN";
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
      include: { items: { orderBy: { createdAt: "asc" } } },
    }),
    prisma.serviceRequest.findMany({
      where: { tableId: table.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);
  const openItems = orders
    .filter((order) => order.status === "SUBMITTED")
    .flatMap((order) => order.items);

  return {
    store: mapStore(table.store),
    table: mapTable(table),
    orders: orders.map((order) => mapCustomerOrder(order, table.store)),
    serviceRequests: serviceRequests.map(mapServiceRequest),
    openTotals: calculateTotals(openItems, table.store),
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
      return {
        menuItemId: menuItem.id,
        nameSnapshot: menuItem.name,
        priceCentsSnapshot: menuItem.priceCents,
        quantity: requested.quantity,
        status: "PENDING" as const,
      };
    });

    const order = await tx.order.create({
      data: {
        storeId: table.storeId,
        tableId: table.id,
        status: "SUBMITTED",
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
    const totals = calculateTotals(allOrderItems, store);

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

    const totals = calculateTotals(
      tableOrders.flatMap((order) => order.items),
      table.store,
    );
    const amountCents = input.amountCents ?? totals.totalCents;
    if (amountCents < 0) {
      throw new HttpError(
        400,
        "INVALID_PAYMENT_AMOUNT",
        "Payment amount cannot be negative",
      );
    }

    const closedAt = new Date();
    const closedOrderIds = tableOrders.map((order) => order.id);
    await tx.order.updateMany({
      where: { id: { in: closedOrderIds } },
      data: { status: "CLOSED", closedAt },
    });

    const payment =
      amountCents > 0
        ? await tx.payment.create({
            data: {
              storeId: table.storeId,
              tableId,
              method: input.paymentMethod ?? "CASH",
              amountCents,
              currency: table.store.currency,
              reference: input.reference?.trim() || null,
              note: input.note?.trim() || null,
              orderIds: closedOrderIds,
              paidAt: closedAt,
            },
          })
        : null;

    return {
      tableId,
      closedOrderIds,
      closedAt: toIso(closedAt),
      payment: payment ? mapPayment(payment) : null,
    };
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
        select: { submittedAt: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const grouped = new Map<string, KitchenPendingItem>();
  for (const item of pendingItems) {
    const earliestSubmittedAt = toIso(item.order.submittedAt);
    const existing = grouped.get(item.menuItemId);
    if (!existing) {
      grouped.set(item.menuItemId, {
        menuItemId: item.menuItemId,
        name: item.nameSnapshot,
        quantity: item.quantity,
        earliestSubmittedAt,
      });
    } else {
      existing.quantity += item.quantity;
      if (earliestSubmittedAt < existing.earliestSubmittedAt) {
        existing.earliestSubmittedAt = earliestSubmittedAt;
      }
    }
  }

  return { store: mapStore(store), items: Array.from(grouped.values()) };
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
      ...(input.currency !== undefined
        ? { currency: input.currency.trim().toUpperCase() }
        : {}),
      ...(input.locale !== undefined ? { locale: input.locale.trim() } : {}),
      ...(input.timezone !== undefined
        ? { timezone: input.timezone.trim() }
        : {}),
      ...(input.address !== undefined
        ? { address: input.address?.trim() || null }
        : {}),
      ...(input.phone !== undefined
        ? { phone: input.phone?.trim() || null }
        : {}),
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
      description: input.description?.trim() || null,
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
        ? { categoryId: input.categoryId }
        : {}),
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.description !== undefined
        ? { description: input.description?.trim() || null }
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
