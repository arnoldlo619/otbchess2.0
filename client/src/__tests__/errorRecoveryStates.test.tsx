import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { createClientErrorReference } from "@/components/ErrorBoundary";
import { getErrorConfig } from "@/pages/NotFound";

describe("public error recovery states", () => {
  it("offers clear home and back recovery from an invalid route", () => {
    const config = getErrorConfig("404");
    expect(config.headline).toBe("This board is empty.");
    expect(config.primaryHref).toBe("/");
    expect(config.secondaryHref).toBe("__back__");
  });

  it("uses a real reload action for connection recovery", () => {
    const config = getErrorConfig("network");
    expect(config.primaryLabel).toBe("Retry");
    expect(config.primaryHref).toBe("__reload__");
    expect(config.body).toContain("Check your internet connection");
  });

  it("creates compact, non-sensitive support references for render crashes", () => {
    const first = createClientErrorReference();
    const second = createClientErrorReference();
    expect(first).toMatch(/^UI-[A-Z0-9]+-[A-Z0-9]{5}$/);
    expect(second).not.toBe(first);
  });

  it("keeps technical stack traces out of the visible generic crash UI", () => {
    const source = readFileSync(
      resolve(import.meta.dirname, "../components/ErrorBoundary.tsx"),
      "utf8",
    );
    expect(source).toContain("Support reference");
    expect(source).toContain("Go Home");
    expect(source).not.toContain("{errorStack}");
  });
});
