const baseUrl = process.env.API_BASE_URL ?? "http://127.0.0.1:3001";
const qrToken = process.env.SMOKE_QR_TOKEN ?? "table-8-token";
const itemName = process.env.SMOKE_ITEM_NAME ?? "Jasmine Tea";
const password = process.env.SMOKE_STAFF_PASSWORD ?? "devpass";
const marker = `p0-smoke-${Date.now()}`;

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

async function handleTableServiceRequests(fohCookie, tableId) {
  const fohTables = await request("/v1/foh/tables", { cookie: fohCookie });
  const table = findTable(fohTables.body, tableId);
  for (const serviceRequest of table.serviceRequests) {
    await request(
      `/v1/foh/service-requests/${encodeURIComponent(serviceRequest.id)}/status`,
      {
        method: "PATCH",
        cookie: fohCookie,
        body: JSON.stringify({ status: "HANDLED" }),
      },
    );
  }
}

async function printOrderTicket(printerCookie, orderId) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const claimed = await request("/v1/printer/jobs?limit=20", {
      cookie: printerCookie,
    });
    if (claimed.body.jobs.length === 0) break;

    let sawOrder = false;
    for (const job of claimed.body.jobs) {
      if (job.orderId === orderId) sawOrder = true;
      await request(`/v1/printer/jobs/${encodeURIComponent(job.id)}/printed`, {
        method: "POST",
        cookie: printerCookie,
      });
    }
    if (sawOrder) return;
  }

  throw new Error(`printer did not claim order ${orderId}`);
}

async function main() {
  await request("/health");

  const [admin, foh, kitchen, printer] = await Promise.all([
    login("admin@local"),
    login("foh@local"),
    login("kitchen@local"),
    login("printer@local"),
  ]);
  assert(admin.user.role === "ADMIN", "admin login returned the wrong role");
  assert(foh.user.role === "FOH", "foh login returned the wrong role");
  assert(
    kitchen.user.role === "KITCHEN",
    "kitchen login returned the wrong role",
  );
  assert(
    printer.user.role === "PRINTER",
    "printer login returned the wrong role",
  );

  const menu = await request(
    `/v1/public/menu?qrToken=${encodeURIComponent(qrToken)}`,
  );
  const tableId = menu.body.table.id;
  const menuItem = menu.body.categories
    .flatMap((category) => category.items)
    .find(
      (item) => item.name === itemName && item.isAvailable && !item.isSoldOut,
    );
  assert(menuItem, `available menu item "${itemName}" not found`);

  const createdOrder = await request("/v1/public/orders", {
    method: "POST",
    body: JSON.stringify({
      qrToken,
      items: [{ menuItemId: menuItem.id, quantity: 1 }],
    }),
  });
  const orderId = createdOrder.body.orderId;
  assert(orderId, "order creation did not return an order id");

  const serviceRequest = await request("/v1/public/service-requests", {
    method: "POST",
    body: JSON.stringify({
      qrToken,
      type: "WATER",
      note: marker,
    }),
  });
  assert(
    serviceRequest.body.status === "PENDING",
    "service request not pending",
  );

  const publicOrders = await request(
    `/v1/public/orders?qrToken=${encodeURIComponent(qrToken)}`,
  );
  assert(
    publicOrders.body.orders.some((order) => order.id === orderId),
    "created order missing from public order status",
  );
  assert(
    publicOrders.body.serviceRequests.some(
      (request) => request.id === serviceRequest.body.id,
    ),
    "created service request missing from public order status",
  );

  const kitchenItems = await request("/v1/kitchen/pending-items", {
    cookie: kitchen.cookie,
  });
  assert(
    kitchenItems.body.items.some((item) => item.menuItemId === menuItem.id),
    "created order item missing from kitchen pending list",
  );

  const firstFohTables = await request("/v1/foh/tables", {
    cookie: foh.cookie,
  });
  const firstFohTable = findTable(firstFohTables.body, tableId);
  assert(
    firstFohTable.pendingItems.some((item) => item.orderId === orderId),
    "created order item missing from FOH table",
  );
  assert(
    firstFohTable.serviceRequests.some(
      (request) => request.id === serviceRequest.body.id,
    ),
    "created service request missing from FOH table",
  );

  const printJobs = await request("/v1/foh/print-jobs", { cookie: foh.cookie });
  assert(
    printJobs.body.jobs.some((job) => job.orderId === orderId),
    "order print job missing from FOH print queue",
  );
  await printOrderTicket(printer.cookie, orderId);

  await markTablePendingItemsDone(foh.cookie, tableId);
  await handleTableServiceRequests(foh.cookie, tableId);

  const checkout = await request(
    `/v1/foh/tables/${encodeURIComponent(tableId)}/checkout`,
    {
      method: "POST",
      cookie: foh.cookie,
      body: JSON.stringify({
        paymentMethod: "CARD",
        reference: marker,
        note: "P0 smoke checkout",
      }),
    },
  );
  assert(
    checkout.body.closedOrderIds.includes(orderId),
    "checkout did not close the created order",
  );
  assert(checkout.body.payment?.id, "checkout did not create a payment");

  const payments = await request("/v1/foh/payments", { cookie: foh.cookie });
  assert(
    payments.body.payments.some((payment) =>
      payment.orderIds.includes(orderId),
    ),
    "checkout payment missing from FOH payments",
  );

  const reprint = await request(
    `/v1/foh/orders/${encodeURIComponent(orderId)}/reprint`,
    {
      method: "POST",
      cookie: foh.cookie,
    },
  );
  assert(
    reprint.body.type === "REPRINT",
    "FOH reprint did not create a REPRINT job",
  );

  await request("/v1/manage/menu", { cookie: admin.cookie });
  await request("/v1/manage/tables", { cookie: admin.cookie });
  await request("/v1/manage/staff", { cookie: admin.cookie });
  await request("/v1/manage/store-settings", { cookie: admin.cookie });
  await request("/v1/manage/analytics?days=7", { cookie: admin.cookie });
  const managePrintJobs = await request("/v1/manage/print-jobs", {
    cookie: admin.cookie,
  });
  assert(
    managePrintJobs.body.jobs.some((job) => job.orderId === orderId),
    "order print jobs missing from management print queue",
  );

  const finalPublicOrders = await request(
    `/v1/public/orders?qrToken=${encodeURIComponent(qrToken)}`,
  );
  assert(
    finalPublicOrders.body.orders.some(
      (order) => order.id === orderId && order.status === "CLOSED",
    ),
    "closed order missing from final public status",
  );

  console.log(
    `p0 smoke ok: order=${orderId} table=${tableId} payment=${checkout.body.payment.id}`,
  );
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
