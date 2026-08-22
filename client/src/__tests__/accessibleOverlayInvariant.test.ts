import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const readSource = (relativePath: string) => readFileSync(path.resolve(relativePath), "utf8");

const migratedOverlays = [
  "client/src/components/AuthModal.tsx",
  "client/src/components/QrScanner.tsx",
  "client/src/components/ProUpgradeModal.tsx",
  "client/src/components/PlayerProfileSheet.tsx",
];

describe("principal custom overlay accessibility", () => {
  it("provides stack-aware Escape, focus containment, and opener restoration", () => {
    const hookSource = readSource("client/src/hooks/useAccessibleOverlay.ts");
    expect(hookSource).toContain("overlayStack.at(-1) !== token");
    expect(hookSource).toContain('event.key === "Escape"');
    expect(hookSource).toContain('event.key !== "Tab"');
    expect(hookSource).toContain("last.focus({ preventScroll: true })");
    expect(hookSource).toContain("first.focus({ preventScroll: true })");
    expect(hookSource).toContain("opener?.isConnected");
  });

  it.each(migratedOverlays)("uses the shared behavior in %s", (relativePath) => {
    expect(readSource(relativePath)).toContain("useAccessibleOverlay({");
  });

  it("keeps explicit dialog semantics on the migrated principal surfaces", () => {
    for (const relativePath of migratedOverlays) {
      const source = readSource(relativePath);
      expect(source, relativePath).toMatch(/role="dialog"/);
      expect(source, relativePath).toMatch(/aria-modal="true"/);
    }
  });
});
