const baseUrl = process.env.API_BASE_URL ?? "http://127.0.0.1:3001";
const password = process.env.SMOKE_STAFF_PASSWORD ?? "devpass";
const marker = `p1-inventory-${Date.now()}`;

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

  const menuBefore = await request("/v1/manage/menu", {
    cookie: admin.cookie,
  });
  const item = allMenuItems(menuBefore.body).find(
    (entry) =>
      entry.stockQuantity !== null && entry.stockQuantity !== undefined,
  );
  assert(item, "tracked menu item not found");
  const beforeStock = item.stockQuantity;
  const countedQuantity = beforeStock + 3;
  const stocktakeName = `ST-${marker}`;

  await requestDenied("/v1/manage/operations/stocktakes", 403, {
    method: "POST",
    cookie: foh.cookie,
    body: JSON.stringify({
      name: `${stocktakeName}-denied`,
      lines: [{ menuItemId: item.id, countedQuantity }],
    }),
  });

  const created = await request("/v1/manage/operations/stocktakes", {
    method: "POST",
    cookie: admin.cookie,
    body: JSON.stringify({
      name: stocktakeName,
      note: "P1 inventory smoke stocktake",
      lines: [
        {
          menuItemId: item.id,
          countedQuantity,
          note: marker,
        },
      ],
    }),
  });
  assert(created.body.status === "APPLIED", "stocktake was not applied");
  assert(created.body.lines.length === 1, "stocktake line missing");
  assert(
    created.body.lines[0].expectedQuantity === beforeStock,
    "stocktake expected quantity did not snapshot current stock",
  );
  assert(
    created.body.lines[0].differenceQuantity === 3,
    "stocktake difference was not calculated",
  );

  const [operationsAfter, menuAfter] = await Promise.all([
    request("/v1/manage/operations", { cookie: admin.cookie }),
    request("/v1/manage/menu", { cookie: admin.cookie }),
  ]);
  const savedStocktake = operationsAfter.body.stocktakes.find(
    (entry) => entry.id === created.body.id,
  );
  assert(savedStocktake, "stocktake missing from operations");
  assert(
    savedStocktake.lines[0].differenceQuantity === 3,
    "saved stocktake did not preserve difference",
  );
  assert(
    operationsAfter.body.inventoryAdjustments.some(
      (entry) =>
        entry.stocktakeId === created.body.id && entry.quantityDelta === 3,
    ),
    "stocktake did not create linked inventory adjustment",
  );

  const updatedItem = allMenuItems(menuAfter.body).find(
    (entry) => entry.id === item.id,
  );
  assert(updatedItem, "counted menu item missing after stocktake");
  assert(
    updatedItem.stockQuantity === countedQuantity,
    `stocktake did not apply counted quantity: before=${beforeStock}, after=${updatedItem.stockQuantity}`,
  );

  console.log(
    `p1 inventory smoke ok: stocktake=${created.body.id} item=${item.id} stock=${beforeStock}->${updatedItem.stockQuantity}`,
  );
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
