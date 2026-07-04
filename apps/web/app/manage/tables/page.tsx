"use client";

import { FormEvent, useEffect, useState } from "react";
import type { DiningTable, ManageTablesResponse } from "@qr2/shared";
import { QrCode } from "../../../components/QrCode";
import { apiFetch } from "../../../lib/api";
import {
  AuthGate,
  StaffSessionBar,
  useRequireRole,
} from "../../../lib/auth-client";

type TableDraft = {
  number: string;
  name: string;
  qrToken: string;
  isActive: boolean;
};

function draftFromTable(table: DiningTable): TableDraft {
  return {
    number: table.number,
    name: table.name ?? "",
    qrToken: table.qrToken,
    isActive: table.isActive,
  };
}

export default function ManageTablesPage() {
  const auth = useRequireRole(["DEV", "ADMIN"]);
  const [data, setData] = useState<ManageTablesResponse | null>(null);
  const [drafts, setDrafts] = useState<Record<string, TableDraft>>({});
  const [origin, setOrigin] = useState("http://127.0.0.1:3000");
  const [number, setNumber] = useState("");
  const [name, setName] = useState("");
  const [qrToken, setQrToken] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setError(null);
    try {
      const result = await apiFetch<ManageTablesResponse>("/v1/manage/tables");
      setData(result);
      setDrafts(
        Object.fromEntries(
          result.tables.map((table) => [table.id, draftFromTable(table)]),
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  useEffect(() => {
    if (!auth.user) return;
    setOrigin(window.location.origin);
    void refresh();
  }, [auth.user]);

  function tableHref(table: DiningTable) {
    return `${origin}/c?t=${encodeURIComponent(table.qrToken)}`;
  }

  function updateDraft(tableId: string, patch: Partial<TableDraft>) {
    setDrafts((current) => {
      const existing = current[tableId] ?? {
        number: "",
        name: "",
        qrToken: "",
        isActive: true,
      };
      return {
        ...current,
        [tableId]: { ...existing, ...patch },
      };
    });
  }

  async function createTable(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await apiFetch("/v1/manage/tables", {
        method: "POST",
        body: JSON.stringify({
          number,
          name: name.trim() || null,
          ...(qrToken.trim() ? { qrToken } : {}),
        }),
      });
      setNumber("");
      setName("");
      setQrToken("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function saveTable(table: DiningTable) {
    const draft = drafts[table.id] ?? draftFromTable(table);
    setError(null);
    try {
      await apiFetch(`/v1/manage/tables/${table.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          number: draft.number,
          name: draft.name.trim() || null,
          qrToken: draft.qrToken,
          isActive: draft.isActive,
        }),
      });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function rotateQr(table: DiningTable) {
    if (!window.confirm(`Rotate QR token for table ${table.number}?`)) return;
    setError(null);
    try {
      await apiFetch(`/v1/manage/tables/${table.id}/rotate-qr`, {
        method: "POST",
      });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function deleteTable(table: DiningTable) {
    if (!window.confirm(`Delete unused table ${table.number}?`)) return;
    setError(null);
    try {
      await apiFetch(`/v1/manage/tables/${table.id}`, { method: "DELETE" });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function copyLink(table: DiningTable) {
    setError(null);
    try {
      await navigator.clipboard.writeText(tableHref(table));
    } catch {
      setError("Could not copy link from this browser session");
    }
  }

  return (
    <AuthGate state={auth}>
      <main className="page">
        <StaffSessionBar user={auth.user} />
        <section className="page-header no-print">
          <div className="row between">
            <div>
              <h1>Tables and QR</h1>
              <p>
                Manage table tokens, active status, and printable table cards.
              </p>
            </div>
            <button className="btn primary" onClick={() => window.print()}>
              Print cards
            </button>
          </div>
        </section>
        {error ? <div className="error card no-print">{error}</div> : null}

        <section className="grid two no-print table-management">
          <form
            className="card grid"
            onSubmit={(event) => void createTable(event)}
          >
            <h2>Add table</h2>
            <label className="field">
              <span>Table number</span>
              <input
                className="input"
                value={number}
                onChange={(event) => setNumber(event.target.value)}
              />
            </label>
            <label className="field">
              <span>Name</span>
              <input
                className="input"
                value={name}
                placeholder="Patio, bar, booth"
                onChange={(event) => setName(event.target.value)}
              />
            </label>
            <label className="field">
              <span>QR token</span>
              <input
                className="input"
                value={qrToken}
                placeholder="Auto-generated"
                onChange={(event) => setQrToken(event.target.value)}
              />
            </label>
            <button className="btn primary" disabled={!number.trim()}>
              Create table
            </button>
          </form>

          <div className="grid">
            {(data?.tables ?? []).map((table) => {
              const draft = drafts[table.id] ?? draftFromTable(table);
              return (
                <article className="card table-editor" key={table.id}>
                  <div className="row between">
                    <h2>Table {table.number}</h2>
                    <span className={table.isActive ? "status ok" : "status"}>
                      {table.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <div className="table-controls">
                    <label className="field">
                      <span>Number</span>
                      <input
                        className="input"
                        value={draft.number}
                        onChange={(event) =>
                          updateDraft(table.id, { number: event.target.value })
                        }
                      />
                    </label>
                    <label className="field">
                      <span>Name</span>
                      <input
                        className="input"
                        value={draft.name}
                        onChange={(event) =>
                          updateDraft(table.id, { name: event.target.value })
                        }
                      />
                    </label>
                    <label className="field checkbox-field">
                      <span>Active</span>
                      <input
                        type="checkbox"
                        checked={draft.isActive}
                        onChange={(event) =>
                          updateDraft(table.id, {
                            isActive: event.target.checked,
                          })
                        }
                      />
                    </label>
                  </div>
                  <label className="field">
                    <span>QR token</span>
                    <input
                      className="input"
                      value={draft.qrToken}
                      onChange={(event) =>
                        updateDraft(table.id, { qrToken: event.target.value })
                      }
                    />
                  </label>
                  <div className="token-row">
                    <code>{tableHref(table)}</code>
                  </div>
                  <div className="qr-preview">
                    <QrCode
                      text={tableHref(table)}
                      size={132}
                      label={`Customer QR for table ${table.number}`}
                      downloadName={`table-${table.number}-qr.svg`}
                    />
                    <div>
                      <strong>Scan target</strong>
                      <p>{tableHref(table)}</p>
                    </div>
                  </div>
                  <div className="row">
                    <button
                      className="btn primary"
                      onClick={() => void saveTable(table)}
                    >
                      Save
                    </button>
                    <button
                      className="btn"
                      onClick={() => void rotateQr(table)}
                    >
                      Rotate QR
                    </button>
                    <button
                      className="btn ghost"
                      onClick={() => void copyLink(table)}
                    >
                      Copy link
                    </button>
                    <a className="link-btn ghost" href={tableHref(table)}>
                      Open
                    </a>
                    <button
                      className="btn ghost"
                      onClick={() => void deleteTable(table)}
                    >
                      Delete unused
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section className="print-sheet">
          <h1>{data?.store.name ?? "Restaurant"} Table Cards</h1>
          <div className="print-grid">
            {(data?.tables ?? []).map((table) => (
              <article className="print-card" key={table.id}>
                <div>
                  <span className="meta">Dine-in ordering</span>
                  <h2>Table {table.number}</h2>
                  {table.name ? <p>{table.name}</p> : null}
                </div>
                <div className="print-token">
                  <span>Scan to order</span>
                  <QrCode
                    text={tableHref(table)}
                    size={176}
                    label={`Customer QR for table ${table.number}`}
                  />
                </div>
                <strong className="print-qr-token">{table.qrToken}</strong>
                <code className="print-url">{tableHref(table)}</code>
                <span className={table.isActive ? "status ok" : "status"}>
                  {table.isActive ? "Active" : "Inactive"}
                </span>
              </article>
            ))}
          </div>
        </section>
      </main>
    </AuthGate>
  );
}
