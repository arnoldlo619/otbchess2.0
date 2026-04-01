/**
 * TiebreakersGuide — Printable explainer page for chess tournament tiebreaker systems.
 * Uses real data from Tuesday Beers & Blunders OTB Blitz (2026-03-31) as examples.
 */

interface Props {
  isDark: boolean;
}

export function TiebreakersGuide({ isDark }: Props) {
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
                  { result: "Win", pts: "+1.0", example: "Ken beats cdchi94 → Ken earns 1 pt", color: "text-emerald-500" },
                  { result: "Draw", pts: "+0.5", example: "Kyle Harman draws → each player earns 0.5 pts", color: "text-blue-500" },
                  { result: "Loss", pts: "+0.0", example: "Grant H loses → Grant H earns 0 pts", color: isDark ? "text-white/30" : "text-gray-300" },
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
                {[
                  { name: "Ken", pts: 6, w: 6, d: 0, l: 0, note: "Perfect score — 6 wins from 6 rounds" },
                  { name: "Kyle Harman", pts: 2.5, w: 2, d: 1, l: 3, note: "Draw earns half a point" },
                  { name: "goldenone975", pts: 1.5, w: 1, d: 1, l: 3, note: "1 win + 1 draw = 1.5 pts" },
                  { name: "Grant H", pts: 0.5, w: 0, d: 1, l: 5, note: "Only a draw — 0.5 pts total" },
                ].map((row, i) => (
                  <tr key={i} className={tdBorder}>
                    <td className={`px-3 py-3 font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>{row.name}</td>
                    <td className={`px-3 py-3 text-center font-bold tabular-nums ${isDark ? "text-white" : "text-gray-900"}`}>{row.pts}</td>
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
              Real example — cdchi94 vs Felix Schlesinger (both 4 pts, Bch separates them)
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
                  {[
                    { name: "cdchi94", pts: 4, opps: "Ken (6), Kyle Harman (2.5), Paul Gilmore (2), …", bch: "21.0", rank: "#2" },
                    { name: "Felix Schlesinger", pts: 4, opps: "Ken (6), Christopher (2), Paul Gilmore (2), …", bch: "20.0", rank: "#3" },
                  ].map((row, i) => (
                    <tr key={i} className={tdBorder}>
                      <td className={`px-3 py-3 font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>{row.name}</td>
                      <td className={`px-3 py-3 text-center font-bold ${isDark ? "text-white" : "text-gray-900"}`}>{row.pts}</td>
                      <td className={`px-3 py-3 text-xs ${muted}`}>{row.opps}</td>
                      <td className={`px-3 py-3 text-center font-bold tabular-nums ${isDark ? "text-amber-400" : "text-amber-600"}`}>{row.bch}</td>
                      <td className={`px-3 py-3 text-center font-bold ${i === 0 ? "text-emerald-500" : (isDark ? "text-white/40" : "text-gray-400")}`}>{row.rank}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className={`text-xs mt-2 ${isDark ? "text-white/30" : "text-gray-400"}`}>
              cdchi94 faced tougher opponents (including Ken, the winner), so their Buchholz is higher → ranked #2.
            </p>
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
                {[
                  { rnd: "R1", opp: "cdchi94 (4 pts)", oppScore: 4, result: "Win (×1)", contrib: "4.0", color: "text-emerald-500" },
                  { rnd: "R2", opp: "Felix S. (4 pts)", oppScore: 4, result: "Win (×1)", contrib: "4.0", color: "text-emerald-500" },
                  { rnd: "R3", opp: "Jacques (3 pts)", oppScore: 3, result: "Win (×1)", contrib: "3.0", color: "text-emerald-500" },
                ].map((row, i) => (
                  <tr key={i} className={tdBorder}>
                    <td className={`px-3 py-3 text-center text-xs ${isDark ? "text-white/40" : "text-gray-400"}`}>{row.rnd}</td>
                    <td className={`px-3 py-3 text-sm ${isDark ? "text-white/70" : "text-gray-700"}`}>{row.opp}</td>
                    <td className={`px-3 py-3 text-center font-mono font-bold ${isDark ? "text-white/70" : "text-gray-700"}`}>{row.oppScore}</td>
                    <td className={`px-3 py-3 text-center font-semibold ${row.color}`}>{row.result}</td>
                    <td className="px-3 py-3 text-center font-bold tabular-nums text-purple-500">{row.contrib}</td>
                  </tr>
                ))}
                <tr className={`border-t-2 ${isDark ? "border-white/12" : "border-gray-200"}`}>
                  <td colSpan={4} className={`px-3 py-3 text-right font-bold text-sm ${muted}`}>Ken's SB Total (3 rounds shown)</td>
                  <td className="px-3 py-3 text-center font-bold text-lg text-purple-500">11.0+</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className={`text-xs ${isDark ? "text-white/30" : "text-gray-400"}`}>
            Beating a player who scored 6 pts contributes more than beating a player who scored 1 pt — quality of wins matters.
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
