import { Router } from "express";
import { getKitchenPendingItems } from "../data.js";

export const kitchenRouter = Router();

kitchenRouter.get("/pending-items", async (_req, res, next) => {
  try {
    res.json(await getKitchenPendingItems());
  } catch (error) {
    next(error);
  }
});
