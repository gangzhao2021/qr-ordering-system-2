"use client";

import { useEffect, useMemo, useState } from "react";
import type { AuditLog, ManageAuditLogsResponse } from "@qr2/shared";
import { apiFetch } from "../../../lib/api";
import {
  AuthGate,
  StaffSessionBar,
  useRequireRole,
} from "../../../lib/auth-client";

function formatDateTime(value?: string | null) {
  return value ? new Date(value).toLocaleString() : "n/a";
}

function metadataPreview(log: AuditLog) {
  const entries = Object.entries(log.metadata ?? {});
  if (entries.length === 0) return null;
  return entries
    .slice(0, 5)
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join(" / ");
}

export default function ManageAuditPage() {
  const auth = useRequireRole(["DEV", "ADMIN"]);
  const [days, setDays] = useState("7");
  const [action, setAction] = useState("");
  const [entityType, setEntityType] = useState("");
  const [actorEmail, setActorEmail] = useState("");
  const [data, setData] = useState<ManageAuditLogsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const query = useMemo(() => {
    const params = new URLSearchParams({ days, limit: "100" });
    if (action) params.set("action", action);
    if (entityType) params.set("entityType", entityType);
    if (actorEmail) params.set("actorEmail", actorEmail);
    return params.toString();
  }, [days, action, entityType, actorEmail]);

  async function refresh() {
    setError(null);
    try {
      setData(
        await apiFetch<ManageAuditLogsResponse>(
          `/v1/manage/audit-logs?${query}`,
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  useEffect(() => {
    if (auth.user) void refresh();
  }, [auth.user, query]);

  return (
    <AuthGate state={auth}>
      <main className="page">
        <StaffSessionBar user={auth.user} />
        <section className="page-header">
          <div className="row between">
            <div>
              <h1>Audit log</h1>
              <p>
                Trace management, platform, inventory, checkout, refund, KDS,
                and feedback changes for the current store.
              </p>
            </div>
            <button className="btn primary" onClick={() => void refresh()}>
              Refresh
            </button>
          </div>
        </section>
        {error ? <div className="error card">{error}</div> : null}

        <section className="grid three">
          <article className="card metric-card">
            <span className="meta">Entries</span>
            <strong>{data?.summary.auditLogCount ?? 0}</strong>
          </article>
          <article className="card metric-card">
            <span className="meta">Actors</span>
            <strong>{data?.summary.actorCount ?? 0}</strong>
          </article>
          <article className="card metric-card">
            <span className="meta">Entity types</span>
            <strong>{data?.summary.entityTypeCount ?? 0}</strong>
          </article>
        </section>

        <section className="card grid" style={{ marginTop: 16 }}>
          <div className="operations-record-grid">
            <label className="field">
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
            <label className="field">
              <span>Action</span>
              <select
                className="select"
                value={action}
                onChange={(event) => setAction(event.target.value)}
              >
                <option value="">All actions</option>
                {(data?.actions ?? []).map((row) => (
                  <option value={row.value} key={row.value}>
                    {row.value} ({row.count})
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Entity</span>
              <select
                className="select"
                value={entityType}
                onChange={(event) => setEntityType(event.target.value)}
              >
                <option value="">All entities</option>
                {(data?.entityTypes ?? []).map((row) => (
                  <option value={row.value} key={row.value}>
                    {row.value} ({row.count})
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Actor</span>
              <select
                className="select"
                value={actorEmail}
                onChange={(event) => setActorEmail(event.target.value)}
              >
                <option value="">All actors</option>
                {(data?.actors ?? []).map((row) => (
                  <option value={row.value} key={row.value}>
                    {row.value} ({row.count})
                  </option>
                ))}
              </select>
            </label>
          </div>
          <span className="meta">
            Latest matching entry {formatDateTime(data?.summary.lastAuditAt)}.
          </span>
        </section>

        <section className="grid two" style={{ marginTop: 16 }}>
          <article className="card grid">
            <h2>Action mix</h2>
            <div className="list compact-list">
              {(data?.actions ?? []).slice(0, 12).map((row) => (
                <div className="list-item row between" key={row.value}>
                  <span>{row.value}</span>
                  <strong>{row.count}</strong>
                </div>
              ))}
            </div>
          </article>

          <article className="card grid">
            <h2>Entity mix</h2>
            <div className="list compact-list">
              {(data?.entityTypes ?? []).slice(0, 12).map((row) => (
                <div className="list-item row between" key={row.value}>
                  <span>{row.value}</span>
                  <strong>{row.count}</strong>
                </div>
              ))}
            </div>
          </article>

          <article className="card grid analytics-wide">
            <h2>Matching entries</h2>
            <div className="list">
              {(data?.logs ?? []).map((entry) => {
                const metadata = metadataPreview(entry);
                return (
                  <div className="operations-record-card" key={entry.id}>
                    <div className="row between">
                      <strong>{entry.action}</strong>
                      <span className="status">{entry.entityType}</span>
                    </div>
                    <span className="meta">
                      {entry.actorEmail ?? "System"} /{" "}
                      {formatDateTime(entry.createdAt)}
                    </span>
                    {entry.entityId ? (
                      <code className="mono">{entry.entityId}</code>
                    ) : null}
                    {metadata ? <span className="meta">{metadata}</span> : null}
                  </div>
                );
              })}
              {(data?.logs ?? []).length === 0 ? (
                <span className="meta">
                  No audit entries match these filters.
                </span>
              ) : null}
            </div>
          </article>
        </section>
      </main>
    </AuthGate>
  );
}
