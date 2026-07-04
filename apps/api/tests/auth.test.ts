import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cookieName,
  hashPassword,
  signSession,
  toStaffRole,
  verifyPassword,
  verifySession,
} from "../src/auth.js";

const originalSessionSecret = process.env.SESSION_SECRET;
const originalCookieName = process.env.SESSION_COOKIE_NAME;

beforeEach(() => {
  process.env.SESSION_SECRET = "test-session-secret";
  delete process.env.SESSION_COOKIE_NAME;
});

afterEach(() => {
  vi.useRealTimers();
  if (originalSessionSecret === undefined) {
    delete process.env.SESSION_SECRET;
  } else {
    process.env.SESSION_SECRET = originalSessionSecret;
  }
  if (originalCookieName === undefined) {
    delete process.env.SESSION_COOKIE_NAME;
  } else {
    process.env.SESSION_COOKIE_NAME = originalCookieName;
  }
});

describe("password hashing", () => {
  it("verifies the password that created the hash", async () => {
    const passwordHash = await hashPassword("devpass");

    expect(passwordHash).toMatch(/^scrypt\$/);
    await expect(verifyPassword("devpass", passwordHash)).resolves.toBe(true);
    await expect(verifyPassword("wrongpass", passwordHash)).resolves.toBe(
      false,
    );
  });

  it("rejects malformed password hashes", async () => {
    await expect(verifyPassword("devpass", "not-a-real-hash")).resolves.toBe(
      false,
    );
  });
});

describe("session tokens", () => {
  it("signs and verifies a staff session", () => {
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));

    const token = signSession({
      uid: "user_1",
      storeId: "store_1",
      role: "ADMIN",
      sv: 3,
    });

    expect(verifySession(token)).toMatchObject({
      uid: "user_1",
      storeId: "store_1",
      role: "ADMIN",
      sv: 3,
    });
  });

  it("rejects tampered session tokens", () => {
    const token = signSession({
      uid: "user_1",
      storeId: "store_1",
      role: "FOH",
      sv: 0,
    });
    const replacement = token.endsWith("a") ? "b" : "a";
    const tampered = `${token.slice(0, -1)}${replacement}`;

    expect(() => verifySession(tampered)).toThrow("invalid token");
  });

  it("rejects expired session tokens", () => {
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const token = signSession({
      uid: "user_1",
      storeId: "store_1",
      role: "KITCHEN",
      sv: 0,
    });

    vi.setSystemTime(new Date("2026-01-09T00:00:01Z"));

    expect(() => verifySession(token)).toThrow("expired token");
  });
});

describe("role helpers", () => {
  it("uses the default session cookie name unless overridden", () => {
    expect(cookieName()).toBe("qr2_session");

    process.env.SESSION_COOKIE_NAME = "custom_session";

    expect(cookieName()).toBe("custom_session");
  });

  it("maps supported staff roles and rejects customer role", () => {
    expect(toStaffRole("PRINTER")).toBe("PRINTER");
    expect(() => toStaffRole("CUSTOMER")).toThrow("Unsupported staff role");
  });
});
