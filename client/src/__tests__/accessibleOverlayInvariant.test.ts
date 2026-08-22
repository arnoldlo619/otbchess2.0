import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const readSource = (relativePath: string) => readFileSync(path.resolve(relativePath), "utf8");

const migratedOverlays = [
  "client/src/components/AuthModal.tsx",
  "client/src/components/QrScanner.tsx",
  "client/src/components/ProUpgradeModal.tsx",
  "client/src/components/PlayerProfileSheet.tsx",
  "client/src/components/AnnounceModal.tsx",
  "client/src/components/CheckInAnnounceModal.tsx",
  "client/src/components/CutoffOverrideModal.tsx",
  "client/src/components/EditPlayerModal.tsx",
  "client/src/components/GameResultModal.tsx",
  "client/src/components/PairingSwapModal.tsx",
  "client/src/components/ShareResultsModal.tsx",
  "client/src/components/SwissPhaseSummaryModal.tsx",
  "client/src/components/tournament/QuadsDirectorPanel.tsx",
  "client/src/components/ChessLineViewer.tsx",
  "client/src/components/FilmGameSheet.tsx",
  "client/src/components/FullScreenClock.tsx",
  "client/src/components/NotationModeOverlay.tsx",
  "client/src/components/QRModal.tsx",
  "client/src/components/RegisterGameModal.tsx",
  "client/src/components/SpectatorQRScreen.tsx",
  "client/src/components/SpectatorShareModal.tsx",
  "client/src/components/ClubMeetupWizard.tsx",
  "client/src/components/ClubShareModal.tsx",
  "client/src/components/ContactOwnerModal.tsx",
  "client/src/components/CreateClubAuthGate.tsx",
  "client/src/components/CreateClubWizard.tsx",
  "client/src/components/CreateLeagueWizard.tsx",
  "client/src/components/EditClubDetailsModal.tsx",
  "client/src/components/club/ClubPromoModal.tsx",
  "client/src/components/club/ClubQRProjectionModal.tsx",
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

  it("uses the stack-aware hook for both result-sharing overlay levels", () => {
    const source = readSource("client/src/components/ShareResultsModal.tsx");
    expect(source.match(/useAccessibleOverlay\(\{/g)).toHaveLength(2);
    expect(source).toContain('aria-label="Exit QR projection"');
  });

  it("preserves chess-line arrow navigation while delegating Escape to the shared overlay", () => {
    const source = readSource("client/src/components/ChessLineViewer.tsx");
    expect(source).toContain('e.key === "ArrowRight"');
    expect(source).toContain('e.key === "ArrowLeft"');
    expect(source).not.toContain('e.key === "Escape" && isFullscreen');
  });

  it("preserves create-club Enter navigation while delegating Escape to the shared overlay", () => {
    const source = readSource("client/src/components/CreateClubWizard.tsx");
    expect(source).toContain('e.key === "Enter"');
    expect(source).not.toContain('if (e.key === "Escape") onClose()');
  });
});
