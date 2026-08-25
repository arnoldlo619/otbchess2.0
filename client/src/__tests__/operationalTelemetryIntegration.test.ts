import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const clientRoot = resolve(import.meta.dirname, "..");
const appSource = readFileSync(resolve(clientRoot, "App.tsx"), "utf8");
const componentSource = readFileSync(resolve(clientRoot, "components/OperationalTelemetry.tsx"), "utf8");
const telemetrySource = readFileSync(resolve(clientRoot, "lib/operationalTelemetry.ts"), "utf8");

describe("operational telemetry integration", () => {
  it("mounts global telemetry beside existing error and connectivity observers", () => {
    expect(appSource).toContain("<ClientErrorTelemetry />");
    expect(appSource).toContain("<OperationalTelemetry />");
    expect(appSource).toContain("<OfflineStatusBanner />");
  });

  it("installs EventSource observation before child routes can create streams", () => {
    expect(componentSource).toContain("installEventSourceTelemetry();");
    expect(componentSource.indexOf("installEventSourceTelemetry();"))
      .toBeLessThan(componentSource.indexOf("export function OperationalTelemetry"));
    expect(telemetrySource).toContain("new Proxy(NativeEventSource");
    expect(telemetrySource).toContain("MAX_REPORTS_PER_SESSION = 30");
  });

  it("reports the three Core Web Vitals through the standard library", () => {
    expect(telemetrySource).toContain("onCLS(report)");
    expect(telemetrySource).toContain("onINP(report)");
    expect(telemetrySource).toContain("onLCP(report)");
    expect(telemetrySource).not.toContain("window.location.search");
  });
});
