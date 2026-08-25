import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { dirname, extname, join, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

export const DEFAULT_BUNDLE_BUDGETS = Object.freeze({
  totalJsGzipBytes: 2_306_867, // 2.20 MiB
  largestJsGzipBytes: 215_040, // 210 KiB
  largestCssRawBytes: 537_600, // 525 KiB
});

function listFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? listFiles(path) : [path];
  });
}

export function measureBuildArtifacts(assetsDirectory) {
  if (!existsSync(assetsDirectory)) {
    throw new Error(`Build assets not found: ${assetsDirectory}`);
  }

  const files = listFiles(assetsDirectory);
  const jsFiles = files.filter((file) => extname(file) === ".js");
  const cssFiles = files.filter((file) => extname(file) === ".css");
  if (jsFiles.length === 0) throw new Error(`No JavaScript artifacts found in ${assetsDirectory}`);
  if (cssFiles.length === 0) throw new Error(`No CSS artifacts found in ${assetsDirectory}`);

  const js = jsFiles.map((file) => ({
    file,
    rawBytes: statSync(file).size,
    gzipBytes: gzipSync(readFileSync(file), { level: 9 }).byteLength,
  }));
  const css = cssFiles.map((file) => ({ file, rawBytes: statSync(file).size }));

  return {
    jsFileCount: js.length,
    totalJsRawBytes: js.reduce((sum, artifact) => sum + artifact.rawBytes, 0),
    totalJsGzipBytes: js.reduce((sum, artifact) => sum + artifact.gzipBytes, 0),
    largestJs: js.reduce((largest, artifact) => artifact.gzipBytes > largest.gzipBytes ? artifact : largest),
    largestCss: css.reduce((largest, artifact) => artifact.rawBytes > largest.rawBytes ? artifact : largest),
  };
}

export function evaluateBuildBudgets(measurement, budgets = DEFAULT_BUNDLE_BUDGETS) {
  return [
    {
      label: "Total JavaScript (gzip)",
      actual: measurement.totalJsGzipBytes,
      limit: budgets.totalJsGzipBytes,
    },
    {
      label: "Largest JavaScript chunk (gzip)",
      actual: measurement.largestJs.gzipBytes,
      limit: budgets.largestJsGzipBytes,
      file: measurement.largestJs.file,
    },
    {
      label: "Largest CSS asset (raw)",
      actual: measurement.largestCss.rawBytes,
      limit: budgets.largestCssRawBytes,
      file: measurement.largestCss.file,
    },
  ].map((result) => ({ ...result, passed: result.actual <= result.limit }));
}

export function formatBytes(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MiB`;
  return `${(bytes / 1024).toFixed(1)} KiB`;
}

function run() {
  const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const assetsDirectory = resolve(process.argv[2] ?? join(projectRoot, "dist/public/assets"));
  try {
    const measurement = measureBuildArtifacts(assetsDirectory);
    const results = evaluateBuildBudgets(measurement);
    process.stdout.write(`Measured ${measurement.jsFileCount} JavaScript artifacts in ${assetsDirectory}\n`);
    for (const result of results) {
      const suffix = result.file ? ` (${result.file.replace(`${assetsDirectory}/`, "")})` : "";
      process.stdout.write(`${result.passed ? "PASS" : "FAIL"} ${result.label}: ${formatBytes(result.actual)} / ${formatBytes(result.limit)}${suffix}\n`);
    }
    if (results.some((result) => !result.passed)) {
      process.stderr.write("Bundle performance budget exceeded. Split, defer, or justify the regression before raising a limit.\n");
      process.exitCode = 1;
    }
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) run();
