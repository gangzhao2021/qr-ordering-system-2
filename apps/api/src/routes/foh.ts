import { Router } from "express";
import { z } from "zod";
import {
  ORDER_ITEM_STATUSES,
  PAYMENT_METHODS,
  SERVICE_REQUEST_STATUSES,
} from "@qr2/shared";
import {
  checkoutTable,
  getFohPayments,
  getFohTables,
  getFohPrintJobs,
  refundPayment,
  reprintOrder,
  updateOrderItemStatus,
  updateServiceRequestStatus,
} from "../data.js";

export const fohRouter = Router();

fohRouter.get("/tables", async (_req, res, next) => {
  try {
    res.json(await getFohTables());
  } catch (error) {
    next(error);
  }
});

fohRouter.get("/print-jobs", async (_req, res, next) => {
  try {
    res.json(await getFohPrintJobs());
  } catch (error) {
    next(error);
  }
});

fohRouter.get("/payments", async (_req, res, next) => {
  try {
    res.json(await getFohPayments());
  } catch (error) {
    next(error);
  }
});

fohRouter.post("/orders/:orderId/reprint", async (req, res, next) => {
  try {
    const params = z
      .object({ orderId: z.string().trim().min(1) })
      .parse(req.params);
    res.status(201).json(await reprintOrder(params.orderId));
  } catch (error) {
    next(error);
  }
});

fohRouter.patch("/order-items/:id/status", async (req, res, next) => {
  try {
    const params = z.object({ id: z.string().trim().min(1) }).parse(req.params);
    const body = z
      .object({ status: z.enum(ORDER_ITEM_STATUSES) })
      .parse(req.body);
    res.json(await updateOrderItemStatus(params.id, body.status));
  } catch (error) {
    next(error);
  }
});

fohRouter.patch("/service-requests/:id/status", async (req, res, next) => {
  try {
    const params = z.object({ id: z.string().trim().min(1) }).parse(req.params);
    const body = z
      .object({ status: z.enum(SERVICE_REQUEST_STATUSES) })
      .parse(req.body);
    res.json(await updateServiceRequestStatus(params.id, body.status));
  } catch (error) {
    next(error);
  }
});

fohRouter.post("/tables/:tableId/checkout", async (req, res, next) => {
  try {
    const params = z
      .object({ tableId: z.string().trim().min(1) })
      .parse(req.params);
    const body = z
      .object({
        paymentMethod: z.enum(PAYMENT_METHODS).optional(),
        amountCents: z.number().int().min(0).optional(),
        tipCents: z.number().int().min(0).optional(),
        discountCents: z.number().int().min(0).optional(),
        memberPhone: z.string().trim().max(80).optional().nullable(),
        memberName: z.string().trim().max(120).optional().nullable(),
        couponCode: z.string().trim().max(40).optional().nullable(),
        reference: z.string().trim().max(120).optional().nullable(),
        note: z.string().trim().max(300).optional().nullable(),
      })
      .parse(req.body ?? {});
    res.json(await checkoutTable(params.tableId, body));
  } catch (error) {
    next(error);
  }
});

fohRouter.post("/payments/:paymentId/refund", async (req, res, next) => {
  try {
    const params = z
      .object({ paymentId: z.string().trim().min(1) })
      .parse(req.params);
    const body = z
      .object({
        amountCents: z.number().int().positive(),
        reason: z.string().trim().max(300).optional().nullable(),
      })
      .parse(req.body ?? {});
    res.json(await refundPayment(params.paymentId, body));
  } catch (error) {
    next(error);
  }
});
