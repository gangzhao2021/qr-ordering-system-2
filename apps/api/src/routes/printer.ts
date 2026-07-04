import { Router } from "express";
import { z } from "zod";
import {
  claimPrinterJobs,
  markPrintJobFailed,
  markPrintJobPrinted,
} from "../data.js";

export const printerRouter = Router();

printerRouter.get("/jobs", async (req, res, next) => {
  try {
    const query = z
      .object({
        limit: z.coerce.number().int().min(1).max(20).optional(),
      })
      .parse(req.query);
    res.json(await claimPrinterJobs(query.limit ?? 5));
  } catch (error) {
    next(error);
  }
});

printerRouter.post("/jobs/:id/printed", async (req, res, next) => {
  try {
    const params = z.object({ id: z.string().trim().min(1) }).parse(req.params);
    res.json(await markPrintJobPrinted(params.id));
  } catch (error) {
    next(error);
  }
});

printerRouter.post("/jobs/:id/failed", async (req, res, next) => {
  try {
    const params = z.object({ id: z.string().trim().min(1) }).parse(req.params);
    res.json(await markPrintJobFailed(params.id));
  } catch (error) {
    next(error);
  }
});
