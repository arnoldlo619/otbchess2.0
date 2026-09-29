import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const authSource = readFileSync(
  resolve(process.cwd(), "client/src/pages/Auth.tsx"),
  "utf8",
);

describe("Auth page visual refinement", () => {
  it("uses the shared Green Waves club-template background instead of the retired photo", () => {
    expect(authSource).toContain('import { GreenWaves } from "@/components/GreenWaves"');
    expect(authSource).toContain('<GreenWaves className="h-full w-full opacity-90" />');
    expect(authSource).toContain('min-h-[100dvh]');
    expect(authSource).not.toContain("auth-bg_d6364218.jpeg");
    expect(authSource).not.toContain('backgroundImage: "url(');
  });

  it("uses the approved Auth brand copy", () => {
    expect(authSource).toContain("Play more chess.");
    expect(authSource).toContain("Over the board.");
    expect(authSource).toContain("chessotb.club");
    expect(authSource).not.toContain("Where chess happens.");
  });

  it("places the supplied 1904 brand artwork above the desktop statement", () => {
    expect(authSource).toContain('src="/auth-assets/auth-brand-artwork.png"');
    expect(authSource).toContain('alt="1904 Chess Club brand mark"');
    expect(authSource).toContain('flex flex-1 items-center justify-center py-3');
    expect(authSource).toContain('h-[19rem] w-[19rem] shrink-0 rounded-[36px]');
    expect(authSource).not.toContain('h-48 w-48 rounded-[28px]');
    expect(authSource.indexOf('src="/auth-assets/auth-brand-artwork.png"')).toBeLessThan(authSource.indexOf("Play more chess."));
    expect(existsSync(resolve(process.cwd(), "client/public/auth-assets/auth-brand-artwork.png"))).toBe(true);
  });
});
