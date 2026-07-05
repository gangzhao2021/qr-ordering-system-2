import { Router } from "express";
import { z } from "zod";
import { getKdsDevicePendingItems, heartbeatKdsDevice } from "../data.js";

export const kdsRouter = Router();

const tokenQuerySchema = z.object({
  token: z.string().trim().min(1).max(200),
});

const tokenBodySchema = z.object({
  token: z.string().trim().min(1).max(200),
});

kdsRouter.get("/pending-items", async (req, res, next) => {
  try {
    const query = tokenQuerySchema.parse(req.query);
    res.json(await getKdsDevicePendingItems(query.token));
  } catch (error) {
    next(error);
  }
});

kdsRouter.post("/heartbeat", async (req, res, next) => {
  try {
    const body = tokenBodySchema.parse(req.body);
    res.json(await heartbeatKdsDevice(body.token));
  } catch (error) {
    next(error);
  }
});
