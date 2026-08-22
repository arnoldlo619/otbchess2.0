import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { resolvePairingRating } from "../lib/swiss";

const clientRoot = resolve(import.meta.dirname, "..");
const uploadSource = readFileSync(resolve(clientRoot, "components/UploadRSVPModal.tsx"), "utf8");
const directorSource = readFileSync(resolve(clientRoot, "pages/Director.tsx"), "utf8");
const wizardSource = readFileSync(resolve(clientRoot, "components/TournamentWizard.tsx"), "utf8");
const playerSource = readFileSync(resolve(clientRoot, "lib/tournamentData.ts"), "utf8");
const swissSource = readFileSync(resolve(clientRoot, "lib/swiss.ts"), "utf8");

describe("dual rapid and blitz ingestion", () => {
  it("parses both Chess.com categories and stores them on imported players", () => {
    expect(uploadSource).toContain("stats.chess_rapid");
    expect(uploadSource).toContain("stats.chess_blitz");
    expect(uploadSource).toContain("rapidElo,");
    expect(uploadSource).toContain("blitzElo,");
    expect(playerSource).toContain("rapidElo?: number");
    expect(playerSource).toContain("blitzElo?: number");
  });

  it("shows distinct RAPID and BLITZ columns in the RSVP preview", () => {
    expect(uploadSource).toContain('<span className="text-center">RAPID</span>');
    expect(uploadSource).toContain('<span className="text-center">BLITZ</span>');
    expect(uploadSource).toContain('row.player?.rapidElo ?? "—"');
    expect(uploadSource).toContain('row.player?.blitzElo ?? "—"');
  });
});

describe("pairing rating selection", () => {
  it("prefers the host-selected category and retains the documented fallback chain", () => {
    const player = { elo: 1700, rapidElo: 1900, blitzElo: 2100, bulletElo: 2200 };
    expect(resolvePairingRating(player, "rapid")).toEqual({ pairingRating: 1900, ratingSource: "rapid" });
    expect(resolvePairingRating(player, "blitz")).toEqual({ pairingRating: 2100, ratingSource: "blitz" });
    expect(resolvePairingRating({ elo: 1700, rapidElo: undefined, blitzElo: undefined, bulletElo: 1800 }, "rapid")).toEqual({
      pairingRating: 1800,
      ratingSource: "bullet",
    });
  });

  it("defaults the selected category from the chosen time-control preset", () => {
    expect(wizardSource).toContain('ratingType: isBlitzCat ? "blitz" : "rapid"');
    expect(wizardSource).toContain('ratingType: isBlitzTime ? "blitz" : "rapid"');
    expect(wizardSource).toContain('ratingType: timeBase < 10 ? "blitz" : "rapid"');
  });

  it("lets Directors switch the active pairing category and synchronizes player ELO", () => {
    expect(directorSource).toContain('(["rapid", "blitz"] as const).map');
    expect(directorSource).toContain('ratingType: rt');
    expect(directorSource).toContain('p.blitzElo || p.rapidElo || p.elo');
    expect(directorSource).toContain('p.rapidElo || p.blitzElo || p.elo');
    expect(directorSource).toContain('updatePlayer(p.id, { elo: newElo })');
  });

  it("sorts Swiss pairings with pairingRating before the active ELO fallback", () => {
    expect(swissSource).toContain("return p.pairingRating ?? p.elo ?? 1200");
    expect(swissSource).toContain("score groups sorted by points desc, ELO desc");
  });
});
