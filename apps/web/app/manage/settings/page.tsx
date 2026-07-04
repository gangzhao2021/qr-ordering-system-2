"use client";

import { FormEvent, useEffect, useState } from "react";
import type {
  LanguageCode,
  PaymentMethodOption,
  StoreMarket,
  StoreSettings,
  StoreSettingsResponse,
} from "@qr2/shared";
import { LANGUAGE_CODES, PAYMENT_METHODS, STORE_MARKETS } from "@qr2/shared";
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
  currency: string;
  locale: string;
  timezone: string;
  defaultLanguage: LanguageCode;
  supportedLanguages: string;
  address: string;
  phone: string;
  taxNumber: string;
  taxMode: "SINGLE" | "CANADA" | "CHINA";
  priceIncludesTax: boolean;
  taxRulesJson: string;
  taxLabel: string;
  taxRatePercent: string;
  serviceChargeLabel: string;
  serviceChargePercent: string;
  enabledPaymentMethods: PaymentMethodOption[];
  invoiceInstructions: string;
  tipEnabled: boolean;
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
    market: store.market,
    region: store.region ?? "",
    currency: store.currency,
    locale: store.locale,
    timezone: store.timezone,
    defaultLanguage: store.defaultLanguage,
    supportedLanguages: store.supportedLanguages.join(","),
    address: store.address ?? "",
    phone: store.phone ?? "",
    taxNumber: store.taxNumber ?? "",
    taxMode: store.taxMode,
    priceIncludesTax: store.priceIncludesTax,
    taxRulesJson: JSON.stringify(store.taxRules, null, 2),
    taxLabel: store.taxLabel,
    taxRatePercent: bpsToPercent(store.taxRateBps),
    serviceChargeLabel: store.serviceChargeLabel,
    serviceChargePercent: bpsToPercent(store.serviceChargeRateBps),
    enabledPaymentMethods: store.enabledPaymentMethods,
    invoiceInstructions: store.invoiceInstructions ?? "",
    tipEnabled: store.tipEnabled,
    receiptFooter: store.receiptFooter ?? "",
  };
}

function preset(
  kind: "ONTARIO" | "BC" | "QUEBEC" | "CHINA",
): Partial<FormState> {
  if (kind === "CHINA") {
    return {
      market: "CHINA",
      region: "CN",
      currency: "CNY",
      locale: "zh-CN",
      timezone: "Asia/Shanghai",
      defaultLanguage: "zh-CN",
      supportedLanguages: "zh-CN,en",
      taxMode: "CHINA",
      priceIncludesTax: true,
      taxLabel: "VAT",
      taxRatePercent: "6",
      taxRulesJson: JSON.stringify(
        [{ id: "vat", label: "VAT", rateBps: 600, appliesTo: "ALL" }],
        null,
        2,
      ),
      enabledPaymentMethods: ["WECHAT_PAY", "ALIPAY", "UNIONPAY", "CASH"],
    };
  }
  if (kind === "BC") {
    return {
      market: "CANADA",
      region: "BC",
      currency: "CAD",
      locale: "en-CA",
      timezone: "America/Vancouver",
      taxMode: "CANADA",
      taxLabel: "GST/PST",
      taxRatePercent: "12",
      taxRulesJson: JSON.stringify(
        [
          { id: "gst", label: "GST", rateBps: 500, appliesTo: "ALL" },
          { id: "pst", label: "PST", rateBps: 700, appliesTo: "ALL" },
        ],
        null,
        2,
      ),
      enabledPaymentMethods: ["CASH", "CARD", "INTERAC", "STRIPE", "OTHER"],
    };
  }
  if (kind === "QUEBEC") {
    return {
      market: "CANADA",
      region: "QC",
      currency: "CAD",
      locale: "fr-CA",
      timezone: "America/Toronto",
      defaultLanguage: "fr-CA",
      supportedLanguages: "fr-CA,en,zh-CN",
      taxMode: "CANADA",
      taxLabel: "GST/QST",
      taxRatePercent: "14.975",
      taxRulesJson: JSON.stringify(
        [
          { id: "gst", label: "GST", rateBps: 500, appliesTo: "ALL" },
          { id: "qst", label: "QST", rateBps: 998, appliesTo: "ALL" },
        ],
        null,
        2,
      ),
      enabledPaymentMethods: ["CASH", "CARD", "INTERAC", "STRIPE", "OTHER"],
    };
  }
  return {
    market: "CANADA",
    region: "ON",
    currency: "CAD",
    locale: "en-CA",
    timezone: "America/Toronto",
    defaultLanguage: "en",
    supportedLanguages: "en,fr-CA,zh-CN",
    taxMode: "CANADA",
    taxLabel: "HST",
    taxRatePercent: "13",
    taxRulesJson: JSON.stringify(
      [{ id: "hst", label: "HST", rateBps: 1300, appliesTo: "ALL" }],
      null,
      2,
    ),
    enabledPaymentMethods: ["CASH", "CARD", "INTERAC", "STRIPE", "OTHER"],
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
      const taxRules = JSON.parse(form.taxRulesJson || "[]");
      const payload = {
        name: form.name,
        market: form.market,
        region: form.region || null,
        currency: form.currency,
        locale: form.locale,
        timezone: form.timezone,
        defaultLanguage: form.defaultLanguage,
        supportedLanguages: form.supportedLanguages
          .split(",")
          .map((entry) => entry.trim())
          .filter(Boolean),
        address: form.address || null,
        phone: form.phone || null,
        taxNumber: form.taxNumber || null,
        taxMode: form.taxMode,
        priceIncludesTax: form.priceIncludesTax,
        taxRules,
        taxLabel: form.taxLabel,
        taxRateBps: percentToBps(form.taxRatePercent),
        serviceChargeLabel: form.serviceChargeLabel,
        serviceChargeRateBps: percentToBps(form.serviceChargePercent),
        enabledPaymentMethods: form.enabledPaymentMethods,
        invoiceInstructions: form.invoiceInstructions || null,
        tipEnabled: form.tipEnabled,
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
            <section className="grid">
              <h2>Market presets</h2>
              <div className="row">
                <button
                  className="btn"
                  type="button"
                  onClick={() =>
                    setForm((current) =>
                      current ? { ...current, ...preset("ONTARIO") } : current,
                    )
                  }
                >
                  Canada ON
                </button>
                <button
                  className="btn"
                  type="button"
                  onClick={() =>
                    setForm((current) =>
                      current ? { ...current, ...preset("BC") } : current,
                    )
                  }
                >
                  Canada BC
                </button>
                <button
                  className="btn"
                  type="button"
                  onClick={() =>
                    setForm((current) =>
                      current ? { ...current, ...preset("QUEBEC") } : current,
                    )
                  }
                >
                  Canada QC
                </button>
                <button
                  className="btn"
                  type="button"
                  onClick={() =>
                    setForm((current) =>
                      current ? { ...current, ...preset("CHINA") } : current,
                    )
                  }
                >
                  China
                </button>
              </div>
            </section>

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
                <span>Market</span>
                <select
                  className="select"
                  value={form.market}
                  onChange={(event) =>
                    update("market", event.target.value as StoreMarket)
                  }
                >
                  {STORE_MARKETS.map((option) => (
                    <option value={option} key={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Region / province</span>
                <input
                  className="input"
                  value={form.region}
                  onChange={(event) => update("region", event.target.value)}
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
                <span>Default language</span>
                <select
                  className="select"
                  value={form.defaultLanguage}
                  onChange={(event) =>
                    update(
                      "defaultLanguage",
                      event.target.value as LanguageCode,
                    )
                  }
                >
                  {LANGUAGE_CODES.map((option) => (
                    <option value={option} key={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Supported languages</span>
                <input
                  className="input"
                  value={form.supportedLanguages}
                  onChange={(event) =>
                    update("supportedLanguages", event.target.value)
                  }
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
              <label className="field">
                <span>Tax / business number</span>
                <input
                  className="input"
                  value={form.taxNumber}
                  onChange={(event) => update("taxNumber", event.target.value)}
                />
              </label>
            </section>

            <section className="grid two">
              <label className="field">
                <span>Tax mode</span>
                <select
                  className="select"
                  value={form.taxMode}
                  onChange={(event) =>
                    update(
                      "taxMode",
                      event.target.value as FormState["taxMode"],
                    )
                  }
                >
                  <option value="SINGLE">Single</option>
                  <option value="CANADA">Canada</option>
                  <option value="CHINA">China</option>
                </select>
              </label>
              <label className="field checkbox-field">
                <span>Prices include tax</span>
                <input
                  type="checkbox"
                  checked={form.priceIncludesTax}
                  onChange={(event) =>
                    update("priceIncludesTax", event.target.checked)
                  }
                />
              </label>
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
              <span>Tax rules JSON</span>
              <textarea
                className="input textarea mono"
                value={form.taxRulesJson}
                onChange={(event) => update("taxRulesJson", event.target.value)}
              />
            </label>

            <section className="grid">
              <h2>Payment methods</h2>
              <div className="method-grid">
                {PAYMENT_METHODS.map((method) => (
                  <label className="mini-check" key={method}>
                    <input
                      type="checkbox"
                      checked={form.enabledPaymentMethods.includes(method)}
                      onChange={(event) =>
                        update(
                          "enabledPaymentMethods",
                          event.target.checked
                            ? [...form.enabledPaymentMethods, method]
                            : form.enabledPaymentMethods.filter(
                                (value) => value !== method,
                              ),
                        )
                      }
                    />
                    <span>{method}</span>
                  </label>
                ))}
              </div>
              <label className="field checkbox-field">
                <span>Tip enabled</span>
                <input
                  type="checkbox"
                  checked={form.tipEnabled}
                  onChange={(event) =>
                    update("tipEnabled", event.target.checked)
                  }
                />
              </label>
            </section>

            <label className="field">
              <span>Invoice instructions</span>
              <textarea
                className="input textarea"
                value={form.invoiceInstructions}
                onChange={(event) =>
                  update("invoiceInstructions", event.target.value)
                }
              />
            </label>

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
