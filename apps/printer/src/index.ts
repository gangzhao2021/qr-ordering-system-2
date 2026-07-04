type PrintJob = {
  id: string;
  type: string;
  orderId?: string | null;
  tableNumber?: string | null;
  payload: {
    store?: { name?: string };
    table?: { number?: string; name?: string | null };
    order?: {
      id?: string;
      submittedAt?: string;
      items?: Array<{ name?: string; quantity?: number }>;
      totals?: {
        subtotalCents?: number;
        serviceChargeCents?: number;
        taxCents?: number;
        totalCents?: number;
        serviceChargeLabel?: string;
        taxLabel?: string;
      };
    };
  };
};

type JobsResponse = {
  jobs: PrintJob[];
};

const apiBaseUrl = process.env.API_BASE_URL ?? "http://127.0.0.1:3001/v1";
const email = process.env.PRINTER_EMAIL ?? "printer@local";
const password = process.env.PRINTER_PASSWORD ?? "devpass";
const pollIntervalMs = Number(process.env.PRINTER_POLL_MS ?? 3000);
const runOnce = process.argv.includes("--once");

let sessionCookie: string | null = null;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(sessionCookie ? { cookie: sessionCookie } : {}),
      ...(init.headers ?? {}),
    },
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(
      `${init.method ?? "GET"} ${path} failed: ${response.status} ${text}`,
    );
  }
  return body as T;
}

async function login() {
  const response = await fetch(`${apiBaseUrl}/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) {
    throw new Error(
      `Printer login failed: ${response.status} ${await response.text()}`,
    );
  }

  const cookie = response.headers.get("set-cookie")?.split(";")[0] ?? null;
  if (!cookie) throw new Error("Printer login did not return a session cookie");
  sessionCookie = cookie;
}

function renderTicket(job: PrintJob) {
  const storeName = job.payload.store?.name ?? "Store";
  const tableNumber = job.payload.table?.number ?? job.tableNumber ?? "-";
  const submittedAt = job.payload.order?.submittedAt ?? "";
  const totals = job.payload.order?.totals;
  const lines = [
    "================================",
    `${job.type} · ${storeName}`,
    `Table ${tableNumber}`,
    `Order ${job.orderId ?? job.payload.order?.id ?? job.id}`,
    submittedAt,
    "--------------------------------",
    ...(job.payload.order?.items ?? []).map(
      (item) => `${item.quantity ?? 0} x ${item.name ?? "Item"}`,
    ),
    "--------------------------------",
    `Subtotal: ${((totals?.subtotalCents ?? 0) / 100).toFixed(2)}`,
    `${totals?.serviceChargeLabel ?? "Service charge"}: ${((totals?.serviceChargeCents ?? 0) / 100).toFixed(2)}`,
    `${totals?.taxLabel ?? "Tax"}: ${((totals?.taxCents ?? 0) / 100).toFixed(2)}`,
    `Total: ${((totals?.totalCents ?? 0) / 100).toFixed(2)}`,
    "================================",
  ];
  return lines.join("\n");
}

async function pollOnce() {
  const data = await request<JobsResponse>("/printer/jobs?limit=5");
  if (data.jobs.length === 0) {
    console.log("No print jobs.");
    return;
  }

  for (const job of data.jobs) {
    console.log(renderTicket(job));
    await request(`/printer/jobs/${encodeURIComponent(job.id)}/printed`, {
      method: "POST",
    });
  }
}

async function main() {
  await login();
  console.log(`Printer service logged in as ${email}`);

  do {
    await pollOnce();
    if (!runOnce) await sleep(pollIntervalMs);
  } while (!runOnce);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
