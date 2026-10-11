import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const directorSource = readFileSync(resolve(process.cwd(), "client/src/pages/Director.tsx"), "utf8");
const lookupSource = readFileSync(resolve(process.cwd(), "client/src/components/tournament/PreStartPlayerLookup.tsx"), "utf8");
const playerLookupSource = readFileSync(resolve(process.cwd(), "client/src/lib/playerLookup.ts"), "utf8");

describe("Director pre-start player lookup", () => {
  const playersTab = directorSource.slice(
    directorSource.indexOf('{activeTab === "players" && ('),
    directorSource.indexOf("/* ── Bracket Tab"),
  );
  const homeTab = directorSource.slice(
    directorSource.indexOf('activeTab === "home"'),
    directorSource.indexOf('activeTab === "standings"'),
  );

  it("uses the inline Chess.com lookup only while the tournament is in registration", () => {
    expect(playersTab).toContain("{isRegistration ? (");
    expect(playersTab).toContain("<PreStartPlayerLookup");
    expect(playersTab).toContain("existingUsernames={existingUsernames}");
    expect(playersTab).toContain("ratingType={tournamentConfig?.ratingType}");
    expect(playersTab).toContain('aria-label="Open manual, Lichess, and CSV player options"');
  });

  it("switches the same toolbar back to roster search after Round 0", () => {
    expect(playersTab).toContain('aria-label="Search name, username, ELO"');
    expect(playersTab).toContain('placeholder="Search name, username, ELO…"');
    expect(playersTab).toContain("{isRegistration ? (");
    expect(playersTab).toContain(") : (");
    expect(playersTab).not.toContain("Late Registration");
  });

  it("keeps late walk-in registration available from the Home dashboard during Round 1", () => {
    expect(homeTab).toContain("Late registration open — players added now will be paired or given a bye.");
    expect(homeTab).toContain("state.currentRound === 1");
    expect(homeTab).toContain("setShowAddPlayer(true)");
  });

  it("provides a labeled, keyboard-accessible lookup with clear feedback and touch-sized controls", () => {
    expect(lookupSource).toContain('htmlFor="prestart-player-username"');
    expect(lookupSource).toContain('aria-label="Add a player from Chess.com"');
    expect(lookupSource).toContain('onSubmit={handleSubmit}');
    expect(lookupSource).toContain('if (status === "found") handleAdd();');
    expect(lookupSource).toContain('role="alert"');
    expect(lookupSource).toContain('aria-live="polite"');
    expect(lookupSource).toContain('style={{ minHeight: "44px", touchAction: "manipulation" }}');
    expect(lookupSource).toContain('This player is already registered.');
  });

  it("shares the Add Player Chess.com profile contract and rating-aware roster mapping", () => {
    expect(playerLookupSource).toContain("chessComPlayerEndpoint(username)");
    expect(playerLookupSource).toContain("createChessComTournamentPlayer");
    expect(playerLookupSource).toContain('platform: "chesscom"');
    expect(playerLookupSource).toContain("resolveChessComRating(lookup, ratingType)");
  });
});
