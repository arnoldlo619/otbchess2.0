import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { Chess } from "chess.js";

import { buildCachedPrepAnalysisReport, buildReport } from "../server/prep/buildReport.js";
import { buildScoutBrief } from "../server/prep/evidencePolicy.js";
import { forecast } from "../server/prep/facts.js";
import { parseGames } from "../server/prep/parseGames.js";
import { EVIDENCE_FIXTURES, LEGAL_LAUNCH_LINES, makeLaunchGames } from "../server/prep/__fixtures__/launchFixtures.js";
import {
  activeScoutRequestFromQuery,
  createActiveScoutRequest,
  scoutRequestCacheKey,
  scoutRequestRoute,
} from "../shared/scoutRequest.js";

const PROJECT_ROOT = join(import.meta.dirname ?? __dirname, "..");
const pageSource = readFileSync(join(PROJECT_ROOT, "client/src/pages/MatchupPrep.tsx"), "utf8");
const forecastSource = readFileSync(join(PROJECT_ROOT, "client/src/components/prep/ForecastWalkthrough.tsx"), "utf8");
const exportSource = readFileSync(join(PROJECT_ROOT, "client/src/components/prep/PrepExportCard.tsx"), "utf8");
const routeSource = readFileSync(join(PROJECT_ROOT, "server/prepRoutes.ts"), "utf8");
const standardOptions = { maxGames: 30, months: 18, timeClasses: ["rapid", "blitz", "bullet"], ratedOnly: true };

describe("Matchup Prep launch blockers before remediation", () => {
  it("MP-01/05/06: completed snapshots retain the complete submitted identity", () => {
    const activeRequest = createActiveScoutRequest({
      platform: "lichess",
      displayUsername: "sameplayer",
      myColor: "black",
      format: "all",
    }, "2026-08-27T00:00:00.000Z");
    const cached = buildCachedPrepAnalysisReport(
      "lichess",
      "sameplayer",
      EVIDENCE_FIXTURES.sameNameLichess,
      standardOptions,
      scoutRequestCacheKey(activeRequest),
      activeRequest,
    );
    expect(cached.report.reportSnapshot).toMatchObject({
      activeRequest: {
        platform: "lichess",
        normalizedUsername: "sameplayer",
        displayUsername: "sameplayer",
        myColor: "black",
        formats: ["rapid", "blitz", "bullet"],
        mode: "standard",
        maxGames: 30,
        schemaVersion: "launch-2",
      },
    });
  });

  it("MP-02/03: a user playing White begins with a legal user White move, never an isolated Black reply", () => {
    const report = buildReport("chesscom", "sameplayer", makeLaunchGames({ count: 12, playerColor: "black" }), standardOptions);
    const root = report.openingForecast.black[0] as typeof report.openingForecast.black[number] & { actor?: string };
    expect(root.moveSan).toBe("e4");
    expect(root.actor).toBe("user");
  });

  it("MP-03: after ...e5, White's Nf3 is never labeled as the Black opponent's continuation", () => {
    const { parsed } = parseGames(
      makeLaunchGames({ count: 12, playerColor: "black" }),
      "sameplayer",
      standardOptions,
    );
    const currentBlackTree = forecast(parsed.filter(game => game.scoutedColor === "black"), "black");
    const e4 = currentBlackTree.find(branch => branch.moveSan === "e4");
    const e5 = e4?.children.find(branch => branch.moveSan === "e5");
    expect(e4).toMatchObject({ actor: "user", previewPath: ["e4"] });
    expect(e5).toMatchObject({ actor: "opponent", previewPath: ["e4", "e5"] });
    expect(e5?.children[0]).toMatchObject({ moveSan: "Nf3", actor: "user" });
    expect(forecastSource).not.toMatch(/selectedPath\.length % 2 === \(opponentColor === "white" \? 0 : 1\)[\s\S]*likely continuation/);
  });

  it("MP-04: every required launch fixture replays legally from the standard position", () => {
    for (const line of Object.values(LEGAL_LAUNCH_LINES)) {
      const chess = new Chess();
      for (const san of line) expect(() => chess.move(san)).not.toThrow();
    }
    const { parsed, quarantined } = parseGames(makeLaunchGames({ count: 4 }), "sameplayer", standardOptions);
    expect(parsed).toHaveLength(4);
    expect(quarantined).toBe(0);
  });

  it("MP-05: the shareable route encodes provider, username, color, and format", () => {
    const activeRequest = createActiveScoutRequest({ platform: "lichess", displayUsername: "SamePlayer", myColor: "black", format: "blitz" });
    const route = scoutRequestRoute(activeRequest);
    expect(route).toBe("/prep/SamePlayer?provider=lichess&myColor=black&tc=blitz");
    const parsed = activeScoutRequestFromQuery("SamePlayer", new URLSearchParams(route.split("?")[1]), activeRequest.requestedAt);
    expect(parsed).toEqual(activeRequest);
  });

  it("MP-05/06: a completed Lichess snapshot, route reload, and recent-history restore cannot resolve to Chess.com", () => {
    const lichess = createActiveScoutRequest({ platform: "lichess", displayUsername: "SamePlayer", myColor: "black", format: "rapid" });
    const chesscom = createActiveScoutRequest({ platform: "chesscom", displayUsername: "sameplayer", myColor: "black", format: "rapid" });
    expect(scoutRequestRoute(lichess)).toContain("provider=lichess");
    expect(scoutRequestCacheKey(lichess)).not.toBe(scoutRequestCacheKey(chesscom));
    expect(pageSource).toContain("scoutRequestRoute(request)");
    expect(pageSource).toContain("data.reportSnapshot?.activeRequest ?? request");
  });

  it("MP-06: cache identity includes platform, normalized username, color, formats, mode, max games, and schema version", () => {
    const whiteRapid = createActiveScoutRequest({ platform: "chesscom", displayUsername: "Player", myColor: "white", format: "rapid" });
    const blackAll = createActiveScoutRequest({ platform: "chesscom", displayUsername: "player", myColor: "black", format: "all" });
    expect(scoutRequestCacheKey(whiteRapid)).toBe("v4:chesscom:player:cwhite:frapid:mstandard:g30:slaunch-2");
    expect(scoutRequestCacheKey(blackAll)).toBe("v4:chesscom:player:cblack:frapid+blitz+bullet:mstandard:g30:slaunch-2");
    expect(routeSource).toContain("scoutRequestCacheKey(activeRequest)");
  });

  it("MP-08/09: Standard uses at most 30 recent eligible games and All includes all three launch formats", () => {
    const report = buildReport("chesscom", "sameplayer", makeLaunchGames({ count: 44 }), standardOptions);
    expect(report.dataQuality.parsed).toBeLessThanOrEqual(30);
    expect(Object.keys(report.opponent.timeControlSplit).sort()).toEqual(["blitz", "bullet", "rapid"]);
  });

  it("MP-10: samples of 3, 6, and 8 expose the required centralized eligibility", () => {
    const reports = [EVIDENCE_FIXTURES.three, EVIDENCE_FIXTURES.six, EVIDENCE_FIXTURES.eight]
      .map(raw => buildReport("chesscom", "sameplayer", raw, standardOptions) as ReturnType<typeof buildReport> & { scoutBrief?: unknown[] });
    expect(reports[0].scoutBrief).toEqual([]);
    expect(reports[1].scoutBrief).toEqual([]);
    expect(reports[2].scoutBrief).toBeDefined();
  });

  it("MP-11: evidence older than 365 days is explicitly Stale", () => {
    const report = buildReport("chesscom", "sameplayer", EVIDENCE_FIXTURES.twentyStale, standardOptions) as ReturnType<typeof buildReport> & { freshness?: string };
    expect(report.freshness).toBe("stale");
  });

  it("MP-12: an isolated root reply receives no opening name", () => {
    const report = buildReport("chesscom", "sameplayer", makeLaunchGames({ count: 12, playerColor: "black" }), standardOptions);
    expect(report.openingForecast.black.every(branch => branch.label === undefined)).toBe(true);
  });

  it("MP-13: game length never creates phase, tactical, middlegame, or endgame claims", () => {
    const report = buildReport("chesscom", "sameplayer", makeLaunchGames({ count: 12, result: "0-1" }), standardOptions);
    const text = report.insights.map(insight => [insight.claim, insight.interpretation, insight.recommendation.action].join(" ")).join(" ");
    expect(text).not.toMatch(/opening losses|middlegame|endgame|by game length|tactical/i);
  });

  it("MP-14: primary recommendations contain no generic actions or duplicate stable IDs", () => {
    const report = buildReport("chesscom", "sameplayer", EVIDENCE_FIXTURES.twentyRecent, standardOptions, "black");
    const concreteInsight = report.insights.find(insight => insight.recommendation.line) ?? {
      ...report.insights[0],
      color: "white" as const,
      recommendation: { action: "Rehearse 1. e4 e5 from the observed position.", line: { san: "1. e4 e5", validated: true as const } },
      sampleSize: 8,
      confidence: "medium" as const,
    };
    const actions = concreteInsight ? buildScoutBrief([concreteInsight], "black", "usable") : [];
    expect(actions.length).toBeGreaterThan(0);
    expect(new Set(actions.map(action => action.id)).size).toBe(actions.length);
    expect(actions.map(action => action.action?.label ?? "").join(" ")).not.toMatch(/know your setup|play solidly|prepare your main line|be ready for alternatives|rehearse to move 10/i);
  });

  it("MP-15: Deep and the secondary opponent-color selector are absent", () => {
    expect(pageSource).not.toMatch(/Deep|gameCountFilter|Depth/);
    expect(forecastSource).not.toMatch(/Opp\. White|Opp\. Black|handleColorSwitch|setOpponentColor/);
  });

  it("MP-15: Standard is the only launch mode rather than the same report under a Deep label", () => {
    const request = createActiveScoutRequest({ platform: "chesscom", displayUsername: "player", myColor: "white", format: "all" });
    expect(request).toMatchObject({ mode: "standard", maxGames: 30 });
    expect(pageSource).not.toMatch(/gc === "50" \? "Standard" : "Deep"/);
    expect(pageSource).not.toMatch(/\["50", "100"\]/);
  });

  it("MP-16: exports consume the completed snapshot without a mutable color prop", () => {
    expect(exportSource).not.toMatch(/myColor\??:/);
    expect(pageSource).not.toMatch(/<PrepExportCard[\s\S]*myColor=\{myColor\}/);
  });

  it("MP-17: the board exposes a live position description while unnamed third-party controls remain inert", () => {
    expect(forecastSource).toContain('id="forecast-board-instructions"');
    expect(forecastSource).toContain('role="status"');
    expect(forecastSource).toContain('aria-hidden="true" inert');
    expect(forecastSource).toContain("Use the named move buttons to navigate legal continuations.");
  });
});
