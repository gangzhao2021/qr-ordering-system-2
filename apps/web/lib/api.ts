const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:3001";

type ApiErrorPayload = {
  error?: {
    code?: string;
    message?: string;
  };
};

function requestHeaders(headers?: HeadersInit) {
  const result = new Headers(headers);
  if (!result.has("content-type")) {
    result.set("content-type", "application/json");
  }
  if (typeof window !== "undefined" && !result.has("x-store-id")) {
    const storeId = window.localStorage
      .getItem("qr2_selected_store_id")
      ?.trim();
    if (storeId) result.set("x-store-id", storeId);
  }
  return result;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
  ) {
    super(message);
  }
}

export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: requestHeaders(init?.headers),
  });

  if (!response.ok) {
    let payload: ApiErrorPayload | null = null;
    try {
      payload = (await response.json()) as ApiErrorPayload;
    } catch {
      payload = null;
    }
    const message =
      payload?.error?.message ?? `Request failed with ${response.status}`;
    throw new ApiError(message, response.status, payload?.error?.code);
  }

  return (await response.json()) as T;
}

export function isUnauthorized(error: unknown) {
  return error instanceof ApiError && error.status === 401;
}
