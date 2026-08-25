import type { Metric } from "web-vitals";
import { isKnownOperationalRouteSegment } from "@shared/operationalTelemetry";

const OPERATIONAL_METRICS_ENDPOINT = "/api/operational-metrics";
const MAX_REPORTS_PER_SESSION = 30;

export type OperationalMetricPayload =
  | {
      eventType: "web_vital";
      path: string;
      metricName: "CLS" | "FCP" | "INP" | "LCP" | "TTFB";
      value: number;
      delta: number;
      rating: "good" | "needs-improvement" | "poor";
      navigationType: string;
    }
  | {
      eventType: "sse_connected" | "sse_disconnected" | "sse_reconnected";
      path: string;
      stream: SseStreamType;
      attempts?: number;
      disconnectedMs?: number;
    };

export type SseStreamType =
  | "broadcast"
  | "club"
  | "live_boards"
  | "tournament_events"
  | "tournament_live"
  | "tournament_players"
  | "other";

type WebVitalName = Extract<OperationalMetricPayload, { eventType: "web_vital" }>["metricName"];
const WEB_VITAL_NAMES = new Set<WebVitalName>(["CLS", "FCP", "INP", "LCP", "TTFB"]);

let reportsSent = 0;
let webVitalsStarted = false;
const reportedWebVitals = new Set<string>();

export function routePattern(rawPath?: string): string {
  const raw = rawPath ?? (typeof window !== "undefined" ? window.location.pathname : "/");
  let pathname = "/";
  try {
    pathname = new URL(raw, "https://chessotb.club").pathname;
  } catch {
    pathname = raw.split(/[?#]/, 1)[0] || "/";
  }

  const segments = pathname
    .split("/")
    .filter(Boolean)
    .slice(0, 8)
    .map((segment) => isKnownOperationalRouteSegment(segment) ? segment.toLowerCase() : ":id");
  return segments.length ? `/${segments.join("/")}` : "/";
}

export function classifySseStream(rawUrl: string | URL): SseStreamType {
  const value = String(rawUrl);
  let pathname = value;
  try {
    pathname = new URL(value, "https://chessotb.club").pathname;
  } catch {
    pathname = value.split(/[?#]/, 1)[0];
  }
  if (/^\/api\/broadcasts\/[^/]+\/events$/.test(pathname)) return "broadcast";
  if (/^\/api\/clubs\/[^/]+\/stream$/.test(pathname)) return "club";
  if (pathname === "/api/sse") return "live_boards";
  if (/^\/api\/tournament\/[^/]+\/players\/stream$/.test(pathname)) return "tournament_players";
  if (/^\/api\/tournament\/[^/]+\/stream$/.test(pathname)) return "tournament_live";
  if (/^\/api\/tournament\/[^/]+\/events$/.test(pathname)) return "tournament_events";
  return "other";
}

export function reportOperationalMetric(payload: OperationalMetricPayload): void {
  if (typeof window === "undefined" || typeof fetch !== "function" || reportsSent >= MAX_REPORTS_PER_SESSION) return;
  reportsSent += 1;
  void fetch(OPERATIONAL_METRICS_ENDPOINT, {
    method: "POST",
    credentials: "omit",
    keepalive: true,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).catch(() => {
    // Operational telemetry must never create a user-visible failure.
  });
}

function reportWebVital(metric: Metric, initialPath: string): void {
  const metricName = metric.name;
  if (!WEB_VITAL_NAMES.has(metricName)) return;
  const key = `${metricName}:${initialPath}`;
  if (reportedWebVitals.has(key)) return;
  reportedWebVitals.add(key);
  reportOperationalMetric({
    eventType: "web_vital",
    path: initialPath,
    metricName,
    value: Number(metric.value.toFixed(metricName === "CLS" ? 4 : 1)),
    delta: Number(metric.delta.toFixed(metricName === "CLS" ? 4 : 1)),
    rating: metric.rating,
    navigationType: String(metric.navigationType).slice(0, 40),
  });
}

export function startWebVitalsReporting(): void {
  if (webVitalsStarted || typeof window === "undefined") return;
  webVitalsStarted = true;
  const initialPath = routePattern(window.location.pathname);
  void import("web-vitals")
    .then(({ onCLS, onFCP, onINP, onLCP, onTTFB }) => {
      const report = (metric: Metric) => reportWebVital(metric, initialPath);
      onCLS(report);
      onFCP(report);
      onINP(report);
      onLCP(report);
      onTTFB(report);
    })
    .catch(() => {
      // Metrics are best-effort and must not affect application startup.
    });
}

export function createObservedEventSource(
  url: string | URL,
  eventSourceInitDict?: EventSourceInit,
): EventSource {
  const source = new EventSource(url, eventSourceInitDict);
  observeEventSource(source, url);
  return source;
}

function observeEventSource(source: EventSource, url: string | URL): void {
  const stream = classifySseStream(url);
  const path = routePattern();
  let hasOpened = false;
  let disconnectedAt: number | null = null;
  let attempts = 0;

  source.addEventListener("open", () => {
    if (disconnectedAt !== null) {
      reportOperationalMetric({
        eventType: "sse_reconnected",
        path,
        stream,
        attempts: Math.max(1, attempts),
        disconnectedMs: Math.max(0, Date.now() - disconnectedAt),
      });
    } else if (!hasOpened) {
      reportOperationalMetric({ eventType: "sse_connected", path, stream });
    }
    hasOpened = true;
    disconnectedAt = null;
    attempts = 0;
  });

  source.addEventListener("error", () => {
    attempts += 1;
    if (disconnectedAt !== null) return;
    disconnectedAt = Date.now();
    reportOperationalMetric({
      eventType: "sse_disconnected",
      path,
      stream,
      attempts,
    });
  });

}

const EVENT_SOURCE_INSTRUMENTED_KEY = "__otbEventSourceTelemetryInstalled";

export function installEventSourceTelemetry(): void {
  if (typeof window === "undefined" || typeof window.EventSource !== "function") return;
  const browserWindow = window as Window & { [EVENT_SOURCE_INSTRUMENTED_KEY]?: boolean };
  if (browserWindow[EVENT_SOURCE_INSTRUMENTED_KEY]) return;

  const NativeEventSource = window.EventSource;
  window.EventSource = new Proxy(NativeEventSource, {
    construct(target, args) {
      const source = Reflect.construct(target, args) as EventSource;
      const url = args[0];
      if (typeof url === "string" || url instanceof URL) observeEventSource(source, url);
      return source;
    },
  }) as typeof EventSource;
  browserWindow[EVENT_SOURCE_INSTRUMENTED_KEY] = true;
}
