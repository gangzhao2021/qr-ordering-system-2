import { Router } from "express";
import { z } from "zod";
import {
  clearSessionCookie,
  setSessionCookie,
  signSession,
  toStaffRole,
  verifyPassword,
} from "../auth.js";
import { prisma } from "../db.js";
import { HttpError } from "../http.js";
import { authOptional, type AuthedRequest } from "../middleware.js";

export const authRouter = Router();

authRouter.post("/login", async (req, res, next) => {
  try {
    const body = z
      .object({
        email: z.string().trim().min(3).max(200),
        password: z.string().min(1).max(200),
      })
      .parse(req.body);

    const user = await prisma.user.findUnique({
      where: { email: body.email.toLowerCase() },
      select: {
        id: true,
        storeId: true,
        email: true,
        name: true,
        role: true,
        passwordHash: true,
        isActive: true,
        sessionVersion: true,
      },
    });

    if (
      !user ||
      !user.isActive ||
      !(await verifyPassword(body.password, user.passwordHash))
    ) {
      throw new HttpError(401, "UNAUTHORIZED", "Invalid email or password");
    }

    const role = toStaffRole(user.role);
    const token = signSession({
      uid: user.id,
      storeId: user.storeId,
      role,
      sv: user.sessionVersion,
    });
    setSessionCookie(res, token);

    res.status(200).json({
      user: {
        id: user.id,
        storeId: user.storeId,
        email: user.email,
        name: user.name,
        role,
      },
    });
  } catch (error) {
    next(error);
  }
});

authRouter.post("/logout", (_req, res) => {
  clearSessionCookie(res);
  res.status(200).json({ ok: true });
});

authRouter.get("/me", authOptional, (req: AuthedRequest, res) => {
  res.status(200).json({ user: req.user ?? null });
});
