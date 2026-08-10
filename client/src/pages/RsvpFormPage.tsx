/**
 * RsvpFormPage — /rsvp/:slug
 *
 * Public shareable RSVP form page. No auth required.
 * Attendees fill out the form and submit their response.
 */
import { useState, useEffect, useRef } from "react";
import { useParams } from "wouter";
import {
  Calendar,
  MapPin,
  CheckCircle,
  ChevronRight,
  AlertCircle,
  Clock,
} from "lucide-react";
import { Sparkles } from "lucide-react";

// ── Confetti particle ─────────────────────────────────────────────────────────
interface Particle { id: number; x: number; y: number; vx: number; vy: number; color: string; size: number; rotation: number; opacity: number; }

function RsvpSuccessScreen({ event, club, accent, confirmationMessage }: {
  event: EventInfo | null;
  club: ClubInfo | null;
  accent: string;
  confirmationMessage?: string | null;
}) {
  const [particles, setParticles] = useState<Particle[]>([]);
  const [showContent, setShowContent] = useState(false);
  const [checkAnimated, setCheckAnimated] = useState(false);
  const rafRef = useRef<number>(0);

  // Build Google Calendar URL
  const calendarUrl = event ? (() => {
    const start = new Date(event.startAt).toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    const end = new Date(new Date(event.startAt).getTime() + 2 * 3600000).toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(event.title)}&dates=${start}/${end}&location=${encodeURIComponent(event.venue ?? "")}`;
  })() : null;

  useEffect(() => {
    // Stagger: checkmark first, then content, then confetti
    const t1 = setTimeout(() => setCheckAnimated(true), 100);
    const t2 = setTimeout(() => setShowContent(true), 500);
    const t3 = setTimeout(() => {
      const colors = [accent, "#4ade80", "#facc15", "#f472b6", "#60a5fa", "#fb923c"];
      const newParticles: Particle[] = Array.from({ length: 60 }, (_, i) => ({
        id: i,
        x: 50 + (Math.random() - 0.5) * 20,
        y: 30,
        vx: (Math.random() - 0.5) * 8,
        vy: -(Math.random() * 6 + 2),
        color: colors[Math.floor(Math.random() * colors.length)],
        size: Math.random() * 8 + 4,
        rotation: Math.random() * 360,
        opacity: 1,
      }));
      setParticles(newParticles);
    }, 400);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [accent]);

  // Animate particles
  useEffect(() => {
    if (particles.length === 0) return;
    let frame = 0;
    function animate() {
      frame++;
      setParticles(prev => prev
        .map(p => ({
          ...p,
          x: p.x + p.vx * 0.6,
          y: p.y + p.vy * 0.6 + frame * 0.08,
          vy: p.vy + 0.15,
          rotation: p.rotation + p.vx * 3,
          opacity: Math.max(0, p.opacity - 0.012),
        }))
        .filter(p => p.opacity > 0)
      );
      if (frame < 120) rafRef.current = requestAnimationFrame(animate);
    }
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [particles.length > 0]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden" style={{ background: "oklch(0.10 0.04 145)" }}>
      {/* Micro-grid */}
      <div className="fixed inset-0 pointer-events-none" style={{
        backgroundImage: "linear-gradient(rgba(255,255,255,0.018) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.018) 1px, transparent 1px)",
        backgroundSize: "24px 24px",
      }} />

      {/* Confetti canvas */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        {particles.map(p => (
          <div key={p.id} style={{
            position: "absolute",
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size * 0.6,
            background: p.color,
            borderRadius: 2,
            opacity: p.opacity,
            transform: `rotate(${p.rotation}deg)`,
            willChange: "transform, opacity",
          }} />
        ))}
      </div>

      <div className="relative z-10 text-center max-w-sm w-full">
        {/* Club avatar */}
        {club?.avatarUrl && (
          <img src={club.avatarUrl} alt={club.name} className="w-12 h-12 rounded-xl object-cover mx-auto mb-4 opacity-60" />
        )}

        {/* Animated checkmark ring */}
        <div className="relative mx-auto mb-6" style={{ width: 88, height: 88 }}>
          {/* Pulse ring */}
          <div style={{
            position: "absolute", inset: -8,
            borderRadius: "50%",
            border: `2px solid ${accent}`,
            opacity: checkAnimated ? 0 : 0.6,
            transform: checkAnimated ? "scale(1.6)" : "scale(1)",
            transition: "transform 800ms cubic-bezier(0.4,0,0.2,1), opacity 800ms ease",
          }} />
          {/* Main circle */}
          <div style={{
            width: 88, height: 88, borderRadius: "50%",
            background: `${accent}18`,
            border: `2.5px solid ${accent}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            transform: checkAnimated ? "scale(1)" : "scale(0.5)",
            opacity: checkAnimated ? 1 : 0,
            transition: "transform 500ms cubic-bezier(0.34,1.56,0.64,1), opacity 400ms ease",
          }}>
            <CheckCircle style={{ width: 40, height: 40, color: accent }} />
          </div>
        </div>

        {/* Text content */}
        <div style={{
          opacity: showContent ? 1 : 0,
          transform: showContent ? "translateY(0)" : "translateY(12px)",
          transition: "opacity 500ms ease, transform 500ms ease",
        }}>
          <div className="flex items-center justify-center gap-2 mb-2">
            <Sparkles className="w-4 h-4" style={{ color: accent }} />
            <h1 className="text-white font-black text-2xl" style={{ fontFamily: "'Clash Display', sans-serif" }}>
              You&apos;re in!
            </h1>
            <Sparkles className="w-4 h-4" style={{ color: accent }} />
          </div>

          <p className="text-white/70 text-sm mb-1">
            {confirmationMessage || (event ? `See you at ${event.title}` : "Your response has been recorded.")}
          </p>

          {event && (
            <div className="mt-3 rounded-2xl px-4 py-3 mb-5" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <p className="text-white font-semibold text-sm mb-1">{event.title}</p>
              <p className="text-white/50 text-xs">{formatDate(event.startAt)} · {formatTime(event.startAt)}</p>
              {event.venue && <p className="text-white/40 text-xs mt-0.5">{event.venue}</p>}
            </div>
          )}

          {/* Add to Calendar */}
          {calendarUrl && (
            <a
              href={calendarUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-semibold transition-all hover:scale-[1.02] active:scale-[0.98] mb-4"
              style={{ background: accent, color: "#0a1a0f" }}
            >
              <Calendar className="w-4 h-4" />
              Add to Google Calendar
            </a>
          )}

          <div className="text-white/20 text-xs mt-2">Powered by ChessOTB.club</div>
        </div>
      </div>
    </div>
  );
}
import type { FormQuestion, RsvpFormData } from "@/components/club/RsvpFormBuilder";

interface EventInfo {
  id: string;
  title: string;
  startAt: string;
  venue?: string | null;
  address?: string | null;
  accentColor?: string | null;
  coverImageUrl?: string | null;
}

interface ClubInfo {
  name: string;
  avatarUrl?: string | null;
}

type AnswerValue = string | string[];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });
}
function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

export default function RsvpFormPage() {
  const { slug } = useParams<{ slug: string }>();

  const [form, setForm] = useState<RsvpFormData | null>(null);
  const [event, setEvent] = useState<EventInfo | null>(null);
  const [club, setClub] = useState<ClubInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/clubs/rsvp-public/${slug}`);
        if (!res.ok) {
          const data = await res.json() as { error?: string };
          setError(data.error ?? "Form not found");
        } else {
          const data = await res.json() as { form: RsvpFormData; event: EventInfo | null; club: ClubInfo | null };
          setForm(data.form);
          setEvent(data.event);
          setClub(data.club);
          // Init answers
          const init: Record<string, AnswerValue> = {};
          for (const q of (data.form.questions as FormQuestion[])) {
            init[q.id] = q.type === "checkbox" ? [] : "";
          }
          setAnswers(init);
        }
      } catch {
        setError("Failed to load form. Please try again.");
      }
      setLoading(false);
    }
    if (slug) load();
  }, [slug]);

  function setAnswer(qId: string, value: AnswerValue) {
    setAnswers((prev) => ({ ...prev, [qId]: value }));
  }

  function toggleCheckbox(qId: string, option: string) {
    setAnswers((prev) => {
      const current = (prev[qId] as string[]) ?? [];
      return {
        ...prev,
        [qId]: current.includes(option)
          ? current.filter((v) => v !== option)
          : [...current, option],
      };
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;

    // Validate required questions
    const questions = form.questions as FormQuestion[];
    for (const q of questions) {
      if (!q.required) continue;
      const ans = answers[q.id];
      if (!ans || (Array.isArray(ans) && ans.length === 0) || ans === "") {
        setSubmitError(`"${q.label || "A required question"}" must be answered.`);
        return;
      }
    }

    setSubmitting(true);
    setSubmitError(null);
    try {
      const payload = {
        respondentName: name || "Anonymous",
        respondentEmail: email || null,
        answers: questions.map((q) => ({
          questionId: q.id,
          questionLabel: q.label,
          answer: answers[q.id] ?? "",
        })),
      };
      const res = await fetch(`/api/clubs/rsvp-public/${slug}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setSubmitted(true);
      } else {
        const data = await res.json() as { error?: string };
        setSubmitError(data.error ?? "Failed to submit. Please try again.");
      }
    } catch {
      setSubmitError("Network error. Please try again.");
    }
    setSubmitting(false);
  }

  const accent = event?.accentColor ?? "#4CAF50";

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "oklch(0.10 0.04 145)" }}>
        <div className="w-8 h-8 rounded-full border-2 border-white/20 border-t-white/80 animate-spin" />
      </div>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────
  if (error || !form) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "oklch(0.10 0.04 145)" }}>
        <div className="text-center max-w-sm">
          <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
          <h1 className="text-white font-bold text-lg mb-2">Form Unavailable</h1>
          <p className="text-white/50 text-sm">{error ?? "This form could not be found."}</p>
        </div>
      </div>
    );
  }

  // ── Success ──────────────────────────────────────────────────────────────
  if (submitted) {
    return <RsvpSuccessScreen event={event} club={club} accent={accent} confirmationMessage={form?.confirmationMessage ?? null} />;
  }

  const questions = form.questions as FormQuestion[];

  // ── Form ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen" style={{ background: "oklch(0.10 0.04 145)" }}>
      {/* Micro-grid background */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          backgroundImage: "linear-gradient(rgba(255,255,255,0.018) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.018) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />

      <div className="relative z-10 max-w-lg mx-auto px-4 py-10">

        {/* Club + event header */}
        {(club || event) && (
          <div className="mb-6 text-center">
            {club?.avatarUrl && (
              <img
                src={club.avatarUrl}
                alt={club.name}
                className="w-14 h-14 rounded-2xl object-cover mx-auto mb-3 shadow-lg"
              />
            )}
            {club && (
              <p className="text-white/50 text-xs font-semibold uppercase tracking-widest mb-1">{club.name}</p>
            )}
            {event && (
              <h1
                className="text-white font-black text-2xl mb-2"
                style={{ fontFamily: "'Clash Display', sans-serif" }}
              >
                {event.title}
              </h1>
            )}
            {event && (
              <div className="flex items-center justify-center gap-3 text-white/50 text-xs flex-wrap">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  {formatDate(event.startAt)}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {formatTime(event.startAt)}
                </span>
                {event.venue && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" />
                    {event.venue}
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Form card */}
        <div
          className="rounded-3xl overflow-hidden"
          style={{ background: "oklch(0.14 0.05 145)", border: "1px solid rgba(255,255,255,0.09)" }}
        >
          {/* Form header */}
          <div
            className="px-6 py-5"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.07)", background: `linear-gradient(135deg, ${accent}18 0%, transparent 60%)` }}
          >
            <h2 className="text-white font-bold text-lg">{form.title}</h2>
            {form.description && (
              <p className="text-white/55 text-sm mt-1">{form.description}</p>
            )}
          </div>

          <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
            {/* Name + email */}
            <div className="space-y-3">
              <div>
                <label className="block text-white/70 text-xs font-semibold mb-1.5 uppercase tracking-wider">
                  Your Name <span className="text-red-400">*</span>
                </label>
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Magnus Carlsen"
                  className="w-full px-4 py-2.5 rounded-xl text-sm text-white placeholder-white/30 outline-none transition-all duration-200"
                  style={{ background: "oklch(0.18 0.05 145)", border: "1px solid rgba(255,255,255,0.10)" }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = accent; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.10)"; }}
                />
              </div>
              <div>
                <label className="block text-white/70 text-xs font-semibold mb-1.5 uppercase tracking-wider">
                  Email <span className="text-white/30 font-normal normal-case">(optional)</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full px-4 py-2.5 rounded-xl text-sm text-white placeholder-white/30 outline-none transition-all duration-200"
                  style={{ background: "oklch(0.18 0.05 145)", border: "1px solid rgba(255,255,255,0.10)" }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = accent; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.10)"; }}
                />
              </div>
            </div>

            {/* Divider */}
            {questions.length > 0 && (
              <div className="h-px" style={{ background: "rgba(255,255,255,0.07)" }} />
            )}

            {/* Dynamic questions */}
            {questions.map((q, idx) => (
              <div key={q.id} className="space-y-2">
                <label className="block text-white/80 text-sm font-semibold">
                  {idx + 1}. {q.label || `Question ${idx + 1}`}
                  {q.required && <span className="text-red-400 ml-1">*</span>}
                </label>

                {q.type === "text" && (
                  <input
                    value={(answers[q.id] as string) ?? ""}
                    onChange={(e) => setAnswer(q.id, e.target.value)}
                    placeholder={q.placeholder ?? "Your answer"}
                    className="w-full px-4 py-2.5 rounded-xl text-sm text-white placeholder-white/30 outline-none transition-all duration-200"
                    style={{ background: "oklch(0.18 0.05 145)", border: "1px solid rgba(255,255,255,0.08)" }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = accent; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; }}
                  />
                )}

                {q.type === "textarea" && (
                  <textarea
                    value={(answers[q.id] as string) ?? ""}
                    onChange={(e) => setAnswer(q.id, e.target.value)}
                    placeholder={q.placeholder ?? "Your answer"}
                    rows={3}
                    className="w-full px-4 py-2.5 rounded-xl text-sm text-white placeholder-white/30 outline-none resize-none transition-all duration-200"
                    style={{ background: "oklch(0.18 0.05 145)", border: "1px solid rgba(255,255,255,0.08)" }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = accent; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; }}
                  />
                )}

                {q.type === "number" && (
                  <input
                    type="number"
                    value={(answers[q.id] as string) ?? ""}
                    onChange={(e) => setAnswer(q.id, e.target.value)}
                    placeholder="0"
                    className="w-full px-4 py-2.5 rounded-xl text-sm text-white placeholder-white/30 outline-none transition-all duration-200"
                    style={{ background: "oklch(0.18 0.05 145)", border: "1px solid rgba(255,255,255,0.08)" }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = accent; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; }}
                  />
                )}

                {q.type === "radio" && (
                  <div className="space-y-2">
                    {(q.options ?? []).map((opt) => {
                      const isSelected = answers[q.id] === opt;
                      return (
                        <button
                          type="button"
                          key={opt}
                          onClick={() => setAnswer(q.id, opt)}
                          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm text-left transition-all duration-200"
                          style={{
                            background: isSelected ? `${accent}22` : "oklch(0.18 0.05 145)",
                            border: isSelected ? `1px solid ${accent}` : "1px solid rgba(255,255,255,0.08)",
                            color: isSelected ? "#fff" : "rgba(255,255,255,0.65)",
                          }}
                        >
                          <span
                            className="w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center"
                            style={{ border: `2px solid ${isSelected ? accent : "rgba(255,255,255,0.25)"}` }}
                          >
                            {isSelected && <span className="w-2 h-2 rounded-full" style={{ background: accent }} />}
                          </span>
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                )}

                {q.type === "checkbox" && (
                  <div className="space-y-2">
                    {(q.options ?? []).map((opt) => {
                      const checked = ((answers[q.id] as string[]) ?? []).includes(opt);
                      return (
                        <button
                          type="button"
                          key={opt}
                          onClick={() => toggleCheckbox(q.id, opt)}
                          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm text-left transition-all duration-200"
                          style={{
                            background: checked ? `${accent}22` : "oklch(0.18 0.05 145)",
                            border: checked ? `1px solid ${accent}` : "1px solid rgba(255,255,255,0.08)",
                            color: checked ? "#fff" : "rgba(255,255,255,0.65)",
                          }}
                        >
                          <span
                            className="w-4 h-4 rounded-md flex-shrink-0 flex items-center justify-center"
                            style={{
                              background: checked ? accent : "transparent",
                              border: `2px solid ${checked ? accent : "rgba(255,255,255,0.25)"}`,
                            }}
                          >
                            {checked && <CheckCircle className="w-3 h-3 text-white" />}
                          </span>
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                )}

                {q.type === "select" && (
                  <select
                    value={(answers[q.id] as string) ?? ""}
                    onChange={(e) => setAnswer(q.id, e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl text-sm text-white outline-none cursor-pointer"
                    style={{ background: "oklch(0.18 0.05 145)", border: "1px solid rgba(255,255,255,0.08)" }}
                  >
                    <option value="">Select an option…</option>
                    {(q.options ?? []).map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                )}
              </div>
            ))}

            {/* Submit error */}
            {submitError && (
              <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm text-red-300" style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.25)" }}>
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {submitError}
              </div>
            )}

            {/* Submit button */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-bold transition-all duration-200 hover:brightness-110 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
              style={{ background: accent, color: "#ffffff" }}
            >
              {submitting ? (
                <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              ) : (
                <>
                  Submit RSVP
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <div className="text-center mt-6 text-white/25 text-xs">
          Powered by{" "}
          <a href="/" className="hover:text-white/50 transition-colors duration-200">ChessOTB.club</a>
        </div>
      </div>
    </div>
  );
}
