import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { clientErrorSchema } from "./validation";

const routerSource = readFileSync(resolve(import.meta.dirname, "clientErrorRoutes.ts"), "utf8");
const appSource = readFileSync(resolve(import.meta.dirname, "index.ts"), "utf8");

describe("client error telemetry route", () => {
  it("accepts only bounded, recognized client error fields", () => {
    const result = clientErrorSchema.safeParse({
      eventType: "render_error",
      message: "A component failed",
      name: "TypeError",
      stack: "TypeError: A component failed",
      componentStack: "at ClubDashboard",
      path: "/clubs/demo/home",
      referenceId: "UI-123",
      extraSensitiveField: "must be stripped",
    });

    expect(result.success).toBe(true);
    if (result.success) expect(result.data).not.toHaveProperty("extraSensitiveField");
    expect(clientErrorSchema.safeParse({ eventType: "credential_dump", message: "x", path: "/" }).success).toBe(false);
    expect(clientErrorSchema.safeParse({ eventType: "api_error", message: "x".repeat(501), path: "/" }).success).toBe(false);
  });

  it("uses a strict anonymous rate limit and structured logger event", () => {
    expect(routerSource).toContain("max: 20");
    expect(routerSource).toContain('logger.error("client_error_reported"');
    expect(routerSource).toContain("res.status(202).json({ ok: true })");
    expect(routerSource).not.toContain("req.ip,");
    expect(appSource).toContain('app.use("/api/client-errors", createClientErrorRouter())');
  });
});
