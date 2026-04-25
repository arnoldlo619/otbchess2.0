/**
 * Tests for the "Retry Failed" button in UploadRSVPModal.
 * Verifies the source code contains the correct logic for:
 * 1. handleRetryFailed resets error rows to pending
 * 2. Button is shown only when errorCount > 0, not looking up, and pendingCount === 0
 * 3. Button label shows the count of failed rows
 * 4. RefreshCw icon is imported and used
 */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const src = fs.readFileSync(
  path.resolve(__dirname, "../components/UploadRSVPModal.tsx"),
  "utf-8"
);

describe("UploadRSVPModal: handleRetryFailed", () => {
  it("defines handleRetryFailed callback", () => {
    expect(src).toContain("const handleRetryFailed = useCallback");
  });

  it("resets error rows to pending status", () => {
    expect(src).toContain('r.status === "error" ? { ...r, status: "pending", errorMsg: undefined }');
  });

  it("guards against running while a lookup is in progress", () => {
    expect(src).toContain('rows.some((r) => r.status === "loading")');
  });

  it("triggers handleLookup after resetting rows", () => {
    expect(src).toContain("setTimeout(() => handleLookup(), 0)");
  });
});

describe("UploadRSVPModal: Retry Failed button rendering", () => {
  it("shows button only when errorCount > 0 and not looking up and pendingCount === 0", () => {
    expect(src).toContain("errorCount > 0 && !isLookingUp && pendingCount === 0");
  });

  it("displays the error count in the button label", () => {
    expect(src).toContain("Retry {errorCount} Failed");
  });

  it("calls handleRetryFailed on click", () => {
    expect(src).toContain("onClick={handleRetryFailed}");
  });

  it("shows a tooltip with the count of failed lookups", () => {
    expect(src).toContain("Retry ${errorCount} failed lookup");
  });
});

describe("UploadRSVPModal: RefreshCw icon", () => {
  it("imports RefreshCw from lucide-react", () => {
    const importMatch = src.match(/import\s*\{[^}]*RefreshCw[^}]*\}\s*from\s*["']lucide-react["']/s);
    expect(importMatch).not.toBeNull();
  });

  it("uses RefreshCw in the Retry Failed button", () => {
    expect(src).toContain('<RefreshCw className="w-3.5 h-3.5"');
  });
});

describe("UploadRSVPModal: errorCount variable", () => {
  it("derives errorCount from rows with error status", () => {
    expect(src).toContain('const errorCount = rows.filter((r) => r.status === "error").length');
  });
});
