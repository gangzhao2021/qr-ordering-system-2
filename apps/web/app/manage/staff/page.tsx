"use client";

import { FormEvent, useEffect, useState } from "react";
import type {
  ManageStaffResponse,
  ManageStaffUser,
  StaffRole,
} from "@qr2/shared";
import { STAFF_ROLES } from "@qr2/shared";
import { apiFetch } from "../../../lib/api";
import {
  AuthGate,
  StaffSessionBar,
  useRequireRole,
} from "../../../lib/auth-client";

type StaffDraft = {
  email: string;
  name: string;
  role: StaffRole;
  isActive: boolean;
  password: string;
};

function draftFromUser(user: ManageStaffUser): StaffDraft {
  return {
    email: user.email,
    name: user.name ?? "",
    role: user.role,
    isActive: user.isActive,
    password: "",
  };
}

export default function ManageStaffPage() {
  const auth = useRequireRole(["DEV", "ADMIN"]);
  const [data, setData] = useState<ManageStaffResponse | null>(null);
  const [drafts, setDrafts] = useState<Record<string, StaffDraft>>({});
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<StaffRole>("FOH");
  const [password, setPassword] = useState("devpass");
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setError(null);
    try {
      const result = await apiFetch<ManageStaffResponse>("/v1/manage/staff");
      setData(result);
      setDrafts(
        Object.fromEntries(
          result.users.map((user) => [user.id, draftFromUser(user)]),
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  useEffect(() => {
    if (auth.user) void refresh();
  }, [auth.user]);

  function updateDraft(userId: string, patch: Partial<StaffDraft>) {
    setDrafts((current) => {
      const existing = current[userId] ?? {
        email: "",
        name: "",
        role: "FOH" as StaffRole,
        isActive: true,
        password: "",
      };
      return {
        ...current,
        [userId]: { ...existing, ...patch },
      };
    });
  }

  async function createUser(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await apiFetch("/v1/manage/staff", {
        method: "POST",
        body: JSON.stringify({
          email,
          name: name.trim() || null,
          role,
          password,
        }),
      });
      setEmail("");
      setName("");
      setRole("FOH");
      setPassword("devpass");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function saveUser(user: ManageStaffUser) {
    const draft = drafts[user.id] ?? draftFromUser(user);
    setError(null);
    try {
      await apiFetch(`/v1/manage/staff/${user.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          email: draft.email,
          name: draft.name.trim() || null,
          role: draft.role,
          isActive: draft.isActive,
          ...(draft.password.trim() ? { password: draft.password } : {}),
        }),
      });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  const users = data?.users ?? [];

  return (
    <AuthGate state={auth}>
      <main className="page">
        <StaffSessionBar user={auth.user} />
        <section className="page-header">
          <h1>Staff management</h1>
          <p>
            Create staff accounts, assign roles, deactivate access, and reset
            passwords.
          </p>
        </section>
        {error ? <div className="error card">{error}</div> : null}

        <section className="grid two">
          <form
            className="card grid"
            onSubmit={(event) => void createUser(event)}
          >
            <h2>Add staff</h2>
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
              <span>Name</span>
              <input
                className="input"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
            <div className="grid two">
              <label className="field">
                <span>Role</span>
                <select
                  className="select"
                  value={role}
                  onChange={(event) => setRole(event.target.value as StaffRole)}
                >
                  {STAFF_ROLES.map((option) => (
                    <option value={option} key={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Password</span>
                <input
                  className="input"
                  type="password"
                  value={password}
                  autoComplete="new-password"
                  onChange={(event) => setPassword(event.target.value)}
                />
              </label>
            </div>
            <button
              className="btn primary"
              disabled={!email.trim() || password.length < 6}
            >
              Create staff
            </button>
          </form>

          <div className="grid">
            {users.map((user) => {
              const draft = drafts[user.id] ?? draftFromUser(user);
              return (
                <form
                  className="card staff-editor"
                  key={user.id}
                  onSubmit={(event) => {
                    event.preventDefault();
                    void saveUser(user);
                  }}
                >
                  <div className="row between">
                    <div>
                      <h2>{user.name || user.email}</h2>
                      <p>{user.email}</p>
                    </div>
                    <span
                      className={user.isActive ? "status ok" : "status urgent"}
                    >
                      {user.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <div className="staff-controls">
                    <label className="field">
                      <span>Email</span>
                      <input
                        className="input"
                        value={draft.email}
                        autoComplete="username"
                        onChange={(event) =>
                          updateDraft(user.id, { email: event.target.value })
                        }
                      />
                    </label>
                    <label className="field">
                      <span>Name</span>
                      <input
                        className="input"
                        value={draft.name}
                        onChange={(event) =>
                          updateDraft(user.id, { name: event.target.value })
                        }
                      />
                    </label>
                    <label className="field">
                      <span>Role</span>
                      <select
                        className="select"
                        value={draft.role}
                        onChange={(event) =>
                          updateDraft(user.id, {
                            role: event.target.value as StaffRole,
                          })
                        }
                      >
                        {STAFF_ROLES.map((option) => (
                          <option value={option} key={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="field checkbox-field">
                      <span>Active</span>
                      <input
                        type="checkbox"
                        checked={draft.isActive}
                        onChange={(event) =>
                          updateDraft(user.id, {
                            isActive: event.target.checked,
                          })
                        }
                      />
                    </label>
                  </div>
                  <div className="staff-password-row">
                    <label className="field">
                      <span>Reset password</span>
                      <input
                        className="input"
                        type="password"
                        value={draft.password}
                        placeholder="Leave blank to keep current password"
                        autoComplete="new-password"
                        onChange={(event) =>
                          updateDraft(user.id, {
                            password: event.target.value,
                          })
                        }
                      />
                    </label>
                    <button
                      className="btn primary"
                      type="submit"
                      disabled={!draft.email.trim()}
                    >
                      Save staff
                    </button>
                  </div>
                  <div className="meta">
                    Created {new Date(user.createdAt).toLocaleString()} /
                    Updated {new Date(user.updatedAt).toLocaleString()}
                  </div>
                </form>
              );
            })}
          </div>
        </section>
      </main>
    </AuthGate>
  );
}
