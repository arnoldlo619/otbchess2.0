/** Privacy-safe structured server logger with backward-compatible call shapes. */

/* eslint-disable no-console */
const isDev = process.env.NODE_ENV !== "production";

type LogLevel = "debug" | "info" | "warn" | "error";
export type LogContext = Record<string, unknown>;

const SENSITIVE_KEY = /(authorization|cookie|password|passwd|secret|token|api[-_]?key|session|credential|clientsecret)/i;
const EMAIL = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const BEARER = /\bBearer\s+[A-Za-z0-9._~+/=-]+/gi;
const INLINE_SECRET = /\b(password|passwd|secret|token|api[-_]?key|authorization|credential)\s*[:=]\s*(?:"[^"]*"|'[^']*'|[^\s,;]+)/gi;

function redactString(value: string): string {
  return value
    .replace(EMAIL, "[REDACTED_EMAIL]")
    .replace(BEARER, "Bearer [REDACTED]")
    .replace(INLINE_SECRET, (_match, key: string) => `${key}=[REDACTED]`);
}

export function sanitizeLogValue(value: unknown, depth = 0, seen = new WeakSet<object>()): unknown {
  if (typeof value === "string") return redactString(value);
  if (value === null || typeof value === "number" || typeof value === "boolean" || value === undefined) return value;
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "function" || typeof value === "symbol") return String(value);
  if (value instanceof Error) {
    return {
      name: value.name,
      message: redactString(value.message),
      ...(isDev && value.stack ? { stack: redactString(value.stack) } : {}),
    };
  }
  if (depth >= 5) return "[TRUNCATED]";
  if (typeof value === "object") {
    if (seen.has(value)) return "[CIRCULAR]";
    seen.add(value);
    if (Array.isArray(value)) return value.map((item) => sanitizeLogValue(item, depth + 1, seen));
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
      key,
      SENSITIVE_KEY.test(key) ? "[REDACTED]" : sanitizeLogValue(entry, depth + 1, seen),
    ]));
  }
  return String(value);
}

function normalizeEvent(value: string): string {
  return value
    .replace(/^\[([^\]]+)\]\s*/, "$1 ")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase()
    .slice(0, 80) || "server_log";
}

function normalizeArgs(args: unknown[]): { event: string; fields: LogContext } {
  const [first, ...rest] = args;
  const explicitEvent = typeof first === "string" ? first : "server_log";
  const isStructured = rest.length === 1 && rest[0] !== null && typeof rest[0] === "object" && !(rest[0] instanceof Error);
  if (isStructured) {
    return { event: normalizeEvent(explicitEvent), fields: sanitizeLogValue(rest[0]) as LogContext };
  }
  return {
    event: normalizeEvent(explicitEvent),
    fields: {
      message: redactString(typeof first === "string" ? first : String(first ?? "")),
      ...(rest.length ? { details: sanitizeLogValue(rest) } : {}),
    },
  };
}

function emit(level: LogLevel, baseContext: LogContext, args: unknown[], always = false): void {
  if (!always && !isDev && (level === "debug" || level === "info")) return;
  const { event, fields } = normalizeArgs(args);
  const record = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    event,
    ...(sanitizeLogValue(baseContext) as LogContext),
    ...fields,
  });
  if (level === "error") console.error(record);
  else if (level === "warn") console.warn(record);
  else console.log(record);
}

function createLogger(baseContext: LogContext = {}) {
  return {
    debug: (...args: unknown[]) => emit("debug", baseContext, args),
    info: (...args: unknown[]) => emit("info", baseContext, args),
    warn: (...args: unknown[]) => emit("warn", baseContext, args),
    error: (...args: unknown[]) => emit("error", baseContext, args),
    telemetry: (...args: unknown[]) => emit("info", baseContext, args, true),
    child: (context: LogContext) => createLogger({ ...baseContext, ...context }),
  } as const;
}

export const logger = createLogger();
