const baseUrl = process.env.API_BASE_URL ?? "http://127.0.0.1:3001";
const password = process.env.SMOKE_STAFF_PASSWORD ?? "devpass";
const marker = `p2-smoke-${Date.now()}`;

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

async function login(email, loginPassword = password) {
  const { response, body } = await request("/v1/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password: loginPassword }),
  });
  return { cookie: cookieFrom(response), user: body.user };
}

async function main() {
  await request("/health");

  const dev = await login("dev@local");
  const defaultAdmin = await login("admin@local");
  assert(dev.user.role === "DEV", "dev login returned the wrong role");
  assert(
    defaultAdmin.user.role === "ADMIN",
    "default admin login returned the wrong role",
  );

  const before = await request("/v1/manage/platform", {
    cookie: dev.cookie,
  });
  const defaultStoreId = before.body.currentStore.id;
  const storeName = `Smoke Store ${marker}`;
  const adminEmail = `${marker}@example.local`;

  const created = await request("/v1/manage/platform/stores", {
    cookie: dev.cookie,
    method: "POST",
    body: JSON.stringify({
      name: storeName,
      market: "CHINA",
      region: "CN",
      adminEmail,
      adminPassword: password,
      adminName: "Smoke Admin",
      tableCount: 2,
    }),
  });
  const newStore = created.body.stores.find(
    (store) => store.name === storeName,
  );
  assert(newStore, "created store not returned in platform overview");
  assert(newStore.activeManagerCount === 1, "created store missing admin");
  assert(newStore.activeTableCount === 2, "created store missing tables");

  const devSettings = await request("/v1/manage/store-settings", {
    cookie: dev.cookie,
    storeId: newStore.id,
  });
  assert(
    devSettings.body.store.id === newStore.id,
    "DEV x-store-id did not switch store context",
  );
  assert(
    devSettings.body.store.market === "CHINA",
    "created store did not apply China market preset",
  );

  const newAdmin = await login(adminEmail);
  assert(newAdmin.user.storeId === newStore.id, "new admin has wrong store");
  const newAdminSettings = await request("/v1/manage/store-settings", {
    cookie: newAdmin.cookie,
  });
  assert(
    newAdminSettings.body.store.id === newStore.id,
    "new admin did not resolve to its own store",
  );

  const blockedByScope = await request("/v1/manage/store-settings", {
    cookie: newAdmin.cookie,
    storeId: defaultStoreId,
  });
  assert(
    blockedByScope.body.store.id === newStore.id,
    "non-DEV admin crossed into another store via x-store-id",
  );

  const defaultAdminSettings = await request("/v1/manage/store-settings", {
    cookie: defaultAdmin.cookie,
    storeId: newStore.id,
  });
  assert(
    defaultAdminSettings.body.store.id === defaultAdmin.user.storeId,
    "default admin crossed into another store via x-store-id",
  );

  const p2 = await request("/v1/manage/p2-smoke", {
    cookie: dev.cookie,
    storeId: newStore.id,
  });
  assert(p2.body.summary.stores >= 2, "p2 cockpit did not see both stores");
  assert(
    p2.body.modules.some((module) => module.id === "isolation"),
    "p2 cockpit missing isolation module",
  );

  console.log(
    `p2 multistore smoke ok: store=${newStore.id} admin=${adminEmail} totalStores=${p2.body.summary.stores}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
