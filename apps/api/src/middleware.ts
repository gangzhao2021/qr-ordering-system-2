import type { NextFunction, Request, Response } from "express";
import type { UserRole } from "@prisma/client";
import type { AuthUser, StaffRole } from "@qr2/shared";
import { cookieName, toStaffRole, verifySession } from "./auth.js";
import { prisma } from "./db.js";
import { HttpError } from "./http.js";

export type AuthedRequest = Request & {
  user?: AuthUser;
};

function getBearerToken(req: Request) {
  const auth = req.header("authorization")?.trim();
  if (!auth) return null;
  const match = /^Bearer\s+(.+)$/i.exec(auth);
  return match?.[1]?.trim() || null;
}

function getCookieToken(req: Request) {
  const cookieHeader = req.header("cookie");
  if (!cookieHeader) return null;

  for (const part of cookieHeader.split(";")) {
    const [rawName, ...rawValue] = part.trim().split("=");
    if (rawName === cookieName()) {
      return decodeURIComponent(rawValue.join("="));
    }
  }
  return null;
}

function getRequestToken(req: Request) {
  return getBearerToken(req) ?? getCookieToken(req);
}

function mapUser(user: {
  id: string;
  storeId: string;
  email: string;
  name: string | null;
  role: UserRole;
}): AuthUser {
  return {
    id: user.id,
    storeId: user.storeId,
    email: user.email,
    name: user.name,
    role: toStaffRole(user.role),
  };
}

export async function authOptional(
  req: AuthedRequest,
  _res: Response,
  next: NextFunction,
) {
  try {
    const token = getRequestToken(req);
    if (!token) {
      next();
      return;
    }

    const payload = verifySession(token);
    const user = await prisma.user.findUnique({
      where: { id: payload.uid },
      select: {
        id: true,
        storeId: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        sessionVersion: true,
      },
    });
    if (!user || !user.isActive || user.sessionVersion !== payload.sv) {
      next();
      return;
    }

    req.user = mapUser(user);
    next();
  } catch {
    next();
  }
}

export function requireRoles(roles: readonly StaffRole[]) {
  return async (req: AuthedRequest, _res: Response, next: NextFunction) => {
    try {
      const token = getRequestToken(req);
      if (!token) throw new HttpError(401, "UNAUTHORIZED", "Login required");

      const payload = verifySession(token);
      const user = await prisma.user.findUnique({
        where: { id: payload.uid },
        select: {
          id: true,
          storeId: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
          sessionVersion: true,
        },
      });

      if (!user) throw new HttpError(401, "UNAUTHORIZED", "Session expired");
      if (!user.isActive)
        throw new HttpError(401, "UNAUTHORIZED", "User disabled");
      if (user.sessionVersion !== payload.sv) {
        throw new HttpError(401, "UNAUTHORIZED", "Session expired");
      }

      const role = toStaffRole(user.role);
      if (!roles.includes(role)) {
        throw new HttpError(403, "FORBIDDEN", "Insufficient role");
      }

      req.user = mapUser(user);
      next();
    } catch (error) {
      next(error);
    }
  };
}
