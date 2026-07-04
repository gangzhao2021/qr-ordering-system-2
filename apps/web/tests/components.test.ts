import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { QrCode } from "../components/QrCode";
import { GET as faviconGET } from "../app/favicon.ico/route";
import { AuthGate, StaffSessionBar } from "../lib/auth-client";
import { p0RunbookSteps } from "../lib/p0-runbook";

describe("AuthGate", () => {
  it("renders the loading state while a session is being checked", () => {
    const html = renderToStaticMarkup(
      React.createElement(
        AuthGate,
        { state: { user: null, loading: true, error: null } },
        React.createElement("div", null, "Private workspace"),
      ),
    );

    expect(html).toContain("Checking access");
    expect(html).toContain("Loading your staff session.");
    expect(html).not.toContain("Private workspace");
  });

  it("renders an access-denied state with a login recovery link", () => {
    const html = renderToStaticMarkup(
      React.createElement(AuthGate, {
        state: {
          user: null,
          loading: false,
          error: "This account does not have access.",
        },
      }),
    );

    expect(html).toContain("Access denied");
    expect(html).toContain("This account does not have access.");
    expect(html).toContain('href="/login"');
    expect(html).toContain("Switch account");
  });

  it("renders protected children after access is allowed", () => {
    const html = renderToStaticMarkup(
      React.createElement(
        AuthGate,
        {
          state: {
            loading: false,
            error: null,
            user: {
              id: "user_1",
              storeId: "store_1",
              email: "admin@local",
              role: "ADMIN",
            },
          },
        },
        React.createElement("section", null, "Management dashboard"),
      ),
    );

    expect(html).toContain("Management dashboard");
    expect(html).not.toContain("Checking access");
    expect(html).not.toContain("Access denied");
  });
});

describe("StaffSessionBar", () => {
  it("does not render without a user", () => {
    const html = renderToStaticMarkup(
      React.createElement(StaffSessionBar, { user: null }),
    );

    expect(html).toBe("");
  });

  it("renders staff identity and logout action", () => {
    const html = renderToStaticMarkup(
      React.createElement(StaffSessionBar, {
        user: {
          id: "user_2",
          storeId: "store_1",
          email: "foh@local",
          role: "FOH",
        },
      }),
    );

    expect(html).toContain("foh@local");
    expect(html).toContain("FOH");
    expect(html).toContain("Log out");
  });
});

describe("QrCode", () => {
  it("renders a stable loading placeholder before the SVG is generated", () => {
    const html = renderToStaticMarkup(
      React.createElement(QrCode, {
        text: "http://127.0.0.1:3000/c?t=table-1-token",
        size: 160,
        label: "Table 1 QR",
        downloadName: "table-1.svg",
      }),
    );

    expect(html).toContain('aria-label="Table 1 QR loading"');
    expect(html).toContain("Generating...");
    expect(html).toContain("width:160px");
    expect(html).toContain("height:160px");
  });
});

describe("favicon route", () => {
  it("serves an immutable SVG favicon response", async () => {
    const response = faviconGET();
    const body = await response.text();

    expect(response.headers.get("content-type")).toBe("image/svg+xml");
    expect(response.headers.get("cache-control")).toBe(
      "public, max-age=31536000, immutable",
    );
    expect(body).toContain("<svg");
    expect(body).toContain('viewBox="0 0 64 64"');
  });
});

describe("p0RunbookSteps", () => {
  it("keeps the manual smoke path aligned to the P0 role boundary", () => {
    expect(p0RunbookSteps.map((step) => step.owner)).toEqual([
      "Customer",
      "Kitchen",
      "FOH",
      "Printer",
      "FOH",
      "Management",
    ]);
    expect(p0RunbookSteps[1]?.goal).toContain("without mutation controls");
    expect(p0RunbookSteps.some((step) => step.href === "customer")).toBe(true);
    expect(p0RunbookSteps.some((step) => step.href === "/foh")).toBe(true);
  });
});
