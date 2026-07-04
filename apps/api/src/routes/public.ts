import { Router } from "express";
import { z } from "zod";
import { SERVICE_REQUEST_TYPES } from "@qr2/shared";
import {
  createOrder,
  createServiceRequest,
  getPublicMenu,
  getPublicOrders,
} from "../data.js";

export const publicRouter = Router();

publicRouter.get("/menu", async (req, res, next) => {
  try {
    const query = z
      .object({ qrToken: z.string().trim().min(1) })
      .parse(req.query);
    res.json(await getPublicMenu(query.qrToken));
  } catch (error) {
    next(error);
  }
});

publicRouter.get("/orders", async (req, res, next) => {
  try {
    const query = z
      .object({ qrToken: z.string().trim().min(1) })
      .parse(req.query);
    res.json(await getPublicOrders(query.qrToken));
  } catch (error) {
    next(error);
  }
});

publicRouter.post("/orders", async (req, res, next) => {
  try {
    const body = z
      .object({
        qrToken: z.string().trim().min(1),
        items: z
          .array(
            z.object({
              menuItemId: z.string().trim().min(1),
              quantity: z.number().int().positive().max(20),
            }),
          )
          .min(1),
      })
      .parse(req.body);
    const order = await createOrder(body);
    res.status(201).json({ orderId: order.id });
  } catch (error) {
    next(error);
  }
});

publicRouter.post("/service-requests", async (req, res, next) => {
  try {
    const body = z
      .object({
        qrToken: z.string().trim().min(1),
        type: z.enum(SERVICE_REQUEST_TYPES),
        note: z.string().trim().max(200).optional(),
      })
      .parse(req.body);
    res.status(201).json(await createServiceRequest(body));
  } catch (error) {
    next(error);
  }
});
