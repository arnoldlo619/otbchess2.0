/**
 * RsvpFormBuilderPage — /clubs/:clubId/meetup/:eventId/rsvp-form/builder
 *
 * Full-page Google Forms-style RSVP form builder for club owners.
 * Layout:
 *   • Fixed top header: form title, auto-save indicator, tab nav, Publish button
 *   • Questions tab: centered scrollable form card + floating right toolbar
 *   • Responses tab: response analytics (reuses RsvpFormAnalytics)
 *   • Settings tab: close date, email collection, confirmation message
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useLocation } from "wouter";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Plus,
  Trash2,
  GripVertical,
  Eye,
  EyeOff,
  Link2,
  CheckCircle,
  ChevronLeft,
  AlignLeft,
  AlignJustify,
  Circle,
  CheckSquare,
  ChevronDown,
  Hash,
  BarChart2,
  Settings2,
  ClipboardList,
  Copy,
  ExternalLink,
  Save,
  Loader2,
  AlertCircle,
  Type,
  ToggleLeft,
} from "lucide-react";
import { authFetch } from "@/lib/apiFetch";
import { useAuthContext } from "@/context/AuthContext";
import { toast } from "sonner";

// ── Types ─────────────────────────────────────────────────────────────────────
export type QuestionType = "text" | "textarea" | "radio" | "checkbox" | "select" | "number";

export interface FormQuestion {
  id: string;
  type: QuestionType;
  label: string;
  required: boolean;
  options?: string[];
  placeholder?: string;
}

interface RsvpFormData {
  id: string;
  eventId: string;
  clubId: string;
  title: string;
  description?: string | null;
  questions: FormQuestion[];
  slug: string;
  isPublished: number;
  closesAt?: string | null;
  confirmationMessage?: string | null;
  collectEmail?: number;
  maxResponses?: number | null;
  allowMultipleSubmissions?: number;
  createdAt: string;
  updatedAt: string;
}

interface FormResponse {
  id: string;
  respondentName: string;
  respondentEmail: string | null;
  submittedAt: string;
  answers: Array<{ questionId: string; questionLabel: string; answer: string | string[] }>;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const QUESTION_TYPE_META: Record<QuestionType, { label: string; icon: React.ReactNode; description: string }> = {
  text:     { label: "Short Answer",    icon: <AlignLeft className="w-4 h-4" />,     description: "Single line text" },
  textarea: { label: "Paragraph",       icon: <AlignJustify className="w-4 h-4" />,  description: "Multi-line text" },
  radio:    { label: "Multiple Choice", icon: <Circle className="w-4 h-4" />,         description: "Pick one option" },
  checkbox: { label: "Checkboxes",      icon: <CheckSquare className="w-4 h-4" />,   description: "Pick multiple" },
  select:   { label: "Dropdown",        icon: <ChevronDown className="w-4 h-4" />,   description: "Dropdown list" },
  number:   { label: "Number",          icon: <Hash className="w-4 h-4" />,           description: "Numeric input" },
};

const ACCENT = "#4CAF50";

function nanoid(len = 10): string {
  return Math.random().toString(36).slice(2, 2 + len);
}

function makeQuestion(type: QuestionType = "radio"): FormQuestion {
  return {
    id: nanoid(),
    type,
    label: "",
    required: false,
    options: ["radio", "checkbox", "select"].includes(type) ? ["Option 1"] : undefined,
  };
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function RsvpFormBuilderPage() {
  const { clubId, eventId } = useParams<{ clubId: string; eventId: string }>();
  const [, navigate] = useLocation();
  const { user } = useAuthContext();

  const [tab, setTab] = useState<"questions" | "responses" | "settings">("questions");
  const [form, setForm] = useState<RsvpFormData | null>(null);
  const [responses, setResponses] = useState<FormResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"saved" | "unsaved" | "saving" | "error">("saved");
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── DnD sensors ───────────────────────────────────────────────────────────
  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // ── Load form ──────────────────────────────────────────────────────────────
  const loadForm = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch(`/api/clubs/${clubId}/events/${eventId}/rsvp-form`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json() as { form: RsvpFormData; responses: FormResponse[] };
        setForm(data.form);
        setResponses(data.responses ?? []);
        if (data.form.questions.length > 0) {
          setActiveQuestionId(data.form.questions[0].id);
        }
      } else if (res.status === 404) {
        // Create a blank form
        const createRes = await authFetch(`/api/clubs/${clubId}/events/${eventId}/rsvp-form`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            title: "RSVP Form",
            description: "",
            questions: [makeQuestion("radio")],
          }),
        });
        if (createRes.ok) {
          const created = await createRes.json() as { form: RsvpFormData };
          setForm(created.form);
          setActiveQuestionId(created.form.questions[0]?.id ?? null);
        }
      }
    } catch {
      toast.error("Failed to load form");
    }
    setLoading(false);
  }, [clubId, eventId]);

  useEffect(() => { void loadForm(); }, [loadForm]);

  // ── Auto-save ──────────────────────────────────────────────────────────────
  const scheduleSave = useCallback((updatedForm: RsvpFormData) => {
    setSaveStatus("unsaved");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSaveStatus("saving");
      try {
        const res = await authFetch(`/api/clubs/${clubId}/events/${eventId}/rsvp-form`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            title: updatedForm.title,
            description: updatedForm.description,
            questions: updatedForm.questions,
            closesAt: updatedForm.closesAt,
            confirmationMessage: updatedForm.confirmationMessage,
            collectEmail: updatedForm.collectEmail,
          }),
        });
        if (res.ok) {
          setSaveStatus("saved");
        } else {
          setSaveStatus("error");
        }
      } catch {
        setSaveStatus("error");
      }
    }, 1200);
  }, [clubId, eventId]);

  function updateForm(patch: Partial<RsvpFormData>) {
    if (!form) return;
    const updated = { ...form, ...patch };
    setForm(updated);
    scheduleSave(updated);
  }

  // ── Question operations ────────────────────────────────────────────────────
  function reorderQuestions(activeId: string, overId: string) {
    if (!form || activeId === overId) return;
    const oldIdx = form.questions.findIndex((q) => q.id === activeId);
    const newIdx = form.questions.findIndex((q) => q.id === overId);
    if (oldIdx === -1 || newIdx === -1) return;
    const updated = { ...form, questions: arrayMove(form.questions, oldIdx, newIdx) };
    setForm(updated);
    scheduleSave(updated);
  }

  function addQuestion(type: QuestionType = "radio") {
    if (!form) return;
    const q = makeQuestion(type);
    const updated = { ...form, questions: [...form.questions, q] };
    setForm(updated);
    setActiveQuestionId(q.id);
    scheduleSave(updated);
  }

  function updateQuestion(id: string, patch: Partial<FormQuestion>) {
    if (!form) return;
    const updated = {
      ...form,
      questions: form.questions.map((q) => q.id === id ? { ...q, ...patch } : q),
    };
    setForm(updated);
    scheduleSave(updated);
  }

  function removeQuestion(id: string) {
    if (!form || form.questions.length <= 1) return;
    const idx = form.questions.findIndex((q) => q.id === id);
    const updated = { ...form, questions: form.questions.filter((q) => q.id !== id) };
    setForm(updated);
    setActiveQuestionId(updated.questions[Math.max(0, idx - 1)]?.id ?? null);
    scheduleSave(updated);
  }

  function duplicateQuestion(id: string) {
    if (!form) return;
    const q = form.questions.find((q) => q.id === id);
    if (!q) return;
    const copy = { ...q, id: nanoid() };
    const idx = form.questions.findIndex((q) => q.id === id);
    const qs = [...form.questions];
    qs.splice(idx + 1, 0, copy);
    const updated = { ...form, questions: qs };
    setForm(updated);
    setActiveQuestionId(copy.id);
    scheduleSave(updated);
  }

  function addOption(questionId: string) {
    const q = form?.questions.find((q) => q.id === questionId);
    if (!q) return;
    const opts = [...(q.options ?? []), `Option ${(q.options?.length ?? 0) + 1}`];
    updateQuestion(questionId, { options: opts });
  }

  function updateOption(questionId: string, idx: number, val: string) {
    const q = form?.questions.find((q) => q.id === questionId);
    if (!q) return;
    const opts = [...(q.options ?? [])];
    opts[idx] = val;
    updateQuestion(questionId, { options: opts });
  }

  function removeOption(questionId: string, idx: number) {
    const q = form?.questions.find((q) => q.id === questionId);
    if (!q || (q.options?.length ?? 0) <= 1) return;
    const opts = (q.options ?? []).filter((_, i) => i !== idx);
    updateQuestion(questionId, { options: opts });
  }

  // ── Publish toggle ─────────────────────────────────────────────────────────
  async function togglePublish() {
    if (!form) return;
    setSaving(true);
    try {
      const res = await authFetch(`/api/clubs/${clubId}/events/${eventId}/rsvp-form`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title: form.title,
          description: form.description,
          questions: form.questions,
          isPublished: form.isPublished ? 0 : 1,
        }),
      });
      if (res.ok) {
        const data = await res.json() as { form: RsvpFormData };
        setForm(data.form);
        toast.success(data.form.isPublished ? "Form published! Share the link." : "Form unpublished.");
      }
    } catch {
      toast.error("Failed to update publish status");
    }
    setSaving(false);
  }

  const shareUrl = form ? `${window.location.origin}/rsvp/${form.slug}` : "";

  function copyLink() {
    navigator.clipboard.writeText(shareUrl).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "oklch(0.11 0.04 145)" }}>
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: ACCENT }} />
          <p className="text-white/40 text-sm">Loading form builder…</p>
        </div>
      </div>
    );
  }

  if (!form) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "oklch(0.11 0.04 145)" }}>
        <div className="flex flex-col items-center gap-3">
          <AlertCircle className="w-8 h-8 text-red-400" />
          <p className="text-white/60 text-sm">Could not load form. Please go back and try again.</p>
          <button
            onClick={() => navigate(`/clubs/${clubId}/meetup/${eventId}`)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white/70 hover:text-white transition"
            style={{ background: "rgba(255,255,255,0.08)" }}
          >
            <ChevronLeft className="w-4 h-4" /> Back to Event
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "oklch(0.13 0.04 145)" }}>
      {/* ── TOP HEADER ─────────────────────────────────────────────────────── */}
      <header
        className="fixed top-0 left-0 right-0 z-50 flex items-center gap-4 px-5 h-14 border-b"
        style={{ background: "oklch(0.15 0.05 145)", borderColor: "rgba(255,255,255,0.08)" }}
      >
        {/* Back button */}
        <button
          onClick={() => navigate(`/clubs/${clubId}/meetup/${eventId}`)}
          className="flex items-center gap-1.5 text-white/50 hover:text-white transition-colors text-sm font-medium flex-shrink-0"
        >
          <ChevronLeft className="w-4 h-4" />
          <span className="hidden sm:inline">Back</span>
        </button>

        {/* Form title (editable) */}
        <div className="flex-1 min-w-0 flex items-center gap-3">
          <ClipboardList className="w-5 h-5 flex-shrink-0" style={{ color: ACCENT }} />
          <input
            value={form.title}
            onChange={(e) => updateForm({ title: e.target.value })}
            className="bg-transparent text-white font-semibold text-base outline-none border-b border-transparent hover:border-white/20 focus:border-white/50 transition-colors truncate max-w-xs"
            placeholder="Form title"
          />
          {/* Auto-save indicator */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {saveStatus === "saving" && (
              <span className="flex items-center gap-1 text-white/30 text-xs">
                <Loader2 className="w-3 h-3 animate-spin" /> Saving…
              </span>
            )}
            {saveStatus === "saved" && (
              <span className="flex items-center gap-1 text-white/30 text-xs">
                <Save className="w-3 h-3" /> Saved
              </span>
            )}
            {saveStatus === "unsaved" && (
              <span className="text-amber-400/60 text-xs">Unsaved changes</span>
            )}
            {saveStatus === "error" && (
              <span className="flex items-center gap-1 text-red-400/70 text-xs">
                <AlertCircle className="w-3 h-3" /> Save failed
              </span>
            )}
          </div>
        </div>

        {/* Tab nav */}
        <nav className="hidden md:flex items-center gap-1">
          {(["questions", "responses", "settings"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="px-4 py-1.5 rounded-full text-sm font-semibold capitalize transition-all"
              style={tab === t
                ? { background: `${ACCENT}22`, color: ACCENT }
                : { color: "rgba(255,255,255,0.45)", background: "transparent" }
              }
            >
              {t}
            </button>
          ))}
        </nav>

        {/* Right actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Preview link */}
          {form.isPublished ? (
            <a
              href={shareUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white/60 hover:text-white transition border border-white/10 hover:border-white/20"
            >
              <Eye className="w-3.5 h-3.5" />
              Preview
            </a>
          ) : null}

          {/* Publish / Unpublish */}
          <button
            onClick={togglePublish}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-sm font-bold transition-all active:scale-95 disabled:opacity-50"
            style={form.isPublished
              ? { background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.12)" }
              : { background: ACCENT, color: "#0a1a0f" }
            }
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : form.isPublished ? <EyeOff className="w-3.5 h-3.5" /> : null}
            {form.isPublished ? "Unpublish" : "Publish"}
          </button>
        </div>
      </header>

      {/* ── MOBILE TAB NAV ─────────────────────────────────────────────────── */}
      <div
        className="md:hidden fixed top-14 left-0 right-0 z-40 flex border-b"
        style={{ background: "oklch(0.15 0.05 145)", borderColor: "rgba(255,255,255,0.08)" }}
      >
        {(["questions", "responses", "settings"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="flex-1 py-2.5 text-xs font-semibold capitalize transition-all border-b-2"
            style={tab === t
              ? { color: ACCENT, borderColor: ACCENT }
              : { color: "rgba(255,255,255,0.40)", borderColor: "transparent" }
            }
          >
            {t}
          </button>
        ))}
      </div>

      {/* ── MAIN CONTENT ───────────────────────────────────────────────────── */}
      <main className="flex-1 pt-14 md:pt-14 pb-16 overflow-y-auto">

        {/* ── QUESTIONS TAB ──────────────────────────────────────────────── */}
        {tab === "questions" && (
          <div className="relative max-w-2xl mx-auto px-4 py-8 md:py-10">

            {/* Form header card */}
            <div
              className="rounded-2xl overflow-hidden mb-4 shadow-lg"
              style={{ background: "oklch(0.17 0.05 145)", border: "1px solid rgba(255,255,255,0.09)" }}
            >
              {/* Accent top bar */}
              <div className="h-2.5 w-full" style={{ background: ACCENT }} />
              <div className="p-6 space-y-3">
                <input
                  value={form.title}
                  onChange={(e) => updateForm({ title: e.target.value })}
                  placeholder="Form title"
                  className="w-full bg-transparent text-white text-2xl font-bold outline-none border-b border-transparent hover:border-white/20 focus:border-white/40 transition-colors pb-1"
                />
                <textarea
                  value={form.description ?? ""}
                  onChange={(e) => updateForm({ description: e.target.value })}
                  placeholder="Form description (optional)"
                  rows={2}
                  className="w-full bg-transparent text-white/60 text-sm outline-none resize-none border-b border-transparent hover:border-white/15 focus:border-white/30 transition-colors pb-1"
                />
                {form.isPublished && (
                  <div
                    className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-white/50"
                    style={{ background: `${ACCENT}11`, border: `1px solid ${ACCENT}33` }}
                  >
                    <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: ACCENT }} />
                    <span>This form is live and collecting responses.</span>
                    <button
                      onClick={copyLink}
                      className="ml-auto flex items-center gap-1 font-semibold transition-colors"
                      style={{ color: copied ? ACCENT : "rgba(255,255,255,0.5)" }}
                    >
                      {copied ? <CheckCircle className="w-3 h-3" /> : <Link2 className="w-3 h-3" />}
                      {copied ? "Copied!" : "Copy link"}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Question cards — drag-and-drop sortable */}
            <DndContext
              sensors={dndSensors}
              collisionDetection={closestCenter}
              onDragEnd={(event: DragEndEvent) => {
                const { active, over } = event;
                if (over && active.id !== over.id) {
                  reorderQuestions(String(active.id), String(over.id));
                }
              }}
            >
              <SortableContext items={form.questions.map((q) => q.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-3">
                  {form.questions.map((q, idx) => (
                    <SortableQuestionCard
                      key={q.id}
                      question={q}
                      index={idx}
                      isActive={activeQuestionId === q.id}
                      onActivate={() => setActiveQuestionId(q.id)}
                      onUpdate={(patch) => updateQuestion(q.id, patch)}
                      onRemove={() => removeQuestion(q.id)}
                      onDuplicate={() => duplicateQuestion(q.id)}
                      onAddOption={() => addOption(q.id)}
                      onUpdateOption={(i, v) => updateOption(q.id, i, v)}
                      onRemoveOption={(i) => removeOption(q.id, i)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>

            {/* Add question button (bottom) */}
            <button
              onClick={() => addQuestion("radio")}
              className="mt-4 w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl text-sm font-semibold border border-dashed transition-all hover:scale-[1.01] active:scale-[0.99]"
              style={{ borderColor: `${ACCENT}55`, color: ACCENT, background: `${ACCENT}08` }}
            >
              <Plus className="w-4 h-4" />
              Add Question
            </button>

            {/* Floating right toolbar */}
            <div
              className="hidden lg:flex fixed right-8 top-1/2 -translate-y-1/2 flex-col gap-1 p-2 rounded-2xl shadow-2xl"
              style={{ background: "oklch(0.17 0.05 145)", border: "1px solid rgba(255,255,255,0.09)" }}
            >
              <p className="text-white/20 text-[10px] font-bold uppercase tracking-widest px-2 py-1 text-center">Add</p>
              {(Object.entries(QUESTION_TYPE_META) as [QuestionType, typeof QUESTION_TYPE_META[QuestionType]][]).map(([type, meta]) => (
                <button
                  key={type}
                  onClick={() => addQuestion(type)}
                  title={`${meta.label} — ${meta.description}`}
                  className="group flex items-center gap-0 w-10 h-10 rounded-xl transition-all hover:w-40 overflow-hidden"
                  style={{ color: "rgba(255,255,255,0.55)", background: "transparent" }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = `${ACCENT}18`; (e.currentTarget as HTMLElement).style.color = ACCENT; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.55)"; }}
                >
                  <span className="w-10 flex items-center justify-center flex-shrink-0">{meta.icon}</span>
                  <span className="text-xs font-semibold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pr-3">{meta.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── RESPONSES TAB ──────────────────────────────────────────────── */}
        {tab === "responses" && (
          <div className="max-w-2xl mx-auto px-4 py-8 md:py-10 space-y-6">
            {/* Summary bar */}
            <div
              className="rounded-2xl p-5 flex items-center gap-5"
              style={{ background: "oklch(0.17 0.05 145)", border: "1px solid rgba(255,255,255,0.09)" }}
            >
              <div className="text-center">
                <div className="text-3xl font-bold text-white">{responses.length}</div>
                <div className="text-white/40 text-xs mt-0.5">Responses</div>
              </div>
              <div className="w-px h-10 bg-white/10" />
              <div className="flex-1">
                <p className="text-white/60 text-sm">
                  {responses.length === 0
                    ? "No responses yet. Share the form link to start collecting RSVPs."
                    : `${responses.length} attendee${responses.length !== 1 ? "s" : ""} have submitted this form.`
                  }
                </p>
              </div>
              {form.isPublished && (
                <button
                  onClick={copyLink}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all flex-shrink-0"
                  style={copied
                    ? { background: `${ACCENT}22`, color: ACCENT }
                    : { background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.6)" }
                  }
                >
                  {copied ? <CheckCircle className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? "Copied!" : "Copy Link"}
                </button>
              )}
            </div>

            {/* Per-question breakdown */}
            {responses.length > 0 && form.questions.map((q, idx) => {
              const answers = responses.map((r) => {
                const a = r.answers.find((a) => a.questionId === q.id);
                return a?.answer ?? "";
              });

              const hasOptions = ["radio", "checkbox", "select"].includes(q.type);

              let counts: Record<string, number> = {};
              if (hasOptions) {
                for (const opt of (q.options ?? [])) counts[opt] = 0;
                for (const ans of answers) {
                  const arr = Array.isArray(ans) ? ans : (typeof ans === "string" && ans ? [ans] : []);
                  for (const v of arr) counts[v] = (counts[v] ?? 0) + 1;
                }
              }
              const total = responses.length;
              const texts = hasOptions ? [] : answers.filter((a) => typeof a === "string" && (a as string).trim()).map((a) => a as string);

              return (
                <div
                  key={q.id}
                  className="rounded-2xl p-5 space-y-4"
                  style={{ background: "oklch(0.17 0.05 145)", border: "1px solid rgba(255,255,255,0.09)" }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-white font-semibold text-base">{idx + 1}. {q.label || `Question ${idx + 1}`}</p>
                    <span className="text-white/30 text-xs flex-shrink-0">{QUESTION_TYPE_META[q.type].label}</span>
                  </div>

                  {hasOptions && (
                    <div className="space-y-2">
                      {Object.entries(counts).map(([opt, count]) => {
                        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                        return (
                          <div key={opt} className="space-y-1">
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-white/70 truncate max-w-[70%]">{opt}</span>
                              <span className="text-white/40 flex-shrink-0 ml-2 text-xs">{count} · {pct}%</span>
                            </div>
                            <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.07)" }}>
                              <div
                                className="h-full rounded-full transition-all duration-500"
                                style={{ width: `${pct}%`, background: ACCENT }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {!hasOptions && (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {texts.length === 0 ? (
                        <p className="text-white/25 text-sm italic">No answers yet</p>
                      ) : texts.slice(0, 10).map((t, i) => (
                        <div
                          key={i}
                          className="px-3 py-2 rounded-xl text-sm text-white/60"
                          style={{ background: "oklch(0.20 0.05 145)", border: "1px solid rgba(255,255,255,0.06)" }}
                        >
                          {t}
                        </div>
                      ))}
                      {texts.length > 10 && (
                        <p className="text-white/30 text-xs pl-1">+{texts.length - 10} more</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Individual responses */}
            {responses.length > 0 && (
              <div
                className="rounded-2xl overflow-hidden"
                style={{ background: "oklch(0.17 0.05 145)", border: "1px solid rgba(255,255,255,0.09)" }}
              >
                <div className="px-5 py-4 border-b" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
                  <h3 className="text-white font-semibold">Individual Responses</h3>
                </div>
                <div className="divide-y" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
                  {responses.map((r) => (
                    <div key={r.id} className="px-5 py-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-white font-semibold text-sm">{r.respondentName}</span>
                        <span className="text-white/30 text-xs">
                          {new Date(r.submittedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                        </span>
                      </div>
                      {r.respondentEmail && (
                        <p className="text-white/40 text-xs">{r.respondentEmail}</p>
                      )}
                      {r.answers.map((a) => (
                        <div key={a.questionId} className="text-xs text-white/50">
                          <span className="text-white/30">{a.questionLabel}: </span>
                          {Array.isArray(a.answer) ? a.answer.join(", ") : a.answer}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {responses.length === 0 && (
              <div className="py-16 text-center">
                <BarChart2 className="w-12 h-12 text-white/10 mx-auto mb-3" />
                <p className="text-white/30 text-base font-semibold">No responses yet</p>
                <p className="text-white/20 text-sm mt-1">
                  {form.isPublished ? "Share the form link to start collecting RSVPs." : "Publish the form first, then share the link."}
                </p>
                {form.isPublished && (
                  <button
                    onClick={copyLink}
                    className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all"
                    style={{ background: ACCENT, color: "#0a1a0f" }}
                  >
                    <Link2 className="w-4 h-4" />
                    {copied ? "Copied!" : "Copy Share Link"}
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── SETTINGS TAB ───────────────────────────────────────────────── */}
        {tab === "settings" && (
          <div className="max-w-2xl mx-auto px-4 py-8 md:py-10 space-y-4">
            {/* Share link */}
            <div
              className="rounded-2xl p-5 space-y-3"
              style={{ background: "oklch(0.17 0.05 145)", border: "1px solid rgba(255,255,255,0.09)" }}
            >
              <h3 className="text-white font-semibold">Share Link</h3>
              <div
                className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
                style={{ background: "oklch(0.20 0.05 145)", border: "1px solid rgba(255,255,255,0.08)" }}
              >
                <Link2 className="w-3.5 h-3.5 text-white/40 flex-shrink-0" />
                <span className="flex-1 text-sm text-white/60 truncate">{shareUrl}</span>
                <button
                  onClick={copyLink}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all flex-shrink-0"
                  style={copied
                    ? { background: `${ACCENT}22`, color: ACCENT }
                    : { background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.6)" }
                  }
                >
                  {copied ? <CheckCircle className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  {copied ? "Copied!" : "Copy"}
                </button>
                <a
                  href={shareUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1 rounded-lg text-white/30 hover:text-white/70 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
              {!form.isPublished && (
                <p className="text-amber-400/70 text-xs flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  Publish the form for this link to be accessible.
                </p>
              )}
            </div>

                        {/* ── Responses section ─────────────────────────────────── */}
            <p className="text-white/30 text-xs font-semibold uppercase tracking-widest px-1">Responses</p>

            {/* Collect email toggle */}
            <div
              className="rounded-2xl p-5 flex items-center justify-between gap-4"
              style={{ background: "oklch(0.17 0.05 145)", border: "1px solid rgba(255,255,255,0.09)" }}
            >
              <div>
                <h3 className="text-white font-semibold">Collect Email Addresses</h3>
                <p className="text-white/40 text-sm mt-0.5">Ask respondents for their email when submitting.</p>
              </div>
              <button
                onClick={() => updateForm({ collectEmail: form.collectEmail ? 0 : 1 })}
                className="relative w-11 h-6 rounded-full transition-all flex-shrink-0"
                style={{ background: form.collectEmail ? ACCENT : "rgba(255,255,255,0.15)" }}
              >
                <span
                  className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all"
                  style={{ left: form.collectEmail ? "calc(100% - 1.375rem)" : "0.125rem" }}
                />
              </button>
            </div>

            {/* Limit responses */}
            <div
              className="rounded-2xl p-5 space-y-3"
              style={{ background: "oklch(0.17 0.05 145)", border: "1px solid rgba(255,255,255,0.09)" }}
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-white font-semibold">Limit Responses</h3>
                  <p className="text-white/40 text-sm mt-0.5">Automatically close the form after a set number of submissions.</p>
                </div>
                <button
                  onClick={() => updateForm({ maxResponses: form.maxResponses ? null : 50 })}
                  className="relative w-11 h-6 rounded-full transition-all flex-shrink-0"
                  style={{ background: form.maxResponses ? ACCENT : "rgba(255,255,255,0.15)" }}
                >
                  <span
                    className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all"
                    style={{ left: form.maxResponses ? "calc(100% - 1.375rem)" : "0.125rem" }}
                  />
                </button>
              </div>
              {form.maxResponses != null && (
                <div className="flex items-center gap-3">
                  <label className="text-white/50 text-sm whitespace-nowrap">Max responses</label>
                  <input
                    type="number"
                    min={1}
                    max={10000}
                    value={form.maxResponses}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      if (!isNaN(val) && val > 0) updateForm({ maxResponses: val });
                    }}
                    className="w-24 px-3 py-2 rounded-xl text-sm text-white/80 outline-none transition-all"
                    style={{ background: "oklch(0.20 0.05 145)", border: "1px solid rgba(255,255,255,0.12)" }}
                  />
                  <span className="text-white/30 text-xs">submissions</span>
                </div>
              )}
            </div>

            {/* Allow multiple submissions */}
            <div
              className="rounded-2xl p-5 flex items-center justify-between gap-4"
              style={{ background: "oklch(0.17 0.05 145)", border: "1px solid rgba(255,255,255,0.09)" }}
            >
              <div>
                <h3 className="text-white font-semibold">Allow Multiple Submissions</h3>
                <p className="text-white/40 text-sm mt-0.5">Let the same person submit the form more than once.</p>
              </div>
              <button
                onClick={() => updateForm({ allowMultipleSubmissions: form.allowMultipleSubmissions ? 0 : 1 })}
                className="relative w-11 h-6 rounded-full transition-all flex-shrink-0"
                style={{ background: form.allowMultipleSubmissions ? ACCENT : "rgba(255,255,255,0.15)" }}
              >
                <span
                  className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all"
                  style={{ left: form.allowMultipleSubmissions ? "calc(100% - 1.375rem)" : "0.125rem" }}
                />
              </button>
            </div>

            {/* ── Scheduling section ────────────────────────────────────── */}
            <p className="text-white/30 text-xs font-semibold uppercase tracking-widest px-1 pt-2">Scheduling</p>

            {/* Closes at */}
            <div
              className="rounded-2xl p-5 space-y-3"
              style={{ background: "oklch(0.17 0.05 145)", border: "1px solid rgba(255,255,255,0.09)" }}
            >
              <h3 className="text-white font-semibold">Close Date</h3>
              <p className="text-white/40 text-sm">Automatically stop accepting responses after this date.</p>
              <input
                type="datetime-local"
                value={form.closesAt ? form.closesAt.slice(0, 16) : ""}
                onChange={(e) => updateForm({ closesAt: e.target.value ? new Date(e.target.value).toISOString() : null })}
                className="px-3 py-2.5 rounded-xl text-sm text-white/70 outline-none transition-all"
                style={{ background: "oklch(0.20 0.05 145)", border: "1px solid rgba(255,255,255,0.08)", colorScheme: "dark" }}
              />
              {form.closesAt && (
                <button
                  onClick={() => updateForm({ closesAt: null })}
                  className="text-xs text-red-400/70 hover:text-red-400 transition-colors"
                >
                  Remove close date
                </button>
              )}
            </div>

            {/* ── Confirmation section ──────────────────────────────────── */}
            <p className="text-white/30 text-xs font-semibold uppercase tracking-widest px-1 pt-2">Confirmation</p>

            {/* Confirmation message */}
            <div
              className="rounded-2xl p-5 space-y-3"
              style={{ background: "oklch(0.17 0.05 145)", border: "1px solid rgba(255,255,255,0.09)" }}
            >
              <h3 className="text-white font-semibold">Confirmation Message</h3>
              <p className="text-white/40 text-sm">Shown to respondents after they submit the form.</p>
              <textarea
                value={form.confirmationMessage ?? ""}
                onChange={(e) => updateForm({ confirmationMessage: e.target.value })}
                placeholder="Thanks for your RSVP! We'll see you there."
                rows={3}
                className="w-full px-3 py-2.5 rounded-xl text-sm text-white/70 placeholder-white/25 outline-none resize-none transition-all"
                style={{ background: "oklch(0.20 0.05 145)", border: "1px solid rgba(255,255,255,0.08)" }}
              />
            </div>

            {/* ── Danger zone ───────────────────────────────────────────── */}
            <p className="text-white/30 text-xs font-semibold uppercase tracking-widest px-1 pt-2">Danger Zone</p>

            <div
              className="rounded-2xl p-5 space-y-3"
              style={{ background: "oklch(0.17 0.05 145)", border: "1px solid rgba(239,68,68,0.2)" }}
            >
              <p className="text-white/40 text-sm">Unpublishing the form will stop new responses. Existing responses are preserved.</p>
              {form.isPublished ? (
                <button
                  onClick={togglePublish}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-red-400 border border-red-400/30 hover:bg-red-400/10 transition-all"
                >
                  <EyeOff className="w-4 h-4" />
                  Unpublish Form
                </button>
              ) : (
                <p className="text-white/25 text-xs italic">Form is currently unpublished.</p>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// ── QuestionCard ──────────────────────────────────────────────────────────────
interface QuestionCardProps {
  question: FormQuestion;
  index: number;
  isActive: boolean;
  onActivate: () => void;
  onUpdate: (patch: Partial<FormQuestion>) => void;
  onRemove: () => void;
  onDuplicate: () => void;
  onAddOption: () => void;
  onUpdateOption: (idx: number, val: string) => void;
  onRemoveOption: (idx: number) => void;
}

function QuestionCard({
  question, index, isActive, onActivate, onUpdate, onRemove, onDuplicate,
  onAddOption, onUpdateOption, onRemoveOption,
}: QuestionCardProps) {
  const hasOptions = ["radio", "checkbox", "select"].includes(question.type);
  const labelRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isActive && labelRef.current && !question.label) {
      labelRef.current.focus();
    }
  }, [isActive, question.label]);

  return (
    <div
      onClick={onActivate}
      className="rounded-2xl overflow-hidden transition-all duration-200 cursor-pointer"
      style={{
        background: "oklch(0.17 0.05 145)",
        border: isActive ? `2px solid ${ACCENT}` : "2px solid rgba(255,255,255,0.07)",
        boxShadow: isActive ? `0 0 0 1px ${ACCENT}22` : "none",
      }}
    >
      {/* Active left accent */}
      {isActive && (
        <div className="h-0.5 w-full" style={{ background: ACCENT }} />
      )}

      <div className="p-5 space-y-4">
        {/* Question header row */}
        <div className="flex items-start gap-3">
          <GripVertical className="w-4 h-4 text-white/20 mt-3 flex-shrink-0 cursor-grab" />
          <div className="flex-1 space-y-3">
            {/* Label + type selector row */}
            <div className="flex items-center gap-3">
              <input
                ref={labelRef}
                value={question.label}
                onChange={(e) => onUpdate({ label: e.target.value })}
                onClick={(e) => e.stopPropagation()}
                placeholder={`Question ${index + 1}`}
                className="flex-1 bg-transparent text-white text-base font-medium outline-none border-b border-transparent hover:border-white/20 focus:border-white/50 transition-colors pb-1 placeholder-white/25"
              />
              {/* Type selector */}
              <div className="relative flex-shrink-0">
                <select
                  value={question.type}
                  onChange={(e) => { e.stopPropagation(); onUpdate({ type: e.target.value as QuestionType, options: ["radio","checkbox","select"].includes(e.target.value) ? ["Option 1"] : undefined }); }}
                  onClick={(e) => e.stopPropagation()}
                  className="appearance-none pl-3 pr-8 py-1.5 rounded-xl text-sm font-semibold text-white/70 outline-none cursor-pointer"
                  style={{ background: "oklch(0.20 0.05 145)", border: "1px solid rgba(255,255,255,0.10)" }}
                >
                  {(Object.entries(QUESTION_TYPE_META) as [QuestionType, typeof QUESTION_TYPE_META[QuestionType]][]).map(([t, meta]) => (
                    <option key={t} value={t}>{meta.label}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/40 pointer-events-none" />
              </div>
            </div>

            {/* Answer preview */}
            {question.type === "text" && (
              <div
                className="h-9 rounded-lg px-3 flex items-center text-sm text-white/20"
                style={{ background: "oklch(0.20 0.05 145)", border: "1px solid rgba(255,255,255,0.06)" }}
              >
                Short answer text
              </div>
            )}
            {question.type === "textarea" && (
              <div
                className="h-16 rounded-lg px-3 pt-2 text-sm text-white/20"
                style={{ background: "oklch(0.20 0.05 145)", border: "1px solid rgba(255,255,255,0.06)" }}
              >
                Long answer text
              </div>
            )}
            {question.type === "number" && (
              <div
                className="h-9 rounded-lg px-3 flex items-center text-sm text-white/20 w-32"
                style={{ background: "oklch(0.20 0.05 145)", border: "1px solid rgba(255,255,255,0.06)" }}
              >
                0
              </div>
            )}

            {/* Options */}
            {hasOptions && (
              <div className="space-y-2">
                {(question.options ?? []).map((opt, i) => (
                  <div key={i} className="flex items-center gap-2.5">
                    {question.type === "radio" && (
                      <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ border: "2px solid rgba(255,255,255,0.25)" }} />
                    )}
                    {question.type === "checkbox" && (
                      <div className="w-4 h-4 rounded flex-shrink-0" style={{ border: "2px solid rgba(255,255,255,0.25)" }} />
                    )}
                    {question.type === "select" && (
                      <span className="text-white/30 text-xs w-4 text-center flex-shrink-0">{i + 1}.</span>
                    )}
                    <input
                      value={opt}
                      onChange={(e) => { e.stopPropagation(); onUpdateOption(i, e.target.value); }}
                      onClick={(e) => e.stopPropagation()}
                      placeholder={`Option ${i + 1}`}
                      className="flex-1 bg-transparent text-white/70 text-sm outline-none border-b border-transparent hover:border-white/15 focus:border-white/40 transition-colors pb-0.5"
                    />
                    <button
                      onClick={(e) => { e.stopPropagation(); onRemoveOption(i); }}
                      className="text-white/20 hover:text-red-400 transition-colors flex-shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
                <button
                  onClick={(e) => { e.stopPropagation(); onAddOption(); }}
                  className="flex items-center gap-1.5 text-sm transition-colors pl-6 pt-0.5"
                  style={{ color: ACCENT }}
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add option
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Bottom action bar (visible when active) */}
        {isActive && (
          <div
            className="flex items-center justify-end gap-3 pt-3 border-t"
            style={{ borderColor: "rgba(255,255,255,0.07)" }}
          >
            <button
              onClick={(e) => { e.stopPropagation(); onDuplicate(); }}
              className="p-2 rounded-lg text-white/40 hover:text-white/70 hover:bg-white/08 transition-all"
              title="Duplicate question"
            >
              <Copy className="w-4 h-4" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onRemove(); }}
              className="p-2 rounded-lg text-white/40 hover:text-red-400 hover:bg-red-400/10 transition-all"
              title="Delete question"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <div className="w-px h-5 bg-white/10" />
            <label className="flex items-center gap-2 cursor-pointer select-none" onClick={(e) => e.stopPropagation()}>
              <span className="text-sm text-white/50 font-medium">Required</span>
              <button
                onClick={(e) => { e.stopPropagation(); onUpdate({ required: !question.required }); }}
                className="relative w-9 h-5 rounded-full transition-all"
                style={{ background: question.required ? ACCENT : "rgba(255,255,255,0.15)" }}
              >
                <span
                  className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all"
                  style={{ left: question.required ? "calc(100% - 1.125rem)" : "0.125rem" }}
                />
              </button>
            </label>
          </div>
        )}
      </div>
    </div>
  );
}

// ── SortableQuestionCard — wraps QuestionCard with @dnd-kit sortable ──────────
function SortableQuestionCard(props: QuestionCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: props.question.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.45 : 1,
    zIndex: isDragging ? 50 : undefined,
    position: "relative",
  };

  return (
    <div ref={setNodeRef} style={style}>
      {/* Drag handle — rendered as an overlay on the top-left of the card */}
      <div
        {...attributes}
        {...listeners}
        className="absolute left-0 top-0 bottom-0 w-7 flex items-center justify-center cursor-grab active:cursor-grabbing rounded-l-2xl z-10 opacity-0 hover:opacity-100 transition-opacity group-hover:opacity-60"
        style={{ background: "transparent" }}
        title="Drag to reorder"
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical className="w-4 h-4 text-white/40" />
      </div>
      {/* Wrap in a group div so the handle shows on card hover */}
      <div className="group pl-1">
        <QuestionCard {...props} />
      </div>
    </div>
  );
}
