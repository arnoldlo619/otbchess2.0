import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const readSource = (relativePath: string) => readFileSync(resolve(root, relativePath), "utf8");

const reportPage = readSource("client/src/pages/Report.tsx");
const shareResultsModal = readSource("client/src/components/ShareResultsModal.tsx");

describe("tournament results QR sharing", () => {
  it("uses the canonical public report URL rather than the current transient browser location", () => {
    expect(reportPage).toContain(
      "new URL(`/tournament/${encodeURIComponent(tournamentId)}/report`, window.location.origin).toString()"
    );
    expect(reportPage).toContain("reportUrl={reportUrl}");
  });

  it("renders the permanent report URL into a branded QR code with copy and download fallbacks", () => {
    expect(shareResultsModal).toContain('import { QRCodeSVG } from "qrcode.react"');
    expect(shareResultsModal).toContain("const qrValue = reportUrl || window.location.href");
    expect(shareResultsModal).toContain("value={qrValue}");
    expect(shareResultsModal).toContain("Download PNG");
    expect(shareResultsModal).toContain("Copy Link");
    expect(shareResultsModal).toContain("Scan to view results");
  });

  it("keeps the results QR projection and action controls accessible", () => {
    expect(shareResultsModal).toContain('aria-label={`${tournamentName} results QR projection`}');
    expect(shareResultsModal).toContain('aria-label="Project results QR code fullscreen"');
    expect(shareResultsModal).toContain("min-h-11 min-w-11");
    expect(shareResultsModal).toContain('aria-label="Exit QR projection"');
  });
});
