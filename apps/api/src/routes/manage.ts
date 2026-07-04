import { Router } from "express";
import { z } from "zod";
import {
  LANGUAGE_CODES,
  PAYMENT_METHODS,
  STAFF_ROLES,
  STORE_MARKETS,
} from "@qr2/shared";
import {
  addMenuItem,
  createCoupon,
  createStaffUser,
  createInventoryAdjustment,
  createKdsDevice,
  createMember,
  createMenuCategory,
  createDiningTable,
  createSupplier,
  deleteMenuCategory,
  deleteDiningTable,
  deleteMenuItem,
  getManageAnalytics,
  getManageOperations,
  getManageMenu,
  getP0SmokeCockpit,
  getFohPrintJobs,
  getManageStaff,
  getManageTables,
  getStoreSettings,
  reprintOrder,
  rotateDiningTableQrToken,
  updateDiningTable,
  updateCoupon,
  updateKdsDevice,
  updateMenuCategory,
  updateMenuItem,
  updateMenuItemInventory,
  updateMember,
  updateStaffUser,
  updateStoreSettings,
  updateSupplier,
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

const localizedTextSchema = z
  .object({
    en: z.string().trim().max(200).optional().nullable(),
    "fr-CA": z.string().trim().max(200).optional().nullable(),
    "zh-CN": z.string().trim().max(200).optional().nullable(),
  })
  .optional()
  .nullable();

const modifierOptionSchema = z.object({
  id: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(120),
  nameLocalized: localizedTextSchema,
  priceDeltaCents: z.number().int().min(-999999).max(999999),
  isDefault: z.boolean().optional(),
});

const modifierGroupSchema = z.object({
  id: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(120),
  nameLocalized: localizedTextSchema,
  required: z.boolean(),
  minSelect: z.number().int().min(0).max(20),
  maxSelect: z.number().int().min(1).max(20),
  options: z.array(modifierOptionSchema).min(1).max(50),
});

const taxRuleSchema = z.object({
  id: z.string().trim().min(1).max(80),
  label: z.string().trim().min(1).max(80),
  rateBps: z.number().int().min(0).max(3000),
  appliesTo: z.string().trim().min(1).max(80),
  compoundOnPrevious: z.boolean().optional(),
});

const menuItemBodySchema = z.object({
  categoryId: z.string().trim().min(1),
  name: z.string().trim().min(1).max(120),
  nameLocalized: localizedTextSchema,
  description: z.string().trim().max(500).optional().nullable(),
  descriptionLocalized: localizedTextSchema,
  imageUrl: z.string().trim().url().max(500).optional().nullable(),
  allergens: z.array(z.string().trim().min(1).max(80)).max(30).optional(),
  spiceLevel: z.number().int().min(0).max(5).optional(),
  taxCategory: z.string().trim().min(1).max(80).optional(),
  kitchenStation: z.string().trim().min(1).max(80).optional(),
  modifierGroups: z.array(modifierGroupSchema).max(20).optional(),
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

const supplierBodySchema = z.object({
  name: z.string().trim().min(1).max(160),
  contactName: z.string().trim().max(120).optional().nullable(),
  phone: z.string().trim().max(80).optional().nullable(),
  email: z.string().trim().email().max(200).optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
});

const memberBodySchema = z.object({
  name: z.string().trim().max(120).optional().nullable(),
  phone: z.string().trim().min(3).max(80),
  email: z.string().trim().email().max(200).optional().nullable(),
  points: z.number().int().min(0).max(999999).optional(),
});

const couponBodySchema = z.object({
  code: z.string().trim().min(2).max(40),
  discountType: z.enum(["PERCENT", "AMOUNT"]),
  discountValue: z.number().int().min(1).max(999999),
  isActive: z.boolean().default(true),
  startsAt: z.string().datetime().optional().nullable(),
  endsAt: z.string().datetime().optional().nullable(),
});

const kdsDeviceBodySchema = z.object({
  name: z.string().trim().min(1).max(120),
  station: z.string().trim().max(80).optional().nullable(),
  token: z.string().trim().max(160).optional(),
  isActive: z.boolean().default(true),
});

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
        market: z.enum(STORE_MARKETS).optional(),
        region: z.string().trim().max(80).optional().nullable(),
        currency: z.string().trim().length(3).optional(),
        locale: z.string().trim().min(2).max(40).optional(),
        timezone: z.string().trim().min(2).max(80).optional(),
        defaultLanguage: z.enum(LANGUAGE_CODES).optional(),
        supportedLanguages: z.array(z.enum(LANGUAGE_CODES)).min(1).optional(),
        address: z.string().trim().max(300).optional().nullable(),
        phone: z.string().trim().max(80).optional().nullable(),
        taxNumber: z.string().trim().max(80).optional().nullable(),
        taxMode: z.enum(["SINGLE", "CANADA", "CHINA"]).optional(),
        priceIncludesTax: z.boolean().optional(),
        taxRules: z.array(taxRuleSchema).max(12).optional(),
        taxLabel: z.string().trim().min(1).max(80).optional(),
        taxRateBps: z.number().int().min(0).max(3000).optional(),
        serviceChargeLabel: z.string().trim().min(1).max(80).optional(),
        serviceChargeRateBps: z.number().int().min(0).max(3000).optional(),
        enabledPaymentMethods: z
          .array(z.enum(PAYMENT_METHODS))
          .min(1)
          .optional(),
        invoiceInstructions: z.string().trim().max(500).optional().nullable(),
        tipEnabled: z.boolean().optional(),
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

manageRouter.get("/operations", async (_req, res, next) => {
  try {
    res.json(await getManageOperations());
  } catch (error) {
    next(error);
  }
});

manageRouter.get("/p0-smoke", async (_req, res, next) => {
  try {
    res.json(await getP0SmokeCockpit());
  } catch (error) {
    next(error);
  }
});

manageRouter.post("/operations/suppliers", async (req, res, next) => {
  try {
    const body = supplierBodySchema.parse(req.body);
    res.status(201).json(await createSupplier(body));
  } catch (error) {
    next(error);
  }
});

manageRouter.patch("/operations/suppliers/:id", async (req, res, next) => {
  try {
    const params = z.object({ id: z.string().trim().min(1) }).parse(req.params);
    const body = supplierBodySchema
      .partial()
      .extend({ isActive: z.boolean().optional() })
      .parse(req.body);
    res.json(await updateSupplier(params.id, body));
  } catch (error) {
    next(error);
  }
});

manageRouter.post(
  "/operations/inventory-adjustments",
  async (req, res, next) => {
    try {
      const body = z
        .object({
          menuItemId: z.string().trim().min(1),
          quantityDelta: z.number().int().min(-9999).max(9999),
          reason: z.string().trim().min(1).max(120),
          note: z.string().trim().max(300).optional().nullable(),
        })
        .parse(req.body);
      res.status(201).json(await createInventoryAdjustment(body));
    } catch (error) {
      next(error);
    }
  },
);

manageRouter.post("/operations/members", async (req, res, next) => {
  try {
    const body = memberBodySchema.parse(req.body);
    res.status(201).json(await createMember(body));
  } catch (error) {
    next(error);
  }
});

manageRouter.patch("/operations/members/:id", async (req, res, next) => {
  try {
    const params = z.object({ id: z.string().trim().min(1) }).parse(req.params);
    const body = memberBodySchema.partial().parse(req.body);
    res.json(await updateMember(params.id, body));
  } catch (error) {
    next(error);
  }
});

manageRouter.post("/operations/coupons", async (req, res, next) => {
  try {
    const body = couponBodySchema.parse(req.body);
    res.status(201).json(await createCoupon(body));
  } catch (error) {
    next(error);
  }
});

manageRouter.patch("/operations/coupons/:id", async (req, res, next) => {
  try {
    const params = z.object({ id: z.string().trim().min(1) }).parse(req.params);
    const body = couponBodySchema.partial().parse(req.body);
    res.json(await updateCoupon(params.id, body));
  } catch (error) {
    next(error);
  }
});

manageRouter.post("/operations/kds-devices", async (req, res, next) => {
  try {
    const body = kdsDeviceBodySchema.parse(req.body);
    res.status(201).json(await createKdsDevice(body));
  } catch (error) {
    next(error);
  }
});

manageRouter.patch("/operations/kds-devices/:id", async (req, res, next) => {
  try {
    const params = z.object({ id: z.string().trim().min(1) }).parse(req.params);
    const body = kdsDeviceBodySchema.partial().parse(req.body);
    res.json(await updateKdsDevice(params.id, body));
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
