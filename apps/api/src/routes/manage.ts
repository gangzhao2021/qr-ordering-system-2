import { Router } from "express";
import { z } from "zod";
import { STAFF_ROLES } from "@qr2/shared";
import {
  addMenuItem,
  createStaffUser,
  createMenuCategory,
  createDiningTable,
  deleteMenuCategory,
  deleteDiningTable,
  deleteMenuItem,
  getManageAnalytics,
  getManageMenu,
  getFohPrintJobs,
  getManageStaff,
  getManageTables,
  getStoreSettings,
  reprintOrder,
  rotateDiningTableQrToken,
  updateDiningTable,
  updateMenuCategory,
  updateMenuItem,
  updateMenuItemInventory,
  updateStaffUser,
  updateStoreSettings,
} from "../data.js";

export const manageRouter = Router();

const tableBodySchema = z.object({
  number: z.string().trim().min(1).max(20),
  name: z.string().trim().max(120).optional().nullable(),
  qrToken: z
    .string()
    .trim()
    .min(6)
    .max(160)
    .regex(/^[A-Za-z0-9_-]+$/)
    .optional(),
  isActive: z.boolean().optional(),
});

const menuCategoryBodySchema = z.object({
  name: z.string().trim().min(1).max(120),
  sortOrder: z.number().int().min(0).max(9999).optional(),
});

const menuItemBodySchema = z.object({
  categoryId: z.string().trim().min(1),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).optional().nullable(),
  priceCents: z.number().int().nonnegative(),
  isAvailable: z.boolean().optional(),
  stockQuantity: z.number().int().min(0).max(9999).optional().nullable(),
  lowStockThreshold: z.number().int().min(0).max(9999).optional(),
  sortOrder: z.number().int().min(0).max(9999).optional(),
});

const staffBodySchema = z.object({
  email: z.string().trim().email().max(200),
  password: z.string().min(6).max(200),
  name: z.string().trim().max(120).optional().nullable(),
  role: z.enum(STAFF_ROLES),
});

const staffPatchSchema = staffBodySchema
  .partial()
  .extend({ isActive: z.boolean().optional() });

manageRouter.get("/store-settings", async (_req, res, next) => {
  try {
    res.json(await getStoreSettings());
  } catch (error) {
    next(error);
  }
});

manageRouter.patch("/store-settings", async (req, res, next) => {
  try {
    const body = z
      .object({
        name: z.string().trim().min(1).max(120).optional(),
        currency: z.string().trim().length(3).optional(),
        locale: z.string().trim().min(2).max(40).optional(),
        timezone: z.string().trim().min(2).max(80).optional(),
        address: z.string().trim().max(300).optional().nullable(),
        phone: z.string().trim().max(80).optional().nullable(),
        taxLabel: z.string().trim().min(1).max(80).optional(),
        taxRateBps: z.number().int().min(0).max(3000).optional(),
        serviceChargeLabel: z.string().trim().min(1).max(80).optional(),
        serviceChargeRateBps: z.number().int().min(0).max(3000).optional(),
        receiptFooter: z.string().trim().max(500).optional().nullable(),
      })
      .parse(req.body);
    res.json(await updateStoreSettings(body));
  } catch (error) {
    next(error);
  }
});

manageRouter.get("/menu", async (_req, res, next) => {
  try {
    res.json(await getManageMenu());
  } catch (error) {
    next(error);
  }
});

manageRouter.get("/analytics", async (req, res, next) => {
  try {
    const query = z
      .object({
        days: z.coerce.number().int().min(1).max(31).optional(),
      })
      .parse(req.query);
    res.json(await getManageAnalytics(query.days));
  } catch (error) {
    next(error);
  }
});

manageRouter.get("/staff", async (_req, res, next) => {
  try {
    res.json(await getManageStaff());
  } catch (error) {
    next(error);
  }
});

manageRouter.post("/staff", async (req, res, next) => {
  try {
    const body = staffBodySchema.parse(req.body);
    res.status(201).json(await createStaffUser(body));
  } catch (error) {
    next(error);
  }
});

manageRouter.patch("/staff/:id", async (req, res, next) => {
  try {
    const params = z.object({ id: z.string().trim().min(1) }).parse(req.params);
    const body = staffPatchSchema.parse(req.body);
    res.json(await updateStaffUser(params.id, body));
  } catch (error) {
    next(error);
  }
});

manageRouter.get("/print-jobs", async (_req, res, next) => {
  try {
    res.json(await getFohPrintJobs());
  } catch (error) {
    next(error);
  }
});

manageRouter.post("/orders/:orderId/reprint", async (req, res, next) => {
  try {
    const params = z
      .object({ orderId: z.string().trim().min(1) })
      .parse(req.params);
    res.status(201).json(await reprintOrder(params.orderId));
  } catch (error) {
    next(error);
  }
});

manageRouter.post("/menu/categories", async (req, res, next) => {
  try {
    const body = menuCategoryBodySchema.parse(req.body);
    res.status(201).json(await createMenuCategory(body));
  } catch (error) {
    next(error);
  }
});

manageRouter.patch("/menu/categories/:id", async (req, res, next) => {
  try {
    const params = z.object({ id: z.string().trim().min(1) }).parse(req.params);
    const body = menuCategoryBodySchema.partial().parse(req.body);
    res.json(await updateMenuCategory(params.id, body));
  } catch (error) {
    next(error);
  }
});

manageRouter.delete("/menu/categories/:id", async (req, res, next) => {
  try {
    const params = z.object({ id: z.string().trim().min(1) }).parse(req.params);
    res.json(await deleteMenuCategory(params.id));
  } catch (error) {
    next(error);
  }
});

manageRouter.post("/menu/items", async (req, res, next) => {
  try {
    const body = menuItemBodySchema.parse(req.body);
    res.status(201).json(await addMenuItem(body));
  } catch (error) {
    next(error);
  }
});

manageRouter.patch("/menu/items/:id", async (req, res, next) => {
  try {
    const params = z.object({ id: z.string().trim().min(1) }).parse(req.params);
    const body = menuItemBodySchema.partial().parse(req.body);
    res.json(await updateMenuItem(params.id, body));
  } catch (error) {
    next(error);
  }
});

manageRouter.patch("/menu/items/:id/inventory", async (req, res, next) => {
  try {
    const body = z
      .object({
        isAvailable: z.boolean().optional(),
        stockQuantity: z.number().int().min(0).max(9999).optional().nullable(),
        lowStockThreshold: z.number().int().min(0).max(9999).optional(),
      })
      .parse(req.body);
    res.json(await updateMenuItemInventory(req.params.id, body));
  } catch (error) {
    next(error);
  }
});

manageRouter.delete("/menu/items/:id", async (req, res, next) => {
  try {
    const params = z.object({ id: z.string().trim().min(1) }).parse(req.params);
    res.json(await deleteMenuItem(params.id));
  } catch (error) {
    next(error);
  }
});

manageRouter.get("/tables", async (_req, res, next) => {
  try {
    res.json(await getManageTables());
  } catch (error) {
    next(error);
  }
});

manageRouter.post("/tables", async (req, res, next) => {
  try {
    const body = tableBodySchema.parse(req.body);
    res.status(201).json(await createDiningTable(body));
  } catch (error) {
    next(error);
  }
});

manageRouter.patch("/tables/:id", async (req, res, next) => {
  try {
    const params = z.object({ id: z.string().trim().min(1) }).parse(req.params);
    const body = tableBodySchema.partial().parse(req.body);
    res.json(await updateDiningTable(params.id, body));
  } catch (error) {
    next(error);
  }
});

manageRouter.post("/tables/:id/rotate-qr", async (req, res, next) => {
  try {
    const params = z.object({ id: z.string().trim().min(1) }).parse(req.params);
    res.json(await rotateDiningTableQrToken(params.id));
  } catch (error) {
    next(error);
  }
});

manageRouter.delete("/tables/:id", async (req, res, next) => {
  try {
    const params = z.object({ id: z.string().trim().min(1) }).parse(req.params);
    res.json(await deleteDiningTable(params.id));
  } catch (error) {
    next(error);
  }
});
