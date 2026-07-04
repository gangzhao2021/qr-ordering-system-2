const baseUrl = process.env.API_BASE_URL ?? "http://127.0.0.1:3001";
const password = process.env.SMOKE_STAFF_PASSWORD ?? "devpass";
const marker = `p1-smoke-${Date.now()}`;

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

async function main() {
  await request("/health");

  const [admin, foh] = await Promise.all([
    login("admin@local"),
    login("foh@local"),
  ]);
  assert(admin.user.role === "ADMIN", "admin login returned the wrong role");
  assert(foh.user.role === "FOH", "foh login returned the wrong role");

  const [operationsBefore, menuBefore] = await Promise.all([
    request("/v1/manage/operations", { cookie: admin.cookie }),
    request("/v1/manage/menu", { cookie: admin.cookie }),
  ]);

  assert(
    Array.isArray(operationsBefore.body.purchaseOrders),
    "operations response missing purchase orders",
  );
  const supplier = operationsBefore.body.suppliers.find(
    (entry) => entry.isActive,
  );
  assert(supplier, "active supplier not found");

  const item = allMenuItems(menuBefore.body).find(
    (entry) =>
      entry.stockQuantity !== null && entry.stockQuantity !== undefined,
  );
  assert(item, "tracked menu item not found");
  const beforeStock = item.stockQuantity;

  const deniedOrderNumber = `${marker}-denied`;
  await requestDenied("/v1/manage/operations/purchase-orders", 403, {
    method: "POST",
    cookie: foh.cookie,
    body: JSON.stringify({
      supplierId: supplier.id,
      orderNumber: deniedOrderNumber,
      lines: [{ menuItemId: item.id, quantityOrdered: 1 }],
    }),
  });

  const orderNumber = `PO-${marker}`;
  const created = await request("/v1/manage/operations/purchase-orders", {
    method: "POST",
    cookie: admin.cookie,
    body: JSON.stringify({
      supplierId: supplier.id,
      orderNumber,
      expectedAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      notes: "P1 smoke purchase order",
      lines: [
        {
          menuItemId: item.id,
          quantityOrdered: 2,
          unitCostCents: 123,
          note: marker,
        },
      ],
    }),
  });
  assert(created.body.status === "ORDERED", "purchase order not ordered");
  assert(created.body.lines.length === 1, "purchase order line missing");

  const line = created.body.lines[0];
  const partial = await request(
    `/v1/manage/operations/purchase-orders/${encodeURIComponent(
      created.body.id,
    )}/receive`,
    {
      method: "POST",
      cookie: admin.cookie,
      body: JSON.stringify({
        lines: [{ lineId: line.id, quantityReceived: 1 }],
      }),
    },
  );
  assert(
    partial.body.status === "PARTIALLY_RECEIVED",
    "partial receive did not update order status",
  );
  assert(
    partial.body.lines[0].quantityReceived === 1,
    "partial receive did not update line quantity",
  );

  const completed = await request(
    `/v1/manage/operations/purchase-orders/${encodeURIComponent(
      created.body.id,
    )}/receive`,
    {
      method: "POST",
      cookie: admin.cookie,
      body: JSON.stringify({
        lines: [{ lineId: line.id, quantityReceived: 1 }],
      }),
    },
  );
  assert(
    completed.body.status === "RECEIVED",
    "final receive did not close the purchase order",
  );

  const [operationsAfter, menuAfter] = await Promise.all([
    request("/v1/manage/operations", { cookie: admin.cookie }),
    request("/v1/manage/menu", { cookie: admin.cookie }),
  ]);
  const savedOrder = operationsAfter.body.purchaseOrders.find(
    (entry) => entry.id === created.body.id,
  );
  assert(savedOrder, "created purchase order missing from operations");
  assert(savedOrder.status === "RECEIVED", "saved purchase order not received");
  assert(
    operationsAfter.body.inventoryAdjustments.filter(
      (entry) => entry.purchaseOrderId === created.body.id,
    ).length >= 2,
    "purchase receiving did not create inventory movement rows",
  );

  const updatedItem = allMenuItems(menuAfter.body).find(
    (entry) => entry.id === item.id,
  );
  assert(updatedItem, "received menu item missing after receive");
  assert(
    updatedItem.stockQuantity === beforeStock + 2,
    `stock did not increase by received quantity: before=${beforeStock}, after=${updatedItem.stockQuantity}`,
  );

  console.log(
    `p1 smoke ok: purchaseOrder=${created.body.id} item=${item.id} stock=${beforeStock}->${updatedItem.stockQuantity}`,
  );
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
