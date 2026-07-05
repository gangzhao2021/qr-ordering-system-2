"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { ManageAnalyticsResponse } from "@qr2/shared";
import { formatCents } from "@qr2/shared";
import { apiFetch } from "../../../lib/api";
import {
  AuthGate,
  StaffSessionBar,
  useRequireRole,
} from "../../../lib/auth-client";

function metricMoney(
  cents: number,
  data: ManageAnalyticsResponse | null,
): string {
  return formatCents(cents, data?.store.currency, data?.store.locale);
}

function formatRating(value: number | null | undefined) {
  return value === null || value === undefined ? "n/a" : value.toFixed(1);
}

function percentFromBps(value: number | null | undefined) {
  if (value === null || value === undefined) return "n/a";
  return `${(value / 100).toFixed(1)}%`;
}

function maxValue(values: number[]) {
  return Math.max(1, ...values);
}

export default function ManageAnalyticsPage() {
  const auth = useRequireRole(["DEV", "ADMIN"]);
  const [days, setDays] = useState("7");
  const [data, setData] = useState<ManageAnalyticsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setError(null);
    try {
      setData(
        await apiFetch<ManageAnalyticsResponse>(
          `/v1/manage/analytics?days=${encodeURIComponent(days)}`,
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  useEffect(() => {
    if (auth.user) void refresh();
  }, [auth.user, days]);

  const maxDailyRevenue = useMemo(
    () =>
      maxValue((data?.dailyRevenue ?? []).map((row) => row.netRevenueCents)),
    [data],
  );
  const maxItemSales = useMemo(
    () => maxValue((data?.topItems ?? []).map((item) => item.salesCents)),
    [data],
  );
  const maxCategorySales = useMemo(
    () => maxValue((data?.categorySales ?? []).map((row) => row.salesCents)),
    [data],
  );
  const maxStationSales = useMemo(
    () => maxValue((data?.kitchenStations ?? []).map((row) => row.salesCents)),
    [data],
  );

  return (
    <AuthGate state={auth}>
      <main className="page">
        <StaffSessionBar user={auth.user} />
        <section className="page-header">
          <div className="row between">
            <div>
              <h1>Operating reports</h1>
              <p>
                Revenue, refunds, orders, menu performance, customer activity,
                inventory risk, and audit signals for the current store.
              </p>
            </div>
            <div className="row">
              <label className="field analytics-range">
                <span>Range</span>
                <select
                  className="select"
                  value={days}
                  onChange={(event) => setDays(event.target.value)}
                >
                  <option value="7">7 days</option>
                  <option value="14">14 days</option>
                  <option value="31">31 days</option>
                </select>
              </label>
              <Link className="link-btn ghost" href="/manage/audit">
                Audit log
              </Link>
            </div>
          </div>
        </section>
        {error ? <div className="error card">{error}</div> : null}

        <section className="foh-metric-grid">
          <article className="card metric-card">
            <span className="meta">Net revenue</span>
            <strong>
              {metricMoney(data?.totals.netRevenueCents ?? 0, data)}
            </strong>
          </article>
          <article className="card metric-card">
            <span className="meta">Gross payments</span>
            <strong>{metricMoney(data?.totals.revenueCents ?? 0, data)}</strong>
          </article>
          <article className="card metric-card">
            <span className="meta">Refunds</span>
            <strong>
              {metricMoney(data?.totals.refundedCents ?? 0, data)}
            </strong>
          </article>
          <article className="card metric-card">
            <span className="meta">Orders</span>
            <strong>{data?.totals.submittedOrderCount ?? 0}</strong>
          </article>
          <article className="card metric-card">
            <span className="meta">Average order</span>
            <strong>
              {metricMoney(data?.totals.averageOrderCents ?? 0, data)}
            </strong>
          </article>
          <article className="card metric-card">
            <span className="meta">Payments</span>
            <strong>{data?.totals.paymentCount ?? 0}</strong>
          </article>
          <article className="card metric-card">
            <span className="meta">Discounts</span>
            <strong>
              {metricMoney(data?.totals.discountCents ?? 0, data)}
            </strong>
          </article>
          <article className="card metric-card">
            <span className="meta">Tax + service</span>
            <strong>
              {metricMoney(
                (data?.totals.taxCents ?? 0) +
                  (data?.totals.serviceChargeCents ?? 0),
                data,
              )}
            </strong>
          </article>
          <article className="card metric-card">
            <span className="meta">Member revenue</span>
            <strong>
              {metricMoney(data?.totals.memberRevenueCents ?? 0, data)}
            </strong>
          </article>
          <article className="card metric-card">
            <span className="meta">Coupon uses</span>
            <strong>{data?.totals.couponRedemptionCount ?? 0}</strong>
          </article>
          <article className="card metric-card">
            <span className="meta">Feedback rating</span>
            <strong>{formatRating(data?.totals.averageRating)}</strong>
          </article>
          <article className="card metric-card">
            <span className="meta">Low stock</span>
            <strong>{data?.totals.lowStockItemCount ?? 0}</strong>
          </article>
        </section>

        <section className="grid two" style={{ marginTop: 16 }}>
          <article className="card grid">
            <h2>Daily net revenue</h2>
            <div className="bar-list">
              {(data?.dailyRevenue ?? []).map((row) => (
                <div className="bar-row" key={row.date}>
                  <span className="meta">{row.date.slice(5)}</span>
                  <div className="bar-track">
                    <div
                      className="bar-fill"
                      style={{
                        width: `${Math.max(
                          2,
                          (row.netRevenueCents / maxDailyRevenue) * 100,
                        )}%`,
                      }}
                    />
                  </div>
                  <strong>
                    {metricMoney(row.netRevenueCents, data)}{" "}
                    <span className="meta">
                      {row.orderCount} orders / {row.paymentCount} pays
                    </span>
                  </strong>
                </div>
              ))}
            </div>
          </article>

          <article className="card grid">
            <h2>Payment mix</h2>
            <div className="list">
              {(data?.paymentMethods ?? []).map((row) => (
                <div className="list-item row between" key={row.method}>
                  <span>{row.method}</span>
                  <strong>
                    {metricMoney(row.netRevenueCents, data)}{" "}
                    <span className="meta">
                      {row.paymentCount} payments
                      {row.refundedCents > 0
                        ? ` / ${metricMoney(row.refundedCents, data)} refunded`
                        : ""}
                    </span>
                  </strong>
                </div>
              ))}
              {(data?.paymentMethods ?? []).length === 0 ? (
                <span className="meta">No payments in this range.</span>
              ) : null}
            </div>
          </article>

          <article className="card grid">
            <h2>Menu categories</h2>
            <div className="bar-list">
              {(data?.categorySales ?? []).map((row) => (
                <div className="bar-row" key={row.categoryName}>
                  <span>{row.categoryName}</span>
                  <div className="bar-track">
                    <div
                      className="bar-fill"
                      style={{
                        width: `${Math.max(
                          2,
                          (row.salesCents / maxCategorySales) * 100,
                        )}%`,
                      }}
                    />
                  </div>
                  <strong>
                    {metricMoney(row.salesCents, data)}{" "}
                    <span className="meta">
                      {row.quantity} sold / {row.itemCount} items
                    </span>
                  </strong>
                </div>
              ))}
              {(data?.categorySales ?? []).length === 0 ? (
                <span className="meta">No category sales in this range.</span>
              ) : null}
            </div>
          </article>

          <article className="card grid">
            <h2>Kitchen stations</h2>
            <div className="bar-list">
              {(data?.kitchenStations ?? []).map((row) => (
                <div className="bar-row" key={row.station}>
                  <span>{row.station}</span>
                  <div className="bar-track">
                    <div
                      className="bar-fill"
                      style={{
                        width: `${Math.max(
                          2,
                          (row.salesCents / maxStationSales) * 100,
                        )}%`,
                      }}
                    />
                  </div>
                  <strong>
                    {metricMoney(row.salesCents, data)}{" "}
                    <span className="meta">
                      {row.quantity} sold / {row.pendingQuantity} pending
                    </span>
                  </strong>
                </div>
              ))}
              {(data?.kitchenStations ?? []).length === 0 ? (
                <span className="meta">No station sales in this range.</span>
              ) : null}
            </div>
          </article>

          <article className="card grid analytics-wide">
            <h2>Top items</h2>
            <div className="bar-list">
              {(data?.topItems ?? []).map((item) => (
                <div className="bar-row" key={item.name}>
                  <span>{item.name}</span>
                  <div className="bar-track">
                    <div
                      className="bar-fill"
                      style={{
                        width: `${Math.max(
                          2,
                          (item.salesCents / maxItemSales) * 100,
                        )}%`,
                      }}
                    />
                  </div>
                  <strong>
                    {metricMoney(item.salesCents, data)}{" "}
                    <span className="meta">
                      {item.quantity} sold / {item.categoryName} /{" "}
                      {item.kitchenStation}
                    </span>
                  </strong>
                </div>
              ))}
              {(data?.topItems ?? []).length === 0 ? (
                <span className="meta">No item sales in this range.</span>
              ) : null}
            </div>
          </article>

          <article className="card grid">
            <h2>Coupons and members</h2>
            <div className="list compact-list">
              <div className="list-item row between">
                <span>Member payments</span>
                <strong>{data?.totals.memberPaymentCount ?? 0}</strong>
              </div>
              <div className="list-item row between">
                <span>Coupon discount</span>
                <strong>
                  {metricMoney(data?.totals.couponDiscountCents ?? 0, data)}
                </strong>
              </div>
              {(data?.coupons ?? []).map((coupon) => (
                <div className="list-item" key={coupon.code}>
                  <strong>{coupon.code}</strong>
                  <span className="meta">
                    {coupon.redemptionCount} uses /{" "}
                    {metricMoney(coupon.discountCents, data)} discount from{" "}
                    {metricMoney(coupon.subtotalCents, data)} subtotal
                  </span>
                </div>
              ))}
              {(data?.coupons ?? []).length === 0 ? (
                <span className="meta">
                  No coupon redemptions in this range.
                </span>
              ) : null}
            </div>
          </article>

          <article className="card grid">
            <h2>Inventory risk</h2>
            <div className="list compact-list">
              {(data?.inventoryRisks ?? []).map((item) => (
                <div className="list-item" key={item.menuItemId}>
                  <div className="row between">
                    <strong>{item.name}</strong>
                    <span className="status checkout">
                      {item.stockQuantity}/{item.lowStockThreshold}
                    </span>
                  </div>
                  <span className="meta">
                    Cost {metricMoney(item.recipeCostCents ?? 0, data)} / margin{" "}
                    {metricMoney(item.marginCents ?? 0, data)} /
                    {percentFromBps(item.marginBps)}
                  </span>
                </div>
              ))}
              {(data?.inventoryRisks ?? []).length === 0 ? (
                <span className="meta">No low-stock menu items.</span>
              ) : null}
            </div>
          </article>

          <article className="card grid analytics-wide">
            <div className="row between">
              <div>
                <h2>Audit activity</h2>
                <p>
                  {data?.totals.auditLogCount ?? 0} entries from{" "}
                  {data?.totals.auditActorCount ?? 0} actors
                  {data?.totals.lastAuditAt
                    ? ` / latest ${new Date(
                        data.totals.lastAuditAt,
                      ).toLocaleString()}`
                    : ""}
                </p>
              </div>
              <Link className="link-btn ghost" href="/manage/audit">
                Open audit
              </Link>
            </div>
            <div className="list compact-list">
              {(data?.auditActions ?? []).map((row) => (
                <div className="list-item row between" key={row.action}>
                  <span>{row.action}</span>
                  <strong>{row.count}</strong>
                </div>
              ))}
              {(data?.auditActions ?? []).length === 0 ? (
                <span className="meta">No audit entries in this range.</span>
              ) : null}
            </div>
          </article>
        </section>
      </main>
    </AuthGate>
  );
}
