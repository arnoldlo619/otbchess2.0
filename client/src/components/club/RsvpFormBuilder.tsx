/**
 * RsvpFormBuilder — Club owner UI to create/edit an RSVP survey form for an event.
 * Displays a Google Form-like builder with question types:
 *   text | textarea | radio | checkbox | select | number
 * Shows the shareable public link once the form is published.
 */
import { useState, useEffect } from "react";
import {
  Plus,
  Trash2,
  GripVertical,
  ClipboardList,
  Link2,
  Check,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Copy,
  CheckCheck,
} from "lucide-react";
import { authFetch } from "@/lib/apiFetch";

export type QuestionType = "text" | "textarea" | "radio" | "checkbox" | "select" | "number";

export interface FormQuestion {
  id: string;
  type: QuestionType;
  label: string;
  required: boolean;
  options?: string[]; // for radio / checkbox / select
  placeholder?: string;
}

export interface RsvpFormData {
  id: string;
  eventId: string;
  clubId: string;
  title: string;
  description?: string | null;
  questions: FormQuestion[];
  slug: string;
  isPublished: number; // 0 | 1
  closesAt?: string | null;
  confirmationMessage?: string | null;
  collectEmail?: number | null;
  maxResponses?: number | null;
  allowMultipleSubmissions?: number | null;
  theme_color?: string | null;
  header_image?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Props {
  clubId: string;
  eventId: string;
}

const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  text: "Short Answer",
  textarea: "Paragraph",
  radio: "Multiple Choice",
  checkbox: "Checkboxes",
  select: "Dropdown",
  number: "Number",
};

function nanoid8() {
  return Math.random().toString(36).slice(2, 10);
}

function defaultQuestion(): FormQuestion {
  return {
    id: nanoid8(),
    type: "text",
    label: "",
    required: false,
    options: [],
    placeholder: "",
  };
}

export default function RsvpFormBuilder({ clubId, eventId }: Props) {
  const [form, setForm] = useState<RsvpFormData | null>(null);
  const [title, setTitle] = useState("RSVP Form");
  const [description, setDescription] = useState("");
  const [questions, setQuestions] = useState<FormQuestion[]>([]);
  const [isPublished, setIsPublished] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const shareUrl = form?.slug
    ? `${window.location.origin}/rsvp/${form.slug}`
    : null;

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await authFetch(`/api/clubs/${clubId}/events/${eventId}/rsvp-form`);
        if (res.ok) {
          const data = await res.json() as { form: RsvpFormData };
          setForm(data.form);
          setTitle(data.form.title);
          setDescription(data.form.description ?? "");
          setQuestions((data.form.questions as FormQuestion[]) ?? []);
          setIsPublished(data.form.isPublished === 1);
        }
      } catch { /* no form yet */ }
      setLoading(false);
    }
    load();
  }, [clubId, eventId]);

  async function handleSave(publish?: boolean) {
    setSaving(true);
    try {
      const res = await authFetch(`/api/clubs/${clubId}/events/${eventId}/rsvp-form`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description: description || null,
          questions,
          isPublished: publish !== undefined ? publish : isPublished,
        }),
      });
      if (res.ok) {
        const data = await res.json() as { form: RsvpFormData };
        setForm(data.form);
        if (publish !== undefined) setIsPublished(publish);
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
      }
    } finally {
      setSaving(false);
    }
  }

  function addQuestion() {
    setQuestions((prev) => [...prev, defaultQuestion()]);
  }

  function removeQuestion(id: string) {
    setQuestions((prev) => prev.filter((q) => q.id !== id));
  }

  function updateQuestion(id: string, patch: Partial<FormQuestion>) {
    setQuestions((prev) => prev.map((q) => q.id === id ? { ...q, ...patch } : q));
  }

  function addOption(qId: string) {
    setQuestions((prev) => prev.map((q) =>
      q.id === qId ? { ...q, options: [...(q.options ?? []), ""] } : q
    ));
  }

  function updateOption(qId: string, idx: number, val: string) {
    setQuestions((prev) => prev.map((q) =>
      q.id === qId ? { ...q, options: (q.options ?? []).map((o, i) => i === idx ? val : o) } : q
    ));
  }

  function removeOption(qId: string, idx: number) {
    setQuestions((prev) => prev.map((q) =>
      q.id === qId ? { ...q, options: (q.options ?? []).filter((_, i) => i !== idx) } : q
    ));
  }

  function copyLink() {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  }

  if (loading) {
    return (
      <div className="rounded-2xl p-5 animate-pulse" style={{ background: "oklch(0.15 0.05 145)", border: "1px solid rgba(255,255,255,0.08)" }}>
        <div className="h-4 w-32 rounded bg-white/10 mb-3" />
        <div className="h-3 w-48 rounded bg-white/06" />
      </div>
    );
  }

  return (
    <div
      className="rounded-2xl overflow-hidden transition-all duration-300"
      style={{ background: "oklch(0.14 0.05 145)", border: "1px solid rgba(255,255,255,0.09)" }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-3 px-5 py-4 cursor-pointer select-none"
        style={{ borderBottom: collapsed ? "none" : "1px solid rgba(255,255,255,0.07)" }}
        onClick={() => setCollapsed((v) => !v)}
      >
        <ClipboardList className="w-4 h-4 flex-shrink-0" style={{ color: "oklch(0.65 0.14 145)" }} />
        <div className="flex-1 min-w-0">
          <h3 className="text-white text-sm font-bold">RSVP Form Survey</h3>
          {form?.isPublished === 1 ? (
            <span className="text-[11px] font-semibold" style={{ color: "oklch(0.65 0.14 145)" }}>
              Published · {form ? `${form.questions.length} question${form.questions.length !== 1 ? "s" : ""}` : ""}
            </span>
          ) : (
            <span className="text-[11px] text-white/40">
              {form ? "Draft — not yet published" : "No form yet — create one below"}
            </span>
          )}
        </div>
        {collapsed ? <ChevronDown className="w-4 h-4 text-white/30" /> : <ChevronUp className="w-4 h-4 text-white/30" />}
      </div>

      {!collapsed && (
        <div className="px-5 py-4 space-y-4">
          {/* Shareable link (when published) */}
          {form?.isPublished === 1 && shareUrl && (
            <div
              className="flex items-center gap-3 px-4 py-3 rounded-xl"
              style={{ background: "oklch(0.18 0.08 145)", border: "1px solid oklch(0.30 0.10 145 / 0.5)" }}
            >
              <Link2 className="w-4 h-4 flex-shrink-0" style={{ color: "oklch(0.65 0.14 145)" }} />
              <span className="flex-1 text-xs font-mono text-white/70 truncate">{shareUrl}</span>
              <button
                onClick={copyLink}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 hover:brightness-110 active:scale-95"
                style={{ background: copied ? "oklch(0.35 0.12 145)" : "oklch(0.25 0.08 145)", color: "rgba(255,255,255,0.9)" }}
              >
                {copied ? <CheckCheck className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
          )}

          {/* Form title & description */}
          <div className="space-y-2">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Form title"
              className="w-full px-4 py-2.5 rounded-xl text-sm font-semibold text-white placeholder-white/30 outline-none transition-all duration-200 focus:ring-1"
              style={{
                background: "oklch(0.18 0.05 145)",
                border: "1px solid rgba(255,255,255,0.10)",
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = "oklch(0.50 0.14 145)"; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.10)"; }}
            />
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description or instructions…"
              rows={2}
              className="w-full px-4 py-2.5 rounded-xl text-sm text-white/70 placeholder-white/30 outline-none resize-none transition-all duration-200"
              style={{
                background: "oklch(0.18 0.05 145)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = "oklch(0.50 0.14 145)"; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; }}
            />
          </div>

          {/* Questions */}
          <div className="space-y-3">
            {questions.map((q, idx) => (
              <QuestionCard
                key={q.id}
                question={q}
                index={idx}
                onUpdate={(patch) => updateQuestion(q.id, patch)}
                onRemove={() => removeQuestion(q.id)}
                onAddOption={() => addOption(q.id)}
                onUpdateOption={(i, v) => updateOption(q.id, i, v)}
                onRemoveOption={(i) => removeOption(q.id, i)}
              />
            ))}
          </div>

          {/* Add question button */}
          <button
            onClick={addQuestion}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 hover:brightness-110 active:scale-[0.98]"
            style={{ background: "oklch(0.20 0.06 145)", border: "1px dashed rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.55)" }}
          >
            <Plus className="w-4 h-4" />
            Add Question
          </button>

          {/* Action buttons */}
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={() => handleSave()}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all duration-200 hover:brightness-110 active:scale-95 disabled:opacity-50"
              style={{ background: "oklch(0.25 0.07 145)", color: "rgba(255,255,255,0.85)", border: "1px solid rgba(255,255,255,0.12)" }}
            >
              {saved ? <Check className="w-4 h-4" style={{ color: "oklch(0.65 0.14 145)" }} /> : null}
              {saving ? "Saving…" : saved ? "Saved" : "Save Draft"}
            </button>
            <button
              onClick={() => handleSave(!isPublished)}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all duration-200 hover:brightness-110 active:scale-95 disabled:opacity-50"
              style={{
                background: isPublished ? "oklch(0.22 0.06 145)" : "oklch(0.45 0.18 145)",
                color: isPublished ? "rgba(255,255,255,0.6)" : "#ffffff",
                border: isPublished ? "1px solid rgba(255,255,255,0.10)" : "none",
              }}
            >
              {isPublished ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              {isPublished ? "Unpublish" : "Publish & Share"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── QuestionCard ──────────────────────────────────────────────────────────────

interface QuestionCardProps {
  question: FormQuestion;
  index: number;
  onUpdate: (patch: Partial<FormQuestion>) => void;
  onRemove: () => void;
  onAddOption: () => void;
  onUpdateOption: (idx: number, val: string) => void;
  onRemoveOption: (idx: number) => void;
}

function QuestionCard({ question, index, onUpdate, onRemove, onAddOption, onUpdateOption, onRemoveOption }: QuestionCardProps) {
  const hasOptions = ["radio", "checkbox", "select"].includes(question.type);

  return (
    <div
      className="rounded-xl p-4 space-y-3 transition-all duration-200 hover:border-white/12"
      style={{ background: "oklch(0.17 0.05 145)", border: "1px solid rgba(255,255,255,0.08)" }}
    >
      <div className="flex items-start gap-2">
        <GripVertical className="w-4 h-4 text-white/20 mt-2.5 flex-shrink-0 cursor-grab" />
        <div className="flex-1 space-y-2">
          {/* Label input */}
          <input
            value={question.label}
            onChange={(e) => onUpdate({ label: e.target.value })}
            placeholder={`Question ${index + 1}`}
            className="w-full px-3 py-2 rounded-lg text-sm font-medium text-white placeholder-white/30 outline-none transition-all duration-200"
            style={{ background: "oklch(0.20 0.05 145)", border: "1px solid rgba(255,255,255,0.08)" }}
            onFocus={(e) => { e.currentTarget.style.borderColor = "oklch(0.50 0.14 145)"; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; }}
          />
          {/* Type selector + required toggle */}
          <div className="flex items-center gap-2">
            <select
              value={question.type}
              onChange={(e) => onUpdate({ type: e.target.value as QuestionType, options: [] })}
              className="flex-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-white/70 outline-none cursor-pointer"
              style={{ background: "oklch(0.20 0.05 145)", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              {(Object.keys(QUESTION_TYPE_LABELS) as QuestionType[]).map((t) => (
                <option key={t} value={t}>{QUESTION_TYPE_LABELS[t]}</option>
              ))}
            </select>
            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={question.required}
                onChange={(e) => onUpdate({ required: e.target.checked })}
                className="w-3.5 h-3.5 accent-green-500"
              />
              <span className="text-xs text-white/50 font-medium">Required</span>
            </label>
          </div>
          {/* Options (for radio/checkbox/select) */}
          {hasOptions && (
            <div className="space-y-1.5 pl-1">
              {(question.options ?? []).map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ border: "1.5px solid rgba(255,255,255,0.25)" }} />
                  <input
                    value={opt}
                    onChange={(e) => onUpdateOption(i, e.target.value)}
                    placeholder={`Option ${i + 1}`}
                    className="flex-1 px-2 py-1 rounded-lg text-xs text-white/80 placeholder-white/30 outline-none"
                    style={{ background: "oklch(0.20 0.05 145)", border: "1px solid rgba(255,255,255,0.06)" }}
                  />
                  <button onClick={() => onRemoveOption(i)} className="text-white/30 hover:text-red-400 transition-colors duration-150">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              <button
                onClick={onAddOption}
                className="flex items-center gap-1 text-xs text-white/40 hover:text-white/70 transition-colors duration-150 pl-5 pt-0.5"
              >
                <Plus className="w-3 h-3" /> Add option
              </button>
            </div>
          )}
        </div>
        <button
          onClick={onRemove}
          className="mt-1.5 p-1.5 rounded-lg text-white/25 hover:text-red-400 hover:bg-red-400/10 transition-all duration-150 flex-shrink-0"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
