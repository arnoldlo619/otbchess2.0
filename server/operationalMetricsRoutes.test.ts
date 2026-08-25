import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { operationalMetricSchema } from "./validation";

const projectRoot = resolve(import.meta.dirname, "..");
const routeSource = readFileSync(resolve(projectRoot, "server/operationalMetricsRoutes.ts"), "utf8");
const appSource = readFileSync(resolve(projectRoot, "server/index.ts"), "utf8");
const loggerSource = readFileSync(resolve(projectRoot, "server/logger.ts"), "utf8");

describe("operational metrics endpoint", () => {
  it("accepts bounded Web Vitals and rejects identifiers or extra fields", () => {
    expect(operationalMetricSchema.safeParse({
      eventType: "web_vital",
      path: "/tournament/:id/manage",
      metricName: "LCP",
      value: 1824.5,
      delta: 1824.5,
      rating: "good",
      navigationType: "navigate",
    }).success).toBe(true);
    expect(operationalMetricSchema.safeParse({
      eventType: "web_vital",
      path: "/tournament/private-tournament-name/manage",
      metricName: "LCP",
      value: 1824.5,
      delta: 1824.5,
      rating: "good",
      navigationType: "navigate",
    }).success).toBe(false);
    expect(operationalMetricSchema.safeParse({
      eventType: "web_vital",
      path: "/",
      metricName: "LCP",
      value: 100,
      delta: 100,
      rating: "good",
      navigationType: "navigate",
      userId: "private",
    }).success).toBe(false);
  });

  it("requires event-specific SSE recovery fields", () => {
    expect(operationalMetricSchema.safeParse({
      eventType: "sse_disconnected",
      path: "/tournament/:id",
      stream: "tournament_live",
      attempts: 1,
    }).success).toBe(true);
    expect(operationalMetricSchema.safeParse({
      eventType: "sse_reconnected",
      path: "/tournament/:id",
      stream: "tournament_live",
      attempts: 2,
    }).success).toBe(false);
  });

  it("uses strict anonymous rate limiting, persistent structured telemetry, and app wiring", () => {
    expect(routeSource).toContain("max: 60");
    expect(routeSource).toContain('logger.telemetry("client_operational_metric"');
    expect(routeSource).toContain("res.status(202).json({ ok: true })");
    expect(routeSource).not.toContain("req.ip,");
    expect(loggerSource).toContain('telemetry: (...args: unknown[]) => emit("info", baseContext, args, true)');
    expect(appSource).toContain('app.use("/api/operational-metrics", createOperationalMetricsRouter())');
  });
});
