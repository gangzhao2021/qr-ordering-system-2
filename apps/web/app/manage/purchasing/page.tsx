"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type {
  ManageMenuResponse,
  ManageOperationsResponse,
  PurchaseOrder,
} from "@qr2/shared";
import { formatCents } from "@qr2/shared";
import Link from "next/link";
import { apiFetch } from "../../../lib/api";
import {
  AuthGate,
  StaffSessionBar,
  useRequireRole,
} from "../../../lib/auth-client";

type PurchaseLineDraft = {
  menuItemId: string;
  quantityOrdered: string;
  unitCostCents: string;
  note: string;
};

type PurchaseOrderDraft = {
  supplierId: string;
  orderNumber: string;
  expectedAt: string;
  notes: string;
  lines: PurchaseLineDraft[];
};

const emptyLine: PurchaseLineDraft = {
  menuItemId: "",
  quantityOrdered: "1",
  unitCostCents: "",
  note: "",
};

const emptyOrder: PurchaseOrderDraft = {
  supplierId: "",
  orderNumber: "",
  expectedAt: "",
  notes: "",
  lines: [emptyLine],
};

function optional(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function datetimeLocalToIso(value: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function formatDateTime(value?: string | null) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function remaining(line: PurchaseOrder["lines"][number]) {
  return Math.max(0, line.quantityOrdered - line.quantityReceived);
}

function isReceivable(order: PurchaseOrder) {
  return order.status === "ORDERED" || order.status === "PARTIALLY_RECEIVED";
}

function statusClass(status: PurchaseOrder["status"]) {
  if (status === "RECEIVED") return "status ok";
  if (status === "PARTIALLY_RECEIVED") return "status checkout";
  if (status === "CANCELED") return "status";
  return "status ok";
}

export default function ManagePurchasingPage() {
  const auth = useRequireRole(["DEV", "ADMIN"]);
  const [operations, setOperations] = useState<ManageOperationsResponse | null>(
    null,
  );
  const [menu, setMenu] = useState<ManageMenuResponse | null>(null);
  const [draft, setDraft] = useState<PurchaseOrderDraft>(emptyOrder);
  const [receiveDrafts, setReceiveDrafts] = useState<
    Record<string, Record<string, string>>
  >({});
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const menuItems = useMemo(
    () => menu?.categories.flatMap((category) => category.items) ?? [],
    [menu],
  );

  const activeSuppliers =
    operations?.suppliers.filter((supplier) => supplier.isActive) ?? [];
  const receivableOrders =
    operations?.purchaseOrders.filter(isReceivable) ?? [];

  async function refresh() {
    setError(null);
    try {
      const [operationsResult, menuResult] = await Promise.all([
        apiFetch<ManageOperationsResponse>("/v1/manage/operations"),
        apiFetch<ManageMenuResponse>("/v1/manage/menu"),
      ]);
      setOperations(operationsResult);
      setMenu(menuResult);
      const firstSupplierId =
        operationsResult.suppliers.find((supplier) => supplier.isActive)?.id ??
        "";
      const firstMenuItemId = menuResult.categories[0]?.items[0]?.id ?? "";
      setDraft((current) => ({
        ...current,
        supplierId: current.supplierId || firstSupplierId,
        lines:
          current.lines.length > 0
            ? current.lines.map((line) => ({
                ...line,
                menuItemId: line.menuItemId || firstMenuItemId,
              }))
            : [{ ...emptyLine, menuItemId: firstMenuItemId }],
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  useEffect(() => {
    if (auth.user) void refresh();
  }, [auth.user]);

  function updateDraft(patch: Partial<PurchaseOrderDraft>) {
    setDraft((current) => ({ ...current, ...patch }));
  }

  function updateLine(index: number, patch: Partial<PurchaseLineDraft>) {
    setDraft((current) => ({
      ...current,
      lines: current.lines.map((line, lineIndex) =>
        lineIndex === index ? { ...line, ...patch } : line,
      ),
    }));
  }

  function addLine() {
    setDraft((current) => ({
      ...current,
      lines: [
        ...current.lines,
        {
          ...emptyLine,
          menuItemId: menuItems[0]?.id ?? "",
        },
      ],
    }));
  }

  function removeLine(index: number) {
    setDraft((current) => ({
      ...current,
      lines: current.lines.filter((_, lineIndex) => lineIndex !== index),
    }));
  }

  async function submitPurchaseOrder(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await apiFetch("/v1/manage/operations/purchase-orders", {
        method: "POST",
        body: JSON.stringify({
          supplierId: draft.supplierId,
          orderNumber: optional(draft.orderNumber),
          expectedAt: datetimeLocalToIso(draft.expectedAt),
          notes: optional(draft.notes),
          lines: draft.lines.map((line) => ({
            menuItemId: line.menuItemId,
            quantityOrdered: Number(line.quantityOrdered || 0),
            unitCostCents: line.unitCostCents
              ? Number(line.unitCostCents)
              : null,
            note: optional(line.note),
          })),
        }),
      });
      setDraft({
        ...emptyOrder,
        supplierId: draft.supplierId,
        lines: [{ ...emptyLine, menuItemId: menuItems[0]?.id ?? "" }],
      });
      setNotice("Purchase order created.");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  function updateReceiveDraft(orderId: string, lineId: string, value: string) {
    setReceiveDrafts((current) => ({
      ...current,
      [orderId]: {
        ...(current[orderId] ?? {}),
        [lineId]: value,
      },
    }));
  }

  async function receiveOrder(order: PurchaseOrder, receiveAll = false) {
    setError(null);
    try {
      const lines = order.lines
        .map((line) => ({
          lineId: line.id,
          quantityReceived: receiveAll
            ? remaining(line)
            : Number(receiveDrafts[order.id]?.[line.id] || 0),
        }))
        .filter((line) => line.quantityReceived > 0);
      if (lines.length === 0) {
        setError("Enter at least one received quantity.");
        return;
      }
      await apiFetch(
        `/v1/manage/operations/purchase-orders/${encodeURIComponent(
          order.id,
        )}/receive`,
        {
          method: "POST",
          body: JSON.stringify({ lines }),
        },
      );
      setReceiveDrafts((current) => ({ ...current, [order.id]: {} }));
      setNotice(`${order.orderNumber} received.`);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <AuthGate state={auth}>
      <main className="page">
        <StaffSessionBar user={auth.user} />
        <section className="page-header">
          <div>
            <h1>Purchasing</h1>
            <p>
              Create purchase orders, receive stock, and keep menu quantities
              tied to real supplier deliveries.
            </p>
          </div>
          <Link className="link-btn ghost" href="/manage/operations">
            Operations records
          </Link>
        </section>
        {error ? <div className="error card">{error}</div> : null}
        {notice ? <div className="success card">{notice}</div> : null}

        <section className="grid two">
          <form
            className="card grid"
            onSubmit={(event) => void submitPurchaseOrder(event)}
          >
            <h2>New purchase order</h2>
            <label className="field">
              <span>Supplier</span>
              <select
                className="select"
                value={draft.supplierId}
                onChange={(event) =>
                  updateDraft({ supplierId: event.target.value })
                }
              >
                {activeSuppliers.map((supplier) => (
                  <option value={supplier.id} key={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid two">
              <label className="field">
                <span>Order number</span>
                <input
                  className="input"
                  placeholder="Auto-generated"
                  value={draft.orderNumber}
                  onChange={(event) =>
                    updateDraft({ orderNumber: event.target.value })
                  }
                />
              </label>
              <label className="field">
                <span>Expected</span>
                <input
                  className="input"
                  type="datetime-local"
                  value={draft.expectedAt}
                  onChange={(event) =>
                    updateDraft({ expectedAt: event.target.value })
                  }
                />
              </label>
            </div>
            <label className="field">
              <span>Notes</span>
              <textarea
                className="input textarea"
                value={draft.notes}
                onChange={(event) => updateDraft({ notes: event.target.value })}
              />
            </label>
            <div className="operations-edit-list">
              {draft.lines.map((line, index) => (
                <div className="operations-record-card" key={index}>
                  <div className="operations-record-grid">
                    <label className="field">
                      <span>Menu item</span>
                      <select
                        className="select"
                        value={line.menuItemId}
                        onChange={(event) =>
                          updateLine(index, { menuItemId: event.target.value })
                        }
                      >
                        {menuItems.map((item) => (
                          <option value={item.id} key={item.id}>
                            {item.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="field">
                      <span>Qty</span>
                      <input
                        className="input"
                        inputMode="numeric"
                        value={line.quantityOrdered}
                        onChange={(event) =>
                          updateLine(index, {
                            quantityOrdered: event.target.value,
                          })
                        }
                      />
                    </label>
                    <label className="field">
                      <span>Unit cost cents</span>
                      <input
                        className="input"
                        inputMode="numeric"
                        value={line.unitCostCents}
                        onChange={(event) =>
                          updateLine(index, {
                            unitCostCents: event.target.value,
                          })
                        }
                      />
                    </label>
                  </div>
                  <label className="field">
                    <span>Line note</span>
                    <input
                      className="input"
                      value={line.note}
                      onChange={(event) =>
                        updateLine(index, { note: event.target.value })
                      }
                    />
                  </label>
                  {draft.lines.length > 1 ? (
                    <button
                      className="btn ghost"
                      type="button"
                      onClick={() => removeLine(index)}
                    >
                      Remove line
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
            <div className="row between">
              <button className="btn ghost" type="button" onClick={addLine}>
                Add line
              </button>
              <button
                className="btn primary"
                disabled={!draft.supplierId || draft.lines.length === 0}
              >
                Create order
              </button>
            </div>
          </form>

          <article className="card grid">
            <h2>Ready to receive</h2>
            <div className="operations-edit-list">
              {receivableOrders.map((order) => (
                <div className="operations-record-card" key={order.id}>
                  <div className="row between">
                    <strong>{order.orderNumber}</strong>
                    <span className={statusClass(order.status)}>
                      {order.status.replace("_", " ")}
                    </span>
                  </div>
                  <span className="meta">
                    {order.supplierName} / Expected{" "}
                    {formatDateTime(order.expectedAt)}
                  </span>
                  <div className="list compact-list">
                    {order.lines.map((line) => (
                      <div className="list-item" key={line.id}>
                        <div className="row between">
                          <div>
                            <strong>{line.menuItemName}</strong>
                            <p>
                              Ordered {line.quantityOrdered}, received{" "}
                              {line.quantityReceived}, remaining{" "}
                              {remaining(line)}
                            </p>
                          </div>
                          <label className="field">
                            <span>Receive</span>
                            <input
                              className="input"
                              inputMode="numeric"
                              placeholder={String(remaining(line))}
                              value={receiveDrafts[order.id]?.[line.id] ?? ""}
                              onChange={(event) =>
                                updateReceiveDraft(
                                  order.id,
                                  line.id,
                                  event.target.value,
                                )
                              }
                            />
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="row between">
                    <button
                      className="btn ghost"
                      type="button"
                      onClick={() => void receiveOrder(order, true)}
                    >
                      Receive all
                    </button>
                    <button
                      className="btn primary"
                      type="button"
                      onClick={() => void receiveOrder(order)}
                    >
                      Receive entered
                    </button>
                  </div>
                </div>
              ))}
              {receivableOrders.length === 0 ? (
                <span className="meta">No purchase orders waiting.</span>
              ) : null}
            </div>
          </article>
        </section>

        <section className="grid two operations-section">
          <article className="card grid">
            <h2>Recent purchase orders</h2>
            <div className="list compact-list">
              {(operations?.purchaseOrders ?? []).map((order) => (
                <div className="list-item" key={order.id}>
                  <div className="row between">
                    <strong>{order.orderNumber}</strong>
                    <span className={statusClass(order.status)}>
                      {order.status.replace("_", " ")}
                    </span>
                  </div>
                  <span className="meta">
                    {order.supplierName} / {order.lines.length} lines / Created{" "}
                    {formatDateTime(order.createdAt)}
                  </span>
                  <div className="list compact-list">
                    {order.lines.map((line) => (
                      <div className="row between" key={line.id}>
                        <span>{line.menuItemName}</span>
                        <span className="meta">
                          {line.quantityReceived}/{line.quantityOrdered}
                          {line.unitCostCents !== null &&
                          line.unitCostCents !== undefined
                            ? ` / ${formatCents(
                                line.unitCostCents,
                                operations?.store.currency,
                                operations?.store.locale,
                              )}`
                            : ""}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </article>

          <article className="card grid">
            <h2>Stock movement from purchasing</h2>
            <div className="list compact-list">
              {(operations?.inventoryAdjustments ?? [])
                .filter((entry) => entry.purchaseOrderId)
                .map((entry) => (
                  <div className="list-item row between" key={entry.id}>
                    <div>
                      <strong>
                        {entry.menuItemName} +{entry.quantityDelta}
                      </strong>
                      <p>{entry.purchaseOrderNumber ?? entry.reason}</p>
                    </div>
                    <span className="meta">
                      {formatDateTime(entry.createdAt)}
                    </span>
                  </div>
                ))}
            </div>
          </article>
        </section>
      </main>
    </AuthGate>
  );
}
