"use client";

import { FormEvent, useEffect, useState } from "react";
import type { ManageMenuResponse, MenuCategory, MenuItem } from "@qr2/shared";
import { formatCents } from "@qr2/shared";
import { apiFetch } from "../../../lib/api";
import {
  AuthGate,
  StaffSessionBar,
  useRequireRole,
} from "../../../lib/auth-client";

type CategoryDraft = {
  name: string;
  sortOrder: string;
};

type MenuItemDraft = {
  categoryId: string;
  name: string;
  description: string;
  price: string;
  isAvailable: boolean;
  stockQuantity: string;
  lowStockThreshold: string;
  sortOrder: string;
};

function dollarsFromCents(cents: number) {
  return (cents / 100).toFixed(2);
}

function parsePriceCents(value: string) {
  return Math.round(Number(value) * 100);
}

function parseOptionalStock(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  return Number(trimmed);
}

function draftFromCategory(category: MenuCategory): CategoryDraft {
  return {
    name: category.name,
    sortOrder: String(category.sortOrder),
  };
}

function draftFromItem(item: MenuItem): MenuItemDraft {
  return {
    categoryId: item.categoryId,
    name: item.name,
    description: item.description ?? "",
    price: dollarsFromCents(item.priceCents),
    isAvailable: item.isAvailable,
    stockQuantity:
      item.stockQuantity === null || item.stockQuantity === undefined
        ? ""
        : String(item.stockQuantity),
    lowStockThreshold: String(item.lowStockThreshold),
    sortOrder: String(item.sortOrder),
  };
}

function stockStatus(item: MenuItem) {
  if (!item.isAvailable) return "Unavailable";
  if (item.isSoldOut) return "Sold out";
  if (item.stockQuantity === null || item.stockQuantity === undefined) {
    return "Unlimited";
  }
  if (item.isLowStock) return `${item.stockQuantity} left`;
  return `${item.stockQuantity} in stock`;
}

function statusClass(item: MenuItem) {
  if (!item.isAvailable || item.isSoldOut) return "urgent";
  if (item.isLowStock) return "checkout";
  return "ok";
}

export default function ManageMenuPage() {
  const auth = useRequireRole(["DEV", "ADMIN"]);
  const [data, setData] = useState<ManageMenuResponse | null>(null);
  const [categoryDrafts, setCategoryDrafts] = useState<
    Record<string, CategoryDraft>
  >({});
  const [itemDrafts, setItemDrafts] = useState<Record<string, MenuItemDraft>>(
    {},
  );
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategorySort, setNewCategorySort] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("12.00");
  const [stockQuantity, setStockQuantity] = useState("");
  const [lowStockThreshold, setLowStockThreshold] = useState("5");
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setError(null);
    try {
      const result = await apiFetch<ManageMenuResponse>("/v1/manage/menu");
      setData(result);
      setCategoryId((current) =>
        result.categories.some((category) => category.id === current)
          ? current
          : result.categories[0]?.id || "",
      );
      setCategoryDrafts(
        Object.fromEntries(
          result.categories.map((category) => [
            category.id,
            draftFromCategory(category),
          ]),
        ),
      );
      setItemDrafts(
        Object.fromEntries(
          result.categories.flatMap((category) =>
            category.items.map((item) => [item.id, draftFromItem(item)]),
          ),
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  useEffect(() => {
    if (auth.user) void refresh();
  }, [auth.user]);

  function updateCategoryDraft(
    categoryId: string,
    patch: Partial<CategoryDraft>,
  ) {
    setCategoryDrafts((current) => {
      const existing = current[categoryId] ?? { name: "", sortOrder: "0" };
      return {
        ...current,
        [categoryId]: { ...existing, ...patch },
      };
    });
  }

  function updateItemDraft(itemId: string, patch: Partial<MenuItemDraft>) {
    setItemDrafts((current) => {
      const existing = current[itemId] ?? {
        categoryId: "",
        name: "",
        description: "",
        price: "0.00",
        isAvailable: true,
        stockQuantity: "",
        lowStockThreshold: "0",
        sortOrder: "0",
      };
      return {
        ...current,
        [itemId]: { ...existing, ...patch },
      };
    });
  }

  async function createCategory(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await apiFetch("/v1/manage/menu/categories", {
        method: "POST",
        body: JSON.stringify({
          name: newCategoryName,
          ...(newCategorySort.trim()
            ? { sortOrder: Number(newCategorySort) }
            : {}),
        }),
      });
      setNewCategoryName("");
      setNewCategorySort("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function saveCategory(category: MenuCategory) {
    const draft = categoryDrafts[category.id] ?? draftFromCategory(category);
    setError(null);
    try {
      await apiFetch(`/v1/manage/menu/categories/${category.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: draft.name,
          sortOrder: Number(draft.sortOrder || 0),
        }),
      });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function deleteCategory(category: MenuCategory) {
    if (!window.confirm(`Delete category ${category.name}?`)) return;
    setError(null);
    try {
      await apiFetch(`/v1/manage/menu/categories/${category.id}`, {
        method: "DELETE",
      });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function createItem(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await apiFetch("/v1/manage/menu/items", {
        method: "POST",
        body: JSON.stringify({
          categoryId,
          name,
          description: description.trim() || null,
          priceCents: parsePriceCents(price),
          stockQuantity: parseOptionalStock(stockQuantity),
          lowStockThreshold: Number(lowStockThreshold || 0),
        }),
      });
      setName("");
      setDescription("");
      setStockQuantity("");
      setLowStockThreshold("5");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function saveItem(item: MenuItem) {
    const draft = itemDrafts[item.id] ?? draftFromItem(item);
    setError(null);
    try {
      await apiFetch(`/v1/manage/menu/items/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          categoryId: draft.categoryId,
          name: draft.name,
          description: draft.description.trim() || null,
          priceCents: parsePriceCents(draft.price),
          isAvailable: draft.isAvailable,
          stockQuantity: parseOptionalStock(draft.stockQuantity),
          lowStockThreshold: Number(draft.lowStockThreshold || 0),
          sortOrder: Number(draft.sortOrder || 0),
        }),
      });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function deleteItem(item: MenuItem) {
    if (!window.confirm(`Delete unused item ${item.name}?`)) return;
    setError(null);
    try {
      await apiFetch(`/v1/manage/menu/items/${item.id}`, {
        method: "DELETE",
      });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  const categories = data?.categories ?? [];

  return (
    <AuthGate state={auth}>
      <main className="page">
        <StaffSessionBar user={auth.user} />
        <section className="page-header">
          <h1>Menu management</h1>
          <p>
            Edit categories, item details, prices, availability, and item-level
            stock.
          </p>
        </section>
        {error ? <div className="error card">{error}</div> : null}

        <section className="grid two">
          <form
            className="card grid"
            onSubmit={(event) => void createCategory(event)}
          >
            <h2>Add category</h2>
            <label className="field">
              <span>Name</span>
              <input
                className="input"
                value={newCategoryName}
                onChange={(event) => setNewCategoryName(event.target.value)}
              />
            </label>
            <label className="field">
              <span>Sort order</span>
              <input
                className="input"
                value={newCategorySort}
                inputMode="numeric"
                placeholder="Auto"
                onChange={(event) => setNewCategorySort(event.target.value)}
              />
            </label>
            <button className="btn primary" disabled={!newCategoryName.trim()}>
              Create category
            </button>
          </form>

          <form
            className="card grid"
            onSubmit={(event) => void createItem(event)}
          >
            <h2>Add item</h2>
            <label className="field">
              <span>Category</span>
              <select
                className="select"
                value={categoryId}
                onChange={(event) => setCategoryId(event.target.value)}
              >
                {categories.map((category) => (
                  <option value={category.id} key={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid two">
              <label className="field">
                <span>Name</span>
                <input
                  className="input"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </label>
              <label className="field">
                <span>Price</span>
                <input
                  className="input"
                  value={price}
                  inputMode="decimal"
                  onChange={(event) => setPrice(event.target.value)}
                />
              </label>
            </div>
            <label className="field">
              <span>Description</span>
              <textarea
                className="input textarea"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </label>
            <div className="grid two">
              <label className="field">
                <span>Stock</span>
                <input
                  className="input"
                  value={stockQuantity}
                  inputMode="numeric"
                  placeholder="Unlimited"
                  onChange={(event) => setStockQuantity(event.target.value)}
                />
              </label>
              <label className="field">
                <span>Low stock alert</span>
                <input
                  className="input"
                  value={lowStockThreshold}
                  inputMode="numeric"
                  onChange={(event) => setLowStockThreshold(event.target.value)}
                />
              </label>
            </div>
            <button
              className="btn primary"
              disabled={!categoryId || !name.trim()}
            >
              Create item
            </button>
          </form>
        </section>

        <section className="grid" style={{ marginTop: 16 }}>
          {categories.map((category) => {
            const categoryDraft =
              categoryDrafts[category.id] ?? draftFromCategory(category);
            return (
              <article className="card menu-category-editor" key={category.id}>
                <div className="category-editor-controls">
                  <label className="field">
                    <span>Category</span>
                    <input
                      className="input"
                      value={categoryDraft.name}
                      onChange={(event) =>
                        updateCategoryDraft(category.id, {
                          name: event.target.value,
                        })
                      }
                    />
                  </label>
                  <label className="field">
                    <span>Sort</span>
                    <input
                      className="input"
                      value={categoryDraft.sortOrder}
                      inputMode="numeric"
                      onChange={(event) =>
                        updateCategoryDraft(category.id, {
                          sortOrder: event.target.value,
                        })
                      }
                    />
                  </label>
                  <button
                    className="btn primary"
                    onClick={() => void saveCategory(category)}
                  >
                    Save category
                  </button>
                  <button
                    className="btn ghost"
                    onClick={() => void deleteCategory(category)}
                  >
                    Delete empty
                  </button>
                </div>

                <div className="list">
                  {category.items.map((item) => {
                    const draft = itemDrafts[item.id] ?? draftFromItem(item);
                    return (
                      <div className="list-item menu-item-editor" key={item.id}>
                        <div className="row between">
                          <div>
                            <strong>{item.name}</strong>
                            <p>{item.description}</p>
                            <div className="row">
                              <span className={`status ${statusClass(item)}`}>
                                {stockStatus(item)}
                              </span>
                              <span className="meta">
                                {formatCents(
                                  item.priceCents,
                                  data?.store.currency,
                                  data?.store.locale,
                                )}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="menu-item-controls">
                          <label className="field">
                            <span>Name</span>
                            <input
                              className="input"
                              value={draft.name}
                              onChange={(event) =>
                                updateItemDraft(item.id, {
                                  name: event.target.value,
                                })
                              }
                            />
                          </label>
                          <label className="field">
                            <span>Category</span>
                            <select
                              className="select"
                              value={draft.categoryId}
                              onChange={(event) =>
                                updateItemDraft(item.id, {
                                  categoryId: event.target.value,
                                })
                              }
                            >
                              {categories.map((option) => (
                                <option value={option.id} key={option.id}>
                                  {option.name}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="field">
                            <span>Price</span>
                            <input
                              className="input"
                              value={draft.price}
                              inputMode="decimal"
                              onChange={(event) =>
                                updateItemDraft(item.id, {
                                  price: event.target.value,
                                })
                              }
                            />
                          </label>
                          <label className="field">
                            <span>Sort</span>
                            <input
                              className="input"
                              value={draft.sortOrder}
                              inputMode="numeric"
                              onChange={(event) =>
                                updateItemDraft(item.id, {
                                  sortOrder: event.target.value,
                                })
                              }
                            />
                          </label>
                          <label className="field checkbox-field">
                            <span>Available</span>
                            <input
                              type="checkbox"
                              checked={draft.isAvailable}
                              onChange={(event) =>
                                updateItemDraft(item.id, {
                                  isAvailable: event.target.checked,
                                })
                              }
                            />
                          </label>
                          <label className="field">
                            <span>Stock</span>
                            <input
                              className="input"
                              value={draft.stockQuantity}
                              inputMode="numeric"
                              placeholder="Unlimited"
                              onChange={(event) =>
                                updateItemDraft(item.id, {
                                  stockQuantity: event.target.value,
                                })
                              }
                            />
                          </label>
                          <label className="field">
                            <span>Low alert</span>
                            <input
                              className="input"
                              value={draft.lowStockThreshold}
                              inputMode="numeric"
                              onChange={(event) =>
                                updateItemDraft(item.id, {
                                  lowStockThreshold: event.target.value,
                                })
                              }
                            />
                          </label>
                        </div>

                        <label className="field">
                          <span>Description</span>
                          <textarea
                            className="input textarea"
                            value={draft.description}
                            onChange={(event) =>
                              updateItemDraft(item.id, {
                                description: event.target.value,
                              })
                            }
                          />
                        </label>

                        <div className="row">
                          <button
                            className="btn primary"
                            onClick={() => void saveItem(item)}
                          >
                            Save item
                          </button>
                          <button
                            className="btn ghost"
                            onClick={() => void deleteItem(item)}
                          >
                            Delete unused
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  {category.items.length === 0 ? (
                    <div className="meta">No items in this category.</div>
                  ) : null}
                </div>
              </article>
            );
          })}
        </section>
      </main>
    </AuthGate>
  );
}
