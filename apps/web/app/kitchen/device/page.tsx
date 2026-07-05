"use client";

import { useEffect, useMemo, useState } from "react";
import type { KdsDevicePendingResponse } from "@qr2/shared";
import { apiFetch } from "../../../lib/api";

type KitchenItem = KdsDevicePendingResponse["items"][number];

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

export default function KdsDevicePage() {
  const [token, setToken] = useState("");
  const [manualToken, setManualToken] = useState("");
  const [data, setData] = useState<KdsDevicePendingResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  function openManualToken() {
    const nextToken = manualToken.trim();
    if (!nextToken) return;
    window.location.href = `/kitchen/device?t=${encodeURIComponent(nextToken)}`;
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setToken(params.get("t")?.trim() ?? "");
  }, []);

  async function refresh() {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      await apiFetch("/v1/kds/heartbeat", {
        method: "POST",
        body: JSON.stringify({ token }),
      });
      const result = await apiFetch<KdsDevicePendingResponse>(
        `/v1/kds/pending-items?token=${encodeURIComponent(token)}`,
      );
      setData(result);
      setLastUpdated(new Date().toISOString());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!token) return;
    void refresh();
    const interval = window.setInterval(() => void refresh(), 15000);
    return () => window.clearInterval(interval);
  }, [token]);

  const stats = useMemo(() => {
    const allItems = data?.items ?? [];
    return {
      cards: allItems.length,
      quantity: allItems.reduce((sum, item) => sum + item.quantity, 0),
      urgent: allItems.filter(
        (item) => waitMinutes(item.earliestSubmittedAt) >= 15,
      ).length,
      oldestMinutes: allItems.reduce(
        (max, item) => Math.max(max, waitMinutes(item.earliestSubmittedAt)),
        0,
      ),
    };
  }, [data]);

  const sortedItems = useMemo<KitchenItem[]>(() => {
    return [...(data?.items ?? [])].sort((a, b) =>
      a.earliestSubmittedAt.localeCompare(b.earliestSubmittedAt),
    );
  }, [data]);

  if (!token) {
    return (
      <main className="page kitchen-page">
        <section className="page-header kitchen-header">
          <div>
            <h1>KDS device</h1>
            <p>Open a station board with a configured device token.</p>
          </div>
        </section>
        <section className="card grid">
          <label className="field">
            <span>Device token</span>
            <input
              className="input mono"
              value={manualToken}
              onChange={(event) => setManualToken(event.target.value)}
            />
          </label>
          <button
            className="btn primary"
            disabled={!manualToken.trim()}
            onClick={openManualToken}
          >
            Open device board
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="page kitchen-page">
      <section className="page-header kitchen-header">
        <div>
          <h1>{data?.device.name ?? "KDS device"}</h1>
          <p>
            {data?.store.name ?? "Restaurant"} /{" "}
            {data?.device.station ?? "All stations"}
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
          <span className="meta">Pending cards</span>
          <strong>{stats.cards}</strong>
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

      <section className="kitchen-board">
        {sortedItems.length === 0 ? (
          <div className="card kitchen-empty">
            <h2>No pending items</h2>
            <p>
              This device will refresh automatically when station work arrives.
            </p>
          </div>
        ) : null}

        <div className="kitchen-card-grid">
          {sortedItems.map((item) => {
            const minutes = waitMinutes(item.earliestSubmittedAt);
            return (
              <article className="card kitchen-ticket" key={item.menuItemId}>
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
                    <div className="kitchen-table-chip" key={table.tableId}>
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
    </main>
  );
}
