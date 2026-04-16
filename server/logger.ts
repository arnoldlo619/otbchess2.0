/**
 * Lightweight server-side logger.
 *
 * - In production (`NODE_ENV=production`): only `warn` and `error` are emitted.
 * - In development: all levels are emitted with an ISO timestamp prefix.
 *
 * Usage:
 *   import { logger } from "./logger.js";
 *   logger.info("[auth] Guest session created:", id);
 *   logger.warn("[push] Notification failed:", err);
 *   logger.error("[db] Query error:", err);
 */

/* eslint-disable no-console */
const isDev = process.env.NODE_ENV !== "production";

type LogLevel = "debug" | "info" | "warn" | "error";

function emit(level: LogLevel, args: unknown[]): void {
  if (!isDev && (level === "debug" || level === "info")) return;
  const ts = new Date().toISOString();
  const prefix = `[${ts}]`;
  if (level === "error") {
    console.error(prefix, ...args);
  } else if (level === "warn") {
    console.warn(prefix, ...args);
  } else {
    console.log(prefix, ...args);
  }
}

export const logger = {
  debug: (...args: unknown[]) => emit("debug", args),
  info:  (...args: unknown[]) => emit("info",  args),
  warn:  (...args: unknown[]) => emit("warn",  args),
  error: (...args: unknown[]) => emit("error", args),
} as const;
