"use client";

import { useEffect, useState } from "react";
import type { KitchenPendingResponse } from "@qr2/shared";
import { apiFetch } from "../../lib/api";
import {
  AuthGate,
  StaffSessionBar,
  useRequireRole,
} from "../../lib/auth-client";

function waitMinutes(iso: string) {
  return Math.max(
    0,
    Math.floor((Date.now() - new Date(iso).getTime()) / 60000),
  );
}

export default function KitchenPage() {
  const auth = useRequireRole(["DEV", "ADMIN", "KITCHEN"]);
  const [data, setData] = useState<KitchenPendingResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setError(null);
    try {
      setData(
        await apiFetch<KitchenPendingResponse>("/v1/kitchen/pending-items"),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  useEffect(() => {
    if (!auth.user) return;
    void refresh();
    const interval = window.setInterval(() => void refresh(), 15000);
    return () => window.clearInterval(interval);
  }, [auth.user]);

  return (
    <AuthGate state={auth}>
      <main className="page">
        <StaffSessionBar user={auth.user} />
        <section className="page-header">
          <h1>Kitchen display</h1>
          <p>
            Read-only board. Kitchen can see pressure and wait time but cannot
            change live order state.
          </p>
        </section>
        <div className="row">
          <button className="btn" onClick={() => void refresh()}>
            Refresh
          </button>
          {error ? <span className="error status">{error}</span> : null}
        </div>
        <section className="grid" style={{ marginTop: 16 }}>
          {(data?.items ?? []).length === 0 ? (
            <div className="card">
              <p>No pending items.</p>
            </div>
          ) : null}
          {(data?.items ?? []).map((item) => {
            const minutes = waitMinutes(item.earliestSubmittedAt);
            const urgent = minutes >= 15;
            return (
              <article className="card row between" key={item.menuItemId}>
                <div>
                  <h2>{item.name}</h2>
                  <p>{item.quantity} pending</p>
                </div>
                <span className={urgent ? "status urgent" : "status ok"}>
                  {minutes} min
                </span>
              </article>
            );
          })}
        </section>
      </main>
    </AuthGate>
  );
}
