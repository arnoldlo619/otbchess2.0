/**
 * ScoutAISummary — AI-generated scouting report summary card.
 * Auto-triggers after the V3 report loads. Calls /api/prep/coach-insight
 * with a structured prompt and renders 3-5 high-value bullet insights.
 */
import { useState, useEffect, useRef } from "react";
import { Sparkles, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import { authFetch } from "@/lib/apiFetch";
import type { ScoutReportV3 } from "../../../../shared/prepTypes";

type Tokens = {
  card: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  [key: string]: string;
};

interface Props {
  report: ScoutReportV3;
  isDark: boolean;
  t: Tokens;
}

// Build a tight, structured prompt from the V3 report data
function buildSummaryPrompt(report: ScoutReportV3): { system: string; user: string } {
  const opp = report.opponent;
  const s = report.sections;

  // Win/draw/loss from record
  const wRecord = opp.record.white;
  const bRecord = opp.record.black;
  const totalW = (wRecord?.w ?? 0) + (bRecord?.w ?? 0);
  const totalD = (wRecord?.d ?? 0) + (bRecord?.d ?? 0);
  const totalL = (wRecord?.l ?? 0) + (bRecord?.l ?? 0);
  const totalGames = totalW + totalD + totalL;
  const overallWinRate = totalGames > 0 ? Math.round((totalW / totalGames) * 100) : 0;

  const whiteGames = (wRecord?.w ?? 0) + (wRecord?.d ?? 0) + (wRecord?.l ?? 0);
  const blackGames = (bRecord?.w ?? 0) + (bRecord?.d ?? 0) + (bRecord?.l ?? 0);
  const whiteWinRate = whiteGames > 0 ? Math.round(((wRecord?.w ?? 0) / whiteGames) * 100) : 0;
  const blackWinRate = blackGames > 0 ? Math.round(((bRecord?.w ?? 0) / blackGames) * 100) : 0;

  // Top opening forecasts
  const whiteOpenings = (report.openingForecast.white ?? []).slice(0, 3)
    .map(b => `${b.label ?? b.moveSan} (${Math.round(b.pct * 100)}%)`);
  const blackOpenings = (report.openingForecast.black ?? []).slice(0, 3)
    .map(b => `${b.label ?? b.moveSan} (${Math.round(b.pct * 100)}%)`);

  // Top weaknesses and strengths from sections
  const weaknesses = s.weaknesses?.slice(0, 3).map(w => `- ${w}`) ?? [];
  const strengths = s.strengths?.slice(0, 2).map(str => `- ${str}`) ?? [];
  const matchupBullets = s.matchupSummary?.slice(0, 3) ?? [];
  const behaviorNotes = s.behavior?.slice(0, 2) ?? [];

  const userPrompt = `
Opponent: ${opp.username}
Rating: ${opp.avgRating ?? "unknown"}
Overall: ${totalW}W ${totalD}D ${totalL}L (${overallWinRate}% win rate, ${totalGames} games)
As White: ${whiteWinRate}% win rate (${whiteGames} games)
As Black: ${blackWinRate}% win rate (${blackGames} games)

Favorite openings as White: ${whiteOpenings.join(", ") || "unknown"}
Favorite openings as Black: ${blackOpenings.join(", ") || "unknown"}

Weaknesses:
${weaknesses.join("\n") || "- None identified"}

Strengths:
${strengths.join("\n") || "- None identified"}

Matchup summary:
${matchupBullets.map(b => `- ${b}`).join("\n") || "- No summary available"}

Behavioral patterns:
${behaviorNotes.map(b => `- ${b}`).join("\n") || "- None identified"}

Write a concise scouting report summary with EXACTLY 4 bullet points. Each bullet must be:
- Actionable and specific (not generic chess advice)
- Based only on the data above
- Maximum 20 words each
- Start with a bold keyword like "**Opening:**", "**Weakness:**", "**Exploit:**", "**Avoid:**", "**Endgame:**", "**Time pressure:**", etc.

Format: Return only the 4 bullet points, one per line, starting with "•". No intro text, no conclusion.
`.trim();

  return {
    system: "You are a chess coach writing a pre-match scouting report. Be direct, specific, and actionable. Use only the data provided.",
    user: userPrompt,
  };
}

// Parse the LLM response into clean bullet strings
function parseBullets(text: string): string[] {
  return text
    .split("\n")
    .map(line => line.trim())
    .filter(line => line.startsWith("•") || line.startsWith("-") || line.match(/^\d+\./))
    .map(line => line.replace(/^[•\-\d.]\s*/, "").trim())
    .filter(Boolean)
    .slice(0, 5);
}

// Build a deterministic fallback summary from the structured report data
function buildDeterministicSummary(report: ScoutReportV3): string[] {
  const bullets: string[] = [];
  const opp = report.opponent;
  const s = report.sections;

  // Top weakness
  const weaknessInsight = report.insights.find(i => s.weaknesses.includes(i.id));
  if (weaknessInsight) {
    bullets.push(`**Exploit:** ${weaknessInsight.recommendation.action}`);
  }

  // Opening tendency
  const tendencyInsight = report.insights.find(i => i.kind === "opening_tendency");
  if (tendencyInsight) {
    bullets.push(`**Opening:** ${tendencyInsight.claim}`);
  }

  // Strength to avoid
  const strengthInsight = report.insights.find(i => s.strengths.includes(i.id));
  if (strengthInsight) {
    bullets.push(`**Avoid:** ${strengthInsight.interpretation}`);
  }

  // Behavior pattern
  const behaviorInsight = report.insights.find(i => i.kind === "behavior");
  if (behaviorInsight) {
    bullets.push(`**Pattern:** ${behaviorInsight.interpretation}`);
  }

  // Fallback if not enough insights
  if (bullets.length === 0) {
    const totalW = (opp.record.white?.w ?? 0) + (opp.record.black?.w ?? 0);
    const totalGames = totalW + (opp.record.white?.d ?? 0) + (opp.record.black?.d ?? 0) + (opp.record.white?.l ?? 0) + (opp.record.black?.l ?? 0);
    bullets.push(`**Overview:** ${opp.username} has ${totalGames} games analyzed with ${report.dataQuality.parsed} usable for insights.`);
  }

  return bullets.slice(0, 4);
}

export function ScoutAISummary({ report, isDark, t }: Props) {
  const [bullets, setBullets] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [isAI, setIsAI] = useState(true);
  const fetchedFor = useRef<string | null>(null);

  const fetchSummary = async () => {
    setLoading(true);
    setError(null);
    try {
      const prompt = buildSummaryPrompt(report);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000); // 12s timeout
      const res = await authFetch("/api/prep/coach-insight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ promptJson: JSON.stringify(prompt) }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!res.ok) throw new Error("Failed to generate summary");
      const data = await res.json() as { insight?: string; error?: string };
      if (data.error) throw new Error(data.error);
      const parsed = parseBullets(data.insight ?? "");
      if (parsed.length === 0) throw new Error("No insights returned");
      setBullets(parsed);
      setIsAI(true);
    } catch {
      // Fallback to deterministic summary
      const fallback = buildDeterministicSummary(report);
      setBullets(fallback);
      setIsAI(false);
      setError(null); // Don't show error — we have a fallback
    } finally {
      setLoading(false);
    }
  };

  // Auto-fetch once per report (keyed by username)
  useEffect(() => {
    const key = report.opponent.username;
    if (fetchedFor.current === key) return;
    fetchedFor.current = key;
    fetchSummary();
  }, [report.opponent.username]); // eslint-disable-line react-hooks/exhaustive-deps

  const accentColor = isDark ? "#7cf562" : "#12372A";
  const cardBg = isDark
    ? "bg-[#0d1a0f]/90 border border-[#1e3a22]/70"
    : "bg-[#f0f7ec] border border-[#ADBC9F]/60";
  const pillBg = isDark
    ? "bg-[#7cf562]/10 text-[#7cf562] border border-[#7cf562]/20"
    : "bg-[#12372A]/08 text-[#12372A] border border-[#12372A]/15";

  return (
    <div className={`rounded-2xl p-4 sm:p-5 ${cardBg}`}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-4 h-4 shrink-0" style={{ color: accentColor }} />
        <h3 className={`font-bold text-sm flex-1 ${t.textPrimary}`}>AI Scouting Summary</h3>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${pillBg}`}>
          {isAI ? "AI" : "Auto"}
        </span>
        {!loading && bullets.length > 0 && (
          <button
            onClick={() => fetchSummary()}
            className={`p-1 rounded-lg transition-colors ${isDark ? "hover:bg-white/06 text-white/30 hover:text-white/60" : "hover:bg-[#ADBC9F]/30 text-[#436850]/50 hover:text-[#436850]"}`}
            title="Regenerate summary"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        )}
        {bullets.length > 0 && (
          <button
            onClick={() => setCollapsed(c => !c)}
            className={`p-1 rounded-lg transition-colors ${isDark ? "hover:bg-white/06 text-white/30 hover:text-white/60" : "hover:bg-[#ADBC9F]/30 text-[#436850]/50 hover:text-[#436850]"}`}
          >
            {collapsed
              ? <ChevronDown className="w-3.5 h-3.5" />
              : <ChevronUp className="w-3.5 h-3.5" />
            }
          </button>
        )}
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-2.5">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="flex items-start gap-2.5">
              <div className={`mt-1 shrink-0 w-1.5 h-1.5 rounded-full ${isDark ? "bg-[#7cf562]/30" : "bg-[#436850]/20"}`} />
              <div
                className={`h-3.5 rounded-full animate-pulse ${isDark ? "bg-white/08" : "bg-[#ADBC9F]/40"}`}
                style={{ width: `${60 + i * 8}%` }}
              />
            </div>
          ))}
          <p className={`text-[10px] mt-1 ${t.textTertiary}`}>Generating scouting summary…</p>
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <div className="flex items-center gap-2">
          <p className={`text-xs ${t.textTertiary}`}>{error}</p>
          <button
            onClick={() => fetchSummary()}
            className={`text-xs font-semibold underline ${isDark ? "text-[#7cf562]/70 hover:text-[#7cf562]" : "text-[#436850] hover:text-[#12372A]"}`}
          >
            Retry
          </button>
        </div>
      )}

      {/* Bullets */}
      {!loading && !error && bullets.length > 0 && !collapsed && (
        <ul className="space-y-2">
          {bullets.map((bullet, i) => {
            // Render **bold** keyword inline
            const boldMatch = bullet.match(/^\*\*(.+?)\*\*:?\s*(.*)/);
            return (
              <li key={i} className="flex items-start gap-2.5">
                <span
                  className="mt-1.5 shrink-0 w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: accentColor, opacity: 0.7 }}
                />
                <span className={`text-xs leading-relaxed ${t.textSecondary}`}>
                  {boldMatch ? (
                    <>
                      <span className="font-bold" style={{ color: accentColor }}>
                        {boldMatch[1]}:{" "}
                      </span>
                      {boldMatch[2]}
                    </>
                  ) : bullet}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
