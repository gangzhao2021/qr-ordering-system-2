"use client";

import { FormEvent, useEffect, useState } from "react";
import type { LoginResponse, MeResponse, StaffRole } from "@qr2/shared";
import { apiFetch } from "../../lib/api";

const demoAccounts: Array<{ email: string; role: StaffRole }> = [
  { email: "foh@local", role: "FOH" },
  { email: "kitchen@local", role: "KITCHEN" },
  { email: "admin@local", role: "ADMIN" },
  { email: "dev@local", role: "DEV" },
];

function defaultTarget(role: StaffRole) {
  if (role === "KITCHEN") return "/kitchen";
  if (role === "FOH") return "/foh";
  if (role === "PRINTER") return "/login";
  return "/manage";
}

export default function LoginPage() {
  const [email, setEmail] = useState("foh@local");
  const [password, setPassword] = useState("devpass");
  const [next, setNext] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setNext(params.get("next") ?? "");

    apiFetch<MeResponse>("/v1/auth/me")
      .then((response) => {
        if (response.user) {
          setMessage(`Signed in as ${response.user.email}.`);
        }
      })
      .catch(() => undefined);
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setMessage(null);
    try {
      const result = await apiFetch<LoginResponse>("/v1/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      window.location.href = next || defaultTarget(result.user.role);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="page auth-page">
      <section className="page-header">
        <h1>Staff login</h1>
        <p>Use a role account for FOH, kitchen, and management workspaces.</p>
      </section>

      <section className="grid two">
        <form
          className="card grid auth-card"
          onSubmit={(event) => void submit(event)}
        >
          <label className="field">
            <span>Email</span>
            <input
              className="input"
              value={email}
              autoComplete="username"
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label className="field">
            <span>Password</span>
            <input
              className="input"
              type="password"
              value={password}
              autoComplete="current-password"
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          <button className="btn primary" disabled={submitting}>
            {submitting ? "Signing in" : "Sign in"}
          </button>
          {message ? <div className="status">{message}</div> : null}
        </form>

        <aside className="card grid">
          <h2>Demo accounts</h2>
          <p>Password: devpass</p>
          <div className="list">
            {demoAccounts.map((account) => (
              <button
                className="btn"
                key={account.email}
                onClick={() => {
                  setEmail(account.email);
                  setPassword("devpass");
                }}
              >
                {account.email} · {account.role}
              </button>
            ))}
          </div>
        </aside>
      </section>
    </main>
  );
}
