/**
 * Lightweight client-side logger.
 *
 * - In production (`import.meta.env.PROD`): only `warn` and `error` are emitted.
 * - In development: all levels are emitted with a bracketed prefix.
 *
 * Usage:
 *   import { logger } from "@/lib/logger";
 *   logger.info("[auth] User signed in");
 *   logger.warn("[push] Subscription failed:", err);
 *   logger.error("[carousel] Export error", err);
 */

type LogLevel = "debug" | "info" | "warn" | "error";

const isDev = !import.meta.env.PROD;

function emit(level: LogLevel, args: unknown[]): void {
  if (!isDev && (level === "debug" || level === "info")) return;
  // eslint-disable-next-line no-console
  console[level](...args);
}

export const logger = {
  debug: (...args: unknown[]) => emit("debug", args),
  info:  (...args: unknown[]) => emit("info",  args),
  warn:  (...args: unknown[]) => emit("warn",  args),
  error: (...args: unknown[]) => emit("error", args),
} as const;
