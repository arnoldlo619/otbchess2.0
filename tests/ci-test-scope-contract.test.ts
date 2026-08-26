import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");
const packageJson = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8")) as {
  scripts: Record<string, string>;
};
const ciConfig = readFileSync(resolve(root, "vitest.ci.config.ts"), "utf8");
const workflow = readFileSync(resolve(root, ".github/workflows/ci.yml"), "utf8");
const template = readFileSync(resolve(root, "docs/CI_WORKFLOW_TEMPLATE.yml"), "utf8");

describe("deterministic CI test scope", () => {
  it("runs the explicit CI unit command instead of broad Vitest discovery", () => {
    const command = packageJson.scripts["test:ci"];

    expect(command).toContain("vitest run --config vitest.ci.config.ts");
    expect(command).not.toContain("pnpm test --");
  });

  it("includes only Vitest test directories and excludes browser and live-credential probes", () => {
    expect(ciConfig).toContain('"client/**/*.test.{ts,tsx}"');
    expect(ciConfig).toContain('"server/**/*.test.{ts,tsx}"');
    expect(ciConfig).toContain('"shared/**/*.test.{ts,tsx}"');
    expect(ciConfig).toContain('"tests/**/*.test.{ts,tsx}"');
    expect(ciConfig).toContain('"scripts/**/*.test.{ts,tsx}"');
    expect(ciConfig).toContain('"e2e/**"');
    expect(ciConfig).toContain('"server/platformEmail.test.ts"');
    expect(ciConfig).toContain('"tests/lichess-token-validation.test.ts"');
  });

  it("keeps the active workflow and preserved template on the explicit deterministic command", () => {
    for (const source of [workflow, template]) {
      expect(source).toContain("run: pnpm test:ci");
      expect(source).not.toContain("run: pnpm test -- --reporter=verbose");
    }
  });
});
