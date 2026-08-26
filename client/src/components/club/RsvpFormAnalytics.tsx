/**
 * RsvpFormAnalytics — shown in ClubDashboard Events tab for owners
 *
 * Fetches the RSVP form for a given event and displays:
 * - Response count + shareable link
 * - Per-question response breakdown (bar charts for radio/checkbox/select,
 *   list preview for text/textarea)
 */
import { useState, useEffect, useCallback } from "react";
import {
  ClipboardList,
  Users,
  Link2,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  ExternalLink,
  RefreshCw,
  BarChart2,
} from "lucide-react";
import { authFetch } from "@/lib/apiFetch";
import type { FormQuestion, RsvpFormData } from "./RsvpFormBuilder";

interface FormResponse {
  id: string;
  respondentName: string;
  respondentEmail: string | null;
  submittedAt: string;
  answers: Array<{ questionId: string; questionLabel: string; answer: string | string[] }>;
}

interface Props {
  clubId: string;
  eventId: string;
  accentColor?: string;
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).catch(() => {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
  });
}

export default function RsvpFormAnalytics({ clubId, eventId, accentColor = "#4CAF50" }: Props) {
  const [form, setForm] = useState<RsvpFormData | null>(null);
  const [responses, setResponses] = useState<FormResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const res = await authFetch(`/api/clubs/${clubId}/events/${eventId}/rsvp-form`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json() as { form: RsvpFormData; responses?: FormResponse[] };
        setForm(data.form);
        setResponses(data.responses ?? []);
      } else {
        setForm(null);
      }
    } catch {
      setForm(null);
    }
    if (!silent) setLoading(false);
    else setRefreshing(false);
  }, [clubId, eventId]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-4 py-3 text-white/30 text-xs">
        <div className="w-3 h-3 rounded-full border border-white/20 border-t-white/60 animate-spin" />
        Loading RSVP form…
      </div>
    );
  }

  if (!form) return null; // No form created yet — RsvpFormBuilder handles the create flow

  const questions = form.questions as FormQuestion[];
  const shareUrl = `${window.location.origin}/rsvp/${form.slug}`;

  function handleCopy() {
    copyToClipboard(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // Build per-question analytics
  function getQuestionStats(q: FormQuestion) {
    const answers = responses.map((r) => {
      const a = r.answers.find((a) => a.questionId === q.id);
      return a?.answer ?? "";
    });

    if (q.type === "radio" || q.type === "select") {
      const counts: Record<string, number> = {};
      for (const opt of (q.options ?? [])) counts[opt] = 0;
      for (const ans of answers) {
        if (typeof ans === "string" && ans) counts[ans] = (counts[ans] ?? 0) + 1;
      }
      const total = Object.values(counts).reduce((s, v) => s + v, 0);
      return { type: "bar" as const, counts, total };
    }

    if (q.type === "checkbox") {
      const counts: Record<string, number> = {};
      for (const opt of (q.options ?? [])) counts[opt] = 0;
      for (const ans of answers) {
        const arr = Array.isArray(ans) ? ans : (typeof ans === "string" && ans ? [ans] : []);
        for (const v of arr) counts[v] = (counts[v] ?? 0) + 1;
      }
      const total = responses.length;
      return { type: "bar" as const, counts, total };
    }

    // text / textarea / number
    const texts = answers
      .filter((a) => typeof a === "string" && a.trim())
      .map((a) => a as string);
    return { type: "text" as const, texts };
  }

  return (
    <div
      className="rounded-2xl overflow-hidden transition-all duration-300"
      style={{ background: "oklch(0.14 0.05 145)", border: "1px solid rgba(255,255,255,0.09)" }}
      >
        {/* Header */}
      <div
        className="flex items-center justify-between gap-2 px-5 py-4"
        style={{ borderBottom: expanded ? "1px solid rgba(255,255,255,0.07)" : "none" }}
      >
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls="rsvp-form-analytics-content"
          onClick={() => setExpanded((v) => !v)}
          className="flex flex-1 min-w-0 items-center gap-3 text-left rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4CAF50]/70"
        >
          <span
            className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: `${accentColor}22` }}
          >
            <ClipboardList className="w-4 h-4" style={{ color: accentColor }} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-white text-sm font-bold">{form.title}</span>
            <span className="mt-0.5 flex items-center gap-2 text-white/40 text-xs">
              <Users className="w-3 h-3" />
              {responses.length} response{responses.length !== 1 ? "s" : ""}
            </span>
          </span>
          {expanded ? (
            <ChevronUp className="w-4 h-4 flex-shrink-0 text-white/30" />
          ) : (
            <ChevronDown className="w-4 h-4 flex-shrink-0 text-white/30" />
          )}
        </button>
        <button
          type="button"
          onClick={() => { void load(true); }}
          className="p-1.5 rounded-lg text-white/30 hover:text-white/70 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4CAF50]/70"
          aria-label="Refresh RSVP analytics"
          title="Refresh"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
        </button>
      </div>

      {expanded && (
        <div id="rsvp-form-analytics-content" className="px-5 py-4 space-y-5">
          {/* Share link */}
          <div>
            <p className="text-white/50 text-xs font-semibold uppercase tracking-wider mb-2">Shareable Link</p>
            <div
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
              style={{ background: "oklch(0.18 0.05 145)", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              <Link2 className="w-3.5 h-3.5 text-white/40 flex-shrink-0" />
              <span className="flex-1 text-xs text-white/60 truncate">{shareUrl}</span>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all duration-200 flex-shrink-0"
                style={copied
                  ? { background: `${accentColor}33`, color: accentColor }
                  : { background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.6)" }
                }
              >
                {copied ? <CheckCircle className="w-3 h-3" /> : <Link2 className="w-3 h-3" />}
                {copied ? "Copied!" : "Copy"}
              </button>
              <a
                href={shareUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1 rounded-lg text-white/30 hover:text-white/70 transition-colors"
                onClick={(e) => e.stopPropagation()}
                title="Open form"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>

          {/* No responses yet */}
          {responses.length === 0 && (
            <div className="py-8 text-center">
              <BarChart2 className="w-8 h-8 text-white/15 mx-auto mb-2" />
              <p className="text-white/30 text-sm">No responses yet</p>
              <p className="text-white/20 text-xs mt-1">Share the link above to start collecting RSVPs</p>
            </div>
          )}

          {/* Per-question breakdown */}
          {responses.length > 0 && questions.map((q, idx) => {
            const stats = getQuestionStats(q);
            return (
              <div key={q.id} className="space-y-2">
                <p className="text-white/70 text-sm font-semibold">
                  {idx + 1}. {q.label || `Question ${idx + 1}`}
                </p>

                {stats.type === "bar" && (
                  <div className="space-y-1.5">
                    {Object.entries(stats.counts).map(([opt, count]) => {
                      const pct = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0;
                      return (
                        <div key={opt} className="space-y-0.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-white/60 truncate max-w-[70%]">{opt}</span>
                            <span className="text-white/40 flex-shrink-0 ml-2">{count} · {pct}%</span>
                          </div>
                          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.07)" }}>
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{ width: `${pct}%`, background: accentColor }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {stats.type === "text" && (
                  <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                    {stats.texts.length === 0 ? (
                      <p className="text-white/25 text-xs italic">No answers yet</p>
                    ) : stats.texts.slice(0, 8).map((t, i) => (
                      <div
                        key={i}
                        className="px-3 py-2 rounded-xl text-xs text-white/60"
                        style={{ background: "oklch(0.18 0.05 145)", border: "1px solid rgba(255,255,255,0.06)" }}
                      >
                        {t}
                      </div>
                    ))}
                    {stats.texts.length > 8 && (
                      <p className="text-white/30 text-xs pl-1">+{stats.texts.length - 8} more responses</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Individual responses */}
          {responses.length > 0 && (
            <details className="group">
              <summary className="cursor-pointer text-xs text-white/40 hover:text-white/70 transition-colors flex items-center gap-1.5 select-none">
                <Users className="w-3.5 h-3.5" />
                View all {responses.length} individual responses
              </summary>
              <div className="mt-3 space-y-2 max-h-64 overflow-y-auto pr-1">
                {responses.map((r) => (
                  <div
                    key={r.id}
                    className="px-4 py-3 rounded-xl"
                    style={{ background: "oklch(0.18 0.05 145)", border: "1px solid rgba(255,255,255,0.06)" }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-white text-sm font-semibold">{r.respondentName}</span>
                      <span className="text-white/30 text-xs">
                        {new Date(r.submittedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </span>
                    </div>
                    {r.answers.map((a) => (
                      <div key={a.questionId} className="text-xs text-white/50 mb-1">
                        <span className="text-white/30">{a.questionLabel}: </span>
                        {Array.isArray(a.answer) ? a.answer.join(", ") : a.answer}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
