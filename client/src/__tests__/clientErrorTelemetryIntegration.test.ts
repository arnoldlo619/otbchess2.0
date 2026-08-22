import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const clientRoot = resolve(import.meta.dirname, "..");
const appSource = readFileSync(resolve(clientRoot, "App.tsx"), "utf8");
const boundarySource = readFileSync(resolve(clientRoot, "components/ErrorBoundary.tsx"), "utf8");
const notifierSource = readFileSync(resolve(clientRoot, "components/ApiErrorNotifier.tsx"), "utf8");
const telemetrySource = readFileSync(resolve(clientRoot, "components/ClientErrorTelemetry.tsx"), "utf8");

describe("client error telemetry integration", () => {
  it("mounts one global listener for unhandled browser failures", () => {
    expect(appSource).toContain("<ClientErrorTelemetry />");
    expect(telemetrySource).toContain('window.addEventListener("error", handleError)');
    expect(telemetrySource).toContain('window.addEventListener("unhandledrejection", handleRejection)');
  });

  it("reports render crashes with the user-visible reference ID", () => {
    expect(boundarySource).toContain('eventType: "render_error"');
    expect(boundarySource).toContain("referenceId: this.state.referenceId");
    expect(boundarySource).toContain("componentStack: info.componentStack");
  });

  it("reports critical API failures with server request correlation", () => {
    expect(notifierSource).toContain('eventType: "api_error"');
    expect(notifierSource).toContain("requestId: error.requestId");
    expect(notifierSource).toContain("status: error.status");
  });
});
