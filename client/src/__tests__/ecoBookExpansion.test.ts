/**
 * ECO Opening Book Expansion — verify comprehensive coverage across all ECO volumes
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const prepEngine = readFileSync(resolve(__dirname, "../../../server/prepEngine.ts"), "utf-8");

// Extract all ECO entries from the source
const entryPattern = /\{ eco: "([^"]+)", name: "([^"]+)", moves: "([^"]+)" \}/g;
const entries: { eco: string; name: string; moves: string }[] = [];
let match: RegExpExecArray | null;
while ((match = entryPattern.exec(prepEngine)) !== null) {
  entries.push({ eco: match[1], name: match[2], moves: match[3] });
}

describe("ECO Book — Size & Coverage", () => {
  it("has at least 120 entries", () => {
    expect(entries.length).toBeGreaterThanOrEqual(120);
  });

  it("covers all 5 ECO volumes (A, B, C, D, E)", () => {
    const volumes = new Set(entries.map(e => e.eco[0]));
    expect(volumes.has("A")).toBe(true);
    expect(volumes.has("B")).toBe(true);
    expect(volumes.has("C")).toBe(true);
    expect(volumes.has("D")).toBe(true);
    expect(volumes.has("E")).toBe(true);
  });

  it("has at least 15 entries per ECO volume", () => {
    const volumeCounts: Record<string, number> = {};
    entries.forEach(e => {
      const vol = e.eco[0];
      volumeCounts[vol] = (volumeCounts[vol] || 0) + 1;
    });
    for (const vol of ["A", "B", "C", "D", "E"]) {
      expect(volumeCounts[vol]).toBeGreaterThanOrEqual(15);
    }
  });
});

describe("ECO Book — Key Opening Families", () => {
  const hasOpening = (name: string) => entries.some(e => e.name.includes(name));

  // Volume A — Flank & Irregular
  it("includes Grob Attack", () => expect(hasOpening("Grob")).toBe(true));
  it("includes Sokolsky Opening", () => expect(hasOpening("Sokolsky")).toBe(true));
  it("includes Bird's Opening", () => expect(hasOpening("Bird")).toBe(true));
  it("includes Larsen's Opening", () => expect(hasOpening("Larsen")).toBe(true));
  it("includes Reti Opening", () => expect(hasOpening("Reti")).toBe(true));
  it("includes King's Indian Attack", () => expect(hasOpening("King's Indian Attack")).toBe(true));
  it("includes English Opening", () => expect(hasOpening("English")).toBe(true));
  it("includes Dutch Defense", () => expect(hasOpening("Dutch")).toBe(true));
  it("includes Dutch: Leningrad", () => expect(hasOpening("Leningrad")).toBe(true));
  it("includes Dutch: Stonewall", () => expect(hasOpening("Stonewall")).toBe(true));
  it("includes Dutch: Classical", () => expect(hasOpening("Dutch: Classical")).toBe(true));
  it("includes Trompowsky Attack", () => expect(hasOpening("Trompowsky")).toBe(true));
  it("includes Torre Attack", () => expect(hasOpening("Torre")).toBe(true));
  it("includes Colle System", () => expect(hasOpening("Colle")).toBe(true));
  it("includes London System", () => expect(hasOpening("London")).toBe(true));
  it("includes Budapest Gambit", () => expect(hasOpening("Budapest")).toBe(true));
  it("includes Old Indian Defense", () => expect(hasOpening("Old Indian")).toBe(true));
  it("includes Benoni Defense", () => expect(hasOpening("Benoni")).toBe(true));
  it("includes Modern Benoni", () => expect(hasOpening("Modern Benoni")).toBe(true));
  it("includes Czech Benoni", () => expect(hasOpening("Czech Benoni")).toBe(true));
  it("includes Benko Gambit", () => expect(hasOpening("Benko")).toBe(true));
  it("includes Old Benoni", () => expect(hasOpening("Old Benoni")).toBe(true));

  // Volume B — Semi-Open
  it("includes Scandinavian Defense", () => expect(hasOpening("Scandinavian")).toBe(true));
  it("includes Alekhine's Defense", () => expect(hasOpening("Alekhine")).toBe(true));
  it("includes Alekhine: Four Pawns Attack", () => expect(hasOpening("Four Pawns")).toBe(true));
  it("includes Pirc Defense", () => expect(hasOpening("Pirc")).toBe(true));
  it("includes Pirc: Austrian Attack", () => expect(hasOpening("Austrian")).toBe(true));
  it("includes Modern Defense", () => expect(hasOpening("Modern Defense")).toBe(true));
  it("includes Nimzowitsch Defense", () => expect(hasOpening("Nimzowitsch")).toBe(true));
  it("includes Owen's Defense", () => expect(hasOpening("Owen")).toBe(true));
  it("includes Caro-Kann Defense", () => expect(hasOpening("Caro-Kann")).toBe(true));
  it("includes Caro-Kann: Panov-Botvinnik", () => expect(hasOpening("Panov")).toBe(true));
  it("includes Sicilian Defense", () => expect(hasOpening("Sicilian Defense")).toBe(true));
  it("includes Sicilian: Najdorf", () => expect(hasOpening("Najdorf")).toBe(true));
  it("includes Sicilian: Dragon", () => expect(hasOpening("Dragon")).toBe(true));
  it("includes Sicilian: Sveshnikov", () => expect(hasOpening("Sveshnikov")).toBe(true));
  it("includes Sicilian: Scheveningen", () => expect(hasOpening("Scheveningen")).toBe(true));
  it("includes Sicilian: Taimanov", () => expect(hasOpening("Taimanov")).toBe(true));
  it("includes Sicilian: Richter-Rauzer", () => expect(hasOpening("Richter-Rauzer")).toBe(true));
  it("includes Sicilian: Smith-Morra Gambit", () => expect(hasOpening("Smith-Morra")).toBe(true));
  it("includes Sicilian: Alapin", () => expect(hasOpening("Alapin")).toBe(true));
  it("includes Sicilian: Grand Prix Attack", () => expect(hasOpening("Grand Prix")).toBe(true));

  // Volume C — French & Open Games
  it("includes French Defense", () => expect(hasOpening("French Defense")).toBe(true));
  it("includes French: Winawer", () => expect(hasOpening("Winawer")).toBe(true));
  it("includes French: Tarrasch", () => expect(hasOpening("Tarrasch")).toBe(true));
  it("includes Italian Game", () => expect(hasOpening("Italian")).toBe(true));
  it("includes Giuoco Piano", () => expect(hasOpening("Giuoco Piano")).toBe(true));
  it("includes Evans Gambit", () => expect(hasOpening("Evans")).toBe(true));
  it("includes Two Knights Defense", () => expect(hasOpening("Two Knights")).toBe(true));
  it("includes Fried Liver Attack", () => expect(hasOpening("Fried Liver")).toBe(true));
  it("includes Four Knights Game", () => expect(hasOpening("Four Knights")).toBe(true));
  it("includes Scotch Game", () => expect(hasOpening("Scotch")).toBe(true));
  it("includes Petrov's Defense", () => expect(hasOpening("Petrov")).toBe(true));
  it("includes Philidor Defense", () => expect(hasOpening("Philidor")).toBe(true));
  it("includes King's Gambit", () => expect(hasOpening("King's Gambit")).toBe(true));
  it("includes Vienna Game", () => expect(hasOpening("Vienna")).toBe(true));
  it("includes Bishop's Opening", () => expect(hasOpening("Bishop's Opening")).toBe(true));
  it("includes Center Game", () => expect(hasOpening("Center Game")).toBe(true));
  it("includes Ruy Lopez", () => expect(hasOpening("Ruy Lopez")).toBe(true));
  it("includes Ruy Lopez: Berlin", () => expect(hasOpening("Berlin")).toBe(true));
  it("includes Ruy Lopez: Marshall Attack", () => expect(hasOpening("Marshall")).toBe(true));
  it("includes Ruy Lopez: Breyer", () => expect(hasOpening("Breyer")).toBe(true));

  // Volume D — Queen's Gambit & Slav
  it("includes Queen's Gambit", () => expect(hasOpening("Queen's Gambit")).toBe(true));
  it("includes QGD", () => expect(hasOpening("QGD")).toBe(true));
  it("includes QGA", () => expect(hasOpening("Queen's Gambit Accepted")).toBe(true));
  it("includes Slav Defense", () => expect(hasOpening("Slav Defense")).toBe(true));
  it("includes Semi-Slav", () => expect(hasOpening("Semi-Slav")).toBe(true));
  it("includes Tarrasch Defense", () => expect(hasOpening("Tarrasch Defense")).toBe(true));
  it("includes Ragozin Defense", () => expect(hasOpening("Ragozin")).toBe(true));
  it("includes Chigorin Defense", () => expect(hasOpening("Chigorin")).toBe(true));
  it("includes Blackmar-Diemer Gambit", () => expect(hasOpening("Blackmar-Diemer")).toBe(true));
  it("includes Veresov Attack", () => expect(hasOpening("Veresov")).toBe(true));
  it("includes Grünfeld Defense", () => expect(hasOpening("Grünfeld")).toBe(true));
  it("includes Grünfeld: Exchange", () => expect(hasOpening("Grünfeld: Exchange")).toBe(true));
  it("includes QGD: Tartakower", () => expect(hasOpening("Tartakower")).toBe(true));

  // Volume E — Indian Defenses
  it("includes Catalan Opening", () => expect(hasOpening("Catalan")).toBe(true));
  it("includes Catalan: Open", () => expect(hasOpening("Catalan: Open")).toBe(true));
  it("includes Nimzo-Indian Defense", () => expect(hasOpening("Nimzo-Indian")).toBe(true));
  it("includes Nimzo-Indian: Samisch", () => expect(hasOpening("Nimzo-Indian: Samisch")).toBe(true));
  it("includes Queen's Indian Defense", () => expect(hasOpening("Queen's Indian")).toBe(true));
  it("includes Bogo-Indian Defense", () => expect(hasOpening("Bogo-Indian")).toBe(true));
  it("includes King's Indian Defense", () => expect(hasOpening("King's Indian Defense")).toBe(true));
  it("includes King's Indian: Classical", () => expect(hasOpening("King's Indian: Classical")).toBe(true));
  it("includes King's Indian: Sämisch", () => expect(hasOpening("Sämisch")).toBe(true));
  it("includes King's Indian: Fianchetto", () => expect(hasOpening("Fianchetto")).toBe(true));
  it("includes King's Indian: Four Pawns Attack", () => expect(hasOpening("Four Pawns Attack")).toBe(true));
  it("includes King's Indian: Mar del Plata", () => expect(hasOpening("Mar del Plata")).toBe(true));
  it("includes King's Indian: Petrosian System", () => expect(hasOpening("Petrosian")).toBe(true));
  it("includes King's Indian: Averbakh", () => expect(hasOpening("Averbakh")).toBe(true));
});

describe("ECO Book — Entry Integrity", () => {
  it("every entry has a valid ECO code (letter + 2 digits)", () => {
    entries.forEach(e => {
      expect(e.eco).toMatch(/^[A-E]\d{2}$/);
    });
  });

  it("every entry has a non-empty name", () => {
    entries.forEach(e => {
      expect(e.name.length).toBeGreaterThan(0);
    });
  });

  it("every entry has a valid move sequence starting with 1.", () => {
    entries.forEach(e => {
      expect(e.moves).toMatch(/^1\./);
    });
  });

  it("no duplicate name+moves combinations", () => {
    const seen = new Set<string>();
    entries.forEach(e => {
      const key = `${e.name}|${e.moves}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    });
  });

  it("entries are sorted by move length descending in ECO_SORTED", () => {
    expect(prepEngine).toContain("ECO_SORTED = [...ECO_BOOK].sort((a, b) => b.moves.length - a.moves.length)");
  });
});
