/**
 * TiebreakersGuide — Printable explainer page for chess tournament tiebreaker systems.
 * When real standings + rounds are provided, examples use actual tournament data.
 * Falls back to static demo data when fewer than 3 players or no completed rounds.
 */

import type {Round} from "@/lib/tournamentData";
import type { StandingRow } from "@/lib/swiss";

interface Props {
  isDark: boolean;
  /** Live standings from computeStandings — optional; falls back to demo data */
  standings?: StandingRow[];
  /** Raw round data — needed for per-round SB breakdown */
  rounds?: Round[];
  /** Points map: playerId → points (used for opponent score lookup) */
  pointsMap?: Map<string, number>;
}

// ─── Demo fallback data ───────────────────────────────────────────────────────
const DEMO_WDL = [
  { name: "Ken", pts: 6, w: 6, d: 0, l: 0, note: "Perfect score — 6 wins from 6 rounds" },
  { name: "Kyle Harman", pts: 2.5, w: 2, d: 1, l: 3, note: "Draw earns half a point" },
  { name: "goldenone975", pts: 1.5, w: 1, d: 1, l: 3, note: "1 win + 1 draw = 1.5 pts" },
  { name: "Grant H", pts: 0.5, w: 0, d: 1, l: 5, note: "Only a draw — 0.5 pts total" },
];
const DEMO_BCH = [
  { name: "cdchi94", pts: 4, opps: "Ken (6), Kyle Harman (2.5), Paul Gilmore (2), …", bch: "21.0", rank: "#2" },
  { name: "Felix Schlesinger", pts: 4, opps: "Ken (6), Christopher (2), Paul Gilmore (2), …", bch: "20.0", rank: "#3" },
];
const DEMO_SB = [
  { rnd: "R1", opp: "cdchi94 (4 pts)", oppScore: 4, result: "Win (×1)", contrib: "4.0", color: "text-emerald-500" },
  { rnd: "R2", opp: "Felix S. (4 pts)", oppScore: 4, result: "Win (×1)", contrib: "4.0", color: "text-emerald-500" },
  { rnd: "R3", opp: "Jacques (3 pts)", oppScore: 3, result: "Win (×1)", contrib: "3.0", color: "text-emerald-500" },
];
const DEMO_SB_TOTAL = "11.0+";
const DEMO_SB_PLAYER = "Ken";

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fmt(n: number): string {
  return n % 1 === 0 ? n.toFixed(0) : n.toFixed(1);
}

function getNote(w: number, d: number, l: number, pts: number): string {
  if (d === 0 && l === 0) return `Perfect score — ${w} win${w !== 1 ? "s" : ""} from ${w + d + l} rounds`;
  if (d > 0 && w === 0) return `${d} draw${d !== 1 ? "s" : ""} only — ${fmt(pts)} pts total`;
  if (d > 0) return `${w} win${w !== 1 ? "s" : ""} + ${d} draw${d !== 1 ? "s" : ""} = ${fmt(pts)} pts`;
  return `${w} win${w !== 1 ? "s" : ""}, ${l} loss${l !== 1 ? "es" : ""}`;
}

export function TiebreakersGuide({ isDark, standings, rounds }: Props) {
  const card = `guide-card rounded-2xl border overflow-hidden ${isDark ? "border-white/08" : "border-gray-100"}`;
  const cardHeader = `guide-card-header px-5 py-4 border-b ${isDark ? "border-white/08 bg-[oklch(0.20_0.06_145)]" : "border-gray-100 bg-[#F0F5EE]"}`;
  const title = `font-bold text-base ${isDark ? "text-white" : "text-gray-900"}`;
  const sub = `text-sm mt-1.5 ${isDark ? "text-white/50" : "text-gray-500"}`;
  const innerTable = `rounded-xl overflow-hidden border ${isDark ? "border-white/06" : "border-gray-100"}`;
  const thead = isDark ? "bg-white/04" : "bg-gray-50";
  const th = `px-3 py-2.5 text-xs font-bold uppercase tracking-wider ${isDark ? "text-white/30" : "text-gray-400"}`;
  const tdBorder = `border-t ${isDark ? "border-white/06" : "border-gray-100"}`;
  const muted = isDark ? "text-white/50" : "text-gray-500";
  const pill = (color: string) =>
    `text-xs font-bold uppercase tracking-widest px-2.5 py-1 rounded-full ${color}`;
  const formulaBox = `rounded-xl p-4 text-center ${isDark ? "bg-white/04" : "bg-gray-50"}`;

  // ── Determine whether we have enough real data ──────────────────────────────
  const hasRealData = !!standings && standings.length >= 3 &&
    !!rounds && rounds.some((r) => r.games.some((g) => g.result !== "*"));

  // ── Build live points map from standings ────────────────────────────────────
  const livePointsMap = new Map<string, number>();
  if (hasRealData && standings) {
    for (const row of standings) {
      livePointsMap.set(row.player.id, row.points);
    }
  }

  // ── W/D/L table rows (top 4 players, real or demo) ──────────────────────────
  const wdlRows = hasRealData && standings
    ? standings.slice(0, 4).map((row) => ({
        name: row.player.name,
        pts: row.points,
        w: row.wins,
        d: row.draws,
        l: row.losses,
        note: getNote(row.wins, row.draws, row.losses, row.points),
      }))
    : DEMO_WDL;

  // ── Buchholz example: find first tied pair ──────────────────────────────────
  let bchRows: { name: string; pts: number; opps: string; bch: string; rank: string }[] = DEMO_BCH;
  let bchNote = "cdchi94 faced tougher opponents (including Ken, the winner), so their Buchholz is higher → ranked #2.";

  if (hasRealData && standings && rounds) {
    // Find first two players tied on points
    let tiedPair: [StandingRow, StandingRow] | null = null;
    for (let i = 0; i < standings.length - 1; i++) {
      if (standings[i].points === standings[i + 1].points) {
        tiedPair = [standings[i], standings[i + 1]];
        break;
      }
    }
    if (tiedPair) {
      const buildOppsStr = (playerId: string): string => {
        const opps: string[] = [];
        for (const round of rounds!) {
          for (const game of round.games) {
            if (game.result === "*") continue;
            let oppId: string | null = null;
            if (game.whiteId === playerId) oppId = game.blackId;
            else if (game.blackId === playerId) oppId = game.whiteId;
            if (oppId) {
              const oppRow = standings!.find((r) => r.player.id === oppId);
              if (oppRow) opps.push(`${oppRow.player.name} (${fmt(oppRow.points)})`);
            }
          }
        }
        return opps.length > 3 ? opps.slice(0, 3).join(", ") + ", …" : opps.join(", ") || "—";
      };
      const [p1, p2] = tiedPair;
      bchRows = [
        { name: p1.player.name, pts: p1.points, opps: buildOppsStr(p1.player.id), bch: fmt(p1.buchholz), rank: `#${p1.rank}` },
        { name: p2.player.name, pts: p2.points, opps: buildOppsStr(p2.player.id), bch: fmt(p2.buchholz), rank: `#${p2.rank}` },
      ];
      bchNote = `${p1.player.name} faced tougher opponents, so their Buchholz is higher → ranked #${p1.rank}.`;
    }
  }

  // ── SB table: top player's round-by-round breakdown ────────────────────────
  type SbRow = { rnd: string; opp: string; oppScore: number; result: string; contrib: string; color: string };
  let sbRows: SbRow[] = DEMO_SB;
  let sbTotal = DEMO_SB_TOTAL;
  let sbPlayerName = DEMO_SB_PLAYER;

  if (hasRealData && standings && rounds) {
    const topRow = standings[0];
    sbPlayerName = topRow.player.name;
    const built: SbRow[] = [];
    for (const round of rounds) {
      for (const game of round.games) {
        if (game.result === "*") continue;
        let oppId: string | null = null;
        let myResult: number = 0;
        if (game.whiteId === topRow.player.id) {
          oppId = game.blackId;
          myResult = game.result === "1-0" ? 1 : game.result === "½-½" ? 0.5 : 0;
        } else if (game.blackId === topRow.player.id) {
          oppId = game.whiteId;
          myResult = game.result === "0-1" ? 1 : game.result === "½-½" ? 0.5 : 0;
        }
        if (oppId) {
          const oppRow = standings.find((r) => r.player.id === oppId);
          if (oppRow) {
            const oppScore = oppRow.points;
            const contrib = oppScore * myResult;
            const resultLabel = myResult === 1 ? "Win (×1)" : myResult === 0.5 ? "Draw (×0.5)" : "Loss (×0)";
            const color = myResult === 1 ? "text-emerald-500" : myResult === 0.5 ? "text-blue-500" : (isDark ? "text-white/30" : "text-gray-300");
            built.push({
              rnd: `R${round.number}`,
              opp: `${oppRow.player.name} (${fmt(oppScore)} pts)`,
              oppScore,
              result: resultLabel,
              contrib: fmt(contrib),
              color,
            });
          }
        }
      }
    }
    if (built.length > 0) {
      sbRows = built.slice(0, 4); // show up to 4 rounds for readability
      sbTotal = fmt(topRow.sonnebornBerger);
    }
  }

  const isLive = hasRealData;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2
          className={`text-lg font-bold ${isDark ? "text-white" : "text-gray-900"}`}
          style={{ fontFamily: "'Clash Display', sans-serif" }}
        >
          How Tiebreakers Work
        </h2>
        <p className={`text-sm mt-0.5 ${muted}`}>
          When players finish with the same number of points, these systems determine final ranking order. Applied in the order shown below.
          {isLive && <span className={`ml-2 text-xs font-semibold ${isDark ? "text-[#4CAF50]" : "text-[#3D6B47]"}`}>· Examples use this tournament's actual data</span>}
        </p>
      </div>

      {/* ── Pts ── */}
      <div className={card}>
        <div className={cardHeader}>
          <div className="flex items-center gap-3">
            <span className={pill(isDark ? "bg-[#4CAF50]/20 text-[#4CAF50]" : "bg-[#3D6B47]/12 text-[#3D6B47]")}>Pts</span>
            <span className={title} style={{ fontFamily: "'Clash Display', sans-serif" }}>Points</span>
            <span className={`text-xs ${isDark ? "text-white/30" : "text-gray-400"}`}>(Primary criterion)</span>
          </div>
          <p className={sub}>The main ranking criterion. Win = 1 pt, Draw = 0.5 pts, Loss = 0 pts.</p>
        </div>
        <div className="p-5">
          <div className={innerTable}>
            <table className="w-full text-sm">
              <thead>
                <tr className={thead}>
                  {["Result", "Points Earned", "Example"].map((h) => (
                    <th key={h} className={`${th} text-left`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  {
                    result: "Win", pts: "+1.0",
                    example: isLive && standings && standings.length >= 2
                      ? `${standings[0].player.name} beats ${standings[1].player.name} → earns 1 pt`
                      : "Ken beats cdchi94 → Ken earns 1 pt",
                    color: "text-emerald-500",
                  },
                  {
                    result: "Draw", pts: "+0.5",
                    example: isLive && standings
                      ? `Two players draw → each earns 0.5 pts`
                      : "Kyle Harman draws → each player earns 0.5 pts",
                    color: "text-blue-500",
                  },
                  {
                    result: "Loss", pts: "+0.0",
                    example: isLive && standings && standings.length > 0
                      ? `${standings[standings.length - 1].player.name} loses → earns 0 pts`
                      : "Grant H loses → Grant H earns 0 pts",
                    color: isDark ? "text-white/30" : "text-gray-300",
                  },
                ].map((row, i) => (
                  <tr key={i} className={tdBorder}>
                    <td className={`px-3 py-3 font-semibold ${row.color}`}>{row.result}</td>
                    <td className={`px-3 py-3 font-mono font-bold text-base ${row.color}`}>{row.pts}</td>
                    <td className={`px-3 py-3 text-xs ${muted}`}>{row.example}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── W / D / L ── */}
      <div className={card}>
        <div className={cardHeader}>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs font-bold uppercase tracking-widest px-2 py-1 rounded-full text-emerald-500 ${isDark ? "bg-emerald-500/15" : "bg-emerald-50"}`}>W</span>
            <span className={`text-xs font-bold uppercase tracking-widest px-2 py-1 rounded-full text-blue-500 ${isDark ? "bg-blue-500/15" : "bg-blue-50"}`}>D</span>
            <span className={`text-xs font-bold uppercase tracking-widest px-2 py-1 rounded-full ${isDark ? "text-white/40 bg-white/08" : "text-gray-400 bg-gray-100"}`}>L</span>
            <span className={`${title} ml-1`} style={{ fontFamily: "'Clash Display', sans-serif" }}>Wins / Draws / Losses</span>
          </div>
          <p className={sub}>A breakdown of each player's individual game outcomes across all rounds.</p>
        </div>
        <div className="p-5">
          <div className={innerTable}>
            <table className="w-full text-sm">
              <thead>
                <tr className={thead}>
                  {["Player", "Pts", "W", "D", "L", "Note"].map((h) => (
                    <th key={h} className={`${th} ${h === "Player" || h === "Note" ? "text-left" : "text-center"}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {wdlRows.map((row, i) => (
                  <tr key={i} className={tdBorder}>
                    <td className={`px-3 py-3 font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>{row.name}</td>
                    <td className={`px-3 py-3 text-center font-bold tabular-nums ${isDark ? "text-white" : "text-gray-900"}`}>{fmt(row.pts)}</td>
                    <td className="px-3 py-3 text-center font-semibold tabular-nums text-emerald-500">{row.w}</td>
                    <td className="px-3 py-3 text-center font-semibold tabular-nums text-blue-500">{row.d}</td>
                    <td className={`px-3 py-3 text-center font-semibold tabular-nums ${isDark ? "text-white/30" : "text-gray-300"}`}>{row.l}</td>
                    <td className={`px-3 py-3 text-xs ${muted}`}>{row.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── Buchholz ── */}
      <div className={card}>
        <div className={cardHeader}>
          <div className="flex items-center gap-3">
            <span className={pill(isDark ? "bg-amber-500/20 text-amber-400" : "bg-amber-50 text-amber-600")}>Bch</span>
            <span className={title} style={{ fontFamily: "'Clash Display', sans-serif" }}>Buchholz</span>
            <span className={`text-xs ${isDark ? "text-white/30" : "text-gray-400"}`}>(1st tiebreak)</span>
          </div>
          <p className={sub}>
            The sum of all your opponents' final scores. Playing stronger opponents gives a higher Buchholz.
          </p>
        </div>
        <div className="p-5 space-y-4">
          <div className={formulaBox}>
            <p className={`text-xs uppercase tracking-widest mb-2 ${isDark ? "text-white/30" : "text-gray-400"}`}>Formula</p>
            <p className={`text-base font-mono font-bold ${isDark ? "text-white" : "text-gray-900"}`}>
              Bch = Opp₁ pts + Opp₂ pts + Opp₃ pts + …
            </p>
          </div>
          <div>
            <p className={`text-xs font-bold uppercase tracking-wider mb-3 ${isDark ? "text-white/30" : "text-gray-400"}`}>
              {isLive
                ? `Real example — ${bchRows[0]?.name} vs ${bchRows[1]?.name} (both ${fmt(bchRows[0]?.pts ?? 0)} pts, Bch separates them)`
                : "Real example — cdchi94 vs Felix Schlesinger (both 4 pts, Bch separates them)"}
            </p>
            <div className={innerTable}>
              <table className="w-full text-sm">
                <thead>
                  <tr className={thead}>
                    {["Player", "Pts", "Opponents Faced", "Bch", "Rank"].map((h) => (
                      <th key={h} className={`${th} ${h === "Player" || h === "Opponents Faced" ? "text-left" : "text-center"}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {bchRows.map((row, i) => (
                    <tr key={i} className={tdBorder}>
                      <td className={`px-3 py-3 font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>{row.name}</td>
                      <td className={`px-3 py-3 text-center font-bold ${isDark ? "text-white" : "text-gray-900"}`}>{fmt(row.pts)}</td>
                      <td className={`px-3 py-3 text-xs ${muted}`}>{row.opps}</td>
                      <td className={`px-3 py-3 text-center font-bold tabular-nums ${isDark ? "text-amber-400" : "text-amber-600"}`}>{row.bch}</td>
                      <td className={`px-3 py-3 text-center font-bold ${i === 0 ? "text-emerald-500" : (isDark ? "text-white/40" : "text-gray-400")}`}>{row.rank}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className={`text-xs mt-2 ${isDark ? "text-white/30" : "text-gray-400"}`}>{bchNote}</p>
          </div>
        </div>
      </div>

      {/* ── Bch1 ── */}
      <div className={card}>
        <div className={cardHeader}>
          <div className="flex items-center gap-3">
            <span className={pill(isDark ? "bg-orange-500/20 text-orange-400" : "bg-orange-50 text-orange-600")}>Bch1</span>
            <span className={title} style={{ fontFamily: "'Clash Display', sans-serif" }}>Buchholz Cut-1</span>
            <span className={`text-xs ${isDark ? "text-white/30" : "text-gray-400"}`}>(2nd tiebreak)</span>
          </div>
          <p className={sub}>
            Same as Buchholz, but the lowest-scoring opponent is removed. Reduces the impact of a lucky pairing against a very weak player.
          </p>
        </div>
        <div className="p-5 space-y-4">
          <div className={formulaBox}>
            <p className={`text-xs uppercase tracking-widest mb-2 ${isDark ? "text-white/30" : "text-gray-400"}`}>Formula</p>
            <p className={`text-base font-mono font-bold ${isDark ? "text-white" : "text-gray-900"}`}>
              Bch1 = Bch − min(opponent score)
            </p>
          </div>
          {/* Live Bch1 example if we have a tied pair */}
          {isLive && bchRows.length === 2 && standings && (() => {
            const p1 = standings.find((r) => r.player.name === bchRows[0].name);
            const p2 = standings.find((r) => r.player.name === bchRows[1].name);
            if (!p1 || !p2) return null;
            return (
              <div className={innerTable}>
                <table className="w-full text-sm">
                  <thead>
                    <tr className={thead}>
                      {["Player", "Bch", "Bch1", "Rank"].map((h) => (
                        <th key={h} className={`${th} ${h === "Player" ? "text-left" : "text-center"}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[p1, p2].map((row, i) => (
                      <tr key={i} className={tdBorder}>
                        <td className={`px-3 py-3 font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>{row.player.name}</td>
                        <td className={`px-3 py-3 text-center font-bold tabular-nums ${isDark ? "text-amber-400" : "text-amber-600"}`}>{fmt(row.buchholz)}</td>
                        <td className={`px-3 py-3 text-center font-bold tabular-nums ${isDark ? "text-orange-400" : "text-orange-600"}`}>{fmt(row.buchholzCut1)}</td>
                        <td className={`px-3 py-3 text-center font-bold ${i === 0 ? "text-emerald-500" : (isDark ? "text-white/40" : "text-gray-400")}`}>#{row.rank}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })()}
          <div className={`guide-highlight flex gap-3 rounded-xl p-4 ${isDark ? "bg-white/04" : "bg-gray-50"}`}>
            <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-sm ${isDark ? "bg-orange-500/20 text-orange-400" : "bg-orange-50 text-orange-600"}`}>
              ⚠️
            </div>
            <div>
              <p className={`text-sm font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>Why remove the lowest?</p>
              <p className={`text-xs mt-0.5 ${muted}`}>
                A player might be paired against a very weak opponent who scores 0 points all tournament.
                Removing that score prevents an easy pairing from unfairly hurting your tiebreak ranking.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── SB ── */}
      <div className={card}>
        <div className={cardHeader}>
          <div className="flex items-center gap-3">
            <span className={pill(isDark ? "bg-purple-500/20 text-purple-400" : "bg-purple-50 text-purple-600")}>SB</span>
            <span className={title} style={{ fontFamily: "'Clash Display', sans-serif" }}>Sonneborn-Berger</span>
            <span className={`text-xs ${isDark ? "text-white/30" : "text-gray-400"}`}>(3rd tiebreak)</span>
          </div>
          <p className={sub}>
            Rewards beating strong opponents more than weak ones. Multiply each opponent's score by your result (1 = win, 0.5 = draw, 0 = loss).
          </p>
        </div>
        <div className="p-5 space-y-4">
          <div className={formulaBox}>
            <p className={`text-xs uppercase tracking-widest mb-2 ${isDark ? "text-white/30" : "text-gray-400"}`}>Formula</p>
            <p className={`text-base font-mono font-bold ${isDark ? "text-white" : "text-gray-900"}`}>
              SB = Σ (opponent score × your result)
            </p>
          </div>
          <p className={`text-xs font-bold uppercase tracking-wider ${isDark ? "text-white/30" : "text-gray-400"}`}>
            {isLive ? `${sbPlayerName}'s round-by-round SB breakdown` : `${sbPlayerName}'s round-by-round SB breakdown (first 3 rounds shown)`}
          </p>
          <div className={innerTable}>
            <table className="w-full text-sm">
              <thead>
                <tr className={thead}>
                  {["Rnd", "Opponent", "Opp. Score", "Your Result", "SB Contribution"].map((h) => (
                    <th key={h} className={`${th} ${h === "Opponent" ? "text-left" : "text-center"}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sbRows.map((row, i) => (
                  <tr key={i} className={tdBorder}>
                    <td className={`px-3 py-3 text-center text-xs ${isDark ? "text-white/40" : "text-gray-400"}`}>{row.rnd}</td>
                    <td className={`px-3 py-3 text-sm ${isDark ? "text-white/70" : "text-gray-700"}`}>{row.opp}</td>
                    <td className={`px-3 py-3 text-center font-mono font-bold ${isDark ? "text-white/70" : "text-gray-700"}`}>{row.oppScore}</td>
                    <td className={`px-3 py-3 text-center font-semibold ${row.color}`}>{row.result}</td>
                    <td className="px-3 py-3 text-center font-bold tabular-nums text-purple-500">{row.contrib}</td>
                  </tr>
                ))}
                <tr className={`border-t-2 ${isDark ? "border-white/12" : "border-gray-200"}`}>
                  <td colSpan={4} className={`px-3 py-3 text-right font-bold text-sm ${muted}`}>
                    {sbPlayerName}'s SB Total{!isLive ? " (3 rounds shown)" : ""}
                  </td>
                  <td className="px-3 py-3 text-center font-bold text-lg text-purple-500">{sbTotal}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className={`text-xs ${isDark ? "text-white/30" : "text-gray-400"}`}>
            Beating a player who scored more points contributes more than beating a player who scored fewer — quality of wins matters.
          </p>
        </div>
      </div>

      {/* ── Tiebreak Order Summary ── */}
      <div className={`rounded-2xl border p-5 ${isDark ? "border-white/08" : "border-gray-100"}`}>
        <h3
          className={`font-bold text-sm mb-4 ${isDark ? "text-white" : "text-gray-900"}`}
          style={{ fontFamily: "'Clash Display', sans-serif" }}
        >
          Tiebreak Order Applied in This Tournament
        </h3>
        <div className="space-y-2">
          {[
            { rank: 1, label: "Pts", desc: "Points — primary criterion", color: isDark ? "text-[#4CAF50]" : "text-[#3D6B47]" },
            { rank: 2, label: "Bch", desc: "Buchholz — sum of all opponent scores", color: isDark ? "text-amber-400" : "text-amber-600" },
            { rank: 3, label: "Bch1", desc: "Buchholz Cut-1 — lowest opponent score removed", color: isDark ? "text-orange-400" : "text-orange-600" },
            { rank: 4, label: "SB", desc: "Sonneborn-Berger — quality of wins weighted", color: "text-purple-500" },
            { rank: 5, label: "W", desc: "Number of wins — final fallback", color: "text-emerald-500" },
          ].map((row) => (
            <div key={row.rank} className={`guide-list-item flex items-center gap-3 rounded-xl px-4 py-3 ${isDark ? "bg-white/04" : "bg-gray-50"}`}>
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${isDark ? "bg-white/08 text-white/40" : "bg-gray-200 text-gray-500"}`}>
                {row.rank}
              </span>
              <span className={`text-sm font-bold w-10 flex-shrink-0 ${row.color}`}>{row.label}</span>
              <span className={`text-sm ${muted}`}>{row.desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
