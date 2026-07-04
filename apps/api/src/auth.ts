import crypto from "node:crypto";
import type { Response } from "express";
import type { UserRole } from "@prisma/client";
import type { StaffRole } from "@qr2/shared";
import { STAFF_ROLES } from "@qr2/shared";

const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;
const PASSWORD_PARAMS = {
  keyLength: 64,
  saltLength: 16,
  cost: 16384,
  blockSize: 8,
  parallelization: 1,
} as const;

export type SessionPayload = {
  uid: string;
  storeId: string;
  role: StaffRole;
  sv: number;
  exp: number;
};

export function cookieName() {
  return process.env.SESSION_COOKIE_NAME ?? "qr2_session";
}

function sessionSecret() {
  const secret = process.env.SESSION_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET is required in production");
  }
  return "qr-ordering-system-2-dev-session-secret";
}

function base64Url(input: Buffer | string) {
  return Buffer.from(input).toString("base64url");
}

function sign(value: string) {
  return crypto
    .createHmac("sha256", sessionSecret())
    .update(value)
    .digest("base64url");
}

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function isStaffRole(value: string): value is StaffRole {
  return STAFF_ROLES.includes(value as StaffRole);
}

export function signSession(payload: Omit<SessionPayload, "exp">) {
  const body = base64Url(
    JSON.stringify({
      ...payload,
      exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
    }),
  );
  return `${body}.${sign(body)}`;
}

export function verifySession(token: string): SessionPayload {
  const [body, signature] = token.split(".");
  if (!body || !signature || !safeEqual(sign(body), signature)) {
    throw new Error("invalid token");
  }

  const decoded = JSON.parse(
    Buffer.from(body, "base64url").toString("utf8"),
  ) as Record<string, unknown>;
  if (
    typeof decoded.uid !== "string" ||
    typeof decoded.storeId !== "string" ||
    typeof decoded.role !== "string" ||
    !isStaffRole(decoded.role) ||
    typeof decoded.sv !== "number" ||
    typeof decoded.exp !== "number"
  ) {
    throw new Error("invalid token payload");
  }
  if (decoded.exp < Math.floor(Date.now() / 1000)) {
    throw new Error("expired token");
  }

  return {
    uid: decoded.uid,
    storeId: decoded.storeId,
    role: decoded.role,
    sv: Math.trunc(decoded.sv),
    exp: Math.trunc(decoded.exp),
  };
}

export async function hashPassword(password: string) {
  const salt = crypto.randomBytes(PASSWORD_PARAMS.saltLength);
  const hash = await new Promise<Buffer>((resolve, reject) => {
    crypto.scrypt(
      password,
      salt,
      PASSWORD_PARAMS.keyLength,
      {
        N: PASSWORD_PARAMS.cost,
        r: PASSWORD_PARAMS.blockSize,
        p: PASSWORD_PARAMS.parallelization,
      },
      (error, derivedKey) => (error ? reject(error) : resolve(derivedKey)),
    );
  });

  return [
    "scrypt",
    PASSWORD_PARAMS.cost,
    PASSWORD_PARAMS.blockSize,
    PASSWORD_PARAMS.parallelization,
    salt.toString("base64url"),
    hash.toString("base64url"),
  ].join("$");
}

export async function verifyPassword(password: string, passwordHash: string) {
  const [algorithm, cost, blockSize, parallelization, salt, hash] =
    passwordHash.split("$");
  if (
    algorithm !== "scrypt" ||
    !cost ||
    !blockSize ||
    !parallelization ||
    !salt ||
    !hash
  ) {
    return false;
  }

  const expected = Buffer.from(hash, "base64url");
  const actual = await new Promise<Buffer>((resolve, reject) => {
    crypto.scrypt(
      password,
      Buffer.from(salt, "base64url"),
      expected.length,
      {
        N: Number(cost),
        r: Number(blockSize),
        p: Number(parallelization),
      },
      (error, derivedKey) => (error ? reject(error) : resolve(derivedKey)),
    );
  });

  return (
    actual.length === expected.length &&
    crypto.timingSafeEqual(actual, expected)
  );
}

export function setSessionCookie(res: Response, token: string) {
  res.cookie(cookieName(), token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.SESSION_COOKIE_SECURE === "true",
    path: "/",
    maxAge: SESSION_TTL_SECONDS * 1000,
  });
}

export function clearSessionCookie(res: Response) {
  res.clearCookie(cookieName(), { path: "/" });
}

export function toStaffRole(role: UserRole): StaffRole {
  if (!isStaffRole(role)) {
    throw new Error(`Unsupported staff role: ${role}`);
  }
  return role;
}
