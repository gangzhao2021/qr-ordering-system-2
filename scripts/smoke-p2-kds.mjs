const baseUrl = process.env.API_BASE_URL ?? "http://127.0.0.1:3001";
const password = process.env.SMOKE_STAFF_PASSWORD ?? "devpass";
const qrToken = process.env.SMOKE_QR_TOKEN ?? "table-7-token";
const marker = `p2-kds-${Date.now()}`;

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
      `${options.method ?? "GET"} ${path} expected ${expectedStatus}, got ${response.status}: ${message}`,
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

async function createKdsDevice(cookie, station, isActive = true) {
  const { body } = await request("/v1/manage/operations/kds-devices", {
    cookie,
    method: "POST",
    body: JSON.stringify({
      name: `${marker}-${station}`,
      station,
      token: `${marker}-${station.toLowerCase()}`,
      isActive,
    }),
  });
  return body;
}

async function heartbeat(token) {
  return request("/v1/kds/heartbeat", {
    method: "POST",
    body: JSON.stringify({ token }),
  });
}

async function pending(token) {
  return request(`/v1/kds/pending-items?token=${encodeURIComponent(token)}`);
}

async function main() {
  await request("/health");

  const admin = await login("admin@local");
  assert(admin.user.role === "ADMIN", "admin login returned the wrong role");

  const menu = await request(
    `/v1/public/menu?qrToken=${encodeURIComponent(qrToken)}`,
  );
  const items = allMenuItems(menu.body);
  const hotItem = items.find(
    (item) =>
      item.isAvailable &&
      item.kitchenStation === "HOT" &&
      (item.stockQuantity === null || item.stockQuantity > 0),
  );
  const barItem = items.find(
    (item) => item.isAvailable && item.kitchenStation === "BAR",
  );
  assert(hotItem, "available HOT item not found");
  assert(barItem, "available BAR item not found");

  await request("/v1/public/orders", {
    method: "POST",
    body: JSON.stringify({
      qrToken,
      customerName: marker,
      items: [{ menuItemId: hotItem.id, quantity: 1 }],
    }),
  });
  await request("/v1/public/orders", {
    method: "POST",
    body: JSON.stringify({
      qrToken,
      customerName: marker,
      items: [{ menuItemId: barItem.id, quantity: 1 }],
    }),
  });

  const hotDevice = await createKdsDevice(admin.cookie, "HOT");
  const barDevice = await createKdsDevice(admin.cookie, "BAR");
  const inactiveDevice = await createKdsDevice(admin.cookie, "COLD", false);

  await requestDenied("/v1/kds/pending-items?token=invalid-kds-token", 401);
  await requestDenied(
    `/v1/kds/pending-items?token=${encodeURIComponent(inactiveDevice.token)}`,
    401,
  );

  const hotHeartbeat = await heartbeat(hotDevice.token);
  assert(
    hotHeartbeat.body.device.lastSeenAt,
    "heartbeat did not update lastSeenAt",
  );

  const hotPending = await pending(hotDevice.token);
  assert(hotPending.body.device.station === "HOT", "HOT device station wrong");
  assert(hotPending.body.items.length > 0, "HOT device returned no pending");
  assert(
    hotPending.body.items.every((item) => item.kitchenStation === "HOT"),
    "HOT device returned another station",
  );

  const barPending = await pending(barDevice.token);
  assert(barPending.body.device.station === "BAR", "BAR device station wrong");
  assert(barPending.body.items.length > 0, "BAR device returned no pending");
  assert(
    barPending.body.items.every((item) => item.kitchenStation === "BAR"),
    "BAR device returned another station",
  );

  const rotated = await request(
    `/v1/manage/operations/kds-devices/${hotDevice.id}/rotate-token`,
    { cookie: admin.cookie, method: "POST" },
  );
  assert(rotated.body.token !== hotDevice.token, "token did not rotate");
  await requestDenied(
    `/v1/kds/pending-items?token=${encodeURIComponent(hotDevice.token)}`,
    401,
  );
  await heartbeat(rotated.body.token);

  const p2 = await request("/v1/manage/p2-smoke", { cookie: admin.cookie });
  assert(
    p2.body.summary.activeKdsDevices >= 1,
    "p2 cockpit missing active KDS devices",
  );
  assert(
    p2.body.summary.onlineKdsDevices >= 1,
    "p2 cockpit missing online KDS devices",
  );
  assert(
    p2.body.modules.some((module) => module.id === "kds"),
    "p2 cockpit missing KDS module",
  );

  console.log(
    `p2 kds smoke ok: hot=${rotated.body.id} bar=${barDevice.id} stations=${p2.body.summary.kdsStations}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
