/**
 * Authenticated API helpers with structured, user-safe error normalization.
 */

const TOKEN_KEY = "otb-auth-token";
export const API_ERROR_EVENT = "otb:api-error";

export interface ApiErrorPayload {
  error?: string;
  message?: string;
  code?: string;
  requestId?: string;
  issues?: unknown[];
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly requestId?: string;
  readonly issues?: unknown[];
  readonly retryable: boolean;

  constructor({
    message,
    status = 0,
    code = "REQUEST_FAILED",
    requestId,
    issues,
    retryable = false,
  }: {
    message: string;
    status?: number;
    code?: string;
    requestId?: string;
    issues?: unknown[];
    retryable?: boolean;
  }) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.requestId = requestId;
    this.issues = issues;
    this.retryable = retryable;
  }
}

export interface ApiErrorEventDetail {
  error: ApiError;
  url: string;
}

const FRIENDLY_SERVER_MESSAGE = "We couldn’t complete that request. Please try again.";
const FRIENDLY_NETWORK_MESSAGE = "We couldn’t reach ChessOTB. Check your connection and try again.";

export function getStoredToken(): string | null {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (error instanceof DOMException && error.name === "AbortError") {
    return new ApiError({
      message: "The request took too long. Please try again.",
      code: "REQUEST_TIMEOUT",
      retryable: true,
    });
  }
  if (error instanceof TypeError) {
    return new ApiError({
      message: FRIENDLY_NETWORK_MESSAGE,
      code: "NETWORK_ERROR",
      retryable: true,
    });
  }
  if (error instanceof Error) return new ApiError({ message: error.message || FRIENDLY_SERVER_MESSAGE });
  return new ApiError({ message: FRIENDLY_SERVER_MESSAGE });
}

export function createApiError(response: Pick<Response, "status">, payload: ApiErrorPayload): ApiError {
  const isServerError = response.status >= 500;
  const serverMessage = payload.message ?? payload.error;
  return new ApiError({
    message: isServerError
      ? (serverMessage && serverMessage !== "Internal server error" ? serverMessage : FRIENDLY_SERVER_MESSAGE)
      : (serverMessage ?? "Request failed"),
    status: response.status,
    code: payload.code ?? (isServerError ? "INTERNAL_SERVER_ERROR" : "REQUEST_FAILED"),
    requestId: payload.requestId,
    issues: payload.issues,
    retryable: isServerError || response.status === 408 || response.status === 429,
  });
}

function emitApiError(error: ApiError, url: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<ApiErrorEventDetail>(API_ERROR_EVENT, {
    detail: { error, url },
  }));
}

async function parseErrorResponse(response: Response): Promise<ApiError> {
  const payload = await response.clone().json().catch(() => ({})) as ApiErrorPayload;
  return createApiError(response, payload);
}

/**
 * Low-level authenticated fetch. Callers keep access to the raw Response, while
 * 5xx and network failures are also surfaced through the global notifier.
 */
export async function authFetch(url: string, options?: RequestInit): Promise<Response> {
  const storedToken = getStoredToken();
  const authHeader: Record<string, string> = storedToken
    ? { Authorization: `Bearer ${storedToken}` }
    : {};

  try {
    const response = await fetch(url, {
      credentials: "include",
      headers: { ...authHeader, ...(options?.headers ?? {}) },
      ...options,
    });
    if (response.status >= 500) emitApiError(await parseErrorResponse(response), url);
    return response;
  } catch (error) {
    const apiError = toApiError(error);
    emitApiError(apiError, url);
    throw apiError;
  }
}

/**
 * Parsed authenticated JSON request. Throws ApiError so contextual UIs can show
 * inline validation and retry controls without technical server details.
 */
export async function apiFetch<T = unknown>(url: string, options?: RequestInit): Promise<T> {
  const storedToken = getStoredToken();
  const authHeader: Record<string, string> = storedToken
    ? { Authorization: `Bearer ${storedToken}` }
    : {};

  try {
    const response = await fetch(url, {
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...authHeader,
        ...(options?.headers ?? {}),
      },
      ...options,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw createApiError(response, data as ApiErrorPayload);
    return data as T;
  } catch (error) {
    throw toApiError(error);
  }
}
