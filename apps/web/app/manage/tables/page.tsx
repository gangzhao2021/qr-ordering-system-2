"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
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

type TableFilter = "ALL" | "ACTIVE" | "INACTIVE";

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
  const [filter, setFilter] = useState<TableFilter>("ALL");
  const [selectedTableIds, setSelectedTableIds] = useState<
    Record<string, boolean>
  >({});
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setError(null);
    setCopyMessage(null);
    try {
      const result = await apiFetch<ManageTablesResponse>("/v1/manage/tables");
      setData(result);
      setDrafts(
        Object.fromEntries(
          result.tables.map((table) => [table.id, draftFromTable(table)]),
        ),
      );
      setSelectedTableIds((current) =>
        Object.fromEntries(
          result.tables.map((table) => [
            table.id,
            current[table.id] ?? table.isActive,
          ]),
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

  function setPrintSelection(tableId: string, selected: boolean) {
    setSelectedTableIds((current) => ({ ...current, [tableId]: selected }));
  }

  function selectActiveTables() {
    setSelectedTableIds(
      Object.fromEntries(
        (data?.tables ?? []).map((table) => [table.id, table.isActive]),
      ),
    );
  }

  function clearPrintSelection() {
    setSelectedTableIds(
      Object.fromEntries(
        (data?.tables ?? []).map((table) => [table.id, false]),
      ),
    );
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
    setCopyMessage(null);
    try {
      await navigator.clipboard.writeText(tableHref(table));
      setCopyMessage(`Copied link for table ${table.number}.`);
    } catch {
      setError("Could not copy link from this browser session");
    }
  }

  const tables = useMemo(() => data?.tables ?? [], [data?.tables]);
  const activeTables = useMemo(
    () => tables.filter((table) => table.isActive),
    [tables],
  );
  const inactiveTables = useMemo(
    () => tables.filter((table) => !table.isActive),
    [tables],
  );
  const selectedTables = useMemo(
    () => tables.filter((table) => selectedTableIds[table.id]),
    [selectedTableIds, tables],
  );
  const filteredTables = useMemo(() => {
    if (filter === "ACTIVE") return activeTables;
    if (filter === "INACTIVE") return inactiveTables;
    return tables;
  }, [activeTables, filter, inactiveTables, tables]);
  const printableTables = selectedTables.length > 0 ? selectedTables : [];

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
            <button
              className="btn primary"
              disabled={printableTables.length === 0}
              onClick={() => window.print()}
            >
              Print selected
            </button>
          </div>
        </section>
        {error ? <div className="error card no-print">{error}</div> : null}
        {copyMessage ? (
          <div className="success card no-print">{copyMessage}</div>
        ) : null}

        <section className="foh-metric-grid table-summary no-print">
          <article className="card metric-card">
            <span className="meta">Total tables</span>
            <strong>{tables.length}</strong>
          </article>
          <article className="card metric-card">
            <span className="meta">Active QR entries</span>
            <strong>{activeTables.length}</strong>
          </article>
          <article className="card metric-card">
            <span className="meta">Inactive tables</span>
            <strong>{inactiveTables.length}</strong>
          </article>
          <article className="card metric-card">
            <span className="meta">Cards selected</span>
            <strong>{selectedTables.length}</strong>
          </article>
        </section>

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
            <section className="card table-toolbar">
              <div className="row between">
                <div>
                  <h2>Table cards</h2>
                  <p>Select the cards that should print for the dining room.</p>
                </div>
                <div className="row">
                  {(["ALL", "ACTIVE", "INACTIVE"] as const).map((option) => (
                    <button
                      className={filter === option ? "btn primary" : "btn"}
                      key={option}
                      type="button"
                      aria-pressed={filter === option}
                      onClick={() => setFilter(option)}
                    >
                      {option === "ALL"
                        ? "All"
                        : option === "ACTIVE"
                          ? "Active"
                          : "Inactive"}
                    </button>
                  ))}
                </div>
              </div>
              <div className="row">
                <button
                  className="btn"
                  type="button"
                  onClick={selectActiveTables}
                >
                  Select active
                </button>
                <button
                  className="btn ghost"
                  type="button"
                  onClick={clearPrintSelection}
                >
                  Clear selection
                </button>
                <span className="meta">
                  {selectedTables.length} selected for print
                </span>
              </div>
            </section>

            {filteredTables.map((table) => {
              const draft = drafts[table.id] ?? draftFromTable(table);
              return (
                <article className="card table-editor" key={table.id}>
                  <div className="row between">
                    <div>
                      <h2>Table {table.number}</h2>
                      {table.name ? <p>{table.name}</p> : null}
                    </div>
                    <span className={table.isActive ? "status ok" : "status"}>
                      {table.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <label className="mini-check table-print-check">
                    <input
                      type="checkbox"
                      checked={Boolean(selectedTableIds[table.id])}
                      onChange={(event) =>
                        setPrintSelection(table.id, event.target.checked)
                      }
                    />
                    Print this table card
                  </label>
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
                    <span>Saved customer link</span>
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
                      type="button"
                      onClick={() => void saveTable(table)}
                    >
                      Save
                    </button>
                    <button
                      className="btn"
                      type="button"
                      onClick={() => void rotateQr(table)}
                    >
                      Rotate QR
                    </button>
                    <button
                      className="btn ghost"
                      type="button"
                      onClick={() => void copyLink(table)}
                    >
                      Copy link
                    </button>
                    <a className="link-btn ghost" href={tableHref(table)}>
                      Open
                    </a>
                    <button
                      className="btn ghost"
                      type="button"
                      onClick={() => void deleteTable(table)}
                    >
                      Delete unused
                    </button>
                  </div>
                </article>
              );
            })}
            {filteredTables.length === 0 ? (
              <article className="card">
                <h2>No tables match this filter</h2>
                <p>Switch filters or add a new table.</p>
              </article>
            ) : null}
          </div>
        </section>

        <section className="print-sheet">
          <h1>{data?.store.name ?? "Restaurant"} Table Cards</h1>
          <div className="print-grid">
            {printableTables.map((table) => (
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
