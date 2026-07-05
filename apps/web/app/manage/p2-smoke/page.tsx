"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type {
  P0SmokeCheck,
  P0SmokeStatus,
  P2SmokeCockpitResponse,
} from "@qr2/shared";
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

export default function P2SmokeCockpitPage() {
  const auth = useRequireRole(["DEV", "ADMIN"]);
  const [data, setData] = useState<P2SmokeCockpitResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setError(null);
    try {
      setData(await apiFetch<P2SmokeCockpitResponse>("/v1/manage/p2-smoke"));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  useEffect(() => {
    if (auth.user) void refresh();
  }, [auth.user]);

  return (
    <AuthGate state={auth}>
      <main className="page smoke-page">
        <StaffSessionBar user={auth.user} />
        <section className="page-header">
          <div className="row between">
            <div>
              <h1>P2 smoke cockpit</h1>
              <p>
                Platform readiness for multi-store onboarding, store switching,
                KDS devices, reporting, and audit traceability.
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
            <span className="meta">Stores</span>
            <strong>{data?.summary.stores ?? 0}</strong>
          </article>
          <article className="card metric-card">
            <span className="meta">Managers</span>
            <strong>{data?.summary.activeManagers ?? 0}</strong>
          </article>
          <article className="card metric-card">
            <span className="meta">Manager coverage</span>
            <strong>{data?.summary.storesWithManagers ?? 0}</strong>
          </article>
          <article className="card metric-card">
            <span className="meta">Table setup</span>
            <strong>{data?.summary.storesWithTables ?? 0}</strong>
          </article>
          <article className="card metric-card">
            <span className="meta">Menu setup</span>
            <strong>{data?.summary.storesWithMenuItems ?? 0}</strong>
          </article>
          <article className="card metric-card">
            <span className="meta">KDS devices</span>
            <strong>{data?.summary.activeKdsDevices ?? 0}</strong>
          </article>
          <article className="card metric-card">
            <span className="meta">KDS online</span>
            <strong>{data?.summary.onlineKdsDevices ?? 0}</strong>
          </article>
          <article className="card metric-card">
            <span className="meta">KDS stations</span>
            <strong>{data?.summary.kdsStations ?? 0}</strong>
          </article>
          <article className="card metric-card">
            <span className="meta">Report payments</span>
            <strong>{data?.summary.reportingPayments ?? 0}</strong>
          </article>
          <article className="card metric-card">
            <span className="meta">Audit entries</span>
            <strong>{data?.summary.reportingAuditLogs ?? 0}</strong>
          </article>
          <article className="card metric-card">
            <span className="meta">Low stock</span>
            <strong>{data?.summary.reportingLowStockItems ?? 0}</strong>
          </article>
        </section>

        <section className="grid two smoke-main">
          <article className="card smoke-routes">
            <h2>Run these commands</h2>
            <div className="list">
              {(data?.commands ?? []).map((entry) => (
                <div className="list-item" key={entry.command}>
                  <strong>{entry.label}</strong>
                  <code>{entry.command}</code>
                  <span className="meta">{entry.coverage}</span>
                </div>
              ))}
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
          {(data?.modules ?? []).map((module) => (
            <article className="card smoke-stage" key={module.id}>
              <h2>{module.title}</h2>
              <div className="list">
                {module.checks.map((check) => (
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
