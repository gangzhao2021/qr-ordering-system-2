const baseUrl = process.env.API_BASE_URL ?? "http://127.0.0.1:3001";
const qrToken = process.env.SMOKE_QR_TOKEN ?? "table-8-token";
const itemName = process.env.SMOKE_ITEM_NAME ?? "Jasmine Tea";
const password = process.env.SMOKE_STAFF_PASSWORD ?? "devpass";
const marker = `p1-member-${Date.now()}`;

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

  const [admin, foh] = await Promise.all([
    login("admin@local"),
    login("foh@local"),
  ]);
  assert(admin.user.role === "ADMIN", "admin login returned the wrong role");
  assert(foh.user.role === "FOH", "foh login returned the wrong role");

  const couponCode = `MBR${Date.now().toString(36).toUpperCase()}`;
  const memberPhone = `+1-416-555-${String(Date.now()).slice(-4)}`;
  const memberName = `Smoke Member ${marker.slice(-6)}`;

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
  const item = allMenuItems(menu.body).find(
    (entry) => entry.name === itemName && entry.isAvailable && !entry.isSoldOut,
  );
  assert(item, `available menu item "${itemName}" not found`);

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

  const publicOrders = await request(
    `/v1/public/orders?qrToken=${encodeURIComponent(qrToken)}`,
  );
  const publicOrder = publicOrders.body.orders.find(
    (order) => order.id === orderId,
  );
  assert(publicOrder, "created order missing from public status");
  assert(
    publicOrder.customerPhone === memberPhone,
    "member phone missing from public order",
  );
  assert(
    publicOrder.couponCode === couponCode &&
      publicOrder.totals.discountCents >= 100,
    "coupon discount missing from public order totals",
  );

  await markTablePendingItemsDone(foh.cookie, tableId);

  const checkout = await request(
    `/v1/foh/tables/${encodeURIComponent(tableId)}/checkout`,
    {
      method: "POST",
      cookie: foh.cookie,
      body: JSON.stringify({
        paymentMethod: "CARD",
        reference: marker,
        note: "P1 membership coupon smoke",
      }),
    },
  );
  assert(
    checkout.body.closedOrderIds.includes(orderId),
    "checkout did not close the created order",
  );
  assert(checkout.body.payment?.id, "checkout did not create a payment");
  assert(
    checkout.body.payment.memberPhone === memberPhone,
    "checkout payment missing member phone",
  );
  assert(
    checkout.body.payment.couponDiscountCents >= 100,
    "checkout payment missing coupon discount",
  );
  assert(
    checkout.body.payment.pointsEarned > 0,
    "checkout payment did not award member points",
  );

  const payments = await request("/v1/foh/payments", { cookie: foh.cookie });
  const payment = payments.body.payments.find((entry) =>
    entry.orderIds.includes(orderId),
  );
  assert(payment, "payment missing from FOH payments");
  assert(payment.memberPhone === memberPhone, "FOH payment missing member");

  const operations = await request("/v1/manage/operations", {
    cookie: admin.cookie,
  });
  const member = operations.body.members.find(
    (entry) => entry.phone === memberPhone,
  );
  assert(member, "member missing from operations");
  assert(member.points > 0, "member points were not incremented");
  assert(member.paymentCount > 0, "member payment count was not aggregated");

  const savedCoupon = operations.body.coupons.find(
    (entry) => entry.code === couponCode,
  );
  assert(savedCoupon, "coupon missing from operations");
  assert(
    savedCoupon.redemptionCount > 0,
    "coupon redemption count was not aggregated",
  );

  console.log(
    `p1 member smoke ok: order=${orderId} payment=${checkout.body.payment.id} member=${member.id} coupon=${savedCoupon.id}`,
  );
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
