/**
 * Sentry client-side initialization.
 *
 * Only active when VITE_SENTRY_DSN is set (production).
 * In development the DSN is intentionally omitted so events
 * are not sent to Sentry during local iteration.
 *
 * Usage: import "./lib/sentry" at the top of main.tsx (before React renders).
 */
import * as Sentry from "@sentry/react";

const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;

if (dsn) {
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    // Release is injected by the CI build step via VITE_SENTRY_RELEASE
    release: (import.meta.env.VITE_SENTRY_RELEASE as string | undefined) ?? "unknown",
    // Capture 10% of transactions for performance monitoring
    tracesSampleRate: 0.1,
    // Replay 1% of sessions, 100% of sessions with errors
    replaysSessionSampleRate: 0.01,
    replaysOnErrorSampleRate: 1.0,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: false,
        blockAllMedia: false,
      }),
    ],
    // Ignore common noise
    ignoreErrors: [
      "ResizeObserver loop limit exceeded",
      "ResizeObserver loop completed with undelivered notifications",
      "Non-Error promise rejection captured",
      "ChunkLoadError",
      "Loading chunk",
      "Loading CSS chunk",
    ],
    beforeSend(event) {
      return event;
    },
  });
}

export { Sentry };
