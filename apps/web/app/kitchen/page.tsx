"use client";

import { useEffect, useMemo, useState } from "react";
import type { KitchenPendingResponse } from "@qr2/shared";
import { apiFetch } from "../../lib/api";
import {
  AuthGate,
  StaffSessionBar,
  useRequireRole,
} from "../../lib/auth-client";

type KitchenItem = KitchenPendingResponse["items"][number];

function waitMinutes(iso: string) {
  return Math.max(
    0,
    Math.floor((Date.now() - new Date(iso).getTime()) / 60000),
  );
}

function shortTime(iso: string) {
  return new Intl.DateTimeFormat("en", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function waitStatusClass(minutes: number) {
  if (minutes >= 15) return "status urgent";
  if (minutes >= 8) return "status checkout";
  return "status ok";
}

function formatWaitDuration(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
}

function waitLabel(minutes: number) {
  const duration = formatWaitDuration(minutes);
  if (minutes >= 15) return `${duration} urgent`;
  if (minutes >= 8) return `${duration} watch`;
  return duration;
}

export default function KitchenPage() {
  const auth = useRequireRole(["DEV", "ADMIN", "KITCHEN"]);
  const [data, setData] = useState<KitchenPendingResponse | null>(null);
  const [station, setStation] = useState("ALL");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      setData(
        await apiFetch<KitchenPendingResponse>("/v1/kitchen/pending-items"),
      );
      setLastUpdated(new Date().toISOString());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!auth.user) return;
    void refresh();
    const interval = window.setInterval(() => void refresh(), 15000);
    return () => window.clearInterval(interval);
  }, [auth.user]);

  const stations = useMemo(
    () =>
      Array.from(
        new Set(
          (data?.items ?? []).map((item) => item.kitchenStation || "HOT"),
        ),
      ).sort(),
    [data],
  );

  const filteredItems = useMemo(() => {
    return (data?.items ?? [])
      .filter((item) => station === "ALL" || item.kitchenStation === station)
      .sort((a, b) =>
        a.earliestSubmittedAt.localeCompare(b.earliestSubmittedAt),
      );
  }, [data, station]);

  const stationGroups = useMemo(() => {
    const grouped = new Map<string, KitchenItem[]>();
    for (const item of filteredItems) {
      const key = item.kitchenStation || "HOT";
      const entries = grouped.get(key) ?? [];
      entries.push(item);
      grouped.set(key, entries);
    }
    return Array.from(grouped.entries()).map(([name, items]) => ({
      name,
      items,
      quantity: items.reduce((sum, item) => sum + item.quantity, 0),
      oldestMinutes: items.reduce(
        (max, item) => Math.max(max, waitMinutes(item.earliestSubmittedAt)),
        0,
      ),
    }));
  }, [filteredItems]);

  const stats = useMemo(() => {
    const allItems = data?.items ?? [];
    return {
      dishes: allItems.length,
      quantity: allItems.reduce((sum, item) => sum + item.quantity, 0),
      urgent: allItems.filter(
        (item) => waitMinutes(item.earliestSubmittedAt) >= 15,
      ).length,
      stations: stations.length,
      oldestMinutes: allItems.reduce(
        (max, item) => Math.max(max, waitMinutes(item.earliestSubmittedAt)),
        0,
      ),
    };
  }, [data, stations.length]);

  return (
    <AuthGate state={auth}>
      <main className="page kitchen-page">
        <StaffSessionBar user={auth.user} />
        <section className="page-header kitchen-header">
          <div>
            <h1>Kitchen display</h1>
            <p>
              Read-only production board for station pressure, wait time, and
              table demand.
            </p>
          </div>
          <div className="kitchen-refresh">
            {lastUpdated ? (
              <span className="meta">Updated {shortTime(lastUpdated)}</span>
            ) : null}
            <button
              className="btn primary"
              onClick={() => void refresh()}
              disabled={loading}
            >
              {loading ? "Refreshing" : "Refresh"}
            </button>
          </div>
        </section>

        {error ? (
          <div className="error status kitchen-message">{error}</div>
        ) : null}

        <section className="kitchen-metric-grid">
          <div className="card metric-card">
            <span className="meta">Pending dishes</span>
            <strong>{stats.dishes}</strong>
          </div>
          <div className="card metric-card">
            <span className="meta">Total quantity</span>
            <strong>{stats.quantity}</strong>
          </div>
          <div className="card metric-card">
            <span className="meta">Urgent cards</span>
            <strong>{stats.urgent}</strong>
          </div>
          <div className="card metric-card">
            <span className="meta">Oldest wait</span>
            <strong>{formatWaitDuration(stats.oldestMinutes)}</strong>
          </div>
        </section>

        <section className="card kitchen-toolbar">
          <div>
            <h2>Stations</h2>
            <p>
              {stats.stations} active station{stats.stations === 1 ? "" : "s"}
            </p>
          </div>
          <div className="kitchen-station-tabs" aria-label="Station filter">
            <button
              className={station === "ALL" ? "btn primary" : "btn ghost"}
              onClick={() => setStation("ALL")}
            >
              All
            </button>
            {stations.map((value) => (
              <button
                className={station === value ? "btn primary" : "btn ghost"}
                key={value}
                onClick={() => setStation(value)}
              >
                {value}
              </button>
            ))}
          </div>
        </section>

        <section className="kitchen-board">
          {filteredItems.length === 0 ? (
            <div className="card kitchen-empty">
              <h2>No pending items</h2>
              <p>The board will refresh automatically when orders arrive.</p>
            </div>
          ) : null}

          {stationGroups.map((group) => (
            <section className="kitchen-station-section" key={group.name}>
              <div className="kitchen-station-header">
                <div>
                  <h2>{group.name}</h2>
                  <p className="meta">
                    {group.items.length} card
                    {group.items.length === 1 ? "" : "s"} / {group.quantity}{" "}
                    item{group.quantity === 1 ? "" : "s"}
                  </p>
                </div>
                <span className={waitStatusClass(group.oldestMinutes)}>
                  {waitLabel(group.oldestMinutes)}
                </span>
              </div>

              <div className="kitchen-card-grid">
                {group.items.map((item) => {
                  const minutes = waitMinutes(item.earliestSubmittedAt);
                  return (
                    <article
                      className="card kitchen-ticket"
                      key={item.menuItemId}
                    >
                      <div className="kitchen-ticket-head">
                        <div>
                          <span className="meta">{item.kitchenStation}</span>
                          <h3>{item.name}</h3>
                        </div>
                        <div className="kitchen-ticket-quantity">
                          <span className="meta">Qty</span>
                          <strong>{item.quantity}</strong>
                        </div>
                      </div>

                      <div className="kitchen-ticket-meta">
                        <span className={waitStatusClass(minutes)}>
                          {waitLabel(minutes)}
                        </span>
                        <span className="meta">
                          First sent {shortTime(item.earliestSubmittedAt)}
                        </span>
                      </div>

                      <div className="kitchen-table-list">
                        {item.tables.map((table) => (
                          <div
                            className="kitchen-table-chip"
                            key={table.tableId}
                          >
                            <strong>Table {table.tableNumber}</strong>
                            <span>
                              {table.quantity}x /{" "}
                              {formatWaitDuration(
                                waitMinutes(table.earliestSubmittedAt),
                              )}
                            </span>
                          </div>
                        ))}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </section>
      </main>
    </AuthGate>
  );
}
