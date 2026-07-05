"use client";

import { FormEvent, useEffect, useState } from "react";
import type {
  CreatePlatformStoreRequest,
  PlatformOverviewResponse,
  StoreMarket,
} from "@qr2/shared";
import { STORE_MARKETS } from "@qr2/shared";
import { apiFetch } from "../../../lib/api";
import {
  AuthGate,
  StaffSessionBar,
  useRequireRole,
} from "../../../lib/auth-client";

type FormState = {
  name: string;
  market: StoreMarket;
  region: string;
  adminEmail: string;
  adminPassword: string;
  adminName: string;
  tableCount: string;
};

const emptyForm: FormState = {
  name: "",
  market: "CANADA",
  region: "ON",
  adminEmail: "",
  adminPassword: "devpass",
  adminName: "Store Admin",
  tableCount: "4",
};

function localSelectedStoreId() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem("qr2_selected_store_id") ?? "";
}

export default function PlatformPage() {
  const auth = useRequireRole(["DEV", "ADMIN"]);
  const [data, setData] = useState<PlatformOverviewResponse | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [selectedStoreId, setSelectedStoreId] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function refresh() {
    setMessage(null);
    setData(await apiFetch<PlatformOverviewResponse>("/v1/manage/platform"));
  }

  useEffect(() => {
    setSelectedStoreId(localSelectedStoreId());
  }, []);

  useEffect(() => {
    if (auth.user) void refresh().catch((error) => setMessage(String(error)));
  }, [auth.user, selectedStoreId]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function selectStore(storeId: string) {
    window.localStorage.setItem("qr2_selected_store_id", storeId);
    setSelectedStoreId(storeId);
  }

  function clearSelection() {
    window.localStorage.removeItem("qr2_selected_store_id");
    setSelectedStoreId("");
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const payload: CreatePlatformStoreRequest = {
        name: form.name,
        market: form.market,
        region: form.region || null,
        adminEmail: form.adminEmail,
        adminPassword: form.adminPassword,
        adminName: form.adminName || null,
        tableCount: Number(form.tableCount || "4"),
      };
      const overview = await apiFetch<PlatformOverviewResponse>(
        "/v1/manage/platform/stores",
        {
          method: "POST",
          body: JSON.stringify(payload),
        },
      );
      setData(overview);
      setForm(emptyForm);
      setMessage("Store created.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setSaving(false);
    }
  }

  const activeStoreId = data?.currentStore.id ?? auth.user?.storeId ?? "";

  return (
    <AuthGate state={auth}>
      <main className="page">
        <StaffSessionBar user={auth.user} />
        <section className="page-header">
          <h1>Platform</h1>
          <p>Store onboarding, DEV switching, and tenant boundary checks.</p>
        </section>

        {message ? <div className="status card">{message}</div> : null}

        <section className="grid two">
          <article className="card grid">
            <h2>Current store</h2>
            <div className="list">
              <div className="list-item">
                <strong>{data?.currentStore.name ?? "Loading"}</strong>
                <span className="meta">{activeStoreId}</span>
              </div>
            </div>
            {data?.canCreateStores ? (
              <div className="row">
                <select
                  className="select"
                  value={activeStoreId}
                  onChange={(event) => selectStore(event.target.value)}
                >
                  {(data?.stores ?? []).map((store) => (
                    <option value={store.id} key={store.id}>
                      {store.name}
                    </option>
                  ))}
                </select>
                <button className="btn ghost" onClick={clearSelection}>
                  Use my store
                </button>
              </div>
            ) : (
              <p className="meta">
                This account is locked to its assigned store.
              </p>
            )}
          </article>

          <article className="card grid">
            <h2>Onboarding checks</h2>
            <div className="list">
              {(data?.onboarding ?? []).map((check) => (
                <div className="list-item" key={check.id}>
                  <div className="row between">
                    <strong>{check.label}</strong>
                    <span
                      className={`status ${check.status === "READY" ? "ok" : check.status === "WATCH" ? "checkout" : "urgent"}`}
                    >
                      {check.status}
                    </span>
                  </div>
                  <span className="meta">{check.detail}</span>
                </div>
              ))}
            </div>
          </article>
        </section>

        <section className="grid two">
          <article className="card grid">
            <h2>Stores</h2>
            <div className="list">
              {(data?.stores ?? []).map((store) => (
                <div className="list-item" key={store.id}>
                  <div className="row between">
                    <strong>{store.name}</strong>
                    <span className="status">{store.market}</span>
                  </div>
                  <span className="meta">
                    {store.region ?? "No region"} / {store.currency} /{" "}
                    {store.locale}
                  </span>
                  <span className="meta">
                    {store.activeManagerCount} managers,{" "}
                    {store.activeTableCount} tables, {store.menuItemCount} menu
                    items
                  </span>
                </div>
              ))}
            </div>
          </article>

          {data?.canCreateStores ? (
            <form
              className="card grid"
              onSubmit={(event) => void submit(event)}
            >
              <h2>Create store</h2>
              <label className="field">
                <span>Store name</span>
                <input
                  className="input"
                  value={form.name}
                  onChange={(event) => update("name", event.target.value)}
                  required
                />
              </label>
              <section className="grid two">
                <label className="field">
                  <span>Market</span>
                  <select
                    className="select"
                    value={form.market}
                    onChange={(event) =>
                      update("market", event.target.value as StoreMarket)
                    }
                  >
                    {STORE_MARKETS.map((market) => (
                      <option value={market} key={market}>
                        {market}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Region</span>
                  <input
                    className="input"
                    value={form.region}
                    onChange={(event) => update("region", event.target.value)}
                  />
                </label>
              </section>
              <label className="field">
                <span>Admin email</span>
                <input
                  className="input"
                  type="email"
                  value={form.adminEmail}
                  onChange={(event) => update("adminEmail", event.target.value)}
                  required
                />
              </label>
              <section className="grid two">
                <label className="field">
                  <span>Admin name</span>
                  <input
                    className="input"
                    value={form.adminName}
                    onChange={(event) =>
                      update("adminName", event.target.value)
                    }
                  />
                </label>
                <label className="field">
                  <span>Admin password</span>
                  <input
                    className="input"
                    type="password"
                    value={form.adminPassword}
                    onChange={(event) =>
                      update("adminPassword", event.target.value)
                    }
                    required
                  />
                </label>
              </section>
              <label className="field">
                <span>Opening tables</span>
                <input
                  className="input"
                  type="number"
                  min="1"
                  max="50"
                  value={form.tableCount}
                  onChange={(event) => update("tableCount", event.target.value)}
                />
              </label>
              <button className="btn primary" disabled={saving}>
                {saving ? "Creating" : "Create store"}
              </button>
            </form>
          ) : null}
        </section>
      </main>
    </AuthGate>
  );
}
