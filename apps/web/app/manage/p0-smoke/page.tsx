"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type {
  P0SmokeCheck,
  P0SmokeCockpitResponse,
  P0SmokeStatus,
} from "@qr2/shared";
import { formatCents } from "@qr2/shared";
import { apiFetch } from "../../../lib/api";
import {
  AuthGate,
  StaffSessionBar,
  useRequireRole,
} from "../../../lib/auth-client";

function statusClass(status: P0SmokeStatus) {
  if (status === "READY") return "status ok";
  if (status === "WATCH") return "status checkout";
  return "status urgent";
}

function statusLabel(status: P0SmokeStatus) {
  if (status === "READY") return "Ready";
  if (status === "WATCH") return "Watch";
  return "Needs setup";
}

function SmokeCheckRow({ check }: { check: P0SmokeCheck }) {
  return (
    <div className="smoke-check-row">
      <div>
        <div className="row">
          <strong>{check.label}</strong>
          <span className={statusClass(check.status)}>
            {statusLabel(check.status)}
          </span>
        </div>
        <p>{check.detail}</p>
      </div>
      {check.href ? (
        <Link className="link-btn ghost" href={check.href}>
          Open
        </Link>
      ) : null}
    </div>
  );
}

export default function P0SmokeCockpitPage() {
  const auth = useRequireRole(["DEV", "ADMIN"]);
  const [data, setData] = useState<P0SmokeCockpitResponse | null>(null);
  const [origin, setOrigin] = useState("http://127.0.0.1:3000");
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setError(null);
    try {
      setData(await apiFetch<P0SmokeCockpitResponse>("/v1/manage/p0-smoke"));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  useEffect(() => {
    if (!auth.user) return;
    setOrigin(window.location.origin);
    void refresh();
  }, [auth.user]);

  const customerHref = useMemo(() => {
    if (!data?.demo.customerPath) return "/c";
    return `${origin}${data.demo.customerPath}`;
  }, [data?.demo.customerPath, origin]);

  return (
    <AuthGate state={auth}>
      <main className="page smoke-page">
        <StaffSessionBar user={auth.user} />
        <section className="page-header">
          <div className="row between">
            <div>
              <h1>P0 smoke cockpit</h1>
              <p>
                Readiness for customer QR ordering, FOH, kitchen, printer, and
                management.
              </p>
            </div>
            <button className="btn primary" onClick={() => void refresh()}>
              Refresh
            </button>
          </div>
        </section>
        {error ? <div className="error card">{error}</div> : null}

        <section className="card smoke-hero">
          <div>
            <span className="meta">Overall status</span>
            <h2>{statusLabel(data?.overallStatus ?? "WATCH")}</h2>
            <p>
              {data?.store.name ?? "Restaurant"} -{" "}
              {data
                ? new Date(data.generatedAt).toLocaleString()
                : "Waiting for data"}
            </p>
          </div>
          <span className={statusClass(data?.overallStatus ?? "WATCH")}>
            {statusLabel(data?.overallStatus ?? "WATCH")}
          </span>
        </section>

        <section className="foh-metric-grid smoke-summary">
          <article className="card metric-card">
            <span className="meta">Active tables</span>
            <strong>{data?.summary.activeTables ?? 0}</strong>
          </article>
          <article className="card metric-card">
            <span className="meta">Available items</span>
            <strong>{data?.summary.availableItems ?? 0}</strong>
          </article>
          <article className="card metric-card">
            <span className="meta">Open tables</span>
            <strong>{data?.summary.openTables ?? 0}</strong>
          </article>
          <article className="card metric-card">
            <span className="meta">Kitchen pending</span>
            <strong>{data?.summary.pendingKitchenItems ?? 0}</strong>
          </article>
          <article className="card metric-card">
            <span className="meta">Service requests</span>
            <strong>{data?.summary.pendingServiceRequests ?? 0}</strong>
          </article>
          <article className="card metric-card">
            <span className="meta">Print pending</span>
            <strong>{data?.summary.pendingPrintJobs ?? 0}</strong>
          </article>
          <article className="card metric-card">
            <span className="meta">Print failed</span>
            <strong>{data?.summary.failedPrintJobs ?? 0}</strong>
          </article>
          <article className="card metric-card">
            <span className="meta">7d payments</span>
            <strong>{data?.summary.recentPayments ?? 0}</strong>
          </article>
        </section>

        <section className="grid two smoke-main">
          <article className="card smoke-demo">
            <h2>Demo path</h2>
            <div className="list">
              <div className="list-item row between">
                <span>Table</span>
                <strong>{data?.demo.table?.number ?? "None"}</strong>
              </div>
              <div className="list-item row between">
                <span>Item</span>
                <strong>
                  {data?.demo.item
                    ? `${data.demo.item.name} - ${formatCents(
                        data.demo.item.priceCents,
                        data.store.currency,
                        data.store.locale,
                      )}`
                    : "None"}
                </strong>
              </div>
              <div className="token-row">
                <span>Customer entry</span>
                <code>{customerHref}</code>
              </div>
              <div className="row">
                <Link
                  className="link-btn primary"
                  href={data?.demo.customerPath ?? "/c"}
                >
                  Open customer
                </Link>
                <Link className="link-btn ghost" href="/foh">
                  Open FOH
                </Link>
                <Link className="link-btn ghost" href="/kitchen">
                  Open kitchen
                </Link>
              </div>
            </div>
          </article>

          <article className="card smoke-routes">
            <h2>Workspaces</h2>
            <div className="smoke-route-grid">
              {(data?.routes ?? []).map((route) => (
                <Link
                  className="link-btn ghost"
                  href={route.href}
                  key={route.href}
                >
                  {route.label}
                  <span>{route.role}</span>
                </Link>
              ))}
            </div>
          </article>
        </section>

        <section className="grid two smoke-stage-grid">
          {(data?.stages ?? []).map((stage) => (
            <article className="card smoke-stage" key={stage.id}>
              <h2>{stage.title}</h2>
              <div className="list">
                {stage.checks.map((check) => (
                  <SmokeCheckRow check={check} key={check.id} />
                ))}
              </div>
            </article>
          ))}
        </section>
      </main>
    </AuthGate>
  );
}
