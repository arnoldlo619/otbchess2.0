export type ClientErrorType = "render_error" | "unhandled_error" | "unhandled_rejection" | "api_error";

export interface ClientErrorReportInput {
  eventType: ClientErrorType;
  error?: unknown;
  message?: string;
  componentStack?: string;
  referenceId?: string;
  requestId?: string;
  status?: number;
  code?: string;
  path?: string;
}

export interface ClientErrorPayload {
  eventType: ClientErrorType;
  message: string;
  name?: string;
  stack?: string;
  componentStack?: string;
  path: string;
  referenceId?: string;
  requestId?: string;
  status?: number;
  code?: string;
}

const REPORT_ENDPOINT = "/api/client-errors";
const DUPLICATE_WINDOW_MS = 10_000;
const lastReported = new Map<string, number>();

export function redactSensitiveText(value: string): string {
  return value
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[REDACTED_EMAIL]")
    .replace(/\bBearer\s+[A-Za-z0-9._~-]+/gi, "Bearer [REDACTED]")
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, "[REDACTED_TOKEN]")
    .replace(/\b(password|token|secret|authorization)\s*[:=]\s*[^\s,;]+/gi, "$1=[REDACTED]");
}

function trim(value: string | undefined, max: number): string | undefined {
  if (!value) return undefined;
  return redactSensitiveText(value).slice(0, max);
}

function reportPath(explicitPath?: string): string {
  const raw = explicitPath ?? (typeof window !== "undefined" ? window.location.pathname : "/");
  try {
    return new URL(raw, typeof window !== "undefined" ? window.location.origin : "https://chessotb.club").pathname.slice(0, 500);
  } catch {
    return raw.split(/[?#]/, 1)[0].slice(0, 500) || "/";
  }
}

function errorParts(error: unknown): { name?: string; message?: string; stack?: string } {
  if (error instanceof Error) return { name: error.name, message: error.message, stack: error.stack };
  if (typeof error === "string") return { message: error };
  if (error && typeof error === "object" && "message" in error) {
    const candidate = error as { name?: unknown; message?: unknown; stack?: unknown };
    return {
      name: typeof candidate.name === "string" ? candidate.name : undefined,
      message: typeof candidate.message === "string" ? candidate.message : undefined,
      stack: typeof candidate.stack === "string" ? candidate.stack : undefined,
    };
  }
  return { message: "Unknown client error" };
}

export function buildClientErrorPayload(input: ClientErrorReportInput): ClientErrorPayload {
  const details = errorParts(input.error);
  return {
    eventType: input.eventType,
    message: trim(input.message ?? details.message ?? "Unknown client error", 500) ?? "Unknown client error",
    name: trim(details.name, 100),
    stack: trim(details.stack, 3_000),
    componentStack: trim(input.componentStack, 3_000),
    path: reportPath(input.path),
    referenceId: trim(input.referenceId, 100),
    requestId: trim(input.requestId, 100),
    status: input.status,
    code: trim(input.code, 100),
  };
}

export function reportClientError(input: ClientErrorReportInput): void {
  if (typeof window === "undefined" || typeof fetch !== "function") return;
  const payload = buildClientErrorPayload(input);
  const key = [payload.eventType, payload.path, payload.name, payload.message, payload.code].join(":");
  const now = Date.now();
  if (now - (lastReported.get(key) ?? 0) < DUPLICATE_WINDOW_MS) return;
  lastReported.set(key, now);

  void fetch(REPORT_ENDPOINT, {
    method: "POST",
    credentials: "omit",
    keepalive: true,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).catch(() => {
    // Error reporting must never create another user-visible failure.
  });
}
