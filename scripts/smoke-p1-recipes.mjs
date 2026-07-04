const baseUrl = process.env.API_BASE_URL ?? "http://127.0.0.1:3001";
const password = process.env.SMOKE_STAFF_PASSWORD ?? "devpass";
const marker = `p1-recipe-${Date.now()}`;

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

function expectedMarginBps(priceCents, costCents) {
  return priceCents > 0
    ? Math.round(((priceCents - costCents) / priceCents) * 10000)
    : 0;
}

async function main() {
  await request("/health");

  const [admin, foh] = await Promise.all([
    login("admin@local"),
    login("foh@local"),
  ]);
  assert(admin.user.role === "ADMIN", "admin login returned the wrong role");
  assert(foh.user.role === "FOH", "foh login returned the wrong role");

  const menu = await request("/v1/manage/menu", { cookie: admin.cookie });
  const item = allMenuItems(menu.body).find((entry) => entry.isAvailable);
  assert(item, "available menu item not found");

  await requestDenied("/v1/manage/operations/ingredients", 403, {
    method: "POST",
    cookie: foh.cookie,
    body: JSON.stringify({
      name: `${marker}-denied`,
      unit: "g",
      stockQuantity: 1,
      unitCostCents: 1,
      lowStockThreshold: 0,
      isActive: true,
    }),
  });

  const ingredient = await request("/v1/manage/operations/ingredients", {
    method: "POST",
    cookie: admin.cookie,
    body: JSON.stringify({
      name: `Smoke beef ${marker}`,
      unit: "g",
      stockQuantity: 1000,
      unitCostCents: 7,
      lowStockThreshold: 100,
      isActive: true,
    }),
  });
  assert(ingredient.body.id, "ingredient was not created");
  assert(ingredient.body.isLowStock === false, "ingredient low stock mismatch");

  await requestDenied("/v1/manage/operations/recipes", 403, {
    method: "POST",
    cookie: foh.cookie,
    body: JSON.stringify({
      menuItemId: item.id,
      yieldQuantity: 1,
      lines: [{ ingredientId: ingredient.body.id, quantity: 4 }],
    }),
  });

  const createdRecipe = await request("/v1/manage/operations/recipes", {
    method: "POST",
    cookie: admin.cookie,
    body: JSON.stringify({
      menuItemId: item.id,
      yieldQuantity: 1,
      note: marker,
      lines: [
        {
          ingredientId: ingredient.body.id,
          quantity: 4,
          note: "P1 recipe smoke line",
        },
      ],
    }),
  });
  const initialCost = 28;
  assert(
    createdRecipe.body.menuItemId === item.id,
    "recipe menu item mismatch",
  );
  assert(createdRecipe.body.lines.length === 1, "recipe line missing");
  assert(createdRecipe.body.costCents === initialCost, "recipe cost mismatch");
  assert(
    createdRecipe.body.marginCents === item.priceCents - initialCost,
    "recipe margin mismatch",
  );
  assert(
    createdRecipe.body.marginBps ===
      expectedMarginBps(item.priceCents, initialCost),
    "recipe margin percentage mismatch",
  );

  await request(`/v1/manage/operations/ingredients/${ingredient.body.id}`, {
    method: "PATCH",
    cookie: admin.cookie,
    body: JSON.stringify({
      unitCostCents: 9,
      stockQuantity: 90,
      lowStockThreshold: 100,
    }),
  });

  const operations = await request("/v1/manage/operations", {
    cookie: admin.cookie,
  });
  const savedIngredient = operations.body.ingredients.find(
    (entry) => entry.id === ingredient.body.id,
  );
  assert(savedIngredient, "ingredient missing from operations");
  assert(savedIngredient.isLowStock === true, "low stock flag was not updated");

  const savedRecipe = operations.body.recipes.find(
    (entry) => entry.menuItemId === item.id && entry.note === marker,
  );
  assert(savedRecipe, "recipe missing from operations");
  const updatedCost = 36;
  assert(savedRecipe.costCents === updatedCost, "updated recipe cost mismatch");
  assert(
    savedRecipe.marginCents === item.priceCents - updatedCost,
    "updated recipe margin mismatch",
  );
  assert(
    savedRecipe.lines[0].ingredientId === ingredient.body.id,
    "recipe ingredient line mismatch",
  );

  console.log(
    `p1 recipe smoke ok: ingredient=${ingredient.body.id} recipe=${savedRecipe.id} item=${item.id} cost=${initialCost}->${updatedCost}`,
  );
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
