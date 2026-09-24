import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const badgeSource = readFileSync(
  resolve(process.cwd(), "client/src/components/ui/club-player-id-badge.tsx"),
  "utf8",
);

describe("Club Player ID badge", () => {
  it("renders a ChessOTB-branded Chess Club Player credential", () => {
    expect(badgeSource).toContain("CHESSOTB.CLUB");
    expect(badgeSource).toContain("Chess Club Player");
    expect(badgeSource).toContain("CHESSOTB COMMUNITY MEMBER");
    expect(badgeSource).toContain("COTB-2026-001");
    expect(badgeSource).toContain('src="/club-assets/club-space-otb-table.webp"');
  });

  it("keeps its interaction local, accessible, and respectful of reduced motion", () => {
    expect(badgeSource).toContain("useReducedMotion");
    expect(badgeSource).toContain("aria-pressed={flipped}");
    expect(badgeSource).toContain('type="button"');
    expect(badgeSource).toContain("onPointerMove={handlePointerMove}");
    expect(badgeSource).toContain("onPointerLeave={resetTilt}");
    expect(badgeSource).toContain("focus-visible:ring-2");
    expect(badgeSource).not.toContain("position:fixed");
    expect(badgeSource).not.toContain("fonts.googleapis.com");
  });

  it("is a desktop-only decorative depth layer rather than a mobile obstruction", () => {
    expect(badgeSource).toContain('h-[22.5rem] w-[14.5rem]');
    expect(badgeSource).toContain("[perspective:1200px]");
    expect(badgeSource).toContain("[backface-visibility:hidden]");
    expect(badgeSource).toContain("[transform:rotateY(180deg)]");
  });
});
