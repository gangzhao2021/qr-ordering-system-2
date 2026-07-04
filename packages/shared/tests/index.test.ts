import { describe, expect, it } from "vitest";
import {
  PAYMENT_METHODS,
  PURCHASE_ORDER_STATUSES,
  STAFF_ROLES,
  USER_ROLES,
  formatCents,
} from "../src/index";

describe("shared role constants", () => {
  it("keeps staff roles as a subset of all user roles", () => {
    expect(STAFF_ROLES).not.toContain("CUSTOMER");
    expect(STAFF_ROLES.every((role) => USER_ROLES.includes(role))).toBe(true);
  });
});

describe("payment constants", () => {
  it("supports the P0 checkout payment methods", () => {
    expect(PAYMENT_METHODS).toEqual([
      "CASH",
      "CARD",
      "INTERAC",
      "STRIPE",
      "WECHAT_PAY",
      "ALIPAY",
      "UNIONPAY",
      "GIFT_CARD",
      "OTHER",
    ]);
  });
});

describe("purchase order constants", () => {
  it("supports the P1 receiving lifecycle", () => {
    expect(PURCHASE_ORDER_STATUSES).toEqual([
      "DRAFT",
      "ORDERED",
      "PARTIALLY_RECEIVED",
      "RECEIVED",
      "CANCELED",
    ]);
  });
});

describe("formatCents", () => {
  it("formats USD cents with the default locale", () => {
    expect(formatCents(326)).toBe("$3.26");
  });

  it("formats zero and negative values consistently", () => {
    expect(formatCents(0)).toBe("$0.00");
    expect(formatCents(-125)).toBe("-$1.25");
  });

  it("accepts another currency with an explicit locale", () => {
    expect(formatCents(123456, "CAD", "en-CA")).toBe("$1,234.56");
  });
});
