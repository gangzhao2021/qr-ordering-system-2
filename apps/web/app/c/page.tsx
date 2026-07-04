"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type {
  CustomerOrder,
  MenuItem,
  PublicMenuResponse,
  PublicOrdersResponse,
  ServiceRequest,
  ServiceRequestType,
} from "@qr2/shared";
import { formatCents } from "@qr2/shared";
import { apiFetch } from "../../lib/api";

type CartLine = {
  menuItemId: string;
  name: string;
  priceCents: number;
  stockQuantity?: number | null;
  quantity: number;
};

function upsertCart(cart: CartLine[], item: MenuItem) {
  if (item.isSoldOut) return cart;
  const maxQuantity = Math.min(20, item.stockQuantity ?? 20);
  const existing = cart.find((line) => line.menuItemId === item.id);
  if (existing) {
    if (existing.quantity >= maxQuantity) return cart;
    return cart.map((line) =>
      line.menuItemId === item.id
        ? { ...line, quantity: line.quantity + 1 }
        : line,
    );
  }
  return [
    ...cart,
    {
      menuItemId: item.id,
      name: item.name,
      priceCents: item.priceCents,
      stockQuantity: item.stockQuantity,
      quantity: 1,
    },
  ];
}

function stockLabel(item: MenuItem) {
  if (!item.isAvailable) return "Unavailable";
  if (item.isSoldOut) return "Sold out";
  if (item.stockQuantity !== null && item.stockQuantity !== undefined) {
    return item.isLowStock
      ? `${item.stockQuantity} left`
      : `${item.stockQuantity} in stock`;
  }
  return "Available";
}

function orderStatusLabel(status: CustomerOrder["status"]) {
  if (status === "SUBMITTED") return "Open";
  if (status === "CLOSED") return "Closed";
  return "Canceled";
}

function itemStatusLabel(status: CustomerOrder["items"][number]["status"]) {
  if (status === "PENDING") return "In progress";
  if (status === "DONE") return "Served";
  return "Canceled";
}

function requestTypeLabel(type: ServiceRequest["type"]) {
  if (type === "WATER") return "Water";
  if (type === "CALL_STAFF") return "Call staff";
  return "Follow up";
}

function requestStatusLabel(status: ServiceRequest["status"]) {
  if (status === "PENDING") return "Pending";
  if (status === "HANDLED") return "Handled";
  return "Canceled";
}

function CustomerExperience() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const qrToken = searchParams.get("t") ?? "";
  const [manualToken, setManualToken] = useState("table-1-token");
  const [menu, setMenu] = useState<PublicMenuResponse | null>(null);
  const [orders, setOrders] = useState<PublicOrdersResponse | null>(null);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function loadCustomerData(token: string) {
    const [menuResult, ordersResult] = await Promise.all([
      apiFetch<PublicMenuResponse>(
        `/v1/public/menu?qrToken=${encodeURIComponent(token)}`,
      ),
      apiFetch<PublicOrdersResponse>(
        `/v1/public/orders?qrToken=${encodeURIComponent(token)}`,
      ),
    ]);
    setMenu(menuResult);
    setOrders(ordersResult);
  }

  async function refreshOrders() {
    if (!qrToken) return;
    const result = await apiFetch<PublicOrdersResponse>(
      `/v1/public/orders?qrToken=${encodeURIComponent(qrToken)}`,
    );
    setOrders(result);
  }

  useEffect(() => {
    if (!qrToken) return;
    setLoading(true);
    setError(null);
    loadCustomerData(qrToken)
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : String(err)),
      )
      .finally(() => setLoading(false));
  }, [qrToken]);

  const filteredCategories = useMemo(() => {
    if (!menu) return [];
    const q = query.trim().toLowerCase();
    if (!q) return menu.categories;
    return menu.categories
      .map((category) => ({
        ...category,
        items: category.items.filter((item) =>
          `${item.name} ${item.description ?? ""}`.toLowerCase().includes(q),
        ),
      }))
      .filter((category) => category.items.length > 0);
  }, [menu, query]);

  const totalCents = cart.reduce(
    (sum, line) => sum + line.priceCents * line.quantity,
    0,
  );
  const totalQuantity = cart.reduce((sum, line) => sum + line.quantity, 0);

  async function submitOrder() {
    if (!qrToken || cart.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const response = await apiFetch<{ orderId: string }>(
        "/v1/public/orders",
        {
          method: "POST",
          body: JSON.stringify({
            qrToken,
            items: cart.map((line) => ({
              menuItemId: line.menuItemId,
              quantity: line.quantity,
            })),
          }),
        },
      );
      const refreshed = await apiFetch<PublicMenuResponse>(
        `/v1/public/menu?qrToken=${encodeURIComponent(qrToken)}`,
      );
      await refreshOrders();
      setCart([]);
      setMenu(refreshed);
      setNotice(`Order sent: ${response.orderId.slice(0, 8)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function sendServiceRequest(type: ServiceRequestType) {
    if (!qrToken) return;
    setError(null);
    try {
      await apiFetch("/v1/public/service-requests", {
        method: "POST",
        body: JSON.stringify({ qrToken, type }),
      });
      await refreshOrders();
      setNotice("Request sent to FOH");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  if (!qrToken) {
    return (
      <main className="page">
        <section className="page-header">
          <h1>Customer entry</h1>
          <p>
            Scan a table QR code or enter a table token to open the right
            dine-in menu.
          </p>
        </section>
        <section className="card grid">
          <label className="field">
            <span>Table token</span>
            <input
              className="input"
              value={manualToken}
              onChange={(event) => setManualToken(event.target.value)}
            />
          </label>
          <button
            className="btn primary"
            onClick={() =>
              router.push(`/c?t=${encodeURIComponent(manualToken.trim())}`)
            }
            disabled={!manualToken.trim()}
          >
            Open menu
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="page">
      <section className="page-header">
        <h1>{menu?.store.name ?? "Customer menu"}</h1>
        <p>
          {menu
            ? `Table ${menu.table.number}. Add items, send the order, or call staff.`
            : "Loading menu..."}
        </p>
      </section>

      <section className="card grid">
        <div className="row between">
          <label className="field" style={{ flex: 1, minWidth: 220 }}>
            <span>Search menu</span>
            <input
              className="input"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Noodles, dumplings, tea"
            />
          </label>
          <div className="row" aria-label="Service requests">
            <button
              className="btn ghost"
              onClick={() => void sendServiceRequest("WATER")}
            >
              Water
            </button>
            <button
              className="btn ghost"
              onClick={() => void sendServiceRequest("CALL_STAFF")}
            >
              Call staff
            </button>
            <button
              className="btn ghost"
              onClick={() => void sendServiceRequest("FOLLOW_UP")}
            >
              Follow up
            </button>
          </div>
        </div>
        {notice ? <div className="success card">{notice}</div> : null}
        {error ? <div className="error card">{error}</div> : null}
      </section>

      {orders ? (
        <section className="grid two order-status-grid">
          <article className="card grid">
            <div className="row between">
              <h2>Table status</h2>
              <button
                className="btn ghost"
                onClick={() => void refreshOrders()}
                disabled={loading}
              >
                Refresh
              </button>
            </div>
            <div className="row between">
              <span className="meta">Open total</span>
              <strong>
                {formatCents(
                  orders.openTotals.totalCents,
                  orders.store.currency,
                  orders.store.locale,
                )}
              </strong>
            </div>
            <div className="row">
              <span className="status ok">
                {orders.orders.filter((order) => order.status === "SUBMITTED")
                  .length || 0}{" "}
                open
              </span>
              <span className="status">
                {orders.serviceRequests.filter(
                  (request) => request.status === "PENDING",
                ).length || 0}{" "}
                requests
              </span>
            </div>
          </article>

          <article className="card grid">
            <h2>Service requests</h2>
            <div className="list">
              {orders.serviceRequests.slice(0, 4).map((request) => (
                <div className="list-item row between" key={request.id}>
                  <span>{requestTypeLabel(request.type)}</span>
                  <span
                    className={`status ${request.status === "PENDING" ? "checkout" : request.status === "HANDLED" ? "ok" : ""}`}
                  >
                    {requestStatusLabel(request.status)}
                  </span>
                </div>
              ))}
              {orders.serviceRequests.length === 0 ? (
                <span className="meta">No service requests yet.</span>
              ) : null}
            </div>
          </article>

          <article className="card grid order-history">
            <h2>Orders</h2>
            <div className="list">
              {orders.orders.map((order) => (
                <div className="list-item order-card" key={order.id}>
                  <div className="row between">
                    <strong>Order {order.id.slice(0, 8)}</strong>
                    <span
                      className={`status ${order.status === "SUBMITTED" ? "checkout" : order.status === "CLOSED" ? "ok" : "urgent"}`}
                    >
                      {orderStatusLabel(order.status)}
                    </span>
                  </div>
                  <div className="meta">
                    {new Date(order.submittedAt).toLocaleString()}
                  </div>
                  <div className="list compact-list">
                    {order.items.map((item) => (
                      <div className="row between" key={item.id}>
                        <span>
                          {item.quantity}x {item.nameSnapshot}
                        </span>
                        <span
                          className={`status ${item.status === "PENDING" ? "checkout" : item.status === "DONE" ? "ok" : "urgent"}`}
                        >
                          {itemStatusLabel(item.status)}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="row between">
                    <span className="meta">Total</span>
                    <strong>
                      {formatCents(
                        order.totals.totalCents,
                        orders.store.currency,
                        orders.store.locale,
                      )}
                    </strong>
                  </div>
                </div>
              ))}
              {orders.orders.length === 0 ? (
                <span className="meta">No orders yet.</span>
              ) : null}
            </div>
          </article>
        </section>
      ) : null}

      <section className="grid" style={{ marginTop: 16 }}>
        {filteredCategories.map((category) => (
          <div className="card" key={category.id}>
            <div className="row between">
              <h2>{category.name}</h2>
              <span className="meta">{category.items.length} items</span>
            </div>
            <div className="list">
              {category.items.map((item) => (
                <div
                  className={`list-item menu-item ${item.isSoldOut ? "muted-item" : ""}`}
                  key={item.id}
                >
                  <div>
                    <strong>{item.name}</strong>
                    <p>{item.description}</p>
                    <div className="row">
                      <span className="meta">
                        {formatCents(
                          item.priceCents,
                          menu?.store.currency,
                          menu?.store.locale,
                        )}
                      </span>
                      <span
                        className={`status ${item.isSoldOut ? "urgent" : item.isLowStock ? "checkout" : "ok"}`}
                      >
                        {stockLabel(item)}
                      </span>
                    </div>
                  </div>
                  <button
                    className="btn"
                    onClick={() =>
                      setCart((current) => upsertCart(current, item))
                    }
                    disabled={
                      item.isSoldOut ||
                      (item.stockQuantity !== null &&
                        item.stockQuantity !== undefined &&
                        (cart.find((line) => line.menuItemId === item.id)
                          ?.quantity ?? 0) >= item.stockQuantity)
                    }
                  >
                    {item.isSoldOut ? "Sold out" : "Add"}
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>

      {cart.length > 0 ? (
        <div className="cart-bar">
          <div className="card row between">
            <div>
              <strong>{totalQuantity} items</strong>
              <div className="meta">
                {formatCents(
                  totalCents,
                  menu?.store.currency,
                  menu?.store.locale,
                )}
              </div>
            </div>
            <div className="row">
              <button className="btn ghost" onClick={() => setCart([])}>
                Clear
              </button>
              <button
                className="btn primary"
                onClick={() => void submitOrder()}
                disabled={loading}
              >
                Send order
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

export default function CustomerPage() {
  return (
    <Suspense
      fallback={
        <main className="page">
          <div className="card">Loading customer menu...</div>
        </main>
      }
    >
      <CustomerExperience />
    </Suspense>
  );
}
