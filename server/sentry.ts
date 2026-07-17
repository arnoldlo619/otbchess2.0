/**
 * Sentry server-side initialization.
 *
 * Only active when SENTRY_DSN is set (production).
 * Import this at the very top of server/index.ts, before any other imports.
 *
 * Usage: import "./sentry.js" as the first line in server/index.ts
 */
import * as Sentry from "@sentry/node";

const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? "development",
    release: process.env.SENTRY_RELEASE ?? "unknown",
    // Capture 10% of transactions for performance monitoring
    tracesSampleRate: 0.1,
    // Capture unhandled promise rejections automatically
    integrations: [
      Sentry.captureConsoleIntegration({ levels: ["error"] }),
    ],
  });
}

export { Sentry };
