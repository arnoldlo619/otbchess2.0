/**
 * CrossTableGuide — Printable explainer page for reading a Swiss cross-table.
 * Uses real data from Tuesday Beers & Blunders OTB Blitz (2026-03-31) as examples.
 */

interface Props {
  isDark: boolean;
}

export function CrossTableGuide({ isDark }: Props) {
  const card = `guide-card rounded-2xl border overflow-hidden ${isDark ? "border-white/08" : "border-gray-100"}`;
  const cardHeader = `guide-card-header px-5 py-4 border-b ${isDark ? "border-white/08 bg-[oklch(0.20_0.06_145)]" : "border-gray-100 bg-[#F0F5EE]"}`;
  const title = `font-bold text-base ${isDark ? "text-white" : "text-gray-900"}`;
  const sub = `text-sm mt-1.5 ${isDark ? "text-white/50" : "text-gray-500"}`;
  const innerTable = `rounded-xl overflow-hidden border ${isDark ? "border-white/06" : "border-gray-100"}`;
  const thead = isDark ? "bg-white/04" : "bg-gray-50";
  const th = `px-3 py-2.5 text-xs font-bold uppercase tracking-wider ${isDark ? "text-white/30" : "text-gray-400"}`;
  const tdBorder = `border-t ${isDark ? "border-white/06" : "border-gray-100"}`;
  const muted = isDark ? "text-white/50" : "text-gray-500";

  // Mini cross-table data: top 5 players from the real tournament
  const players = [
    { rank: 1, name: "Ken",               results: ["—", "1", "1", null, null], pts: 6 },
    { rank: 2, name: "cdchi94",           results: ["0", "—", null, null, null], pts: 4 },
    { rank: 3, name: "Felix Schlesinger", results: ["0", null, "—", null, null], pts: 4 },
    { rank: 4, name: "Kyle Hugo",         results: [null, null, null, "—", "1"], pts: 4 },
    { rank: 5, name: "Felix S. (2nd)",    results: [null, null, null, "0", "—"], pts: 4 },
  ];

  function cellColor(val: string | null) {
    if (val === "1") return "text-emerald-500";
    if (val === "0") return isDark ? "text-white/30" : "text-gray-300";
    if (val === "—") return isDark ? "text-white/15" : "text-gray-200";
    return isDark ? "text-white/08" : "text-gray-100";
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2
          className={`text-lg font-bold ${isDark ? "text-white" : "text-gray-900"}`}
          style={{ fontFamily: "'Clash Display', sans-serif" }}
        >
          How to Read the Cross-Table
        </h2>
        <p className={`text-sm mt-0.5 ${muted}`}>
          The cross-table shows every game played in the tournament — who played who, and what the result was.
        </p>
      </div>

      {/* ── Grid layout explainer ── */}
      <div className={card}>
        <div className={cardHeader}>
          <span className={title} style={{ fontFamily: "'Clash Display', sans-serif" }}>The Grid Layout</span>
          <p className={sub}>
            Rows = players (ranked by final standing). Columns = opponent numbers. Each cell shows the result of that game.
          </p>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { symbol: "1", label: "Win", desc: "You beat this opponent", color: "text-emerald-500", bg: isDark ? "bg-emerald-500/15" : "bg-emerald-50" },
              { symbol: "0", label: "Loss", desc: "You lost to this opponent", color: isDark ? "text-white/40" : "text-gray-400", bg: isDark ? "bg-white/06" : "bg-gray-50" },
              { symbol: "—", label: "Diagonal / Not Played", desc: "Can't play yourself, or no game this round", color: isDark ? "text-white/20" : "text-gray-300", bg: isDark ? "bg-white/04" : "bg-gray-50" },
            ].map((item) => (
              <div key={item.symbol} className={`guide-highlight rounded-xl p-4 text-center ${item.bg}`}>
                <div className={`text-3xl font-bold tabular-nums mb-2 ${item.color}`}>{item.symbol}</div>
                <p className={`text-sm font-bold ${isDark ? "text-white" : "text-gray-900"}`}>{item.label}</p>
                <p className={`text-xs mt-0.5 ${muted}`}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Mini cross-table ── */}
      <div className={card}>
        <div className={cardHeader}>
          <span className={title} style={{ fontFamily: "'Clash Display', sans-serif" }}>Real Example — Top 5 Players</span>
          <p className={sub}>From Tuesday Beers & Blunders. Read across each row to see a player's results against each opponent.</p>
        </div>
        <div className="p-5 overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className={thead}>
                <th className={`${th} text-center`}>#</th>
                <th className={`${th} text-left`}>Player</th>
                {[1, 2, 3, 4, 5].map((n) => (
                  <th key={n} className={`${th} text-center`}>{n}</th>
                ))}
                <th className={`${th} text-center ${isDark ? "text-[#4CAF50]" : "text-[#3D6B47]"}`}>Pts</th>
              </tr>
            </thead>
            <tbody>
              {players.map((row, i) => (
                <tr key={i} className={tdBorder}>
                  <td className={`px-3 py-3 text-xs font-bold text-center ${isDark ? "text-white/30" : "text-gray-400"}`}>{row.rank}</td>
                  <td className={`px-3 py-3 font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>{row.name}</td>
                  {row.results.map((cell, ci) => (
                    <td key={ci} className={`px-3 py-3 text-center font-bold tabular-nums ${cellColor(cell)}`}>
                      {cell ?? ""}
                    </td>
                  ))}
                  <td className={`px-3 py-3 text-center font-bold tabular-nums ${isDark ? "text-[#4CAF50]" : "text-[#3D6B47]"}`}>
                    {row.pts}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className={`text-xs mt-3 ${isDark ? "text-white/25" : "text-gray-400"}`}>
            Note: Only games between these 5 players are shown. Each player also played opponents outside this group (columns 6–16).
          </p>
        </div>
      </div>

      {/* ── Reading a single cell ── */}
      <div className={card}>
        <div className={cardHeader}>
          <span className={title} style={{ fontFamily: "'Clash Display', sans-serif" }}>Reading a Single Cell</span>
          <p className={sub}>Find the row for the player you're looking at, then move across to the column of their opponent.</p>
        </div>
        <div className="p-5 space-y-3">
          {[
            { row: "Ken (#1)", col: "Column 2 (cdchi94)", value: "1", meaning: "Ken beat cdchi94", color: "text-emerald-500" },
            { row: "cdchi94 (#2)", col: "Column 1 (Ken)", value: "0", meaning: "cdchi94 lost to Ken", color: isDark ? "text-white/40" : "text-gray-400" },
            { row: "Ken (#1)", col: "Column 1 (self)", value: "—", meaning: "Diagonal — a player can't play themselves", color: isDark ? "text-white/20" : "text-gray-300" },
            { row: "Kyle Hugo (#4)", col: "Column 1 (Ken)", value: "(empty)", meaning: "These two never played each other in this tournament", color: isDark ? "text-white/20" : "text-gray-300" },
          ].map((item, i) => (
            <div key={i} className={`guide-highlight flex items-start gap-3 rounded-xl px-4 py-3 ${isDark ? "bg-white/04" : "bg-gray-50"}`}>
              <span className={`text-lg font-bold tabular-nums flex-shrink-0 w-8 text-center ${item.color}`}>{item.value}</span>
              <div>
                <p className={`text-sm font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>
                  Row: {item.row} • {item.col}
                </p>
                <p className={`text-xs mt-0.5 ${muted}`}>{item.meaning}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Symmetry rule ── */}
      <div className={`guide-highlight rounded-2xl border p-5 ${isDark ? "border-[#4CAF50]/20 bg-[#3D6B47]/10" : "border-[#3D6B47]/20 bg-[#3D6B47]/04"}`}>
        <div className="flex items-start gap-3">
          <span className="text-xl flex-shrink-0">🔄</span>
          <div>
            <p
              className={`font-bold text-sm ${isDark ? "text-white" : "text-gray-900"}`}
              style={{ fontFamily: "'Clash Display', sans-serif" }}
            >
              The Symmetry Rule
            </p>
            <p className={`text-sm mt-1 ${isDark ? "text-white/60" : "text-gray-600"}`}>
              Every game has two sides. If Row A → Column B shows <strong>1</strong> (A won),
              then Row B → Column A will always show <strong>0</strong> (B lost).
              The table is always a mirror image across the diagonal.
            </p>
            <p className={`text-xs mt-2 font-mono ${isDark ? "text-white/30" : "text-gray-400"}`}>
              Ken[row 1, col 2] = 1 (win) ↔ cdchi94[row 2, col 1] = 0 (loss)
            </p>
          </div>
        </div>
      </div>

      {/* ── Pts column ── */}
      <div className={card}>
        <div className={cardHeader}>
          <span className={title} style={{ fontFamily: "'Clash Display', sans-serif" }}>The Pts Column</span>
          <p className={sub}>
            The rightmost column sums up all results in that row. It always matches the player's total in the Final Standings.
          </p>
        </div>
        <div className="p-5">
          <div className={innerTable}>
            <table className="w-full text-sm">
              <thead>
                <tr className={thead}>
                  {["Player", "Results in Row", "Calculation", "Pts"].map((h) => (
                    <th key={h} className={`${th} ${h === "Pts" ? "text-center" : "text-left"}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { name: "Ken", results: "1, 1, 1, 1, 1, 1", calc: "6 × 1.0 = 6.0", pts: 6 },
                  { name: "cdchi94", results: "0, 1, 0, 1, 1, 1", calc: "4 × 1.0 + 2 × 0 = 4.0", pts: 4 },
                  { name: "Kyle Harman", results: "0, 1, ½, 0, 0, 1", calc: "2 × 1.0 + 1 × 0.5 = 2.5", pts: 2.5 },
                  { name: "Grant H", results: "0, 0, 0, 0, ½, 0", calc: "0 × 1.0 + 1 × 0.5 = 0.5", pts: 0.5 },
                ].map((row, i) => (
                  <tr key={i} className={tdBorder}>
                    <td className={`px-3 py-3 font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>{row.name}</td>
                    <td className={`px-3 py-3 font-mono text-xs ${muted}`}>{row.results}</td>
                    <td className={`px-3 py-3 font-mono text-xs ${muted}`}>{row.calc}</td>
                    <td className={`px-3 py-3 text-center font-bold tabular-nums ${isDark ? "text-[#4CAF50]" : "text-[#3D6B47]"}`}>{row.pts}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── Swiss pairing note ── */}
      <div className={`guide-card rounded-2xl border p-5 ${isDark ? "border-white/08" : "border-gray-100"}`}>
        <div className="flex items-start gap-3">
          <span className="text-xl flex-shrink-0">♟️</span>
          <div>
            <p
              className={`font-bold text-sm ${isDark ? "text-white" : "text-gray-900"}`}
              style={{ fontFamily: "'Clash Display', sans-serif" }}
            >
              Why Are There Empty Cells?
            </p>
            <p className={`text-sm mt-1 ${isDark ? "text-white/60" : "text-gray-600"}`}>
              In a Swiss tournament, not every player faces every other player. With 16 players and 6 rounds,
              each player only plays 6 games. The cross-table will have many empty cells — that's normal and expected.
              Only players who were actually paired together have a result shown.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
