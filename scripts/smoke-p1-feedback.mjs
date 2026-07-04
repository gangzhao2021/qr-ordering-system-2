const baseUrl = process.env.API_BASE_URL ?? "http://127.0.0.1:3001";
const qrToken = process.env.SMOKE_QR_TOKEN ?? "table-8-token";
const itemName = process.env.SMOKE_ITEM_NAME ?? "Jasmine Tea";
const password = process.env.SMOKE_STAFF_PASSWORD ?? "devpass";
const marker = `p1-feedback-${Date.now()}`;

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

async function requestDenied(path, expectedStatus, options = {}) {
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
  if (response.status !== expectedStatus) {
    const message = body?.error?.message ?? response.statusText;
    throw new Error(
      `${options.method ?? "GET"} ${path} expected ${expectedStatus}, got ${
        response.status
      }: ${message}`,
    );
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

  const memberPhone = `+1-647-555-${String(Date.now()).slice(-4)}`;
  const memberName = `Feedback ${marker.slice(-6)}`;
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
      items: [{ menuItemId: item.id, quantity: 1 }],
    }),
  });
  const orderId = createdOrder.body.orderId;
  assert(orderId, "order creation did not return an order id");

  await requestDenied("/v1/public/feedback", 409, {
    method: "POST",
    body: JSON.stringify({
      qrToken,
      orderId,
      rating: 2,
      tags: ["SPEED"],
      comment: `${marker} too early`,
    }),
  });

  await markTablePendingItemsDone(foh.cookie, tableId);
  const checkout = await request(
    `/v1/foh/tables/${encodeURIComponent(tableId)}/checkout`,
    {
      method: "POST",
      cookie: foh.cookie,
      body: JSON.stringify({
        paymentMethod: "CARD",
        reference: marker,
        note: "P1 feedback smoke",
      }),
    },
  );
  assert(
    checkout.body.closedOrderIds.includes(orderId),
    "checkout did not close the created order",
  );

  const feedback = await request("/v1/public/feedback", {
    method: "POST",
    body: JSON.stringify({
      qrToken,
      orderId,
      rating: 2,
      tags: ["SERVICE", "SPEED"],
      comment: `${marker} service was slow`,
      customerName: memberName,
      customerPhone: memberPhone,
    }),
  });
  assert(feedback.body.status === "NEW", "feedback did not start as NEW");
  assert(feedback.body.orderId === orderId, "feedback order mismatch");
  assert(feedback.body.tags.includes("SPEED"), "feedback tags missing");

  const publicOrders = await request(
    `/v1/public/orders?qrToken=${encodeURIComponent(qrToken)}`,
  );
  const publicOrder = publicOrders.body.orders.find(
    (order) => order.id === orderId,
  );
  assert(
    publicOrder?.feedback?.id === feedback.body.id,
    "public order missing feedback",
  );

  await requestDenied(
    `/v1/manage/operations/feedback/${encodeURIComponent(feedback.body.id)}`,
    403,
    {
      method: "PATCH",
      cookie: foh.cookie,
      body: JSON.stringify({ status: "RESOLVED" }),
    },
  );

  const resolved = await request(
    `/v1/manage/operations/feedback/${encodeURIComponent(feedback.body.id)}`,
    {
      method: "PATCH",
      cookie: admin.cookie,
      body: JSON.stringify({ status: "RESOLVED" }),
    },
  );
  assert(resolved.body.status === "RESOLVED", "feedback was not resolved");
  assert(resolved.body.handledAt, "resolved feedback missing handledAt");

  const operations = await request("/v1/manage/operations", {
    cookie: admin.cookie,
  });
  const savedFeedback = operations.body.feedback.find(
    (entry) => entry.id === feedback.body.id,
  );
  assert(savedFeedback, "feedback missing from operations");
  assert(
    savedFeedback.status === "RESOLVED",
    "operations feedback status mismatch",
  );

  const member = operations.body.members.find(
    (entry) => entry.phone === memberPhone,
  );
  assert(member, "member missing from operations");
  assert(member.orderCount > 0, "member order history missing");
  assert(member.paymentCount > 0, "member payment history missing");
  assert(member.feedbackCount > 0, "member feedback count missing");
  assert(
    member.recentFeedback.some((entry) => entry.id === feedback.body.id),
    "member profile missing recent feedback",
  );

  console.log(
    `p1 feedback smoke ok: order=${orderId} feedback=${feedback.body.id} member=${member.id}`,
  );
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
