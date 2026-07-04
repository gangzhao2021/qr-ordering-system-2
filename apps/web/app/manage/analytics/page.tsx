"use client";

import { useEffect, useMemo, useState } from "react";
import type { ManageAnalyticsResponse } from "@qr2/shared";
import { formatCents } from "@qr2/shared";
import { apiFetch } from "../../../lib/api";
import {
  AuthGate,
  StaffSessionBar,
  useRequireRole,
} from "../../../lib/auth-client";

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
      Math.max(1, ...(data?.dailyRevenue ?? []).map((row) => row.revenueCents)),
    [data],
  );
  const maxItemQuantity = useMemo(
    () => Math.max(1, ...(data?.topItems ?? []).map((item) => item.quantity)),
    [data],
  );

  return (
    <AuthGate state={auth}>
      <main className="page">
        <StaffSessionBar user={auth.user} />
        <section className="page-header">
          <div className="row between">
            <div>
              <h1>Analytics</h1>
              <p>Revenue, checkout volume, payment mix, and top items.</p>
            </div>
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
          </div>
        </section>
        {error ? <div className="error card">{error}</div> : null}

        <section className="grid three">
          <div className="card">
            <h3>Revenue</h3>
            <strong>
              {formatCents(
                data?.totals.revenueCents ?? 0,
                data?.store.currency,
                data?.store.locale,
              )}
            </strong>
          </div>
          <div className="card">
            <h3>Payments</h3>
            <strong>{data?.totals.paymentCount ?? 0}</strong>
          </div>
          <div className="card">
            <h3>Average payment</h3>
            <strong>
              {formatCents(
                data?.totals.averagePaymentCents ?? 0,
                data?.store.currency,
                data?.store.locale,
              )}
            </strong>
          </div>
          <div className="card">
            <h3>Orders</h3>
            <strong>{data?.totals.submittedOrderCount ?? 0}</strong>
          </div>
          <div className="card">
            <h3>Closed</h3>
            <strong>{data?.totals.closedOrderCount ?? 0}</strong>
          </div>
          <div className="card">
            <h3>Open</h3>
            <strong>{data?.totals.openOrderCount ?? 0}</strong>
          </div>
        </section>

        <section className="grid two" style={{ marginTop: 16 }}>
          <article className="card grid">
            <h2>Daily revenue</h2>
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
                          (row.revenueCents / maxDailyRevenue) * 100,
                        )}%`,
                      }}
                    />
                  </div>
                  <strong>
                    {formatCents(
                      row.revenueCents,
                      data?.store.currency,
                      data?.store.locale,
                    )}
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
                    {formatCents(
                      row.amountCents,
                      data?.store.currency,
                      data?.store.locale,
                    )}{" "}
                    <span className="meta">({row.paymentCount})</span>
                  </strong>
                </div>
              ))}
              {(data?.paymentMethods ?? []).length === 0 ? (
                <span className="meta">No payments in this range.</span>
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
                          (item.quantity / maxItemQuantity) * 100,
                        )}%`,
                      }}
                    />
                  </div>
                  <strong>
                    {item.quantity}{" "}
                    <span className="meta">
                      {formatCents(
                        item.salesCents,
                        data?.store.currency,
                        data?.store.locale,
                      )}
                    </span>
                  </strong>
                </div>
              ))}
              {(data?.topItems ?? []).length === 0 ? (
                <span className="meta">No item sales in this range.</span>
              ) : null}
            </div>
          </article>
        </section>
      </main>
    </AuthGate>
  );
}
