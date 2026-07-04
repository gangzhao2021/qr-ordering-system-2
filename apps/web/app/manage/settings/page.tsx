"use client";

import { FormEvent, useEffect, useState } from "react";
import type { StoreSettings, StoreSettingsResponse } from "@qr2/shared";
import { apiFetch } from "../../../lib/api";
import {
  AuthGate,
  StaffSessionBar,
  useRequireRole,
} from "../../../lib/auth-client";

type FormState = {
  name: string;
  currency: string;
  locale: string;
  timezone: string;
  address: string;
  phone: string;
  taxLabel: string;
  taxRatePercent: string;
  serviceChargeLabel: string;
  serviceChargePercent: string;
  receiptFooter: string;
};

function bpsToPercent(value: number) {
  return (value / 100).toFixed(2).replace(/\.?0+$/, "");
}

function percentToBps(value: string) {
  return Math.round(Number(value || "0") * 100);
}

function toForm(store: StoreSettings): FormState {
  return {
    name: store.name,
    currency: store.currency,
    locale: store.locale,
    timezone: store.timezone,
    address: store.address ?? "",
    phone: store.phone ?? "",
    taxLabel: store.taxLabel,
    taxRatePercent: bpsToPercent(store.taxRateBps),
    serviceChargeLabel: store.serviceChargeLabel,
    serviceChargePercent: bpsToPercent(store.serviceChargeRateBps),
    receiptFooter: store.receiptFooter ?? "",
  };
}

export default function ManageSettingsPage() {
  const auth = useRequireRole(["DEV", "ADMIN"]);
  const [form, setForm] = useState<FormState | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function refresh() {
    setMessage(null);
    const data = await apiFetch<StoreSettingsResponse>(
      "/v1/manage/store-settings",
    );
    setForm(toForm(data.store));
  }

  useEffect(() => {
    if (auth.user) void refresh().catch((error) => setMessage(String(error)));
  }, [auth.user]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => (current ? { ...current, [key]: value } : current));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!form) return;
    setSaving(true);
    setMessage(null);
    try {
      const payload = {
        name: form.name,
        currency: form.currency,
        locale: form.locale,
        timezone: form.timezone,
        address: form.address || null,
        phone: form.phone || null,
        taxLabel: form.taxLabel,
        taxRateBps: percentToBps(form.taxRatePercent),
        serviceChargeLabel: form.serviceChargeLabel,
        serviceChargeRateBps: percentToBps(form.serviceChargePercent),
        receiptFooter: form.receiptFooter || null,
      };
      const data = await apiFetch<StoreSettingsResponse>(
        "/v1/manage/store-settings",
        {
          method: "PATCH",
          body: JSON.stringify(payload),
        },
      );
      setForm(toForm(data.store));
      setMessage("Settings saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <AuthGate state={auth}>
      <main className="page">
        <StaffSessionBar user={auth.user} />
        <section className="page-header">
          <h1>Store settings</h1>
          <p>
            Configure receipt identity, currency, tax, and service charge for
            FOH totals.
          </p>
        </section>

        {!form ? (
          <div className="card">Loading settings.</div>
        ) : (
          <form className="card grid" onSubmit={(event) => void submit(event)}>
            <section className="grid two">
              <label className="field">
                <span>Store name</span>
                <input
                  className="input"
                  value={form.name}
                  onChange={(event) => update("name", event.target.value)}
                />
              </label>
              <label className="field">
                <span>Currency</span>
                <input
                  className="input"
                  value={form.currency}
                  maxLength={3}
                  onChange={(event) =>
                    update("currency", event.target.value.toUpperCase())
                  }
                />
              </label>
              <label className="field">
                <span>Locale</span>
                <input
                  className="input"
                  value={form.locale}
                  onChange={(event) => update("locale", event.target.value)}
                />
              </label>
              <label className="field">
                <span>Timezone</span>
                <input
                  className="input"
                  value={form.timezone}
                  onChange={(event) => update("timezone", event.target.value)}
                />
              </label>
              <label className="field">
                <span>Address</span>
                <input
                  className="input"
                  value={form.address}
                  onChange={(event) => update("address", event.target.value)}
                />
              </label>
              <label className="field">
                <span>Phone</span>
                <input
                  className="input"
                  value={form.phone}
                  onChange={(event) => update("phone", event.target.value)}
                />
              </label>
            </section>

            <section className="grid two">
              <label className="field">
                <span>Tax label</span>
                <input
                  className="input"
                  value={form.taxLabel}
                  onChange={(event) => update("taxLabel", event.target.value)}
                />
              </label>
              <label className="field">
                <span>Tax rate %</span>
                <input
                  className="input"
                  inputMode="decimal"
                  value={form.taxRatePercent}
                  onChange={(event) =>
                    update("taxRatePercent", event.target.value)
                  }
                />
              </label>
              <label className="field">
                <span>Service charge label</span>
                <input
                  className="input"
                  value={form.serviceChargeLabel}
                  onChange={(event) =>
                    update("serviceChargeLabel", event.target.value)
                  }
                />
              </label>
              <label className="field">
                <span>Service charge %</span>
                <input
                  className="input"
                  inputMode="decimal"
                  value={form.serviceChargePercent}
                  onChange={(event) =>
                    update("serviceChargePercent", event.target.value)
                  }
                />
              </label>
            </section>

            <label className="field">
              <span>Receipt footer</span>
              <textarea
                className="input textarea"
                value={form.receiptFooter}
                onChange={(event) =>
                  update("receiptFooter", event.target.value)
                }
              />
            </label>

            <div className="row">
              <button className="btn primary" disabled={saving}>
                {saving ? "Saving" : "Save settings"}
              </button>
              {message ? <span className="status">{message}</span> : null}
            </div>
          </form>
        )}
      </main>
    </AuthGate>
  );
}
