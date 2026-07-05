const baseUrl = process.env.API_BASE_URL ?? "http://127.0.0.1:3001";
const qrToken = process.env.SMOKE_QR_TOKEN ?? "table-8-token";
const preferredItemName = process.env.SMOKE_ITEM_NAME;
const password = process.env.SMOKE_STAFF_PASSWORD ?? "devpass";
const marker = `p2-report-${Date.now()}`;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function cookieFrom(response) {
  const header = response.headers.get("set-cookie");
  assert(header, "login did not return a session cookie");
  return header.split(";")[0];
}

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(options.cookie ? { cookie: options.cookie } : {}),
      ...(options.storeId ? { "x-store-id": options.storeId } : {}),
      ...(options.headers ?? {}),
    },
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const message = body?.error?.message ?? response.statusText;
    throw new Error(`${options.method ?? "GET"} ${path} failed: ${message}`);
  }
  return { response, body };
}

async function login(email) {
  const { response, body } = await request("/v1/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  return { cookie: cookieFrom(response), user: body.user };
}

function allMenuItems(menu) {
  return menu.categories.flatMap((category) => category.items);
}

function findTable(fohTables, tableId) {
  const table = fohTables.tables.find((entry) => entry.table.id === tableId);
  assert(table, `FOH table ${tableId} not found`);
  return table;
}

async function markTablePendingItemsDone(fohCookie, tableId) {
  const fohTables = await request("/v1/foh/tables", { cookie: fohCookie });
  const table = findTable(fohTables.body, tableId);
  for (const item of table.pendingItems) {
    await request(`/v1/foh/order-items/${encodeURIComponent(item.id)}/status`, {
      method: "PATCH",
      cookie: fohCookie,
      body: JSON.stringify({ status: "DONE" }),
    });
  }
}

async function main() {
  await request("/health");

  const [dev, admin, foh] = await Promise.all([
    login("dev@local"),
    login("admin@local"),
    login("foh@local"),
  ]);
  assert(dev.user.role === "DEV", "dev login returned the wrong role");
  assert(admin.user.role === "ADMIN", "admin login returned the wrong role");
  assert(foh.user.role === "FOH", "foh login returned the wrong role");

  const defaultStoreId = admin.user.storeId;
  const couponCode = `RPT${Date.now().toString(36).toUpperCase()}`;
  const memberPhone = `+1-647-555-${String(Date.now()).slice(-4)}`;
  const memberName = `Reporting ${marker.slice(-6)}`;

  const coupon = await request("/v1/manage/operations/coupons", {
    method: "POST",
    cookie: admin.cookie,
    body: JSON.stringify({
      code: couponCode,
      discountType: "AMOUNT",
      discountValue: 100,
      minimumSubtotalCents: 0,
      isActive: true,
      startsAt: null,
      endsAt: null,
    }),
  });
  assert(coupon.body.code === couponCode, "coupon was not saved");

  const menu = await request(
    `/v1/public/menu?qrToken=${encodeURIComponent(qrToken)}`,
  );
  const tableId = menu.body.table.id;
  const menuItems = allMenuItems(menu.body);
  const item =
    (preferredItemName
      ? menuItems.find(
          (entry) => entry.name === preferredItemName && entry.isAvailable,
        )
      : null) ??
    menuItems.find(
      (entry) =>
        entry.name !== "Jasmine Tea" &&
        entry.isAvailable &&
        entry.stockQuantity !== null,
    ) ??
    menuItems.find(
      (entry) => entry.name !== "Jasmine Tea" && entry.isAvailable,
    ) ??
    menuItems.find((entry) => entry.isAvailable);
  assert(item, "available menu item not found");

  await request(
    `/v1/manage/menu/items/${encodeURIComponent(item.id)}/inventory`,
    {
      method: "PATCH",
      cookie: admin.cookie,
      body: JSON.stringify({
        isAvailable: true,
        stockQuantity: 5,
        lowStockThreshold: 5,
      }),
    },
  );
  await request("/v1/manage/operations/inventory-adjustments", {
    method: "POST",
    cookie: admin.cookie,
    body: JSON.stringify({
      menuItemId: item.id,
      quantityDelta: -1,
      reason: "P2 reporting smoke",
      note: marker,
    }),
  });

  const createdOrder = await request("/v1/public/orders", {
    method: "POST",
    body: JSON.stringify({
      qrToken,
      customerName: memberName,
      customerPhone: memberPhone,
      couponCode,
      items: [{ menuItemId: item.id, quantity: 1 }],
    }),
  });
  const orderId = createdOrder.body.orderId;
  assert(orderId, "order creation did not return an order id");

  await markTablePendingItemsDone(foh.cookie, tableId);
  const checkout = await request(
    `/v1/foh/tables/${encodeURIComponent(tableId)}/checkout`,
    {
      method: "POST",
      cookie: foh.cookie,
      body: JSON.stringify({
        paymentMethod: "CARD",
        tipCents: 50,
        discountCents: 25,
        reference: marker,
        note: "P2 reporting smoke",
      }),
    },
  );
  assert(checkout.body.payment?.id, "checkout did not create a payment");
  assert(
    checkout.body.closedOrderIds.includes(orderId),
    "checkout did not close the created order",
  );

  const refunded = await request(
    `/v1/foh/payments/${encodeURIComponent(checkout.body.payment.id)}/refund`,
    {
      method: "POST",
      cookie: foh.cookie,
      body: JSON.stringify({
        amountCents: 1,
        reason: "P2 reporting smoke refund",
      }),
    },
  );
  assert(refunded.body.refundedCents >= 1, "refund was not recorded");

  const analytics = await request("/v1/manage/analytics?days=31", {
    cookie: admin.cookie,
  });
  assert(
    analytics.body.store.id === defaultStoreId,
    "analytics resolved the wrong store",
  );
  assert(
    analytics.body.totals.paymentCount > 0,
    "analytics missing payment count",
  );
  assert(
    analytics.body.totals.netRevenueCents > 0,
    "analytics missing net revenue",
  );
  assert(
    analytics.body.totals.refundedCents >= 1,
    "analytics missing refund amount",
  );
  assert(
    analytics.body.totals.memberPaymentCount > 0,
    "analytics missing member payments",
  );
  assert(
    analytics.body.totals.couponRedemptionCount > 0,
    "analytics missing coupon redemptions",
  );
  assert(
    analytics.body.topItems.some((entry) => entry.name === item.name),
    "analytics missing top item",
  );
  assert(
    analytics.body.categorySales.length > 0,
    "analytics missing category sales",
  );
  assert(
    analytics.body.kitchenStations.length > 0,
    "analytics missing station performance",
  );
  assert(
    analytics.body.totals.couponDiscountCents > 0 &&
      analytics.body.coupons.length > 0,
    "analytics missing coupon performance",
  );
  assert(
    analytics.body.inventoryRisks.some((entry) => entry.menuItemId === item.id),
    "analytics missing inventory risk",
  );
  assert(
    analytics.body.auditActions.some(
      (entry) => entry.action === "PAYMENT_REFUNDED",
    ),
    "analytics missing refund audit action",
  );

  const refundAudit = await request(
    "/v1/manage/audit-logs?days=31&action=PAYMENT_REFUNDED",
    { cookie: admin.cookie },
  );
  assert(
    refundAudit.body.logs.some(
      (entry) => entry.entityId === checkout.body.payment.id,
    ),
    "audit log filter missing refund payment",
  );
  const inventoryAudit = await request(
    "/v1/manage/audit-logs?days=31&entityType=MenuItem",
    { cookie: admin.cookie },
  );
  assert(
    inventoryAudit.body.logs.some(
      (entry) => entry.action === "INVENTORY_ADJUSTED",
    ),
    "audit log filter missing inventory adjustment",
  );

  const storeName = `Reporting Store ${marker}`;
  const adminEmail = `${marker}@example.local`;
  const createdStore = await request("/v1/manage/platform/stores", {
    cookie: dev.cookie,
    method: "POST",
    body: JSON.stringify({
      name: storeName,
      market: "CANADA",
      region: "ON",
      adminEmail,
      adminPassword: password,
      adminName: "Reporting Admin",
      tableCount: 1,
    }),
  });
  const newStore = createdStore.body.stores.find(
    (entry) => entry.name === storeName,
  );
  assert(newStore, "reporting smoke store not returned");

  const emptyAnalytics = await request("/v1/manage/analytics?days=31", {
    cookie: dev.cookie,
    storeId: newStore.id,
  });
  assert(
    emptyAnalytics.body.store.id === newStore.id,
    "DEV analytics did not switch store",
  );
  assert(
    emptyAnalytics.body.totals.paymentCount === 0,
    "new store analytics leaked payments",
  );
  assert(
    emptyAnalytics.body.totals.submittedOrderCount === 0,
    "new store analytics leaked orders",
  );

  const newStoreAudit = await request(
    `/v1/manage/audit-logs?days=31&actorEmail=${encodeURIComponent(dev.user.email)}`,
    {
      cookie: dev.cookie,
      storeId: newStore.id,
    },
  );
  assert(
    newStoreAudit.body.logs.some(
      (entry) => entry.action === "PLATFORM_STORE_CREATED",
    ),
    "new store audit did not include platform creation",
  );

  const blockedAnalytics = await request("/v1/manage/analytics?days=31", {
    cookie: admin.cookie,
    storeId: newStore.id,
  });
  assert(
    blockedAnalytics.body.store.id === defaultStoreId,
    "non-DEV admin crossed into another store analytics",
  );

  const p2 = await request("/v1/manage/p2-smoke", { cookie: admin.cookie });
  assert(
    p2.body.modules.some((module) => module.id === "reporting"),
    "p2 cockpit missing reporting module",
  );
  assert(
    p2.body.commands.some(
      (entry) => entry.command === "pnpm smoke:p2-reporting",
    ),
    "p2 cockpit missing reporting smoke command",
  );

  console.log(
    `p2 reporting smoke ok: order=${orderId} payment=${checkout.body.payment.id} store=${newStore.id}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
