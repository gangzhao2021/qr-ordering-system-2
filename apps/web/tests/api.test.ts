import { afterEach, describe, expect, it, vi } from "vitest";

async function loadApiModule(apiBaseUrl = "http://api.test") {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", apiBaseUrl);
  return import("../lib/api");
}

describe("apiFetch", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("sends JSON requests to the configured API with credentials", async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const { apiFetch } = await loadApiModule();
    const result = await apiFetch<{ ok: boolean }>("/v1/auth/me", {
      method: "POST",
      headers: { "x-request-id": "test-request" },
      body: JSON.stringify({ hello: "world" }),
    });

    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledWith("http://api.test/v1/auth/me", {
      method: "POST",
      credentials: "include",
      headers: {
        "content-type": "application/json",
        "x-request-id": "test-request",
      },
      body: JSON.stringify({ hello: "world" }),
    });
  });

  it("throws an ApiError with the API error payload", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        return new Response(
          JSON.stringify({
            error: { code: "FORBIDDEN", message: "Manager role required" },
          }),
          { status: 403 },
        );
      }),
    );

    const { ApiError, apiFetch, isUnauthorized } = await loadApiModule();

    await expect(apiFetch("/v1/manage/settings")).rejects.toMatchObject({
      message: "Manager role required",
      status: 403,
      code: "FORBIDDEN",
    });

    const error = new ApiError("Session expired", 401, "UNAUTHORIZED");
    expect(isUnauthorized(error)).toBe(true);
    expect(isUnauthorized(new ApiError("Forbidden", 403))).toBe(false);
    expect(isUnauthorized(new Error("Unauthorized"))).toBe(false);
  });

  it("falls back to a status-based message when the error body is not JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        return new Response("Service unavailable", { status: 503 });
      }),
    );

    const { apiFetch } = await loadApiModule();

    await expect(apiFetch("/health")).rejects.toMatchObject({
      message: "Request failed with 503",
      status: 503,
      code: undefined,
    });
  });
});
