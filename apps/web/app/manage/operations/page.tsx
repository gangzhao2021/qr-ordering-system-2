"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type {
  Coupon,
  Ingredient,
  KdsDevice,
  ManageMenuResponse,
  ManageOperationsResponse,
  MenuRecipe,
  Member,
  Supplier,
} from "@qr2/shared";
import { formatCents } from "@qr2/shared";
import { apiFetch } from "../../../lib/api";
import {
  AuthGate,
  StaffSessionBar,
  useRequireRole,
} from "../../../lib/auth-client";

type SupplierForm = {
  name: string;
  contactName: string;
  phone: string;
  email: string;
  notes: string;
  isActive: boolean;
};

type AdjustmentForm = {
  menuItemId: string;
  quantityDelta: string;
  reason: string;
  note: string;
};

type StocktakeLineForm = {
  menuItemId: string;
  countedQuantity: string;
  note: string;
};

type StocktakeForm = {
  name: string;
  note: string;
  countedAt: string;
  lines: StocktakeLineForm[];
};

type IngredientForm = {
  name: string;
  unit: string;
  stockQuantity: string;
  unitCostCents: string;
  lowStockThreshold: string;
  isActive: boolean;
};

type RecipeLineForm = {
  ingredientId: string;
  quantity: string;
  note: string;
};

type RecipeForm = {
  menuItemId: string;
  yieldQuantity: string;
  note: string;
  lines: RecipeLineForm[];
};

type MemberForm = {
  name: string;
  phone: string;
  email: string;
  points: string;
};

type CouponForm = {
  code: string;
  discountType: "PERCENT" | "AMOUNT";
  discountValue: string;
  minimumSubtotalCents: string;
  isActive: boolean;
  startsAt: string;
  endsAt: string;
};

type KdsForm = {
  name: string;
  station: string;
  token: string;
  isActive: boolean;
};

const initialSupplier: SupplierForm = {
  name: "",
  contactName: "",
  phone: "",
  email: "",
  notes: "",
  isActive: true,
};

const initialAdjustment: AdjustmentForm = {
  menuItemId: "",
  quantityDelta: "1",
  reason: "Stock count",
  note: "",
};

const initialStocktake: StocktakeForm = {
  name: "",
  note: "",
  countedAt: "",
  lines: [{ menuItemId: "", countedQuantity: "0", note: "" }],
};

const initialIngredient: IngredientForm = {
  name: "",
  unit: "unit",
  stockQuantity: "0",
  unitCostCents: "0",
  lowStockThreshold: "0",
  isActive: true,
};

const initialRecipe: RecipeForm = {
  menuItemId: "",
  yieldQuantity: "1",
  note: "",
  lines: [{ ingredientId: "", quantity: "1", note: "" }],
};

const initialMember: MemberForm = {
  name: "",
  phone: "",
  email: "",
  points: "0",
};

const initialCoupon: CouponForm = {
  code: "",
  discountType: "PERCENT",
  discountValue: "10",
  minimumSubtotalCents: "0",
  isActive: true,
  startsAt: "",
  endsAt: "",
};

const initialKds: KdsForm = {
  name: "",
  station: "",
  token: "",
  isActive: true,
};

function optional(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function datetimeLocalToIso(value: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function isoToDatetimeLocal(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (input: number) => String(input).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatDateTime(value?: string | null) {
  if (!value) return "Never";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function signed(value: number) {
  return value > 0 ? `+${value}` : String(value);
}

function stockLabel(value?: number | null) {
  return value === null || value === undefined ? "Untracked" : String(value);
}

function formatBps(value: number) {
  return `${(value / 100).toFixed(1)}%`;
}

function supplierForm(entry: Supplier): SupplierForm {
  return {
    name: entry.name,
    contactName: entry.contactName ?? "",
    phone: entry.phone ?? "",
    email: entry.email ?? "",
    notes: entry.notes ?? "",
    isActive: entry.isActive,
  };
}

function memberForm(entry: Member): MemberForm {
  return {
    name: entry.name ?? "",
    phone: entry.phone,
    email: entry.email ?? "",
    points: String(entry.points),
  };
}

function couponForm(entry: Coupon): CouponForm {
  return {
    code: entry.code,
    discountType: entry.discountType,
    discountValue: String(entry.discountValue),
    minimumSubtotalCents: String(entry.minimumSubtotalCents),
    isActive: entry.isActive,
    startsAt: isoToDatetimeLocal(entry.startsAt),
    endsAt: isoToDatetimeLocal(entry.endsAt),
  };
}

function kdsForm(entry: KdsDevice): KdsForm {
  return {
    name: entry.name,
    station: entry.station ?? "",
    token: entry.token,
    isActive: entry.isActive,
  };
}

function ingredientForm(entry: Ingredient): IngredientForm {
  return {
    name: entry.name,
    unit: entry.unit,
    stockQuantity: String(entry.stockQuantity),
    unitCostCents: String(entry.unitCostCents),
    lowStockThreshold: String(entry.lowStockThreshold),
    isActive: entry.isActive,
  };
}

export default function ManageOperationsPage() {
  const auth = useRequireRole(["DEV", "ADMIN"]);
  const [operations, setOperations] = useState<ManageOperationsResponse | null>(
    null,
  );
  const [menu, setMenu] = useState<ManageMenuResponse | null>(null);
  const [supplier, setSupplier] = useState<SupplierForm>(initialSupplier);
  const [adjustment, setAdjustment] =
    useState<AdjustmentForm>(initialAdjustment);
  const [stocktake, setStocktake] = useState<StocktakeForm>(initialStocktake);
  const [ingredient, setIngredient] =
    useState<IngredientForm>(initialIngredient);
  const [recipe, setRecipe] = useState<RecipeForm>(initialRecipe);
  const [member, setMember] = useState<MemberForm>(initialMember);
  const [coupon, setCoupon] = useState<CouponForm>(initialCoupon);
  const [kds, setKds] = useState<KdsForm>(initialKds);
  const [supplierDrafts, setSupplierDrafts] = useState<
    Record<string, SupplierForm>
  >({});
  const [memberDrafts, setMemberDrafts] = useState<Record<string, MemberForm>>(
    {},
  );
  const [couponDrafts, setCouponDrafts] = useState<Record<string, CouponForm>>(
    {},
  );
  const [ingredientDrafts, setIngredientDrafts] = useState<
    Record<string, IngredientForm>
  >({});
  const [kdsDrafts, setKdsDrafts] = useState<Record<string, KdsForm>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const menuItems = useMemo(
    () => menu?.categories.flatMap((category) => category.items) ?? [],
    [menu],
  );
  const trackedMenuItems = useMemo(
    () =>
      menuItems.filter(
        (item) =>
          item.stockQuantity !== null && item.stockQuantity !== undefined,
      ),
    [menuItems],
  );
  const recipeMenuItems = useMemo(
    () => menuItems.filter((item) => item.isAvailable),
    [menuItems],
  );
  const ingredients = useMemo(
    () => operations?.ingredients ?? [],
    [operations?.ingredients],
  );

  async function refresh() {
    setError(null);
    try {
      const [operationsResult, menuResult] = await Promise.all([
        apiFetch<ManageOperationsResponse>("/v1/manage/operations"),
        apiFetch<ManageMenuResponse>("/v1/manage/menu"),
      ]);
      setOperations(operationsResult);
      setMenu(menuResult);
      setSupplierDrafts(
        Object.fromEntries(
          operationsResult.suppliers.map((entry) => [
            entry.id,
            supplierForm(entry),
          ]),
        ),
      );
      setMemberDrafts(
        Object.fromEntries(
          operationsResult.members.map((entry) => [
            entry.id,
            memberForm(entry),
          ]),
        ),
      );
      setCouponDrafts(
        Object.fromEntries(
          operationsResult.coupons.map((entry) => [
            entry.id,
            couponForm(entry),
          ]),
        ),
      );
      setIngredientDrafts(
        Object.fromEntries(
          operationsResult.ingredients.map((entry) => [
            entry.id,
            ingredientForm(entry),
          ]),
        ),
      );
      setKdsDrafts(
        Object.fromEntries(
          operationsResult.kdsDevices.map((entry) => [
            entry.id,
            kdsForm(entry),
          ]),
        ),
      );
      setAdjustment((current) => ({
        ...current,
        menuItemId:
          current.menuItemId ||
          menuResult.categories
            .flatMap((category) => category.items)
            .find(
              (item) =>
                item.stockQuantity !== null && item.stockQuantity !== undefined,
            )?.id ||
          menuResult.categories[0]?.items[0]?.id ||
          "",
      }));
      setStocktake((current) => {
        const firstTracked = menuResult.categories
          .flatMap((category) => category.items)
          .find(
            (item) =>
              item.stockQuantity !== null && item.stockQuantity !== undefined,
          );
        if (!firstTracked || current.lines.some((line) => line.menuItemId)) {
          return current;
        }
        return {
          ...current,
          lines: [
            {
              menuItemId: firstTracked.id,
              countedQuantity: String(firstTracked.stockQuantity ?? 0),
              note: "",
            },
          ],
        };
      });
      setRecipe((current) => {
        const firstMenuItem = menuResult.categories
          .flatMap((category) => category.items)
          .find((item) => item.isAvailable);
        const firstIngredient = operationsResult.ingredients.find(
          (entry) => entry.isActive,
        );
        if (current.menuItemId || !firstMenuItem) return current;
        return {
          ...current,
          menuItemId: firstMenuItem.id,
          lines: [
            {
              ingredientId: firstIngredient?.id ?? "",
              quantity: "1",
              note: "",
            },
          ],
        };
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  useEffect(() => {
    if (auth.user) void refresh();
  }, [auth.user]);

  async function submitSupplier(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await apiFetch("/v1/manage/operations/suppliers", {
        method: "POST",
        body: JSON.stringify({
          name: supplier.name,
          contactName: optional(supplier.contactName),
          phone: optional(supplier.phone),
          email: optional(supplier.email),
          notes: optional(supplier.notes),
        }),
      });
      setSupplier(initialSupplier);
      setNotice("Supplier saved.");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function submitAdjustment(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await apiFetch("/v1/manage/operations/inventory-adjustments", {
        method: "POST",
        body: JSON.stringify({
          menuItemId: adjustment.menuItemId,
          quantityDelta: Number(adjustment.quantityDelta || 0),
          reason: adjustment.reason,
          note: optional(adjustment.note),
        }),
      });
      setAdjustment((current) => ({
        ...initialAdjustment,
        menuItemId: current.menuItemId,
      }));
      setNotice("Inventory adjustment saved.");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  function updateStocktakeLine(
    index: number,
    patch: Partial<StocktakeLineForm>,
  ) {
    setStocktake((current) => ({
      ...current,
      lines: current.lines.map((line, lineIndex) =>
        lineIndex === index ? { ...line, ...patch } : line,
      ),
    }));
  }

  function addStocktakeLine() {
    const firstItem = trackedMenuItems[0];
    setStocktake((current) => ({
      ...current,
      lines: [
        ...current.lines,
        {
          menuItemId: firstItem?.id ?? "",
          countedQuantity: String(firstItem?.stockQuantity ?? 0),
          note: "",
        },
      ],
    }));
  }

  function removeStocktakeLine(index: number) {
    setStocktake((current) => ({
      ...current,
      lines:
        current.lines.length <= 1
          ? current.lines
          : current.lines.filter((_, lineIndex) => lineIndex !== index),
    }));
  }

  async function submitStocktake(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await apiFetch("/v1/manage/operations/stocktakes", {
        method: "POST",
        body: JSON.stringify({
          name: stocktake.name,
          note: optional(stocktake.note),
          countedAt: datetimeLocalToIso(stocktake.countedAt),
          lines: stocktake.lines
            .filter((line) => line.menuItemId)
            .map((line) => ({
              menuItemId: line.menuItemId,
              countedQuantity: Number(line.countedQuantity || 0),
              note: optional(line.note),
            })),
        }),
      });
      const firstItem = trackedMenuItems[0];
      setStocktake({
        ...initialStocktake,
        lines: [
          {
            menuItemId: firstItem?.id ?? "",
            countedQuantity: String(firstItem?.stockQuantity ?? 0),
            note: "",
          },
        ],
      });
      setNotice("Stocktake applied.");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function submitIngredient(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await apiFetch("/v1/manage/operations/ingredients", {
        method: "POST",
        body: JSON.stringify({
          name: ingredient.name,
          unit: ingredient.unit,
          stockQuantity: Number(ingredient.stockQuantity || 0),
          unitCostCents: Number(ingredient.unitCostCents || 0),
          lowStockThreshold: Number(ingredient.lowStockThreshold || 0),
          isActive: ingredient.isActive,
        }),
      });
      setIngredient(initialIngredient);
      setNotice("Ingredient saved.");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function submitRecipe(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await apiFetch("/v1/manage/operations/recipes", {
        method: "POST",
        body: JSON.stringify({
          menuItemId: recipe.menuItemId,
          yieldQuantity: Number(recipe.yieldQuantity || 1),
          note: optional(recipe.note),
          lines: recipe.lines
            .filter((line) => line.ingredientId)
            .map((line) => ({
              ingredientId: line.ingredientId,
              quantity: Number(line.quantity || 0),
              note: optional(line.note),
            })),
        }),
      });
      setNotice("Recipe saved.");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function submitMember(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await apiFetch("/v1/manage/operations/members", {
        method: "POST",
        body: JSON.stringify({
          name: optional(member.name),
          phone: member.phone,
          email: optional(member.email),
          points: Number(member.points || 0),
        }),
      });
      setMember(initialMember);
      setNotice("Member saved.");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function submitCoupon(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await apiFetch("/v1/manage/operations/coupons", {
        method: "POST",
        body: JSON.stringify({
          code: coupon.code,
          discountType: coupon.discountType,
          discountValue: Number(coupon.discountValue || 0),
          minimumSubtotalCents: Number(coupon.minimumSubtotalCents || 0),
          isActive: coupon.isActive,
          startsAt: datetimeLocalToIso(coupon.startsAt),
          endsAt: datetimeLocalToIso(coupon.endsAt),
        }),
      });
      setCoupon(initialCoupon);
      setNotice("Coupon saved.");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function submitKds(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await apiFetch("/v1/manage/operations/kds-devices", {
        method: "POST",
        body: JSON.stringify({
          name: kds.name,
          station: optional(kds.station),
          token: optional(kds.token) ?? undefined,
          isActive: kds.isActive,
        }),
      });
      setKds(initialKds);
      setNotice("KDS device saved.");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  function updateSupplierDraft(id: string, patch: Partial<SupplierForm>) {
    setSupplierDrafts((current) => ({
      ...current,
      [id]: { ...(current[id] ?? initialSupplier), ...patch },
    }));
  }

  function updateMemberDraft(id: string, patch: Partial<MemberForm>) {
    setMemberDrafts((current) => ({
      ...current,
      [id]: { ...(current[id] ?? initialMember), ...patch },
    }));
  }

  function updateCouponDraft(id: string, patch: Partial<CouponForm>) {
    setCouponDrafts((current) => ({
      ...current,
      [id]: { ...(current[id] ?? initialCoupon), ...patch },
    }));
  }

  function updateIngredientDraft(id: string, patch: Partial<IngredientForm>) {
    setIngredientDrafts((current) => ({
      ...current,
      [id]: { ...(current[id] ?? initialIngredient), ...patch },
    }));
  }

  function updateKdsDraft(id: string, patch: Partial<KdsForm>) {
    setKdsDrafts((current) => ({
      ...current,
      [id]: { ...(current[id] ?? initialKds), ...patch },
    }));
  }

  function recipeToForm(entry: MenuRecipe): RecipeForm {
    return {
      menuItemId: entry.menuItemId,
      yieldQuantity: String(entry.yieldQuantity),
      note: entry.note ?? "",
      lines: entry.lines.map((line) => ({
        ingredientId: line.ingredientId,
        quantity: String(line.quantity),
        note: line.note ?? "",
      })),
    };
  }

  function selectRecipeMenuItem(menuItemId: string) {
    const existing = operations?.recipes.find(
      (entry) => entry.menuItemId === menuItemId,
    );
    if (existing) {
      setRecipe(recipeToForm(existing));
      return;
    }
    const firstIngredient = operations?.ingredients.find(
      (entry) => entry.isActive,
    );
    setRecipe({
      menuItemId,
      yieldQuantity: "1",
      note: "",
      lines: [
        {
          ingredientId: firstIngredient?.id ?? "",
          quantity: "1",
          note: "",
        },
      ],
    });
  }

  function updateRecipeLine(index: number, patch: Partial<RecipeLineForm>) {
    setRecipe((current) => ({
      ...current,
      lines: current.lines.map((line, lineIndex) =>
        lineIndex === index ? { ...line, ...patch } : line,
      ),
    }));
  }

  function addRecipeLine() {
    const firstIngredient = operations?.ingredients.find(
      (entry) => entry.isActive,
    );
    setRecipe((current) => ({
      ...current,
      lines: [
        ...current.lines,
        { ingredientId: firstIngredient?.id ?? "", quantity: "1", note: "" },
      ],
    }));
  }

  function removeRecipeLine(index: number) {
    setRecipe((current) => ({
      ...current,
      lines:
        current.lines.length <= 1
          ? current.lines
          : current.lines.filter((_, lineIndex) => lineIndex !== index),
    }));
  }

  async function saveSupplier(entry: Supplier) {
    const draft = supplierDrafts[entry.id] ?? supplierForm(entry);
    setError(null);
    try {
      await apiFetch(`/v1/manage/operations/suppliers/${entry.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: draft.name,
          contactName: optional(draft.contactName),
          phone: optional(draft.phone),
          email: optional(draft.email),
          notes: optional(draft.notes),
          isActive: draft.isActive,
        }),
      });
      setNotice("Supplier updated.");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function saveIngredient(entry: Ingredient) {
    const draft = ingredientDrafts[entry.id] ?? ingredientForm(entry);
    setError(null);
    try {
      await apiFetch(`/v1/manage/operations/ingredients/${entry.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: draft.name,
          unit: draft.unit,
          stockQuantity: Number(draft.stockQuantity || 0),
          unitCostCents: Number(draft.unitCostCents || 0),
          lowStockThreshold: Number(draft.lowStockThreshold || 0),
          isActive: draft.isActive,
        }),
      });
      setNotice("Ingredient updated.");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function saveMember(entry: Member) {
    const draft = memberDrafts[entry.id] ?? memberForm(entry);
    setError(null);
    try {
      await apiFetch(`/v1/manage/operations/members/${entry.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: optional(draft.name),
          phone: draft.phone,
          email: optional(draft.email),
          points: Number(draft.points || 0),
        }),
      });
      setNotice("Member updated.");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function saveCoupon(entry: Coupon) {
    const draft = couponDrafts[entry.id] ?? couponForm(entry);
    setError(null);
    try {
      await apiFetch(`/v1/manage/operations/coupons/${entry.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          code: draft.code,
          discountType: draft.discountType,
          discountValue: Number(draft.discountValue || 0),
          minimumSubtotalCents: Number(draft.minimumSubtotalCents || 0),
          isActive: draft.isActive,
          startsAt: datetimeLocalToIso(draft.startsAt),
          endsAt: datetimeLocalToIso(draft.endsAt),
        }),
      });
      setNotice("Coupon updated.");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function saveKdsDevice(entry: KdsDevice) {
    const draft = kdsDrafts[entry.id] ?? kdsForm(entry);
    setError(null);
    try {
      await apiFetch(`/v1/manage/operations/kds-devices/${entry.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: draft.name,
          station: optional(draft.station),
          token: optional(draft.token) ?? undefined,
          isActive: draft.isActive,
        }),
      });
      setNotice("KDS device updated.");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <AuthGate state={auth}>
      <main className="page">
        <StaffSessionBar user={auth.user} />
        <section className="page-header">
          <h1>Operations</h1>
          <p>
            Manage purchasing contacts, item stock movement, ingredient costs,
            recipes, loyalty members, coupons, KDS devices, and audit history.
          </p>
        </section>
        {error ? <div className="error card">{error}</div> : null}
        {notice ? <div className="success card">{notice}</div> : null}

        <section className="grid two">
          <form
            className="card grid"
            onSubmit={(event) => void submitSupplier(event)}
          >
            <h2>Supplier</h2>
            <label className="field">
              <span>Name</span>
              <input
                className="input"
                value={supplier.name}
                onChange={(event) =>
                  setSupplier((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
              />
            </label>
            <div className="grid two">
              <label className="field">
                <span>Contact</span>
                <input
                  className="input"
                  value={supplier.contactName}
                  onChange={(event) =>
                    setSupplier((current) => ({
                      ...current,
                      contactName: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="field">
                <span>Phone</span>
                <input
                  className="input"
                  value={supplier.phone}
                  onChange={(event) =>
                    setSupplier((current) => ({
                      ...current,
                      phone: event.target.value,
                    }))
                  }
                />
              </label>
            </div>
            <label className="field">
              <span>Email</span>
              <input
                className="input"
                value={supplier.email}
                onChange={(event) =>
                  setSupplier((current) => ({
                    ...current,
                    email: event.target.value,
                  }))
                }
              />
            </label>
            <label className="field">
              <span>Notes</span>
              <textarea
                className="input textarea"
                value={supplier.notes}
                onChange={(event) =>
                  setSupplier((current) => ({
                    ...current,
                    notes: event.target.value,
                  }))
                }
              />
            </label>
            <button className="btn primary" disabled={!supplier.name.trim()}>
              Save supplier
            </button>
          </form>

          <form
            className="card grid"
            onSubmit={(event) => void submitAdjustment(event)}
          >
            <h2>Inventory adjustment</h2>
            <label className="field">
              <span>Menu item</span>
              <select
                className="select"
                value={adjustment.menuItemId}
                onChange={(event) =>
                  setAdjustment((current) => ({
                    ...current,
                    menuItemId: event.target.value,
                  }))
                }
              >
                {menuItems.map((item) => (
                  <option value={item.id} key={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid two">
              <label className="field">
                <span>Quantity delta</span>
                <input
                  className="input"
                  value={adjustment.quantityDelta}
                  inputMode="numeric"
                  onChange={(event) =>
                    setAdjustment((current) => ({
                      ...current,
                      quantityDelta: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="field">
                <span>Reason</span>
                <input
                  className="input"
                  value={adjustment.reason}
                  onChange={(event) =>
                    setAdjustment((current) => ({
                      ...current,
                      reason: event.target.value,
                    }))
                  }
                />
              </label>
            </div>
            <label className="field">
              <span>Note</span>
              <textarea
                className="input textarea"
                value={adjustment.note}
                onChange={(event) =>
                  setAdjustment((current) => ({
                    ...current,
                    note: event.target.value,
                  }))
                }
              />
            </label>
            <button
              className="btn primary"
              disabled={!adjustment.menuItemId || !adjustment.reason.trim()}
            >
              Save adjustment
            </button>
          </form>

          <form
            className="card grid"
            onSubmit={(event) => void submitStocktake(event)}
          >
            <div className="row between">
              <h2>Stocktake</h2>
              <button
                className="btn ghost"
                type="button"
                onClick={addStocktakeLine}
              >
                Add line
              </button>
            </div>
            <div className="grid two">
              <label className="field">
                <span>Name</span>
                <input
                  className="input"
                  value={stocktake.name}
                  placeholder="Daily count"
                  onChange={(event) =>
                    setStocktake((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="field">
                <span>Counted at</span>
                <input
                  className="input"
                  type="datetime-local"
                  value={stocktake.countedAt}
                  onChange={(event) =>
                    setStocktake((current) => ({
                      ...current,
                      countedAt: event.target.value,
                    }))
                  }
                />
              </label>
            </div>
            <div className="operations-edit-list">
              {stocktake.lines.map((line, index) => {
                const item = trackedMenuItems.find(
                  (entry) => entry.id === line.menuItemId,
                );
                return (
                  <div
                    className="operations-record-card"
                    key={`${line.menuItemId}-${index}`}
                  >
                    <div className="operations-record-grid">
                      <label className="field">
                        <span>Menu item</span>
                        <select
                          className="select"
                          value={line.menuItemId}
                          onChange={(event) => {
                            const nextItem = trackedMenuItems.find(
                              (entry) => entry.id === event.target.value,
                            );
                            updateStocktakeLine(index, {
                              menuItemId: event.target.value,
                              countedQuantity: String(
                                nextItem?.stockQuantity ?? 0,
                              ),
                            });
                          }}
                        >
                          {trackedMenuItems.map((entry) => (
                            <option value={entry.id} key={entry.id}>
                              {entry.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="field">
                        <span>Expected</span>
                        <input
                          className="input"
                          value={stockLabel(item?.stockQuantity)}
                          disabled
                        />
                      </label>
                      <label className="field">
                        <span>Counted</span>
                        <input
                          className="input"
                          inputMode="numeric"
                          value={line.countedQuantity}
                          onChange={(event) =>
                            updateStocktakeLine(index, {
                              countedQuantity: event.target.value,
                            })
                          }
                        />
                      </label>
                      <label className="field">
                        <span>Line note</span>
                        <input
                          className="input"
                          value={line.note}
                          onChange={(event) =>
                            updateStocktakeLine(index, {
                              note: event.target.value,
                            })
                          }
                        />
                      </label>
                    </div>
                    <button
                      className="btn ghost"
                      type="button"
                      disabled={stocktake.lines.length <= 1}
                      onClick={() => removeStocktakeLine(index)}
                    >
                      Remove line
                    </button>
                  </div>
                );
              })}
            </div>
            <label className="field">
              <span>Note</span>
              <textarea
                className="input textarea"
                value={stocktake.note}
                onChange={(event) =>
                  setStocktake((current) => ({
                    ...current,
                    note: event.target.value,
                  }))
                }
              />
            </label>
            <button
              className="btn primary"
              disabled={
                !stocktake.name.trim() ||
                trackedMenuItems.length === 0 ||
                stocktake.lines.every((line) => !line.menuItemId)
              }
            >
              Apply stocktake
            </button>
          </form>

          <form
            className="card grid"
            onSubmit={(event) => void submitIngredient(event)}
          >
            <h2>Ingredient</h2>
            <div className="grid two">
              <label className="field">
                <span>Name</span>
                <input
                  className="input"
                  value={ingredient.name}
                  onChange={(event) =>
                    setIngredient((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="field">
                <span>Unit</span>
                <input
                  className="input"
                  value={ingredient.unit}
                  placeholder="g, ml, unit"
                  onChange={(event) =>
                    setIngredient((current) => ({
                      ...current,
                      unit: event.target.value,
                    }))
                  }
                />
              </label>
            </div>
            <div className="grid two">
              <label className="field">
                <span>Stock quantity</span>
                <input
                  className="input"
                  inputMode="numeric"
                  value={ingredient.stockQuantity}
                  onChange={(event) =>
                    setIngredient((current) => ({
                      ...current,
                      stockQuantity: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="field">
                <span>Unit cost</span>
                <input
                  className="input"
                  inputMode="numeric"
                  value={ingredient.unitCostCents}
                  onChange={(event) =>
                    setIngredient((current) => ({
                      ...current,
                      unitCostCents: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="field">
                <span>Low stock threshold</span>
                <input
                  className="input"
                  inputMode="numeric"
                  value={ingredient.lowStockThreshold}
                  onChange={(event) =>
                    setIngredient((current) => ({
                      ...current,
                      lowStockThreshold: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="field checkbox-field">
                <span>Active</span>
                <input
                  type="checkbox"
                  checked={ingredient.isActive}
                  onChange={(event) =>
                    setIngredient((current) => ({
                      ...current,
                      isActive: event.target.checked,
                    }))
                  }
                />
              </label>
            </div>
            <button
              className="btn primary"
              disabled={!ingredient.name.trim() || !ingredient.unit.trim()}
            >
              Save ingredient
            </button>
          </form>

          <form
            className="card grid"
            onSubmit={(event) => void submitRecipe(event)}
          >
            <div className="row between">
              <h2>Recipe</h2>
              <button
                className="btn ghost"
                type="button"
                onClick={addRecipeLine}
              >
                Add line
              </button>
            </div>
            <label className="field">
              <span>Menu item</span>
              <select
                className="select"
                value={recipe.menuItemId}
                onChange={(event) => selectRecipeMenuItem(event.target.value)}
              >
                {recipeMenuItems.length === 0 ? (
                  <option value="">No available menu items</option>
                ) : null}
                {recipeMenuItems.map((item) => (
                  <option value={item.id} key={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid two">
              <label className="field">
                <span>Yield quantity</span>
                <input
                  className="input"
                  inputMode="numeric"
                  value={recipe.yieldQuantity}
                  onChange={(event) =>
                    setRecipe((current) => ({
                      ...current,
                      yieldQuantity: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="field">
                <span>Note</span>
                <input
                  className="input"
                  value={recipe.note}
                  onChange={(event) =>
                    setRecipe((current) => ({
                      ...current,
                      note: event.target.value,
                    }))
                  }
                />
              </label>
            </div>
            <div className="operations-edit-list">
              {recipe.lines.map((line, index) => {
                const selectedIngredient = ingredients.find(
                  (entry) => entry.id === line.ingredientId,
                );
                const lineCostCents =
                  (selectedIngredient?.unitCostCents ?? 0) *
                  Number(line.quantity || 0);
                return (
                  <div
                    className="operations-record-card"
                    key={`${line.ingredientId}-${index}`}
                  >
                    <div className="operations-record-grid">
                      <label className="field">
                        <span>Ingredient</span>
                        <select
                          className="select"
                          value={line.ingredientId}
                          onChange={(event) =>
                            updateRecipeLine(index, {
                              ingredientId: event.target.value,
                            })
                          }
                        >
                          {ingredients.length === 0 ? (
                            <option value="">No ingredients</option>
                          ) : null}
                          {ingredients.map((entry) => (
                            <option value={entry.id} key={entry.id}>
                              {entry.name}
                              {entry.isActive ? "" : " (inactive)"}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="field">
                        <span>Quantity</span>
                        <input
                          className="input"
                          inputMode="numeric"
                          value={line.quantity}
                          onChange={(event) =>
                            updateRecipeLine(index, {
                              quantity: event.target.value,
                            })
                          }
                        />
                      </label>
                      <label className="field">
                        <span>Line note</span>
                        <input
                          className="input"
                          value={line.note}
                          onChange={(event) =>
                            updateRecipeLine(index, {
                              note: event.target.value,
                            })
                          }
                        />
                      </label>
                      <label className="field">
                        <span>Line cost</span>
                        <input
                          className="input"
                          value={formatCents(
                            lineCostCents,
                            operations?.store.currency,
                            operations?.store.locale,
                          )}
                          disabled
                        />
                      </label>
                    </div>
                    <button
                      className="btn ghost"
                      type="button"
                      disabled={recipe.lines.length <= 1}
                      onClick={() => removeRecipeLine(index)}
                    >
                      Remove line
                    </button>
                  </div>
                );
              })}
            </div>
            <button
              className="btn primary"
              disabled={
                !recipe.menuItemId ||
                ingredients.length === 0 ||
                recipe.lines.every((line) => !line.ingredientId)
              }
            >
              Save recipe
            </button>
          </form>

          <form
            className="card grid"
            onSubmit={(event) => void submitMember(event)}
          >
            <h2>Member</h2>
            <label className="field">
              <span>Phone</span>
              <input
                className="input"
                value={member.phone}
                onChange={(event) =>
                  setMember((current) => ({
                    ...current,
                    phone: event.target.value,
                  }))
                }
              />
            </label>
            <div className="grid two">
              <label className="field">
                <span>Name</span>
                <input
                  className="input"
                  value={member.name}
                  onChange={(event) =>
                    setMember((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="field">
                <span>Points</span>
                <input
                  className="input"
                  value={member.points}
                  inputMode="numeric"
                  onChange={(event) =>
                    setMember((current) => ({
                      ...current,
                      points: event.target.value,
                    }))
                  }
                />
              </label>
            </div>
            <label className="field">
              <span>Email</span>
              <input
                className="input"
                value={member.email}
                onChange={(event) =>
                  setMember((current) => ({
                    ...current,
                    email: event.target.value,
                  }))
                }
              />
            </label>
            <button className="btn primary" disabled={!member.phone.trim()}>
              Save member
            </button>
          </form>

          <form
            className="card grid"
            onSubmit={(event) => void submitCoupon(event)}
          >
            <h2>Coupon</h2>
            <div className="grid two">
              <label className="field">
                <span>Code</span>
                <input
                  className="input"
                  value={coupon.code}
                  onChange={(event) =>
                    setCoupon((current) => ({
                      ...current,
                      code: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="field">
                <span>Type</span>
                <select
                  className="select"
                  value={coupon.discountType}
                  onChange={(event) =>
                    setCoupon((current) => ({
                      ...current,
                      discountType: event.target
                        .value as CouponForm["discountType"],
                    }))
                  }
                >
                  <option value="PERCENT">Percent</option>
                  <option value="AMOUNT">Amount</option>
                </select>
              </label>
            </div>
            <div className="grid two">
              <label className="field">
                <span>Value</span>
                <input
                  className="input"
                  value={coupon.discountValue}
                  inputMode="numeric"
                  onChange={(event) =>
                    setCoupon((current) => ({
                      ...current,
                      discountValue: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="field">
                <span>Minimum subtotal</span>
                <input
                  className="input"
                  value={coupon.minimumSubtotalCents}
                  inputMode="numeric"
                  onChange={(event) =>
                    setCoupon((current) => ({
                      ...current,
                      minimumSubtotalCents: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="field checkbox-field">
                <span>Active</span>
                <input
                  type="checkbox"
                  checked={coupon.isActive}
                  onChange={(event) =>
                    setCoupon((current) => ({
                      ...current,
                      isActive: event.target.checked,
                    }))
                  }
                />
              </label>
            </div>
            <div className="grid two">
              <label className="field">
                <span>Starts</span>
                <input
                  className="input"
                  type="datetime-local"
                  value={coupon.startsAt}
                  onChange={(event) =>
                    setCoupon((current) => ({
                      ...current,
                      startsAt: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="field">
                <span>Ends</span>
                <input
                  className="input"
                  type="datetime-local"
                  value={coupon.endsAt}
                  onChange={(event) =>
                    setCoupon((current) => ({
                      ...current,
                      endsAt: event.target.value,
                    }))
                  }
                />
              </label>
            </div>
            <button className="btn primary" disabled={!coupon.code.trim()}>
              Save coupon
            </button>
          </form>

          <form
            className="card grid"
            onSubmit={(event) => void submitKds(event)}
          >
            <h2>KDS device</h2>
            <div className="grid two">
              <label className="field">
                <span>Name</span>
                <input
                  className="input"
                  value={kds.name}
                  onChange={(event) =>
                    setKds((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="field">
                <span>Station</span>
                <input
                  className="input"
                  value={kds.station}
                  onChange={(event) =>
                    setKds((current) => ({
                      ...current,
                      station: event.target.value,
                    }))
                  }
                />
              </label>
            </div>
            <label className="field">
              <span>Token</span>
              <input
                className="input"
                value={kds.token}
                placeholder="Auto-generated"
                onChange={(event) =>
                  setKds((current) => ({
                    ...current,
                    token: event.target.value,
                  }))
                }
              />
            </label>
            <label className="field checkbox-field">
              <span>Active</span>
              <input
                type="checkbox"
                checked={kds.isActive}
                onChange={(event) =>
                  setKds((current) => ({
                    ...current,
                    isActive: event.target.checked,
                  }))
                }
              />
            </label>
            <button className="btn primary" disabled={!kds.name.trim()}>
              Save KDS device
            </button>
          </form>
        </section>

        <section className="grid two operations-section">
          <article className="card grid">
            <h2>Suppliers</h2>
            <div className="operations-edit-list">
              {(operations?.suppliers ?? []).map((entry) => {
                const draft = supplierDrafts[entry.id] ?? supplierForm(entry);
                return (
                  <div className="operations-record-card" key={entry.id}>
                    <div className="row between">
                      <strong>{entry.name}</strong>
                      <span className={draft.isActive ? "status ok" : "status"}>
                        {draft.isActive ? "Active" : "Inactive"}
                      </span>
                    </div>
                    <div className="operations-record-grid">
                      <label className="field">
                        <span>Name</span>
                        <input
                          className="input"
                          value={draft.name}
                          onChange={(event) =>
                            updateSupplierDraft(entry.id, {
                              name: event.target.value,
                            })
                          }
                        />
                      </label>
                      <label className="field">
                        <span>Contact</span>
                        <input
                          className="input"
                          value={draft.contactName}
                          onChange={(event) =>
                            updateSupplierDraft(entry.id, {
                              contactName: event.target.value,
                            })
                          }
                        />
                      </label>
                      <label className="field">
                        <span>Phone</span>
                        <input
                          className="input"
                          value={draft.phone}
                          onChange={(event) =>
                            updateSupplierDraft(entry.id, {
                              phone: event.target.value,
                            })
                          }
                        />
                      </label>
                      <label className="field">
                        <span>Email</span>
                        <input
                          className="input"
                          value={draft.email}
                          onChange={(event) =>
                            updateSupplierDraft(entry.id, {
                              email: event.target.value,
                            })
                          }
                        />
                      </label>
                      <label className="mini-check operations-active-check">
                        <input
                          type="checkbox"
                          checked={draft.isActive}
                          onChange={(event) =>
                            updateSupplierDraft(entry.id, {
                              isActive: event.target.checked,
                            })
                          }
                        />
                        <span>Active</span>
                      </label>
                    </div>
                    <label className="field">
                      <span>Notes</span>
                      <textarea
                        className="input textarea"
                        value={draft.notes}
                        onChange={(event) =>
                          updateSupplierDraft(entry.id, {
                            notes: event.target.value,
                          })
                        }
                      />
                    </label>
                    <button
                      className="btn primary"
                      type="button"
                      disabled={!draft.name.trim()}
                      onClick={() => void saveSupplier(entry)}
                    >
                      Save supplier
                    </button>
                  </div>
                );
              })}
              {operations?.suppliers.length === 0 ? (
                <span className="meta">No suppliers yet.</span>
              ) : null}
            </div>
          </article>

          <article className="card grid">
            <h2>Inventory movement</h2>
            <div className="list compact-list">
              {(operations?.inventoryAdjustments ?? []).map((entry) => (
                <div className="list-item row between" key={entry.id}>
                  <div>
                    <strong>
                      {entry.menuItemName} {signed(entry.quantityDelta)}
                    </strong>
                    <p>
                      {entry.reason}
                      {entry.stocktakeName ? ` / ${entry.stocktakeName}` : ""}
                    </p>
                  </div>
                  <span className="meta">
                    {formatDateTime(entry.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          </article>

          <article className="card grid">
            <h2>Stocktakes</h2>
            <div className="operations-edit-list">
              {(operations?.stocktakes ?? []).map((entry) => (
                <div className="operations-record-card" key={entry.id}>
                  <div className="row between">
                    <div>
                      <strong>{entry.name}</strong>
                      <p>{entry.note || "Applied stock count"}</p>
                    </div>
                    <span className="status ok">{entry.status}</span>
                  </div>
                  <div className="row between">
                    <span className="meta">
                      Counted {formatDateTime(entry.countedAt)}
                    </span>
                    <span className="meta">{entry.lines.length} lines</span>
                  </div>
                  <div className="list compact-list">
                    {entry.lines.slice(0, 5).map((line) => (
                      <div className="row between" key={line.id}>
                        <span>{line.menuItemName}</span>
                        <span
                          className={
                            line.differenceQuantity === 0
                              ? "status"
                              : line.differenceQuantity > 0
                                ? "status ok"
                                : "status urgent"
                          }
                        >
                          {line.expectedQuantity}
                          {" -> "}
                          {line.countedQuantity} (
                          {signed(line.differenceQuantity)})
                        </span>
                      </div>
                    ))}
                    {entry.lines.length > 5 ? (
                      <span className="meta">
                        +{entry.lines.length - 5} more lines
                      </span>
                    ) : null}
                  </div>
                </div>
              ))}
              {operations?.stocktakes.length === 0 ? (
                <span className="meta">No stocktakes yet.</span>
              ) : null}
            </div>
          </article>

          <article className="card grid">
            <h2>Ingredients</h2>
            <div className="operations-edit-list">
              {ingredients.map((entry) => {
                const draft =
                  ingredientDrafts[entry.id] ?? ingredientForm(entry);
                return (
                  <div className="operations-record-card" key={entry.id}>
                    <div className="row between">
                      <strong>{entry.name}</strong>
                      <span
                        className={
                          entry.isLowStock
                            ? "status urgent"
                            : draft.isActive
                              ? "status ok"
                              : "status"
                        }
                      >
                        {entry.isLowStock
                          ? "Low stock"
                          : draft.isActive
                            ? "Active"
                            : "Inactive"}
                      </span>
                    </div>
                    <div className="row between">
                      <span className="meta">
                        {entry.stockQuantity} {entry.unit} on hand
                      </span>
                      <span className="meta">
                        {formatCents(
                          entry.unitCostCents,
                          operations?.store.currency,
                          operations?.store.locale,
                        )}{" "}
                        / {entry.unit}
                      </span>
                    </div>
                    <div className="operations-record-grid">
                      <label className="field">
                        <span>Name</span>
                        <input
                          className="input"
                          value={draft.name}
                          onChange={(event) =>
                            updateIngredientDraft(entry.id, {
                              name: event.target.value,
                            })
                          }
                        />
                      </label>
                      <label className="field">
                        <span>Unit</span>
                        <input
                          className="input"
                          value={draft.unit}
                          onChange={(event) =>
                            updateIngredientDraft(entry.id, {
                              unit: event.target.value,
                            })
                          }
                        />
                      </label>
                      <label className="field">
                        <span>Stock quantity</span>
                        <input
                          className="input"
                          inputMode="numeric"
                          value={draft.stockQuantity}
                          onChange={(event) =>
                            updateIngredientDraft(entry.id, {
                              stockQuantity: event.target.value,
                            })
                          }
                        />
                      </label>
                      <label className="field">
                        <span>Unit cost</span>
                        <input
                          className="input"
                          inputMode="numeric"
                          value={draft.unitCostCents}
                          onChange={(event) =>
                            updateIngredientDraft(entry.id, {
                              unitCostCents: event.target.value,
                            })
                          }
                        />
                      </label>
                      <label className="field">
                        <span>Low stock threshold</span>
                        <input
                          className="input"
                          inputMode="numeric"
                          value={draft.lowStockThreshold}
                          onChange={(event) =>
                            updateIngredientDraft(entry.id, {
                              lowStockThreshold: event.target.value,
                            })
                          }
                        />
                      </label>
                      <label className="mini-check operations-active-check">
                        <input
                          type="checkbox"
                          checked={draft.isActive}
                          onChange={(event) =>
                            updateIngredientDraft(entry.id, {
                              isActive: event.target.checked,
                            })
                          }
                        />
                        <span>Active</span>
                      </label>
                    </div>
                    <button
                      className="btn primary"
                      type="button"
                      disabled={!draft.name.trim() || !draft.unit.trim()}
                      onClick={() => void saveIngredient(entry)}
                    >
                      Save ingredient
                    </button>
                  </div>
                );
              })}
              {ingredients.length === 0 ? (
                <span className="meta">No ingredients yet.</span>
              ) : null}
            </div>
          </article>

          <article className="card grid">
            <h2>Recipes</h2>
            <div className="operations-edit-list">
              {(operations?.recipes ?? []).map((entry) => (
                <div className="operations-record-card" key={entry.id}>
                  <div className="row between">
                    <div>
                      <strong>{entry.menuItemName}</strong>
                      <p>
                        Yield {entry.yieldQuantity} / updated{" "}
                        {formatDateTime(entry.updatedAt)}
                      </p>
                    </div>
                    <span
                      className={
                        entry.marginCents >= 0 ? "status ok" : "status urgent"
                      }
                    >
                      {formatBps(entry.marginBps)} margin
                    </span>
                  </div>
                  <div className="row between">
                    <span className="meta">
                      Price{" "}
                      {formatCents(
                        entry.menuItemPriceCents,
                        operations?.store.currency,
                        operations?.store.locale,
                      )}
                    </span>
                    <span className="meta">
                      Cost{" "}
                      {formatCents(
                        entry.costCents,
                        operations?.store.currency,
                        operations?.store.locale,
                      )}{" "}
                      / margin{" "}
                      {formatCents(
                        entry.marginCents,
                        operations?.store.currency,
                        operations?.store.locale,
                      )}
                    </span>
                  </div>
                  {entry.note ? <p>{entry.note}</p> : null}
                  <div className="list compact-list">
                    {entry.lines.map((line) => (
                      <div className="row between" key={line.id}>
                        <span>
                          {line.ingredientName} x {line.quantity} {line.unit}
                        </span>
                        <span className="meta">
                          {formatCents(
                            line.costCents,
                            operations?.store.currency,
                            operations?.store.locale,
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                  <button
                    className="btn ghost"
                    type="button"
                    onClick={() => setRecipe(recipeToForm(entry))}
                  >
                    Edit recipe
                  </button>
                </div>
              ))}
              {operations?.recipes.length === 0 ? (
                <span className="meta">No recipes yet.</span>
              ) : null}
            </div>
          </article>

          <article className="card grid">
            <h2>Members</h2>
            <div className="operations-edit-list">
              {(operations?.members ?? []).map((entry) => {
                const draft = memberDrafts[entry.id] ?? memberForm(entry);
                return (
                  <div className="operations-record-card" key={entry.id}>
                    <div className="row between">
                      <strong>{entry.name || entry.phone}</strong>
                      <div className="row">
                        <span className="status ok">{entry.points} pts</span>
                        <span className="status">
                          {entry.paymentCount ?? 0} payments
                        </span>
                      </div>
                    </div>
                    <div className="row between">
                      <span className="meta">
                        Spend{" "}
                        {formatCents(
                          entry.totalSpendCents ?? 0,
                          operations?.store.currency,
                          operations?.store.locale,
                        )}
                      </span>
                      <span className="meta">
                        Last {formatDateTime(entry.lastPaidAt)}
                      </span>
                    </div>
                    <div className="operations-record-grid">
                      <label className="field">
                        <span>Phone</span>
                        <input
                          className="input"
                          value={draft.phone}
                          onChange={(event) =>
                            updateMemberDraft(entry.id, {
                              phone: event.target.value,
                            })
                          }
                        />
                      </label>
                      <label className="field">
                        <span>Name</span>
                        <input
                          className="input"
                          value={draft.name}
                          onChange={(event) =>
                            updateMemberDraft(entry.id, {
                              name: event.target.value,
                            })
                          }
                        />
                      </label>
                      <label className="field">
                        <span>Email</span>
                        <input
                          className="input"
                          value={draft.email}
                          onChange={(event) =>
                            updateMemberDraft(entry.id, {
                              email: event.target.value,
                            })
                          }
                        />
                      </label>
                      <label className="field">
                        <span>Points</span>
                        <input
                          className="input"
                          inputMode="numeric"
                          value={draft.points}
                          onChange={(event) =>
                            updateMemberDraft(entry.id, {
                              points: event.target.value,
                            })
                          }
                        />
                      </label>
                    </div>
                    <button
                      className="btn primary"
                      type="button"
                      disabled={!draft.phone.trim()}
                      onClick={() => void saveMember(entry)}
                    >
                      Save member
                    </button>
                  </div>
                );
              })}
              {operations?.members.length === 0 ? (
                <span className="meta">No members yet.</span>
              ) : null}
            </div>
          </article>

          <article className="card grid">
            <h2>Coupons</h2>
            <div className="operations-edit-list">
              {(operations?.coupons ?? []).map((entry) => {
                const draft = couponDrafts[entry.id] ?? couponForm(entry);
                return (
                  <div className="operations-record-card" key={entry.id}>
                    <div className="row between">
                      <strong>{entry.code}</strong>
                      <div className="row">
                        <span
                          className={draft.isActive ? "status ok" : "status"}
                        >
                          {draft.isActive ? "Active" : "Inactive"}
                        </span>
                        <span className="status">
                          {entry.redemptionCount ?? 0} used
                        </span>
                      </div>
                    </div>
                    <div className="meta">
                      Minimum{" "}
                      {formatCents(
                        entry.minimumSubtotalCents,
                        operations?.store.currency,
                        operations?.store.locale,
                      )}
                    </div>
                    <div className="operations-record-grid">
                      <label className="field">
                        <span>Code</span>
                        <input
                          className="input"
                          value={draft.code}
                          onChange={(event) =>
                            updateCouponDraft(entry.id, {
                              code: event.target.value,
                            })
                          }
                        />
                      </label>
                      <label className="field">
                        <span>Type</span>
                        <select
                          className="select"
                          value={draft.discountType}
                          onChange={(event) =>
                            updateCouponDraft(entry.id, {
                              discountType: event.target
                                .value as CouponForm["discountType"],
                            })
                          }
                        >
                          <option value="PERCENT">Percent</option>
                          <option value="AMOUNT">Amount</option>
                        </select>
                      </label>
                      <label className="field">
                        <span>Value</span>
                        <input
                          className="input"
                          inputMode="numeric"
                          value={draft.discountValue}
                          onChange={(event) =>
                            updateCouponDraft(entry.id, {
                              discountValue: event.target.value,
                            })
                          }
                        />
                      </label>
                      <label className="field">
                        <span>Minimum subtotal</span>
                        <input
                          className="input"
                          inputMode="numeric"
                          value={draft.minimumSubtotalCents}
                          onChange={(event) =>
                            updateCouponDraft(entry.id, {
                              minimumSubtotalCents: event.target.value,
                            })
                          }
                        />
                      </label>
                      <label className="mini-check operations-active-check">
                        <input
                          type="checkbox"
                          checked={draft.isActive}
                          onChange={(event) =>
                            updateCouponDraft(entry.id, {
                              isActive: event.target.checked,
                            })
                          }
                        />
                        <span>Active</span>
                      </label>
                    </div>
                    <div className="grid two">
                      <label className="field">
                        <span>Starts</span>
                        <input
                          className="input"
                          type="datetime-local"
                          value={draft.startsAt}
                          onChange={(event) =>
                            updateCouponDraft(entry.id, {
                              startsAt: event.target.value,
                            })
                          }
                        />
                      </label>
                      <label className="field">
                        <span>Ends</span>
                        <input
                          className="input"
                          type="datetime-local"
                          value={draft.endsAt}
                          onChange={(event) =>
                            updateCouponDraft(entry.id, {
                              endsAt: event.target.value,
                            })
                          }
                        />
                      </label>
                    </div>
                    <button
                      className="btn primary"
                      type="button"
                      disabled={!draft.code.trim()}
                      onClick={() => void saveCoupon(entry)}
                    >
                      Save coupon
                    </button>
                  </div>
                );
              })}
              {operations?.coupons.length === 0 ? (
                <span className="meta">No coupons yet.</span>
              ) : null}
            </div>
          </article>

          <article className="card grid">
            <h2>KDS devices</h2>
            <div className="operations-edit-list">
              {(operations?.kdsDevices ?? []).map((entry) => {
                const draft = kdsDrafts[entry.id] ?? kdsForm(entry);
                return (
                  <div className="operations-record-card" key={entry.id}>
                    <div className="row between">
                      <strong>{entry.name}</strong>
                      <span className={draft.isActive ? "status ok" : "status"}>
                        {draft.isActive ? "Active" : "Inactive"}
                      </span>
                    </div>
                    <span className="meta">
                      Last seen {formatDateTime(entry.lastSeenAt)}
                    </span>
                    <div className="operations-record-grid">
                      <label className="field">
                        <span>Name</span>
                        <input
                          className="input"
                          value={draft.name}
                          onChange={(event) =>
                            updateKdsDraft(entry.id, {
                              name: event.target.value,
                            })
                          }
                        />
                      </label>
                      <label className="field">
                        <span>Station</span>
                        <input
                          className="input"
                          value={draft.station}
                          onChange={(event) =>
                            updateKdsDraft(entry.id, {
                              station: event.target.value,
                            })
                          }
                        />
                      </label>
                      <label className="mini-check operations-active-check">
                        <input
                          type="checkbox"
                          checked={draft.isActive}
                          onChange={(event) =>
                            updateKdsDraft(entry.id, {
                              isActive: event.target.checked,
                            })
                          }
                        />
                        <span>Active</span>
                      </label>
                    </div>
                    <label className="field">
                      <span>Token</span>
                      <input
                        className="input mono"
                        value={draft.token}
                        onChange={(event) =>
                          updateKdsDraft(entry.id, {
                            token: event.target.value,
                          })
                        }
                      />
                    </label>
                    <button
                      className="btn primary"
                      type="button"
                      disabled={!draft.name.trim() || !draft.token.trim()}
                      onClick={() => void saveKdsDevice(entry)}
                    >
                      Save KDS device
                    </button>
                  </div>
                );
              })}
              {operations?.kdsDevices.length === 0 ? (
                <span className="meta">No KDS devices yet.</span>
              ) : null}
            </div>
          </article>

          <article className="card grid">
            <h2>Audit log</h2>
            <div className="list compact-list">
              {(operations?.auditLogs ?? []).map((entry) => (
                <div className="list-item" key={entry.id}>
                  <strong>{entry.action}</strong>
                  <span className="meta">
                    {entry.entityType}
                    {entry.entityId ? ` ${entry.entityId}` : ""} |{" "}
                    {formatDateTime(entry.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          </article>
        </section>
      </main>
    </AuthGate>
  );
}
