"use client";

import { useEffect, useMemo, useState } from "react";
import type { PrintJob, PrintJobStatus, PrintJobsResponse } from "@qr2/shared";
import { apiFetch } from "../../../lib/api";
import {
  AuthGate,
  StaffSessionBar,
  useRequireRole,
} from "../../../lib/auth-client";

type TicketPayload = {
  order?: {
    items?: Array<{ name?: string; quantity?: number }>;
  };
};

function statusClass(status: PrintJobStatus) {
  if (status === "PRINTED") return "status ok";
  if (status === "FAILED") return "status urgent";
  if (status === "PENDING" || status === "PRINTING") return "status checkout";
  return "status";
}

function ticketItems(job: PrintJob) {
  const payload = job.payload as TicketPayload | null;
  return Array.isArray(payload?.order?.items) ? payload.order.items : [];
}

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleString() : "-";
}

export default function ManagePrintJobsPage() {
  const auth = useRequireRole(["DEV", "ADMIN"]);
  const [data, setData] = useState<PrintJobsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      setData(await apiFetch<PrintJobsResponse>("/v1/manage/print-jobs"));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function reprint(orderId: string) {
    setLoading(true);
    setError(null);
    try {
      await apiFetch(
        `/v1/manage/orders/${encodeURIComponent(orderId)}/reprint`,
        {
          method: "POST",
        },
      );
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setLoading(false);
    }
  }

  useEffect(() => {
    if (auth.user) void refresh();
  }, [auth.user]);

  const jobs = data?.jobs ?? [];
  const counts = useMemo(
    () => ({
      active: jobs.filter((job) => job.status !== "PRINTED").length,
      failed: jobs.filter((job) => job.status === "FAILED").length,
      printed: jobs.filter((job) => job.status === "PRINTED").length,
    }),
    [jobs],
  );

  return (
    <AuthGate state={auth}>
      <main className="page">
        <StaffSessionBar user={auth.user} />
        <section className="page-header">
          <div className="row between">
            <div>
              <h1>Print jobs</h1>
              <p>Review kitchen ticket delivery and create reprints.</p>
            </div>
            <button
              className="btn"
              onClick={() => void refresh()}
              disabled={loading}
            >
              Refresh
            </button>
          </div>
        </section>
        {error ? <div className="error card">{error}</div> : null}

        <section className="grid three">
          <div className="card">
            <h3>Active</h3>
            <strong>{counts.active}</strong>
          </div>
          <div className="card">
            <h3>Failed</h3>
            <strong>{counts.failed}</strong>
          </div>
          <div className="card">
            <h3>Printed</h3>
            <strong>{counts.printed}</strong>
          </div>
        </section>

        <section className="grid" style={{ marginTop: 16 }}>
          {jobs.map((job) => {
            const items = ticketItems(job);
            return (
              <article className="card print-job-card" key={job.id}>
                <div className="row between">
                  <div>
                    <h2>
                      {job.type} / Table {job.tableNumber ?? "-"}
                    </h2>
                    <p>Created {formatDate(job.createdAt)}</p>
                  </div>
                  <span className={statusClass(job.status)}>{job.status}</span>
                </div>
                <div className="print-job-meta">
                  <span>Attempts {job.attempts}</span>
                  <span>Printed {formatDate(job.printedAt)}</span>
                  <span>Failed {formatDate(job.failedAt)}</span>
                </div>
                {items.length > 0 ? (
                  <div className="list">
                    {items.map((item, index) => (
                      <div className="list-item row between" key={index}>
                        <span>{item.name ?? "Item"}</span>
                        <strong>x{item.quantity ?? 0}</strong>
                      </div>
                    ))}
                  </div>
                ) : null}
                <div className="row between">
                  <span className="meta">Order {job.orderId ?? "-"}</span>
                  {job.orderId ? (
                    <button
                      className="btn primary"
                      onClick={() => void reprint(job.orderId!)}
                      disabled={loading}
                    >
                      Reprint
                    </button>
                  ) : null}
                </div>
              </article>
            );
          })}
          {jobs.length === 0 ? (
            <div className="card">No print jobs yet.</div>
          ) : null}
        </section>
      </main>
    </AuthGate>
  );
}
