"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type {
  CustomerOrder,
  LanguageCode,
  MenuItem,
  PublicMenuResponse,
  PublicOrdersResponse,
  SelectedModifier,
  ServiceRequest,
  ServiceRequestType,
} from "@qr2/shared";
import { LANGUAGE_CODES, formatCents } from "@qr2/shared";
import { apiFetch } from "../../lib/api";

type CartLine = {
  menuItemId: string;
  name: string;
  priceCents: number;
  modifiers: SelectedModifier[];
  note: string;
  quantity: number;
};

const labels = {
  en: {
    entryTitle: "Customer entry",
    entryBody:
      "Scan a table QR code or enter a table token to open the right dine-in menu.",
    openMenu: "Open menu",
    search: "Search menu",
    water: "Water",
    callStaff: "Call staff",
    followUp: "Follow up",
    tableStatus: "Table status",
    serviceRequests: "Service requests",
    orders: "Orders",
    refresh: "Refresh",
    add: "Add",
    sendOrder: "Send order",
    clear: "Clear",
    note: "Kitchen note",
    language: "Language",
    openTotal: "Open total",
    customize: "Customize",
    hideOptions: "Hide options",
    viewStatus: "View table status",
    menu: "Menu",
    tableSummary: "Table summary",
    soldOut: "Sold out",
    unavailable: "Unavailable",
    available: "Available",
  },
  "fr-CA": {
    entryTitle: "Entree client",
    entryBody: "Scannez le code QR de la table ou entrez un jeton de table.",
    openMenu: "Ouvrir le menu",
    search: "Rechercher",
    water: "Eau",
    callStaff: "Appeler",
    followUp: "Relancer",
    tableStatus: "Etat de la table",
    serviceRequests: "Demandes",
    orders: "Commandes",
    refresh: "Actualiser",
    add: "Ajouter",
    sendOrder: "Envoyer",
    clear: "Vider",
    note: "Note cuisine",
    language: "Langue",
    openTotal: "Total ouvert",
    customize: "Options",
    hideOptions: "Masquer",
    viewStatus: "Voir la table",
    menu: "Menu",
    tableSummary: "Resume de table",
    soldOut: "Epuise",
    unavailable: "Indisponible",
    available: "Disponible",
  },
  "zh-CN": {
    entryTitle: "顾客入口",
    entryBody: "扫描桌台二维码，或输入桌台 token 打开堂食菜单。",
    openMenu: "打开菜单",
    search: "搜索菜单",
    water: "加水",
    callStaff: "呼叫服务员",
    followUp: "催单",
    tableStatus: "桌台状态",
    serviceRequests: "服务请求",
    orders: "订单",
    refresh: "刷新",
    add: "加入",
    sendOrder: "提交订单",
    clear: "清空",
    note: "口味备注",
    language: "语言",
    openTotal: "未结金额",
    customize: "选择口味",
    hideOptions: "收起选项",
    viewStatus: "查看桌台状态",
    menu: "菜单",
    tableSummary: "桌台概览",
    soldOut: "售罄",
    unavailable: "不可售",
    available: "可点",
  },
} as const;

function localized(
  base: string | null | undefined,
  localizedValue: MenuItem["nameLocalized"],
  language: LanguageCode,
) {
  return localizedValue?.[language] || localizedValue?.en || base || "";
}

function modifierName(modifier: SelectedModifier) {
  return modifier.priceDeltaCents
    ? `${modifier.name} (${modifier.priceDeltaCents > 0 ? "+" : ""}${formatCents(modifier.priceDeltaCents)})`
    : modifier.name;
}

function stockLabel(item: MenuItem, language: LanguageCode) {
  const t = labels[language];
  if (!item.isAvailable) return t.unavailable;
  if (item.isSoldOut) return t.soldOut;
  if (item.stockQuantity !== null && item.stockQuantity !== undefined) {
    return item.isLowStock
      ? `${item.stockQuantity} left`
      : `${item.stockQuantity} in stock`;
  }
  return t.available;
}

function orderStatusLabel(status: CustomerOrder["status"]) {
  if (status === "SUBMITTED") return "Open";
  if (status === "CLOSED") return "Closed";
  return "Canceled";
}

function itemStatusLabel(status: CustomerOrder["items"][number]["status"]) {
  if (status === "PENDING") return "In progress";
  if (status === "DONE") return "Served";
  return "Canceled";
}

function requestTypeLabel(
  type: ServiceRequest["type"],
  language: LanguageCode,
) {
  const t = labels[language];
  if (type === "WATER") return t.water;
  if (type === "CALL_STAFF") return t.callStaff;
  return t.followUp;
}

function requestStatusLabel(status: ServiceRequest["status"]) {
  if (status === "PENDING") return "Pending";
  if (status === "HANDLED") return "Handled";
  return "Canceled";
}

function CustomerExperience() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const qrToken = searchParams.get("t") ?? "";
  const [language, setLanguage] = useState<LanguageCode>("en");
  const [manualToken, setManualToken] = useState("table-1-token");
  const [menu, setMenu] = useState<PublicMenuResponse | null>(null);
  const [orders, setOrders] = useState<PublicOrdersResponse | null>(null);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [query, setQuery] = useState("");
  const [modifierDrafts, setModifierDrafts] = useState<
    Record<string, Record<string, string[]>>
  >({});
  const [expandedOptions, setExpandedOptions] = useState<
    Record<string, boolean>
  >({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const t = labels[language];

  async function loadCustomerData(token: string) {
    const [menuResult, ordersResult] = await Promise.all([
      apiFetch<PublicMenuResponse>(
        `/v1/public/menu?qrToken=${encodeURIComponent(token)}`,
      ),
      apiFetch<PublicOrdersResponse>(
        `/v1/public/orders?qrToken=${encodeURIComponent(token)}`,
      ),
    ]);
    setMenu(menuResult);
    setOrders(ordersResult);
  }

  async function refreshOrders() {
    if (!qrToken) return;
    const result = await apiFetch<PublicOrdersResponse>(
      `/v1/public/orders?qrToken=${encodeURIComponent(qrToken)}`,
    );
    setOrders(result);
  }

  useEffect(() => {
    const requestedLanguage = searchParams.get("lang");
    if (LANGUAGE_CODES.includes(requestedLanguage as LanguageCode)) {
      setLanguage(requestedLanguage as LanguageCode);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!qrToken) return;
    setLoading(true);
    setError(null);
    loadCustomerData(qrToken)
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : String(err)),
      )
      .finally(() => setLoading(false));
  }, [qrToken]);

  const filteredCategories = useMemo(() => {
    if (!menu) return [];
    const q = query.trim().toLowerCase();
    if (!q) return menu.categories;
    return menu.categories
      .map((category) => ({
        ...category,
        items: category.items.filter((item) =>
          `${localized(item.name, item.nameLocalized, language)} ${localized(
            item.description,
            item.descriptionLocalized,
            language,
          )}`
            .toLowerCase()
            .includes(q),
        ),
      }))
      .filter((category) => category.items.length > 0);
  }, [menu, query, language]);

  function selectedModifiers(item: MenuItem): SelectedModifier[] {
    const draft = modifierDrafts[item.id] ?? {};
    return item.modifierGroups.flatMap((group) => {
      const selectedIds =
        draft[group.id] ??
        group.options
          .filter((option) => option.isDefault)
          .map((option) => option.id);
      return group.options
        .filter((option) => selectedIds.includes(option.id))
        .map((option) => ({
          groupId: group.id,
          optionId: option.id,
          name: `${localized(group.name, group.nameLocalized, language)}: ${localized(
            option.name,
            option.nameLocalized,
            language,
          )}`,
          priceDeltaCents: option.priceDeltaCents,
        }));
    });
  }

  function updateModifier(
    item: MenuItem,
    groupId: string,
    optionId: string,
    checked = true,
  ) {
    const group = item.modifierGroups.find((entry) => entry.id === groupId);
    setModifierDrafts((current) => {
      const itemDraft = current[item.id] ?? {};
      if (!group || group.maxSelect <= 1) {
        return {
          ...current,
          [item.id]: { ...itemDraft, [groupId]: [optionId] },
        };
      }
      const existing = itemDraft[groupId] ?? [];
      const next = checked
        ? Array.from(new Set([...existing, optionId])).slice(0, group.maxSelect)
        : existing.filter((id) => id !== optionId);
      return { ...current, [item.id]: { ...itemDraft, [groupId]: next } };
    });
  }

  function addToCart(item: MenuItem) {
    if (item.isSoldOut || !item.isAvailable) return;
    const modifiers = selectedModifiers(item);
    const note = notes[item.id]?.trim() ?? "";
    const unitPrice =
      item.priceCents +
      modifiers.reduce((sum, modifier) => sum + modifier.priceDeltaCents, 0);
    const key = `${item.id}|${modifiers
      .map((modifier) => modifier.optionId)
      .sort()
      .join(",")}|${note}`;
    setCart((current) => {
      const existing = current.find(
        (line) =>
          `${line.menuItemId}|${line.modifiers
            .map((modifier) => modifier.optionId)
            .sort()
            .join(",")}|${line.note}` === key,
      );
      const maxQuantity = Math.min(20, item.stockQuantity ?? 20);
      if (existing) {
        if (existing.quantity >= maxQuantity) return current;
        return current.map((line) =>
          line === existing ? { ...line, quantity: line.quantity + 1 } : line,
        );
      }
      return [
        ...current,
        {
          menuItemId: item.id,
          name: localized(item.name, item.nameLocalized, language),
          priceCents: unitPrice,
          modifiers,
          note,
          quantity: 1,
        },
      ];
    });
  }

  const totalCents = cart.reduce(
    (sum, line) => sum + line.priceCents * line.quantity,
    0,
  );
  const totalQuantity = cart.reduce((sum, line) => sum + line.quantity, 0);
  const activeOrderCount =
    orders?.orders.filter((order) => order.status === "SUBMITTED").length ?? 0;
  const pendingRequestCount =
    orders?.serviceRequests.filter((request) => request.status === "PENDING")
      .length ?? 0;

  function toggleOptions(itemId: string) {
    setExpandedOptions((current) => ({
      ...current,
      [itemId]: !current[itemId],
    }));
  }

  async function submitOrder() {
    if (!qrToken || cart.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const response = await apiFetch<{ orderId: string }>(
        "/v1/public/orders",
        {
          method: "POST",
          body: JSON.stringify({
            qrToken,
            customerLanguage: language,
            items: cart.map((line) => ({
              menuItemId: line.menuItemId,
              quantity: line.quantity,
              modifiers: line.modifiers,
              note: line.note || null,
            })),
          }),
        },
      );
      const refreshed = await apiFetch<PublicMenuResponse>(
        `/v1/public/menu?qrToken=${encodeURIComponent(qrToken)}`,
      );
      await refreshOrders();
      setCart([]);
      setMenu(refreshed);
      setNotice(`Order sent: ${response.orderId.slice(0, 8)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function sendServiceRequest(type: ServiceRequestType) {
    if (!qrToken) return;
    setError(null);
    try {
      await apiFetch("/v1/public/service-requests", {
        method: "POST",
        body: JSON.stringify({ qrToken, type }),
      });
      await refreshOrders();
      setNotice("Request sent to FOH");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  if (!qrToken) {
    return (
      <main className="page">
        <section className="page-header">
          <h1>{t.entryTitle}</h1>
          <p>{t.entryBody}</p>
        </section>
        <section className="card grid">
          <label className="field">
            <span>Table token</span>
            <input
              className="input"
              value={manualToken}
              onChange={(event) => setManualToken(event.target.value)}
            />
          </label>
          <button
            className="btn primary"
            onClick={() =>
              router.push(`/c?t=${encodeURIComponent(manualToken.trim())}`)
            }
            disabled={!manualToken.trim()}
          >
            {t.openMenu}
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="page customer-page">
      <section className="page-header customer-header">
        <div>
          <span className="meta">
            {menu ? `Table ${menu.table.number}` : "Dine-in"}
          </span>
          <h1>{menu?.store.name ?? "Customer menu"}</h1>
          <p>
            {menu
              ? "Browse the menu first. Your table status is below the menu."
              : "Loading menu..."}
          </p>
        </div>
        {orders ? (
          <div className="customer-total-pill">
            <span>{t.openTotal}</span>
            <strong>
              {formatCents(
                orders.openTotals.totalCents,
                orders.store.currency,
                orders.store.locale,
              )}
            </strong>
          </div>
        ) : null}
      </section>

      <section className="card grid customer-controls">
        <label className="field customer-search">
          <span>{t.search}</span>
          <input
            className="input"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Noodles, dumplings, tea"
          />
        </label>
        <label className="field customer-language">
          <span>{t.language}</span>
          <select
            className="select"
            value={language}
            onChange={(event) =>
              setLanguage(event.target.value as LanguageCode)
            }
          >
            <option value="en">English</option>
            <option value="fr-CA">Francais</option>
            <option value="zh-CN">中文</option>
          </select>
        </label>
        <div
          className="row customer-service-actions"
          aria-label="Service requests"
        >
          <button
            className="btn ghost"
            onClick={() => void sendServiceRequest("WATER")}
          >
            {t.water}
          </button>
          <button
            className="btn ghost"
            onClick={() => void sendServiceRequest("CALL_STAFF")}
          >
            {t.callStaff}
          </button>
          <button
            className="btn ghost"
            onClick={() => void sendServiceRequest("FOLLOW_UP")}
          >
            {t.followUp}
          </button>
        </div>
        {notice ? (
          <div className="success card customer-message">{notice}</div>
        ) : null}
        {error ? (
          <div className="error card customer-message">{error}</div>
        ) : null}
      </section>

      <section className="grid customer-menu-grid" id="menu">
        {filteredCategories.map((category) => (
          <div className="card" key={category.id}>
            <div className="row between">
              <h2>
                {t.menu} / {category.name}
              </h2>
              <span className="meta">{category.items.length} items</span>
            </div>
            <div className="list">
              {category.items.map((item) => {
                const displayName = localized(
                  item.name,
                  item.nameLocalized,
                  language,
                );
                const description = localized(
                  item.description,
                  item.descriptionLocalized,
                  language,
                );
                const modifiers = selectedModifiers(item);
                const modifierTotal = modifiers.reduce(
                  (sum, modifier) => sum + modifier.priceDeltaCents,
                  0,
                );
                const isExpanded = expandedOptions[item.id] ?? false;
                const note = notes[item.id]?.trim() ?? "";
                const itemQuantityInCart = cart
                  .filter((line) => line.menuItemId === item.id)
                  .reduce((sum, line) => sum + line.quantity, 0);
                return (
                  <div
                    className={`list-item menu-item ${item.isSoldOut ? "muted-item" : ""}`}
                    key={item.id}
                  >
                    {item.imageUrl ? (
                      <img className="menu-thumb" src={item.imageUrl} alt="" />
                    ) : (
                      <div className="menu-thumb placeholder" />
                    )}
                    <div className="menu-item-body">
                      <strong>{displayName}</strong>
                      <p>{description}</p>
                      <div className="row">
                        <span className="meta">
                          {formatCents(
                            item.priceCents + modifierTotal,
                            menu?.store.currency,
                            menu?.store.locale,
                          )}
                        </span>
                        <span
                          className={`status ${
                            item.isSoldOut
                              ? "urgent"
                              : item.isLowStock
                                ? "checkout"
                                : "ok"
                          }`}
                        >
                          {stockLabel(item, language)}
                        </span>
                        {item.spiceLevel > 0 ? (
                          <span className="status checkout">
                            Spice {item.spiceLevel}/5
                          </span>
                        ) : null}
                        {item.allergens.length > 0 ? (
                          <span className="meta">
                            Allergens: {item.allergens.join(", ")}
                          </span>
                        ) : null}
                      </div>

                      {modifiers.length > 0 ? (
                        <span className="meta selected-options">
                          {modifiers.map(modifierName).join(" / ")}
                        </span>
                      ) : null}
                      {note ? <span className="meta">{note}</span> : null}

                      {isExpanded ? (
                        <div className="menu-item-options">
                          {item.modifierGroups.length > 0 ? (
                            <div className="modifier-grid">
                              {item.modifierGroups.map((group) => (
                                <fieldset
                                  className="modifier-group"
                                  key={group.id}
                                >
                                  <legend>
                                    {localized(
                                      group.name,
                                      group.nameLocalized,
                                      language,
                                    )}
                                  </legend>
                                  {group.maxSelect <= 1 ? (
                                    <select
                                      className="select"
                                      value={
                                        (modifierDrafts[item.id]?.[group.id] ??
                                          group.options
                                            .filter(
                                              (option) => option.isDefault,
                                            )
                                            .map((option) => option.id))[0] ??
                                        ""
                                      }
                                      onChange={(event) =>
                                        updateModifier(
                                          item,
                                          group.id,
                                          event.target.value,
                                        )
                                      }
                                    >
                                      {!group.required ? (
                                        <option value="">None</option>
                                      ) : null}
                                      {group.options.map((option) => (
                                        <option
                                          value={option.id}
                                          key={option.id}
                                        >
                                          {localized(
                                            option.name,
                                            option.nameLocalized,
                                            language,
                                          )}
                                          {option.priceDeltaCents
                                            ? ` ${formatCents(
                                                option.priceDeltaCents,
                                                menu?.store.currency,
                                                menu?.store.locale,
                                              )}`
                                            : ""}
                                        </option>
                                      ))}
                                    </select>
                                  ) : (
                                    <div className="row">
                                      {group.options.map((option) => {
                                        const selectedIds =
                                          modifierDrafts[item.id]?.[group.id] ??
                                          group.options
                                            .filter((entry) => entry.isDefault)
                                            .map((entry) => entry.id);
                                        const checked = selectedIds.includes(
                                          option.id,
                                        );
                                        return (
                                          <label
                                            className="mini-check"
                                            key={option.id}
                                          >
                                            <input
                                              type="checkbox"
                                              checked={checked}
                                              onChange={(event) =>
                                                updateModifier(
                                                  item,
                                                  group.id,
                                                  option.id,
                                                  event.target.checked,
                                                )
                                              }
                                            />
                                            <span>
                                              {localized(
                                                option.name,
                                                option.nameLocalized,
                                                language,
                                              )}
                                            </span>
                                          </label>
                                        );
                                      })}
                                    </div>
                                  )}
                                </fieldset>
                              ))}
                            </div>
                          ) : null}

                          <label className="field">
                            <span>{t.note}</span>
                            <input
                              className="input"
                              value={notes[item.id] ?? ""}
                              maxLength={200}
                              onChange={(event) =>
                                setNotes((current) => ({
                                  ...current,
                                  [item.id]: event.target.value,
                                }))
                              }
                            />
                          </label>
                        </div>
                      ) : null}
                    </div>
                    <div className="menu-item-actions">
                      <button
                        className="btn ghost"
                        onClick={() => toggleOptions(item.id)}
                      >
                        {isExpanded ? t.hideOptions : t.customize}
                      </button>
                      <button
                        className="btn primary"
                        onClick={() => addToCart(item)}
                        disabled={
                          item.isSoldOut ||
                          !item.isAvailable ||
                          (item.stockQuantity !== null &&
                            item.stockQuantity !== undefined &&
                            itemQuantityInCart >= item.stockQuantity)
                        }
                      >
                        {item.isSoldOut
                          ? t.soldOut
                          : item.isAvailable
                            ? t.add
                            : t.unavailable}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </section>

      {orders ? (
        <details
          className="customer-status-panel"
          open={activeOrderCount > 0 || pendingRequestCount > 0}
        >
          <summary>
            <span>
              <strong>{t.viewStatus}</strong>
              <span className="meta">
                {activeOrderCount} open / {pendingRequestCount} request
              </span>
            </span>
            <span className="status">
              {formatCents(
                orders.openTotals.totalCents,
                orders.store.currency,
                orders.store.locale,
              )}
            </span>
          </summary>

          <section className="grid two order-status-grid">
            <article className="card grid">
              <div className="row between">
                <h2>{t.tableStatus}</h2>
                <button
                  className="btn ghost"
                  onClick={() => void refreshOrders()}
                  disabled={loading}
                >
                  {t.refresh}
                </button>
              </div>
              <div className="row between">
                <span className="meta">{t.openTotal}</span>
                <strong>
                  {formatCents(
                    orders.openTotals.totalCents,
                    orders.store.currency,
                    orders.store.locale,
                  )}
                </strong>
              </div>
              {orders.openTotals.taxLines.length > 0 ? (
                <div className="list compact-list">
                  {orders.openTotals.taxLines.map((line) => (
                    <div className="row between" key={line.label}>
                      <span className="meta">{line.label}</span>
                      <span className="meta">
                        {formatCents(
                          line.amountCents,
                          orders.store.currency,
                          orders.store.locale,
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              ) : null}
            </article>

            <article className="card grid">
              <h2>{t.serviceRequests}</h2>
              <div className="list">
                {orders.serviceRequests.slice(0, 4).map((request) => (
                  <div className="list-item row between" key={request.id}>
                    <span>{requestTypeLabel(request.type, language)}</span>
                    <span
                      className={`status ${
                        request.status === "PENDING"
                          ? "checkout"
                          : request.status === "HANDLED"
                            ? "ok"
                            : ""
                      }`}
                    >
                      {requestStatusLabel(request.status)}
                    </span>
                  </div>
                ))}
                {orders.serviceRequests.length === 0 ? (
                  <span className="meta">No service requests yet.</span>
                ) : null}
              </div>
            </article>

            <article className="card grid order-history">
              <h2>{t.orders}</h2>
              <div className="list">
                {orders.orders.map((order) => (
                  <div className="list-item order-card" key={order.id}>
                    <div className="row between">
                      <strong>Order {order.id.slice(0, 8)}</strong>
                      <span
                        className={`status ${
                          order.status === "SUBMITTED"
                            ? "checkout"
                            : order.status === "CLOSED"
                              ? "ok"
                              : "urgent"
                        }`}
                      >
                        {orderStatusLabel(order.status)}
                      </span>
                    </div>
                    <div className="list compact-list">
                      {order.items.map((item) => (
                        <div className="grid compact-list" key={item.id}>
                          <div className="row between">
                            <span>
                              {item.quantity}x {item.nameSnapshot}
                            </span>
                            <span
                              className={`status ${
                                item.status === "PENDING"
                                  ? "checkout"
                                  : item.status === "DONE"
                                    ? "ok"
                                    : "urgent"
                              }`}
                            >
                              {itemStatusLabel(item.status)}
                            </span>
                          </div>
                          {item.modifiers.length > 0 ? (
                            <span className="meta">
                              {item.modifiers.map(modifierName).join(" / ")}
                            </span>
                          ) : null}
                          {item.note ? (
                            <span className="meta">{item.note}</span>
                          ) : null}
                        </div>
                      ))}
                    </div>
                    <div className="row between">
                      <span className="meta">Total</span>
                      <strong>
                        {formatCents(
                          order.totals.totalCents,
                          orders.store.currency,
                          orders.store.locale,
                        )}
                      </strong>
                    </div>
                  </div>
                ))}
                {orders.orders.length === 0 ? (
                  <span className="meta">No orders yet.</span>
                ) : null}
              </div>
            </article>
          </section>
        </details>
      ) : null}

      {cart.length > 0 ? (
        <div className="cart-bar">
          <div className="card grid">
            <div className="row between">
              <div>
                <strong>{totalQuantity} items</strong>
                <div className="meta">
                  {formatCents(
                    totalCents,
                    menu?.store.currency,
                    menu?.store.locale,
                  )}
                </div>
              </div>
              <div className="row">
                <button className="btn ghost" onClick={() => setCart([])}>
                  {t.clear}
                </button>
                <button
                  className="btn primary"
                  onClick={() => void submitOrder()}
                  disabled={loading}
                >
                  {t.sendOrder}
                </button>
              </div>
            </div>
            <div className="list compact-list">
              {cart.map((line, index) => (
                <div
                  className="row between"
                  key={`${line.menuItemId}-${index}`}
                >
                  <span>
                    {line.quantity}x {line.name}
                    {line.modifiers.length > 0
                      ? ` / ${line.modifiers.map(modifierName).join(" / ")}`
                      : ""}
                  </span>
                  <strong>
                    {formatCents(
                      line.priceCents * line.quantity,
                      menu?.store.currency,
                      menu?.store.locale,
                    )}
                  </strong>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

export default function CustomerPage() {
  return (
    <Suspense
      fallback={
        <main className="page">
          <div className="card">Loading customer menu...</div>
        </main>
      }
    >
      <CustomerExperience />
    </Suspense>
  );
}
