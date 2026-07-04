"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type {
  Coupon,
  KdsDevice,
  ManageMenuResponse,
  ManageOperationsResponse,
  Member,
  Supplier,
} from "@qr2/shared";
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

export default function ManageOperationsPage() {
  const auth = useRequireRole(["DEV", "ADMIN"]);
  const [operations, setOperations] = useState<ManageOperationsResponse | null>(
    null,
  );
  const [menu, setMenu] = useState<ManageMenuResponse | null>(null);
  const [supplier, setSupplier] = useState<SupplierForm>(initialSupplier);
  const [adjustment, setAdjustment] =
    useState<AdjustmentForm>(initialAdjustment);
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
  const [kdsDrafts, setKdsDrafts] = useState<Record<string, KdsForm>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const menuItems = useMemo(
    () => menu?.categories.flatMap((category) => category.items) ?? [],
    [menu],
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
          current.menuItemId || menuResult.categories[0]?.items[0]?.id || "",
      }));
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

  function updateKdsDraft(id: string, patch: Partial<KdsForm>) {
    setKdsDrafts((current) => ({
      ...current,
      [id]: { ...(current[id] ?? initialKds), ...patch },
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
            Manage purchasing contacts, item stock movement, loyalty members,
            coupons, KDS devices, and audit history.
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
                    <p>{entry.reason}</p>
                  </div>
                  <span className="meta">
                    {formatDateTime(entry.createdAt)}
                  </span>
                </div>
              ))}
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
                      <span className="status ok">{entry.points} pts</span>
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
                      <span className={draft.isActive ? "status ok" : "status"}>
                        {draft.isActive ? "Active" : "Inactive"}
                      </span>
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
