import { useEffect, useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import { authFetch } from "@/lib/apiFetch";
import type { Insight } from "../../../../shared/prepTypes";
import {
  buildOpeningWeaknessFallback,
  buildOpeningWeaknessPrompt,
  normalizeOpeningWeaknessSummary,
} from "@/lib/openingWeaknessSummary";

type Tokens = {
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  [key: string]: string;
};

interface Props {
  opponentUsername: string;
  opponentColor: "white" | "black";
  weaknesses: Insight[];
  isDark: boolean;
  t: Tokens;
}

export function OpeningForecastWeaknessSummary({
  opponentUsername,
  opponentColor,
  weaknesses,
  isDark,
  t,
}: Props) {
  const input = useMemo(() => ({ opponentUsername, opponentColor, weaknesses }), [opponentUsername, opponentColor, weaknesses]);
  const prompt = useMemo(() => buildOpeningWeaknessPrompt(input), [input]);
  const fallback = useMemo(() => buildOpeningWeaknessFallback(input), [input]);
  const evidenceKey = useMemo(
    () => `${opponentUsername}:${opponentColor}:${weaknesses.map((insight) => `${insight.id}:${insight.sampleSize}`).join("|")}`,
    [opponentUsername, opponentColor, weaknesses],
  );
  const [summary, setSummary] = useState(fallback);
  const [loading, setLoading] = useState(Boolean(prompt));
  const [isAiGenerated, setIsAiGenerated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setSummary(fallback);
    setIsAiGenerated(false);
    if (!prompt) {
      setLoading(false);
      return () => { cancelled = true; };
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 10_000);
    setLoading(true);
    void authFetch("/api/prep/coach-insight", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ promptJson: JSON.stringify(prompt) }),
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Opening summary request failed");
        return response.json() as Promise<{ insight?: string }>;
      })
      .then((data) => {
        const generated = normalizeOpeningWeaknessSummary(data.insight ?? "");
        if (!cancelled && generated) {
          setSummary(generated);
          setIsAiGenerated(true);
        }
      })
      .catch(() => undefined)
      .finally(() => {
        window.clearTimeout(timeout);
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [evidenceKey, fallback, prompt]);

  return (
    <aside
      aria-live="polite"
      className={`mb-4 rounded-xl border px-3.5 py-3 ${isDark ? "border-[#5B9A6A]/25 bg-[#0d1a0f]/70" : "border-[#436850]/15 bg-[#f4f8f1]"}`}
    >
      <div className="flex items-center gap-2">
        <Sparkles className={`h-3.5 w-3.5 shrink-0 ${isDark ? "text-[#8dcc9b]" : "text-[#436850]"}`} />
        <h4 className={`text-[11px] font-bold uppercase tracking-[0.12em] ${t.textPrimary}`}>AI weakness read</h4>
        {isAiGenerated && <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${isDark ? "bg-[#5B9A6A]/15 text-[#8dcc9b]" : "bg-[#436850]/10 text-[#436850]"}`}>AI</span>}
      </div>
      {loading ? (
        <div className={`mt-2 h-3.5 w-11/12 animate-pulse rounded ${isDark ? "bg-white/10" : "bg-[#ADBC9F]/35"}`} />
      ) : (
        <p className={`mt-2 text-xs leading-relaxed ${t.textSecondary}`}>{summary}</p>
      )}
      <p className={`mt-1.5 text-[10px] ${t.textTertiary}`}>Grounded in the verified forecast evidence shown below.</p>
    </aside>
  );
}
