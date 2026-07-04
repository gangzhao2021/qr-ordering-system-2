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
  maxQuantity: number;
};

const labels = {
  en: {
    entryTitle: "Customer entry",
    entryBody:
      "Scan a table QR code or enter a table token to open the right dine-in menu.",
    tableToken: "Table token",
    tableTokenHelp: "Ask staff if the QR code is damaged or missing.",
    openMenu: "Open menu",
    search: "Search menu",
    searchPlaceholder: "Noodles, dumplings, tea",
    water: "Water",
    callStaff: "Call staff",
    followUp: "Follow up",
    serviceHelp: "Need help at the table? FOH sees these requests live.",
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
    tableStep: "Table",
    menuStep: "Menu",
    cartStep: "Cart",
    statusStep: "Status",
    orderingSteps: "Ordering steps",
    tableReady: "Table ready",
    dineIn: "Dine-in",
    browsePrompt:
      "Choose items, review your cart, then send the order to the front desk.",
    loadingMenu: "Loading menu...",
    categoryTabs: "Menu sections",
    allCategories: "All sections",
    emptyMenuTitle: "No matching items",
    emptyMenuBody: "Clear the search or try another dish name.",
    clearSearch: "Clear search",
    itemSingular: "item",
    itemPlural: "items",
    none: "None",
    selectedInCart: "in cart",
    spice: "Spice",
    allergens: "Allergens",
    cartTitle: "Review cart",
    cartHelp: "Adjust quantities before sending this table order.",
    decrease: "Decrease",
    increase: "Increase",
    remove: "Remove",
    noServiceRequests: "No service requests yet.",
    noOrders: "No orders yet.",
    orderLabel: "Order",
    total: "Total",
    subtotal: "Subtotal",
    serviceCharge: "Service charge",
    includedTax: "Included tax",
    orderSent: "Order sent",
    requestSent: "Request sent to FOH",
    statusSummary: "open / request",
    openStatus: "Open",
    closedStatus: "Closed",
    canceledStatus: "Canceled",
    inProgressStatus: "In progress",
    servedStatus: "Served",
    pendingStatus: "Pending",
    handledStatus: "Handled",
    stockLeft: "{count} left",
    stockIn: "{count} in stock",
    soldOut: "Sold out",
    unavailable: "Unavailable",
    available: "Available",
  },
  "fr-CA": {
    entryTitle: "Entree client",
    entryBody: "Scannez le code QR de la table ou entrez un jeton de table.",
    tableToken: "Jeton de table",
    tableTokenHelp: "Demandez a l'equipe si le code QR est abime ou absent.",
    openMenu: "Ouvrir le menu",
    search: "Rechercher",
    searchPlaceholder: "Nouilles, raviolis, the",
    water: "Eau",
    callStaff: "Appeler",
    followUp: "Relancer",
    serviceHelp: "Besoin d'aide a table? L'equipe voit ces demandes.",
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
    tableStep: "Table",
    menuStep: "Menu",
    cartStep: "Panier",
    statusStep: "Suivi",
    orderingSteps: "Etapes de commande",
    tableReady: "Table prete",
    dineIn: "Sur place",
    browsePrompt:
      "Choisissez vos plats, verifiez le panier, puis envoyez la commande.",
    loadingMenu: "Chargement du menu...",
    categoryTabs: "Sections du menu",
    allCategories: "Toutes les sections",
    emptyMenuTitle: "Aucun article trouve",
    emptyMenuBody: "Effacez la recherche ou essayez un autre plat.",
    clearSearch: "Effacer",
    itemSingular: "article",
    itemPlural: "articles",
    none: "Aucun",
    selectedInCart: "au panier",
    spice: "Piquant",
    allergens: "Allergenes",
    cartTitle: "Verifier le panier",
    cartHelp: "Ajustez les quantites avant d'envoyer la commande.",
    decrease: "Diminuer",
    increase: "Augmenter",
    remove: "Retirer",
    noServiceRequests: "Aucune demande pour le moment.",
    noOrders: "Aucune commande pour le moment.",
    orderLabel: "Commande",
    total: "Total",
    subtotal: "Sous-total",
    serviceCharge: "Frais de service",
    includedTax: "Taxe incluse",
    orderSent: "Commande envoyee",
    requestSent: "Demande envoyee a l'equipe",
    statusSummary: "ouvert / demande",
    openStatus: "Ouverte",
    closedStatus: "Fermee",
    canceledStatus: "Annulee",
    inProgressStatus: "En cours",
    servedStatus: "Servi",
    pendingStatus: "En attente",
    handledStatus: "Traitee",
    stockLeft: "{count} restants",
    stockIn: "{count} en stock",
    soldOut: "Epuise",
    unavailable: "Indisponible",
    available: "Disponible",
  },
  "zh-CN": {
    entryTitle: "顾客入口",
    entryBody: "扫描桌台二维码，或输入桌台 token 打开堂食菜单。",
    tableToken: "桌台 token",
    tableTokenHelp: "如果二维码损坏或缺失，请联系服务员。",
    openMenu: "打开菜单",
    search: "搜索菜单",
    searchPlaceholder: "牛肉面、水饺、茶",
    water: "加水",
    callStaff: "呼叫服务员",
    followUp: "催单",
    serviceHelp: "需要帮助时可直接呼叫，前厅会看到请求。",
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
    tableStep: "桌台",
    menuStep: "菜单",
    cartStep: "购物车",
    statusStep: "状态",
    orderingSteps: "点餐步骤",
    tableReady: "桌台已确认",
    dineIn: "堂食",
    browsePrompt: "选择菜品，确认购物车，然后提交给前厅。",
    loadingMenu: "菜单加载中...",
    categoryTabs: "菜单分类",
    allCategories: "全部分类",
    emptyMenuTitle: "没有匹配菜品",
    emptyMenuBody: "清空搜索，或换一个菜名试试。",
    clearSearch: "清空搜索",
    itemSingular: "项",
    itemPlural: "项",
    none: "无",
    selectedInCart: "已加入",
    spice: "辣度",
    allergens: "过敏原",
    cartTitle: "确认购物车",
    cartHelp: "提交前可调整数量。",
    decrease: "减少",
    increase: "增加",
    remove: "移除",
    noServiceRequests: "暂无服务请求。",
    noOrders: "暂无订单。",
    orderLabel: "订单",
    total: "合计",
    subtotal: "小计",
    serviceCharge: "服务费",
    includedTax: "已含税",
    orderSent: "订单已提交",
    requestSent: "已通知前厅",
    statusSummary: "进行中 / 请求",
    openStatus: "进行中",
    closedStatus: "已结账",
    canceledStatus: "已取消",
    inProgressStatus: "制作中",
    servedStatus: "已上菜",
    pendingStatus: "待处理",
    handledStatus: "已处理",
    stockLeft: "剩余 {count}",
    stockIn: "库存 {count}",
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

function fillCount(template: string, count: number) {
  return template.replace("{count}", String(count));
}

function countLabel(
  count: number,
  singular: string,
  plural: string,
  language: LanguageCode,
) {
  if (language === "zh-CN") return `${count} ${plural}`;
  return `${count} ${count === 1 ? singular : plural}`;
}

function sectionId(categoryId: string) {
  return `category-${categoryId}`;
}

function stockLabel(item: MenuItem, language: LanguageCode) {
  const t = labels[language];
  if (!item.isAvailable) return t.unavailable;
  if (item.isSoldOut) return t.soldOut;
  if (item.stockQuantity !== null && item.stockQuantity !== undefined) {
    return item.isLowStock
      ? fillCount(t.stockLeft, item.stockQuantity)
      : fillCount(t.stockIn, item.stockQuantity);
  }
  return t.available;
}

function orderStatusLabel(
  status: CustomerOrder["status"],
  language: LanguageCode,
) {
  const t = labels[language];
  if (status === "SUBMITTED") return t.openStatus;
  if (status === "CLOSED") return t.closedStatus;
  return t.canceledStatus;
}

function itemStatusLabel(
  status: CustomerOrder["items"][number]["status"],
  language: LanguageCode,
) {
  const t = labels[language];
  if (status === "PENDING") return t.inProgressStatus;
  if (status === "DONE") return t.servedStatus;
  return t.canceledStatus;
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

function requestStatusLabel(
  status: ServiceRequest["status"],
  language: LanguageCode,
) {
  const t = labels[language];
  if (status === "PENDING") return t.pendingStatus;
  if (status === "HANDLED") return t.handledStatus;
  return t.canceledStatus;
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

  function handleLanguageChange(nextLanguage: LanguageCode) {
    setLanguage(nextLanguage);
    if (!qrToken) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("lang", nextLanguage);
    router.replace(`/c?${params.toString()}`, { scroll: false });
  }

  function openManualMenu() {
    const token = manualToken.trim();
    if (!token) return;
    const params = new URLSearchParams({ t: token, lang: language });
    router.push(`/c?${params.toString()}`);
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

  const visibleItemCount = filteredCategories.reduce(
    (sum, category) => sum + category.items.length,
    0,
  );
  const totalMenuItemCount =
    menu?.categories.reduce(
      (sum, category) => sum + category.items.length,
      0,
    ) ?? 0;

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
          maxQuantity,
        },
      ];
    });
  }

  function updateCartLine(index: number, nextQuantity: number) {
    setCart((current) =>
      current.flatMap((line, lineIndex) => {
        if (lineIndex !== index) return [line];
        if (nextQuantity <= 0) return [];
        return [
          {
            ...line,
            quantity: Math.min(nextQuantity, line.maxQuantity),
          },
        ];
      }),
    );
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
      setNotice(`${t.orderSent}: ${response.orderId.slice(0, 8)}`);
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
      setNotice(t.requestSent);
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
            <span>{t.tableToken}</span>
            <input
              className="input"
              value={manualToken}
              onChange={(event) => setManualToken(event.target.value)}
            />
            <span>{t.tableTokenHelp}</span>
          </label>
          <label className="field">
            <span>{t.language}</span>
            <select
              className="select"
              value={language}
              onChange={(event) =>
                handleLanguageChange(event.target.value as LanguageCode)
              }
            >
              <option value="en">English</option>
              <option value="fr-CA">Francais</option>
              <option value="zh-CN">中文</option>
            </select>
          </label>
          <button
            className="btn primary"
            onClick={openManualMenu}
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
            {menu ? `${t.tableStep} ${menu.table.number}` : t.dineIn}
          </span>
          <h1>{menu?.store.name ?? t.menu}</h1>
          <p>{menu ? t.browsePrompt : t.loadingMenu}</p>
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

      <section className="customer-step-strip" aria-label={t.orderingSteps}>
        <a className="customer-step active" href="#menu">
          <span>{t.tableStep}</span>
          <strong>
            {menu ? `${t.tableStep} ${menu.table.number}` : t.dineIn}
          </strong>
          <small>{t.tableReady}</small>
        </a>
        <a className="customer-step active" href="#menu">
          <span>{t.menuStep}</span>
          <strong>
            {countLabel(
              totalMenuItemCount,
              t.itemSingular,
              t.itemPlural,
              language,
            )}
          </strong>
          <small>{t.categoryTabs}</small>
        </a>
        <a
          className={`customer-step ${totalQuantity > 0 ? "active" : ""}`}
          href="#cart"
        >
          <span>{t.cartStep}</span>
          <strong>
            {countLabel(totalQuantity, t.itemSingular, t.itemPlural, language)}
          </strong>
          <small>{t.cartTitle}</small>
        </a>
        <a
          className={`customer-step ${
            activeOrderCount > 0 || pendingRequestCount > 0 ? "active" : ""
          }`}
          href="#status"
        >
          <span>{t.statusStep}</span>
          <strong>
            {activeOrderCount} / {pendingRequestCount}
          </strong>
          <small>{t.statusSummary}</small>
        </a>
      </section>

      <section className="card grid customer-controls">
        <label className="field customer-search">
          <span>{t.search}</span>
          <input
            className="input"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t.searchPlaceholder}
          />
        </label>
        <label className="field customer-language">
          <span>{t.language}</span>
          <select
            className="select"
            value={language}
            onChange={(event) =>
              handleLanguageChange(event.target.value as LanguageCode)
            }
          >
            <option value="en">English</option>
            <option value="fr-CA">Francais</option>
            <option value="zh-CN">中文</option>
          </select>
        </label>
        <div className="customer-service-copy">
          <strong>{t.serviceRequests}</strong>
          <span>{t.serviceHelp}</span>
        </div>
        <div
          className="row customer-service-actions"
          aria-label={t.serviceRequests}
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
          <div className="success customer-message">{notice}</div>
        ) : null}
        {error ? <div className="error customer-message">{error}</div> : null}
      </section>

      {menu ? (
        <nav className="category-tabs" aria-label={t.categoryTabs}>
          <a href="#menu">
            <span>{t.allCategories}</span>
            <strong>
              {query.trim()
                ? `${visibleItemCount}/${totalMenuItemCount}`
                : totalMenuItemCount}
            </strong>
          </a>
          {menu.categories.map((category) => (
            <a href={`#${sectionId(category.id)}`} key={category.id}>
              <span>{category.name}</span>
              <strong>{category.items.length}</strong>
            </a>
          ))}
        </nav>
      ) : null}

      <section className="grid customer-menu-grid" id="menu">
        {menu && filteredCategories.length === 0 ? (
          <div className="card empty-state">
            <h2>{t.emptyMenuTitle}</h2>
            <p>{t.emptyMenuBody}</p>
            <button className="btn ghost" onClick={() => setQuery("")}>
              {t.clearSearch}
            </button>
          </div>
        ) : null}
        {filteredCategories.map((category) => (
          <div className="card" id={sectionId(category.id)} key={category.id}>
            <div className="row between">
              <h2>
                {t.menu} / {category.name}
              </h2>
              <span className="meta">
                {countLabel(
                  category.items.length,
                  t.itemSingular,
                  t.itemPlural,
                  language,
                )}
              </span>
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
                      <img
                        className="menu-thumb"
                        src={item.imageUrl}
                        alt={displayName}
                      />
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
                        {itemQuantityInCart > 0 ? (
                          <span className="status ok">
                            {itemQuantityInCart} {t.selectedInCart}
                          </span>
                        ) : null}
                        {item.spiceLevel > 0 ? (
                          <span className="status checkout">
                            {t.spice} {item.spiceLevel}/5
                          </span>
                        ) : null}
                        {item.allergens.length > 0 ? (
                          <span className="meta">
                            {t.allergens}: {item.allergens.join(", ")}
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
                                        <option value="">{t.none}</option>
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
          id="status"
          className="customer-status-panel"
          open={activeOrderCount > 0 || pendingRequestCount > 0}
        >
          <summary>
            <span>
              <strong>{t.viewStatus}</strong>
              <span className="meta">
                {activeOrderCount} {t.openStatus} / {pendingRequestCount}{" "}
                {t.serviceRequests}
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
                <span className="meta">{t.subtotal}</span>
                <span>
                  {formatCents(
                    orders.openTotals.subtotalCents,
                    orders.store.currency,
                    orders.store.locale,
                  )}
                </span>
              </div>
              {orders.openTotals.serviceChargeCents > 0 ? (
                <div className="row between">
                  <span className="meta">
                    {orders.openTotals.serviceChargeLabel || t.serviceCharge}
                  </span>
                  <span>
                    {formatCents(
                      orders.openTotals.serviceChargeCents,
                      orders.store.currency,
                      orders.store.locale,
                    )}
                  </span>
                </div>
              ) : null}
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
              {orders.openTotals.includedTaxCents > 0 ? (
                <div className="row between">
                  <span className="meta">{t.includedTax}</span>
                  <span className="meta">
                    {formatCents(
                      orders.openTotals.includedTaxCents,
                      orders.store.currency,
                      orders.store.locale,
                    )}
                  </span>
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
                      {requestStatusLabel(request.status, language)}
                    </span>
                  </div>
                ))}
                {orders.serviceRequests.length === 0 ? (
                  <span className="meta">{t.noServiceRequests}</span>
                ) : null}
              </div>
            </article>

            <article className="card grid order-history">
              <h2>{t.orders}</h2>
              <div className="list">
                {orders.orders.map((order) => (
                  <div className="list-item order-card" key={order.id}>
                    <div className="row between">
                      <strong>
                        {t.orderLabel} {order.id.slice(0, 8)}
                      </strong>
                      <span
                        className={`status ${
                          order.status === "SUBMITTED"
                            ? "checkout"
                            : order.status === "CLOSED"
                              ? "ok"
                              : "urgent"
                        }`}
                      >
                        {orderStatusLabel(order.status, language)}
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
                              {itemStatusLabel(item.status, language)}
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
                      <span className="meta">{t.total}</span>
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
                  <span className="meta">{t.noOrders}</span>
                ) : null}
              </div>
            </article>
          </section>
        </details>
      ) : null}

      {cart.length > 0 ? (
        <div className="cart-bar" id="cart">
          <div className="card grid">
            <div className="row between">
              <div>
                <strong>{t.cartTitle}</strong>
                <div className="meta">
                  {countLabel(
                    totalQuantity,
                    t.itemSingular,
                    t.itemPlural,
                    language,
                  )}{" "}
                  /{" "}
                  {formatCents(
                    totalCents,
                    menu?.store.currency,
                    menu?.store.locale,
                  )}
                </div>
                <div className="meta">{t.cartHelp}</div>
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
                <div className="cart-line" key={`${line.menuItemId}-${index}`}>
                  <div>
                    <strong>{line.name}</strong>
                    <div className="meta">
                      {line.modifiers.length > 0
                        ? line.modifiers.map(modifierName).join(" / ")
                        : t.none}
                    </div>
                    {line.note ? <div className="meta">{line.note}</div> : null}
                  </div>
                  <div className="quantity-stepper">
                    <button
                      className="btn ghost"
                      type="button"
                      aria-label={`${t.decrease} ${line.name}`}
                      onClick={() => updateCartLine(index, line.quantity - 1)}
                    >
                      -
                    </button>
                    <span>{line.quantity}</span>
                    <button
                      className="btn ghost"
                      type="button"
                      aria-label={`${t.increase} ${line.name}`}
                      onClick={() => updateCartLine(index, line.quantity + 1)}
                      disabled={line.quantity >= line.maxQuantity}
                    >
                      +
                    </button>
                  </div>
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
