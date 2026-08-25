import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  evaluateBuildBudgets,
  formatBytes,
  measureBuildArtifacts,
} from "./check-build-budgets.mjs";

const projectRoot = join(import.meta.dirname, "..");
const packageSource = readFileSync(join(projectRoot, "package.json"), "utf8");
const workflowSource = readFileSync(join(projectRoot, "docs/CI_WORKFLOW_TEMPLATE.yml"), "utf8");
const auditSource = readFileSync(join(projectRoot, "docs/BUNDLE_AUDIT.md"), "utf8");

const temporaryDirectories: string[] = [];

function buildFixture() {
  const root = mkdtempSync(join(tmpdir(), "otb-bundle-budget-"));
  temporaryDirectories.push(root);
  const assets = join(root, "assets");
  mkdirSync(join(assets, "nested"), { recursive: true });
  writeFileSync(join(assets, "entry.js"), "export const entry = 'chessotb';\n".repeat(40));
  writeFileSync(join(assets, "nested/route.js"), "export const route = 'clubs';\n".repeat(20));
  writeFileSync(join(assets, "app.css"), ".app{color:green}\n".repeat(30));
  return assets;
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe("production bundle budgets", () => {
  it("measures nested JavaScript and CSS artifacts deterministically", () => {
    const measurement = measureBuildArtifacts(buildFixture());
    expect(measurement.jsFileCount).toBe(2);
    expect(measurement.totalJsRawBytes).toBeGreaterThan(measurement.totalJsGzipBytes);
    expect(measurement.largestJs.file).toMatch(/entry\.js$/);
    expect(measurement.largestCss.file).toMatch(/app\.css$/);
  });

  it("passes measurements within budget and fails each exceeded ceiling", () => {
    const measurement = measureBuildArtifacts(buildFixture());
    const passing = evaluateBuildBudgets(measurement, {
      totalJsGzipBytes: measurement.totalJsGzipBytes,
      largestJsGzipBytes: measurement.largestJs.gzipBytes,
      largestCssRawBytes: measurement.largestCss.rawBytes,
    });
    expect(passing.every((result) => result.passed)).toBe(true);

    const failing = evaluateBuildBudgets(measurement, {
      totalJsGzipBytes: measurement.totalJsGzipBytes - 1,
      largestJsGzipBytes: measurement.largestJs.gzipBytes - 1,
      largestCssRawBytes: measurement.largestCss.rawBytes - 1,
    });
    expect(failing.map((result) => result.passed)).toEqual([false, false, false]);
  });

  it("formats binary byte values for actionable CI output", () => {
    expect(formatBytes(2_306_867)).toBe("2.20 MiB");
    expect(formatBytes(215_040)).toBe("210.0 KiB");
  });

  it("runs after the production build and documents every enforced threshold", () => {
    expect(packageSource).toContain('"check:bundle-budget": "node scripts/check-build-budgets.mjs"');
    expect(workflowSource).toContain("- name: Enforce bundle performance budget\n        run: pnpm check:bundle-budget");
    expect(workflowSource.indexOf("run: pnpm build")).toBeLessThan(workflowSource.indexOf("run: pnpm check:bundle-budget"));
    expect(auditSource).toContain("| Total JavaScript across all route/feature chunks, gzip | 1.87 MiB | 2.20 MiB | 17.6% |");
    expect(auditSource).toContain("| Largest JavaScript chunk, gzip | 179.9 KiB | 210 KiB | 16.7% |");
    expect(auditSource).toContain("| Largest CSS asset, raw | 476.5 KiB | 525 KiB | 10.2% |");
  });
});
