"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  FohTablesResponse,
  OrderItemStatus,
  PaymentMethod,
  PaymentsResponse,
  PrintJobsResponse,
  ServiceRequestStatus,
} from "@qr2/shared";
import { PAYMENT_METHODS, formatCents } from "@qr2/shared";
import { apiFetch } from "../../lib/api";
import {
  AuthGate,
  StaffSessionBar,
  useRequireRole,
} from "../../lib/auth-client";

const statusClass = {
  EMPTY: "status",
  DINING: "status ok",
  URGENT: "status urgent",
  CHECKOUT: "status checkout",
} as const;

type FohTable = FohTablesResponse["tables"][number];
type FohPendingItem = FohTable["pendingItems"][number];
type FohServiceRequest = FohTable["serviceRequests"][number];

type CheckoutDraft = {
  paymentMethod: PaymentMethod;
  amount: string;
  tip: string;
  discount: string;
  reference: string;
  note: string;
};

function dollarsFromCents(cents: number) {
  return (cents / 100).toFixed(2);
}

function parsePriceCents(value: string) {
  return Math.round(Number(value) * 100);
}

function serviceRequestLabel(type: FohServiceRequest["type"]) {
  if (type === "WATER") return "Water";
  if (type === "CALL_STAFF") return "Call staff";
  return "Follow up";
}

function shortTime(iso: string) {
  return new Intl.DateTimeFormat("en", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function modifierText(item: FohPendingItem) {
  return item.modifiers.map((modifier) => modifier.name).join(" / ");
}

export default function FohPage() {
  const auth = useRequireRole(["DEV", "ADMIN", "FOH"]);
  const [data, setData] = useState<FohTablesResponse | null>(null);
  const [printData, setPrintData] = useState<PrintJobsResponse | null>(null);
  const [paymentData, setPaymentData] = useState<PaymentsResponse | null>(null);
  const [checkoutDrafts, setCheckoutDrafts] = useState<
    Record<string, CheckoutDraft>
  >({});
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const [tables, printJobs, payments] = await Promise.all([
        apiFetch<FohTablesResponse>("/v1/foh/tables"),
        apiFetch<PrintJobsResponse>("/v1/foh/print-jobs"),
        apiFetch<PaymentsResponse>("/v1/foh/payments"),
      ]);
      setData(tables);
      setPrintData(printJobs);
      setPaymentData(payments);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (auth.user) void refresh();
  }, [auth.user]);

  useEffect(() => {
    if (!auth.user) return;
    const interval = window.setInterval(() => void refresh(), 10000);
    return () => window.clearInterval(interval);
  }, [auth.user]);

  const queues = useMemo(() => {
    const tables = data?.tables ?? [];
    return {
      serviceRequests: tables.flatMap((table) =>
        table.serviceRequests.map((request) => ({ table, request })),
      ),
      pendingItems: tables.flatMap((table) =>
        table.pendingItems.map((item) => ({ table, item })),
      ),
      checkoutReady: tables.filter(
        (table) => table.tableStatus === "CHECKOUT" && table.openTotalCents > 0,
      ),
      openTables: tables.filter((table) => table.tableStatus !== "EMPTY"),
    };
  }, [data]);

  const stats = useMemo(() => {
    const tables = data?.tables ?? [];
    return {
      open: tables.filter((table) => table.tableStatus !== "EMPTY").length,
      pending: tables.reduce(
        (sum, table) => sum + table.pendingItems.length,
        0,
      ),
      requests: tables.reduce(
        (sum, table) => sum + table.serviceRequests.length,
        0,
      ),
      checkout: tables.filter(
        (table) => table.tableStatus === "CHECKOUT" && table.openTotalCents > 0,
      ).length,
      total: tables.reduce((sum, table) => sum + table.openTotalCents, 0),
    };
  }, [data]);

  const activePrintJobs = (printData?.jobs ?? []).filter(
    (job) => job.status !== "PRINTED",
  );

  async function setItemStatus(id: string, status: OrderItemStatus) {
    await apiFetch(`/v1/foh/order-items/${encodeURIComponent(id)}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    await refresh();
  }

  async function setRequestStatus(id: string, status: ServiceRequestStatus) {
    await apiFetch(
      `/v1/foh/service-requests/${encodeURIComponent(id)}/status`,
      {
        method: "PATCH",
        body: JSON.stringify({ status }),
      },
    );
    await refresh();
  }

  function checkoutDraft(table: FohTable): CheckoutDraft {
    return (
      checkoutDrafts[table.table.id] ?? {
        paymentMethod: "CASH",
        amount: dollarsFromCents(table.openTotalCents),
        tip: "0.00",
        discount: "0.00",
        reference: "",
        note: "",
      }
    );
  }

  function updateCheckoutDraft(table: FohTable, patch: Partial<CheckoutDraft>) {
    setCheckoutDrafts((current) => ({
      ...current,
      [table.table.id]: { ...checkoutDraft(table), ...patch },
    }));
  }

  async function checkout(table: FohTable) {
    const draft = checkoutDraft(table);
    await apiFetch(
      `/v1/foh/tables/${encodeURIComponent(table.table.id)}/checkout`,
      {
        method: "POST",
        body: JSON.stringify({
          paymentMethod: draft.paymentMethod,
          amountCents: parsePriceCents(draft.amount),
          tipCents: parsePriceCents(draft.tip || "0"),
          discountCents: parsePriceCents(draft.discount || "0"),
          reference: draft.reference.trim() || null,
          note: draft.note.trim() || null,
        }),
      },
    );
    await refresh();
  }

  async function refund(paymentId: string, remainingCents: number) {
    const dollars = dollarsFromCents(remainingCents);
    const value = window.prompt("Refund amount", dollars);
    if (!value) return;
    const amountCents = parsePriceCents(value);
    await apiFetch(`/v1/foh/payments/${encodeURIComponent(paymentId)}/refund`, {
      method: "POST",
      body: JSON.stringify({
        amountCents,
        reason: "FOH refund",
      }),
    });
    setNotice(
      `Refund recorded: ${formatCents(amountCents, paymentData?.store.currency, paymentData?.store.locale)}`,
    );
    await refresh();
  }

  async function reprint(orderId: string) {
    await apiFetch(`/v1/foh/orders/${encodeURIComponent(orderId)}/reprint`, {
      method: "POST",
    });
    await refresh();
  }

  return (
    <AuthGate state={auth}>
      <main className="page foh-page">
        <StaffSessionBar user={auth.user} />
        <section className="page-header foh-header">
          <div>
            <h1>FOH workspace</h1>
            <p>
              Handle requests, confirm handed-off dishes, and close tables from
              the same live floor board.
            </p>
          </div>
          <button
            className="btn primary"
            onClick={() => void refresh()}
            disabled={loading}
          >
            {loading ? "Refreshing" : "Refresh"}
          </button>
        </section>

        {(error || notice) && (
          <div className="foh-message-row">
            {error ? <span className="error status">{error}</span> : null}
            {notice ? <span className="success status">{notice}</span> : null}
          </div>
        )}

        <section className="foh-metric-grid">
          <div className="card metric-card">
            <span className="meta">Action queue</span>
            <strong>{stats.pending + stats.requests}</strong>
          </div>
          <div className="card metric-card">
            <span className="meta">Open tables</span>
            <strong>{stats.open}</strong>
          </div>
          <div className="card metric-card">
            <span className="meta">Ready to close</span>
            <strong>{stats.checkout}</strong>
          </div>
          <div className="card metric-card">
            <span className="meta">Open total</span>
            <strong>
              {formatCents(
                stats.total,
                data?.store.currency,
                data?.store.locale,
              )}
            </strong>
          </div>
        </section>

        <section className="foh-dashboard">
          <div className="foh-main-column">
            <section className="card foh-action-panel">
              <div className="row between">
                <div>
                  <h2>Action queue</h2>
                  <p>
                    Oldest service calls and pending dishes stay at the top.
                  </p>
                </div>
                <span
                  className={
                    stats.pending + stats.requests > 0
                      ? "status urgent"
                      : "status ok"
                  }
                >
                  {stats.pending + stats.requests} open
                </span>
              </div>

              <div className="foh-action-grid">
                <div className="foh-action-column">
                  <div className="row between">
                    <h3>Service calls</h3>
                    <span className="status">{stats.requests}</span>
                  </div>
                  <div className="list compact-list">
                    {queues.serviceRequests.length === 0 ? (
                      <p>No waiting service requests.</p>
                    ) : null}
                    {queues.serviceRequests.map(({ table, request }) => (
                      <div
                        className="list-item foh-action-item urgent"
                        key={request.id}
                      >
                        <div>
                          <strong>
                            Table {table.table.number} /{" "}
                            {serviceRequestLabel(request.type)}
                          </strong>
                          <div className="meta">
                            {table.table.name} / {shortTime(request.createdAt)}
                          </div>
                        </div>
                        <button
                          className="btn primary"
                          onClick={() =>
                            void setRequestStatus(request.id, "HANDLED")
                          }
                        >
                          Handled
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="foh-action-column">
                  <div className="row between">
                    <h3>Pending dishes</h3>
                    <span className="status checkout">{stats.pending}</span>
                  </div>
                  <div className="list compact-list">
                    {queues.pendingItems.length === 0 ? (
                      <p>No pending dishes.</p>
                    ) : null}
                    {queues.pendingItems.map(({ table, item }) => (
                      <div className="list-item foh-action-item" key={item.id}>
                        <div>
                          <strong>
                            Table {table.table.number} / {item.quantity} x{" "}
                            {item.nameSnapshot}
                          </strong>
                          <div className="meta">
                            Submitted {shortTime(item.orderCreatedAt)}
                          </div>
                          {modifierText(item) ? (
                            <div className="meta">{modifierText(item)}</div>
                          ) : null}
                          {item.note ? (
                            <div className="meta">{item.note}</div>
                          ) : null}
                        </div>
                        <div className="row foh-action-buttons">
                          <button
                            className="btn primary"
                            onClick={() => void setItemStatus(item.id, "DONE")}
                          >
                            Confirm
                          </button>
                          <button
                            className="btn ghost"
                            onClick={() =>
                              void setItemStatus(item.id, "CANCELED")
                            }
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            <section className="foh-table-section">
              <div className="row between">
                <div>
                  <h2>Tables</h2>
                  <p className="meta">
                    Checkout controls stay with each table.
                  </p>
                </div>
                <span className="status">
                  {queues.openTables.length} active
                </span>
              </div>

              <div className="foh-table-grid">
                {(data?.tables ?? []).map((table) => {
                  const payment = checkoutDraft(table);
                  const hasWork =
                    table.pendingItems.length > 0 ||
                    table.serviceRequests.length > 0;
                  const canCheckout =
                    table.pendingItems.length === 0 && table.openTotalCents > 0;

                  return (
                    <article
                      className={`card foh-table-card ${hasWork ? "attention" : ""}`}
                      key={table.table.id}
                    >
                      <div className="row between">
                        <div>
                          <h3>Table {table.table.number}</h3>
                          <p>{table.table.name}</p>
                        </div>
                        <span className={statusClass[table.tableStatus]}>
                          {table.tableStatus}
                        </span>
                      </div>

                      <div className="foh-table-total">
                        <span className="meta">Open total</span>
                        <strong>
                          {formatCents(
                            table.openTotalCents,
                            data?.store.currency,
                            data?.store.locale,
                          )}
                        </strong>
                      </div>

                      <div className="foh-table-alerts">
                        {table.serviceRequests.length > 0 ? (
                          <span className="status urgent">
                            {table.serviceRequests.length} request
                          </span>
                        ) : null}
                        {table.pendingItems.length > 0 ? (
                          <span className="status checkout">
                            {table.pendingItems.length} dish
                          </span>
                        ) : null}
                        {canCheckout ? (
                          <span className="status ok">Ready to close</span>
                        ) : null}
                      </div>

                      <div className="list compact-list foh-totals-list">
                        <div className="row between">
                          <span>Subtotal</span>
                          <strong>
                            {formatCents(
                              table.totals.subtotalCents,
                              data?.store.currency,
                              data?.store.locale,
                            )}
                          </strong>
                        </div>
                        {table.totals.serviceChargeCents > 0 ? (
                          <div className="row between">
                            <span>
                              {table.totals.serviceChargeLabel} (
                              {(
                                table.totals.serviceChargeRateBps / 100
                              ).toFixed(2)}
                              %)
                            </span>
                            <strong>
                              {formatCents(
                                table.totals.serviceChargeCents,
                                data?.store.currency,
                                data?.store.locale,
                              )}
                            </strong>
                          </div>
                        ) : null}
                        {table.totals.taxCents > 0 ? (
                          <div className="row between">
                            <span>
                              {table.totals.taxLabel} (
                              {(table.totals.taxRateBps / 100).toFixed(2)}%)
                            </span>
                            <strong>
                              {formatCents(
                                table.totals.taxCents,
                                data?.store.currency,
                                data?.store.locale,
                              )}
                            </strong>
                          </div>
                        ) : null}
                      </div>

                      {table.recentlyDoneItems.length > 0 ? (
                        <div className="list compact-list">
                          <strong>Recently confirmed</strong>
                          {table.recentlyDoneItems.map((item) => (
                            <div
                              className="list-item row between"
                              key={item.id}
                            >
                              <span>
                                {item.quantity} x {item.nameSnapshot}
                              </span>
                              <button
                                className="btn ghost"
                                onClick={() =>
                                  void setItemStatus(item.id, "PENDING")
                                }
                              >
                                Undo
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : null}

                      {table.openTotalCents > 0 ? (
                        <div className="checkout-controls foh-checkout-controls">
                          <label className="field">
                            <span>Payment</span>
                            <select
                              className="select"
                              value={payment.paymentMethod}
                              onChange={(event) =>
                                updateCheckoutDraft(table, {
                                  paymentMethod: event.target
                                    .value as PaymentMethod,
                                })
                              }
                            >
                              {PAYMENT_METHODS.map((method) => (
                                <option value={method} key={method}>
                                  {method}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="field">
                            <span>Amount</span>
                            <input
                              className="input"
                              inputMode="decimal"
                              value={payment.amount}
                              onChange={(event) =>
                                updateCheckoutDraft(table, {
                                  amount: event.target.value,
                                })
                              }
                            />
                          </label>
                          <label className="field">
                            <span>Tip</span>
                            <input
                              className="input"
                              inputMode="decimal"
                              value={payment.tip}
                              onChange={(event) =>
                                updateCheckoutDraft(table, {
                                  tip: event.target.value,
                                })
                              }
                            />
                          </label>
                          <label className="field">
                            <span>Discount</span>
                            <input
                              className="input"
                              inputMode="decimal"
                              value={payment.discount}
                              onChange={(event) =>
                                updateCheckoutDraft(table, {
                                  discount: event.target.value,
                                })
                              }
                            />
                          </label>
                          <label className="field">
                            <span>Reference</span>
                            <input
                              className="input"
                              value={payment.reference}
                              placeholder="Last 4, cash drawer"
                              onChange={(event) =>
                                updateCheckoutDraft(table, {
                                  reference: event.target.value,
                                })
                              }
                            />
                          </label>
                          <label className="field foh-payment-note">
                            <span>Close note</span>
                            <textarea
                              className="input textarea"
                              value={payment.note}
                              placeholder="Optional payment or shift note"
                              onChange={(event) =>
                                updateCheckoutDraft(table, {
                                  note: event.target.value,
                                })
                              }
                            />
                          </label>
                        </div>
                      ) : null}

                      {table.openTotalCents > 0 ? (
                        <button
                          className="btn primary foh-close-button"
                          disabled={!canCheckout}
                          onClick={() => void checkout(table)}
                        >
                          {canCheckout
                            ? "Take payment and close"
                            : "Finish pending dishes first"}
                        </button>
                      ) : (
                        <p className="meta foh-no-checkout">No open check.</p>
                      )}
                    </article>
                  );
                })}
              </div>
            </section>
          </div>

          <aside className="foh-side-column">
            <section className="card foh-side-card">
              <div className="row between">
                <div>
                  <h2>Ready to close</h2>
                  <p>Tables with no pending dishes.</p>
                </div>
                <span className="status ok">{queues.checkoutReady.length}</span>
              </div>
              <div className="list compact-list">
                {queues.checkoutReady.length === 0 ? (
                  <p>No checkout-ready tables.</p>
                ) : null}
                {queues.checkoutReady.map((table) => (
                  <div className="list-item row between" key={table.table.id}>
                    <span>
                      Table {table.table.number} / {table.table.name}
                    </span>
                    <strong>
                      {formatCents(
                        table.openTotalCents,
                        data?.store.currency,
                        data?.store.locale,
                      )}
                    </strong>
                  </div>
                ))}
              </div>
            </section>

            <section className="card foh-side-card">
              <div className="row between">
                <div>
                  <h2>Print queue</h2>
                  <p>Kitchen tickets from customer orders.</p>
                </div>
                <span
                  className={
                    activePrintJobs.length > 0 ? "status checkout" : "status"
                  }
                >
                  {activePrintJobs.length} active
                </span>
              </div>
              <div className="list compact-list">
                {(printData?.jobs ?? []).slice(0, 8).map((job) => (
                  <div className="list-item row between" key={job.id}>
                    <span>
                      {job.type} / Table {job.tableNumber ?? "-"} / {job.status}
                    </span>
                    {job.orderId &&
                    job.status !== "PENDING" &&
                    job.status !== "PRINTING" ? (
                      <button
                        className="btn ghost"
                        onClick={() => void reprint(job.orderId!)}
                      >
                        Reprint
                      </button>
                    ) : job.status === "PENDING" ||
                      job.status === "PRINTING" ? (
                      <span className="status checkout">Waiting</span>
                    ) : null}
                  </div>
                ))}
                {(printData?.jobs ?? []).length === 0 ? (
                  <p>No print jobs yet.</p>
                ) : null}
              </div>
            </section>

            <section className="card foh-side-card">
              <div className="row between">
                <div>
                  <h2>Recent payments</h2>
                  <p>Payments recorded when FOH closes a table.</p>
                </div>
                <span className="status">
                  {paymentData?.payments.length ?? 0}
                </span>
              </div>
              <div className="list compact-list">
                {(paymentData?.payments ?? []).slice(0, 8).map((payment) => (
                  <div className="list-item" key={payment.id}>
                    <div className="row between">
                      <span>
                        Table {payment.tableNumber ?? "-"} / {payment.method}
                        {payment.reference ? ` / ${payment.reference}` : ""}
                        {payment.status !== "PAID"
                          ? ` / ${payment.status}`
                          : ""}
                      </span>
                      <strong>
                        {formatCents(
                          payment.amountCents - payment.refundedCents,
                          paymentData?.store.currency,
                          paymentData?.store.locale,
                        )}
                      </strong>
                    </div>
                    <div className="row">
                      {payment.refundedCents > 0 ? (
                        <span className="status urgent">
                          refunded{" "}
                          {formatCents(
                            payment.refundedCents,
                            paymentData?.store.currency,
                            paymentData?.store.locale,
                          )}
                        </span>
                      ) : null}
                      {payment.amountCents > payment.refundedCents ? (
                        <button
                          className="btn ghost"
                          onClick={() =>
                            void refund(
                              payment.id,
                              payment.amountCents - payment.refundedCents,
                            )
                          }
                        >
                          Refund
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))}
                {(paymentData?.payments ?? []).length === 0 ? (
                  <p>No payments recorded yet.</p>
                ) : null}
              </div>
            </section>
          </aside>
        </section>
      </main>
    </AuthGate>
  );
}
