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
  taxRules: TaxRuleDraft[];
  taxLabel: string;
  taxRatePercent: string;
  serviceChargeLabel: string;
  serviceChargePercent: string;
  enabledPaymentMethods: PaymentMethodOption[];
  invoiceInstructions: string;
  tipEnabled: boolean;
  receiptFooter: string;
};

type TaxRuleDraft = {
  id: string;
  label: string;
  ratePercent: string;
  appliesTo: string;
  compoundOnPrevious: boolean;
};

function bpsToPercent(value: number) {
  return (value / 100).toFixed(2).replace(/\.?0+$/, "");
}

function percentToBps(value: string) {
  return Math.round(Number(value || "0") * 100);
}

function taxRuleDrafts(
  rules: StoreSettings["taxRules"],
  fallback: Pick<StoreSettings, "taxLabel" | "taxRateBps">,
): TaxRuleDraft[] {
  const source =
    rules.length > 0
      ? rules
      : [
          {
            id: fallback.taxLabel.toLowerCase() || "tax",
            label: fallback.taxLabel,
            rateBps: fallback.taxRateBps,
            appliesTo: "ALL",
          },
        ];

  return source.map((rule) => ({
    id: rule.id,
    label: rule.label,
    ratePercent: bpsToPercent(rule.rateBps),
    appliesTo: rule.appliesTo,
    compoundOnPrevious: Boolean(rule.compoundOnPrevious),
  }));
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
    taxRules: taxRuleDrafts(store.taxRules, store),
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
      taxRules: [
        {
          id: "vat",
          label: "VAT",
          ratePercent: "6",
          appliesTo: "ALL",
          compoundOnPrevious: false,
        },
      ],
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
      taxRules: [
        {
          id: "gst",
          label: "GST",
          ratePercent: "5",
          appliesTo: "ALL",
          compoundOnPrevious: false,
        },
        {
          id: "pst",
          label: "PST",
          ratePercent: "7",
          appliesTo: "ALL",
          compoundOnPrevious: false,
        },
      ],
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
      taxRules: [
        {
          id: "gst",
          label: "GST",
          ratePercent: "5",
          appliesTo: "ALL",
          compoundOnPrevious: false,
        },
        {
          id: "qst",
          label: "QST",
          ratePercent: "9.975",
          appliesTo: "ALL",
          compoundOnPrevious: false,
        },
      ],
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
    taxRules: [
      {
        id: "hst",
        label: "HST",
        ratePercent: "13",
        appliesTo: "ALL",
        compoundOnPrevious: false,
      },
    ],
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

  function updateTaxRule(index: number, patch: Partial<TaxRuleDraft>) {
    setForm((current) => {
      if (!current) return current;
      return {
        ...current,
        taxRules: current.taxRules.map((rule, ruleIndex) =>
          ruleIndex === index ? { ...rule, ...patch } : rule,
        ),
      };
    });
  }

  function addTaxRule() {
    setForm((current) => {
      if (!current) return current;
      const nextIndex = current.taxRules.length + 1;
      return {
        ...current,
        taxRules: [
          ...current.taxRules,
          {
            id: `tax-${nextIndex}`,
            label: `Tax ${nextIndex}`,
            ratePercent: "0",
            appliesTo: "ALL",
            compoundOnPrevious: false,
          },
        ],
      };
    });
  }

  function removeTaxRule(index: number) {
    setForm((current) => {
      if (!current) return current;
      return {
        ...current,
        taxRules: current.taxRules.filter(
          (_, ruleIndex) => ruleIndex !== index,
        ),
      };
    });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!form) return;
    setSaving(true);
    setMessage(null);
    try {
      const taxRules = form.taxRules
        .filter((rule) => rule.id.trim() && rule.label.trim())
        .map((rule) => ({
          id: rule.id.trim(),
          label: rule.label.trim(),
          rateBps: percentToBps(rule.ratePercent),
          appliesTo: rule.appliesTo.trim() || "ALL",
          ...(rule.compoundOnPrevious ? { compoundOnPrevious: true } : {}),
        }));
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
                <span>Fallback tax label</span>
                <input
                  className="input"
                  value={form.taxLabel}
                  onChange={(event) => update("taxLabel", event.target.value)}
                />
              </label>
              <label className="field">
                <span>Fallback tax rate %</span>
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

            <section className="grid settings-tax-rules">
              <div className="row between">
                <div>
                  <h2>Tax rules</h2>
                  <p>
                    Add one line for HST/VAT, or multiple lines for GST/PST/QST.
                  </p>
                </div>
                <button
                  className="btn ghost"
                  type="button"
                  onClick={addTaxRule}
                >
                  Add tax line
                </button>
              </div>

              <div className="settings-tax-grid">
                {form.taxRules.map((rule, index) => (
                  <div className="tax-rule-row" key={`${rule.id}-${index}`}>
                    <label className="field">
                      <span>Code</span>
                      <input
                        className="input"
                        value={rule.id}
                        onChange={(event) =>
                          updateTaxRule(index, {
                            id: event.target.value
                              .trim()
                              .toLowerCase()
                              .replace(/\s+/g, "-"),
                          })
                        }
                      />
                    </label>
                    <label className="field">
                      <span>Label</span>
                      <input
                        className="input"
                        value={rule.label}
                        onChange={(event) =>
                          updateTaxRule(index, { label: event.target.value })
                        }
                      />
                    </label>
                    <label className="field">
                      <span>Rate %</span>
                      <input
                        className="input"
                        inputMode="decimal"
                        value={rule.ratePercent}
                        onChange={(event) =>
                          updateTaxRule(index, {
                            ratePercent: event.target.value,
                          })
                        }
                      />
                    </label>
                    <label className="field">
                      <span>Applies to</span>
                      <input
                        className="input"
                        value={rule.appliesTo}
                        onChange={(event) =>
                          updateTaxRule(index, {
                            appliesTo: event.target.value,
                          })
                        }
                      />
                    </label>
                    <label className="mini-check tax-compound-check">
                      <input
                        type="checkbox"
                        checked={rule.compoundOnPrevious}
                        onChange={(event) =>
                          updateTaxRule(index, {
                            compoundOnPrevious: event.target.checked,
                          })
                        }
                      />
                      <span>Compound</span>
                    </label>
                    <button
                      className="btn ghost"
                      type="button"
                      onClick={() => removeTaxRule(index)}
                      disabled={form.taxRules.length <= 1}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </section>

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
