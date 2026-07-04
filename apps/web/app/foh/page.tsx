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

type CheckoutDraft = {
  paymentMethod: PaymentMethod;
  amount: string;
  reference: string;
  note: string;
};

function dollarsFromCents(cents: number) {
  return (cents / 100).toFixed(2);
}

function parsePriceCents(value: string) {
  return Math.round(Number(value) * 100);
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
      total: tables.reduce((sum, table) => sum + table.openTotalCents, 0),
    };
  }, [data]);

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
          reference: draft.reference.trim() || null,
          note: draft.note.trim() || null,
        }),
      },
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
      <main className="page">
        <StaffSessionBar user={auth.user} />
        <section className="page-header">
          <h1>FOH workspace</h1>
          <p>
            Live order state belongs here. Confirm dishes only after the
            physical handoff is visible.
          </p>
        </section>

        <section className="grid three">
          <div className="card">
            <h3>Open tables</h3>
            <strong>{stats.open}</strong>
          </div>
          <div className="card">
            <h3>Pending items</h3>
            <strong>{stats.pending}</strong>
          </div>
          <div className="card">
            <h3>Service requests</h3>
            <strong>{stats.requests}</strong>
          </div>
          <div className="card">
            <h3>Open total</h3>
            <strong>
              {formatCents(
                stats.total,
                data?.store.currency,
                data?.store.locale,
              )}
            </strong>
          </div>
        </section>

        <div className="row" style={{ marginTop: 16 }}>
          <button
            className="btn"
            onClick={() => void refresh()}
            disabled={loading}
          >
            Refresh
          </button>
          {error ? <span className="error status">{error}</span> : null}
        </div>

        <section className="card" style={{ marginTop: 16 }}>
          <div className="row between">
            <div>
              <h2>Print queue</h2>
              <p>Kitchen tickets created from customer orders.</p>
            </div>
            <span className="status">
              {
                (printData?.jobs ?? []).filter(
                  (job) => job.status !== "PRINTED",
                ).length
              }{" "}
              active
            </span>
          </div>
          <div className="list" style={{ marginTop: 12 }}>
            {(printData?.jobs ?? []).slice(0, 8).map((job) => (
              <div className="list-item row between" key={job.id}>
                <span>
                  {job.type} · Table {job.tableNumber ?? "-"} · {job.status}
                </span>
                {job.orderId ? (
                  <button
                    className="btn ghost"
                    onClick={() => void reprint(job.orderId!)}
                  >
                    Reprint
                  </button>
                ) : null}
              </div>
            ))}
            {(printData?.jobs ?? []).length === 0 ? (
              <p>No print jobs yet.</p>
            ) : null}
          </div>
        </section>

        <section className="card" style={{ marginTop: 16 }}>
          <div className="row between">
            <div>
              <h2>Recent payments</h2>
              <p>Payments recorded when FOH closes a table.</p>
            </div>
            <span className="status">{paymentData?.payments.length ?? 0}</span>
          </div>
          <div className="list" style={{ marginTop: 12 }}>
            {(paymentData?.payments ?? []).slice(0, 8).map((payment) => (
              <div className="list-item row between" key={payment.id}>
                <span>
                  Table {payment.tableNumber ?? "-"} / {payment.method}
                  {payment.reference ? ` / ${payment.reference}` : ""}
                </span>
                <strong>
                  {formatCents(
                    payment.amountCents,
                    paymentData?.store.currency,
                    paymentData?.store.locale,
                  )}
                </strong>
              </div>
            ))}
            {(paymentData?.payments ?? []).length === 0 ? (
              <p>No payments recorded yet.</p>
            ) : null}
          </div>
        </section>

        <section className="grid two" style={{ marginTop: 16 }}>
          {(data?.tables ?? []).map((table) => {
            const payment = checkoutDraft(table);
            return (
              <article className="card" key={table.table.id}>
                <div className="row between">
                  <div>
                    <h2>Table {table.table.number}</h2>
                    <p>{table.table.name}</p>
                  </div>
                  <span className={statusClass[table.tableStatus]}>
                    {table.tableStatus}
                  </span>
                </div>
                <p style={{ marginTop: 8 }}>
                  Total:{" "}
                  <strong>
                    {formatCents(
                      table.openTotalCents,
                      data?.store.currency,
                      data?.store.locale,
                    )}
                  </strong>
                </p>
                <div className="list" style={{ marginTop: 10 }}>
                  <div className="list-item row between">
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
                    <div className="list-item row between">
                      <span>
                        {table.totals.serviceChargeLabel} (
                        {(table.totals.serviceChargeRateBps / 100).toFixed(2)}%)
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
                    <div className="list-item row between">
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

                {table.serviceRequests.length > 0 ? (
                  <div className="list" style={{ marginTop: 12 }}>
                    <strong>Service requests</strong>
                    {table.serviceRequests.map((request) => (
                      <div className="list-item" key={request.id}>
                        <div className="row between">
                          <span>{request.type}</span>
                          <button
                            className="btn"
                            onClick={() =>
                              void setRequestStatus(request.id, "HANDLED")
                            }
                          >
                            Handled
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}

                <div className="list" style={{ marginTop: 12 }}>
                  <strong>Pending dishes</strong>
                  {table.pendingItems.length === 0 ? (
                    <p>No pending items.</p>
                  ) : null}
                  {table.pendingItems.map((item) => (
                    <div className="list-item" key={item.id}>
                      <div className="row between">
                        <span>
                          {item.quantity} x {item.nameSnapshot}
                        </span>
                        <div className="row">
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
                    </div>
                  ))}
                </div>

                {table.recentlyDoneItems.length > 0 ? (
                  <div className="list" style={{ marginTop: 12 }}>
                    <strong>Recently confirmed</strong>
                    {table.recentlyDoneItems.map((item) => (
                      <div className="list-item" key={item.id}>
                        <div className="row between">
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
                      </div>
                    ))}
                  </div>
                ) : null}

                {table.openTotalCents > 0 ? (
                  <div className="checkout-controls">
                    <label className="field">
                      <span>Payment</span>
                      <select
                        className="select"
                        value={payment.paymentMethod}
                        onChange={(event) =>
                          updateCheckoutDraft(table, {
                            paymentMethod: event.target.value as PaymentMethod,
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
                      <span>Reference</span>
                      <input
                        className="input"
                        value={payment.reference}
                        placeholder="Last 4, cash drawer, note"
                        onChange={(event) =>
                          updateCheckoutDraft(table, {
                            reference: event.target.value,
                          })
                        }
                      />
                    </label>
                  </div>
                ) : null}

                <button
                  className="btn primary"
                  style={{ marginTop: 14 }}
                  disabled={
                    table.pendingItems.length > 0 || table.openTotalCents === 0
                  }
                  onClick={() => void checkout(table)}
                >
                  Take payment and close
                </button>
              </article>
            );
          })}
        </section>
      </main>
    </AuthGate>
  );
}
