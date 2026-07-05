import cors from "cors";
import express from "express";
import { HttpError } from "./http.js";
import { applyStoreScope, requireRoles } from "./middleware.js";
import { authRouter } from "./routes/auth.js";
import { fohRouter } from "./routes/foh.js";
import { kitchenRouter } from "./routes/kitchen.js";
import { kdsRouter } from "./routes/kds.js";
import { manageRouter } from "./routes/manage.js";
import { printerRouter } from "./routes/printer.js";
import { publicRouter } from "./routes/public.js";

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin: process.env.WEB_ORIGIN ?? true,
      credentials: true,
    }),
  );
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({ ok: true, service: "qr-ordering-system-2-api" });
  });

  app.use("/v1/auth", authRouter);
  app.use("/v1/public", publicRouter);
  app.use("/v1/kds", kdsRouter);
  app.use(
    "/v1/foh",
    requireRoles(["DEV", "ADMIN", "FOH"]),
    applyStoreScope,
    fohRouter,
  );
  app.use(
    "/v1/kitchen",
    requireRoles(["DEV", "ADMIN", "KITCHEN"]),
    applyStoreScope,
    kitchenRouter,
  );
  app.use(
    "/v1/manage",
    requireRoles(["DEV", "ADMIN"]),
    applyStoreScope,
    manageRouter,
  );
  app.use(
    "/v1/printer",
    requireRoles(["DEV", "ADMIN", "PRINTER"]),
    applyStoreScope,
    printerRouter,
  );

  app.use((_req, res) => {
    res
      .status(404)
      .json({ error: { code: "NOT_FOUND", message: "Route not found" } });
  });

  app.use(
    (
      error: unknown,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      if (error instanceof HttpError) {
        res
          .status(error.status)
          .json({ error: { code: error.code, message: error.message } });
        return;
      }

      const maybeZod = error as { issues?: unknown; message?: string };
      if (Array.isArray(maybeZod.issues)) {
        res.status(400).json({
          error: { code: "VALIDATION_ERROR", message: maybeZod.message },
        });
        return;
      }

      res.status(500).json({
        error: {
          code: "INTERNAL_ERROR",
          message:
            error instanceof Error ? error.message : "Internal server error",
        },
      });
    },
  );

  return app;
}
