"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import type { AuthUser, MeResponse, StaffRole } from "@qr2/shared";
import { apiFetch, isUnauthorized } from "./api";

type AuthState = {
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
};

function loginUrl() {
  const next = `${window.location.pathname}${window.location.search}`;
  return `/login?next=${encodeURIComponent(next)}`;
}

export function useRequireRole(roles: readonly StaffRole[]): AuthState {
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
    error: null,
  });
  const roleKey = roles.join("|");

  useEffect(() => {
    let cancelled = false;
    const allowedRoles = roleKey.split("|") as StaffRole[];
    setState({ user: null, loading: true, error: null });

    apiFetch<MeResponse>("/v1/auth/me")
      .then((response) => {
        if (cancelled) return;
        if (!response.user) {
          window.location.href = loginUrl();
          return;
        }
        if (!allowedRoles.includes(response.user.role)) {
          setState({
            user: response.user,
            loading: false,
            error: "This account does not have access to this workspace.",
          });
          return;
        }
        setState({ user: response.user, loading: false, error: null });
      })
      .catch((error) => {
        if (cancelled) return;
        if (isUnauthorized(error)) {
          window.location.href = loginUrl();
          return;
        }
        setState({
          user: null,
          loading: false,
          error: error instanceof Error ? error.message : String(error),
        });
      });

    return () => {
      cancelled = true;
    };
  }, [roleKey]);

  return state;
}

export function AuthGate({
  state,
  children,
}: {
  state: AuthState;
  children?: ReactNode;
}) {
  if (state.loading) {
    return (
      <main className="page">
        <section className="page-header">
          <h1>Checking access</h1>
          <p>Loading your staff session.</p>
        </section>
      </main>
    );
  }

  if (state.error) {
    return (
      <main className="page">
        <section className="page-header">
          <h1>Access denied</h1>
          <p>{state.error}</p>
        </section>
        <a className="link-btn primary" href="/login">
          Switch account
        </a>
      </main>
    );
  }

  return <>{children}</>;
}

export function StaffSessionBar({ user }: { user: AuthUser | null }) {
  if (!user) return null;

  async function logout() {
    await apiFetch("/v1/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <div className="session-bar">
      <span>
        {user.email} · {user.role}
      </span>
      <button className="btn ghost" onClick={() => void logout()}>
        Log out
      </button>
    </div>
  );
}
