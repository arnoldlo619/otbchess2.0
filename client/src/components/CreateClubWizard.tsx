/**
 * CreateClubWizard — full-screen multi-step club creation overlay
 *
 * Steps:
 *   1. Identity   — club name + tagline (live slug preview)
 *   2. Category   — large visual category cards
 *   3. Location   — city + country picker
 *   4. About      — description + accent colour + optional links
 *   5. Share      — success screen with club link + copy/share
 *
 * Design mirrors the TournamentWizard:
 *   - Full-viewport fixed overlay (portal)
 *   - Two-column desktop layout: left hero panel + right input panel
 *   - Thin animated progress bar
 *   - Smooth horizontal slide transitions
 *   - Keyboard navigation (Enter → next, Escape → close)
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "wouter";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuthContext } from "@/context/AuthContext";
import { createClub, type ClubCategory } from "@/lib/clubRegistry";
import { ClubAvatarUpload } from "@/components/ClubAvatarUpload";
import { toast } from "sonner";
import {
  X,
  ChevronLeft,
  ChevronRight,
  Check,
  Copy,
  Share2,
  Crown,
  Users,
  BookOpen,
  GraduationCap,
  Globe,
  Building2,
  MapPin,
  Link2,
  MessageSquare,
  Sparkles,
  ArrowRight,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface WizardData {
  name: string;
  tagline: string;
  category: ClubCategory;
  location: string;
  country: string;
  description: string;
  accentColor: string;
  website: string;
  discord: string;
  isPublic: boolean;
  /** Base64 data URL for the club avatar (null = use initials) */
  avatarUrl: string | null;
}

const DEFAULT_DATA: WizardData = {
  name: "",
  tagline: "",
  category: "club",
  location: "",
  country: "US",
  description: "",
  accentColor: "#3D6B47",
  website: "",
  discord: "",
  isPublic: true,
  avatarUrl: null,
};

// ── Constants ─────────────────────────────────────────────────────────────────

const TOTAL_STEPS = 5;

const ACCENT_COLORS = [
  { hex: "#3D6B47", label: "Forest Green" },
  { hex: "#1a3a5c", label: "Navy Blue" },
  { hex: "#8B1A1A", label: "Deep Red" },
  { hex: "#5C3317", label: "Warm Brown" },
  { hex: "#8B2252", label: "Plum" },
  { hex: "#2D4A22", label: "Dark Green" },
  { hex: "#1a4a4a", label: "Teal" },
  { hex: "#4a2d6b", label: "Purple" },
  { hex: "#6b4a1a", label: "Gold" },
  { hex: "#2a2a2a", label: "Slate" },
];

const CATEGORIES: Array<{
  value: ClubCategory;
  label: string;
  description: string;
  icon: React.ReactNode;
}> = [
  {
    value: "club",
    label: "Chess Club",
    description: "A local or regional chess club for regular play",
    icon: <Crown className="w-6 h-6" />,
  },
  {
    value: "community",
    label: "Community",
    description: "Open community bringing chess to everyone",
    icon: <Users className="w-6 h-6" />,
  },
  {
    value: "university",
    label: "University",
    description: "Collegiate or university chess team",
    icon: <GraduationCap className="w-6 h-6" />,
  },
  {
    value: "school",
    label: "School Team",
    description: "K-12 school chess club or team",
    icon: <BookOpen className="w-6 h-6" />,
  },
  {
    value: "professional",
    label: "Academy",
    description: "Professional training academy or coaching centre",
    icon: <Building2 className="w-6 h-6" />,
  },
  {
    value: "online",
    label: "Online",
    description: "Primarily online community with OTB meetups",
    icon: <Globe className="w-6 h-6" />,
  },
];

const COUNTRIES = [
  { code: "US", name: "United States" },
  { code: "GB", name: "United Kingdom" },
  { code: "DE", name: "Germany" },
  { code: "FR", name: "France" },
  { code: "ES", name: "Spain" },
  { code: "IT", name: "Italy" },
  { code: "JP", name: "Japan" },
  { code: "IN", name: "India" },
  { code: "BR", name: "Brazil" },
  { code: "CA", name: "Canada" },
  { code: "AU", name: "Australia" },
  { code: "RU", name: "Russia" },
  { code: "CN", name: "China" },
  { code: "NL", name: "Netherlands" },
  { code: "PL", name: "Poland" },
  { code: "UA", name: "Ukraine" },
  { code: "AR", name: "Argentina" },
  { code: "NG", name: "Nigeria" },
  { code: "ZA", name: "South Africa" },
  { code: "EG", name: "Egypt" },
  { code: "OTHER", name: "Other" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function slugPreview(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "your-club-name";
}

export function validateStep(step: number, data: WizardData): string | null {
  if (step === 1) {
    if (!data.name.trim()) return "Club name is required";
    if (data.name.trim().length < 3) return "Name must be at least 3 characters";
    if (data.name.trim().length > 60) return "Name must be 60 characters or fewer";
    if (!data.tagline.trim()) return "Tagline is required";
    if (data.tagline.trim().length > 100) return "Tagline must be 100 characters or fewer";
  }
  if (step === 2) {
    if (!data.category) return "Please select a category";
  }
  if (step === 3) {
    if (!data.location.trim()) return "City / location is required";
    if (!data.country) return "Please select a country";
  }
  if (step === 4) {
    if (!data.description.trim()) return "Description is required";
    if (data.description.trim().length < 20) return "Description must be at least 20 characters";
    if (data.description.trim().length > 500) return "Description must be 500 characters or fewer";
  }
  return null;
}

// ── Step hero content ─────────────────────────────────────────────────────────

const STEP_HERO = [
  {
    eyebrow: "Step 1 of 4",
    title: "Name your\nclub",
    body: "Give your club a name that players will remember. A great tagline tells visitors what you're about in one sentence.",
    icon: <Crown className="w-10 h-10 text-white" strokeWidth={1.5} />,
  },
  {
    eyebrow: "Step 2 of 4",
    title: "Choose a\ncategory",
    body: "Help players find you. Selecting the right category puts your club in front of the right audience.",
    icon: <Users className="w-10 h-10 text-white" strokeWidth={1.5} />,
  },
  {
    eyebrow: "Step 3 of 4",
    title: "Where are\nyou based?",
    body: "Location helps nearby players discover your club and lets you appear in local search results.",
    icon: <MapPin className="w-10 h-10 text-white" strokeWidth={1.5} />,
  },
  {
    eyebrow: "Step 4 of 4",
    title: "Tell your\nstory",
    body: "A compelling description and a distinctive colour make your club page stand out. Add links so players can find you online.",
    icon: <Sparkles className="w-10 h-10 text-white" strokeWidth={1.5} />,
  },
];

// ── Main component ────────────────────────────────────────────────────────────

interface CreateClubWizardProps {
  onClose: () => void;
}

export function CreateClubWizard({ onClose }: CreateClubWizardProps) {
  const [, navigate] = useLocation();
  const { user } = useAuthContext();
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [step, setStep] = useState(1);
  const [data, setData] = useState<WizardData>(DEFAULT_DATA);
  const [error, setError] = useState<string | null>(null);
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const [animating, setAnimating] = useState(false);
  const [createdClubId, setCreatedClubId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  // Focus first input on mount
  useEffect(() => {
    setTimeout(() => nameRef.current?.focus(), 100);
  }, []);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Enter" && step < 5 && !animating) {
        e.preventDefault();
        handleNext();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [step, data, animating]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const patch = (fields: Partial<WizardData>) => {
    setData((d) => ({ ...d, ...fields }));
    setError(null);
  };

  const handleNext = () => {
    if (step === 5) return;
    const err = validateStep(step, data);
    if (err) { setError(err); return; }
    setError(null);

    // On step 4 → create the club
    if (step === 4) {
      if (!user) { toast.error("Sign in to create a club"); return; }
      const club = createClub(
        {
          name: data.name.trim(),
          tagline: data.tagline.trim(),
          category: data.category,
          location: data.location.trim(),
          country: data.country,
          description: data.description.trim(),
          accentColor: data.accentColor,
          avatarUrl: data.avatarUrl,
          bannerUrl: null,
          ownerId: user.id,
          ownerName: user.displayName,
          isPublic: data.isPublic,
          website: data.website.trim() || undefined,
          discord: data.discord.trim() || undefined,
        },
        { userId: user.id, displayName: user.displayName, avatarUrl: user.avatarUrl }
      );
      setCreatedClubId(club.id);
    }

    setDirection("forward");
    setAnimating(true);
    setTimeout(() => {
      setStep((s) => s + 1);
      setAnimating(false);
    }, 180);
  };

  const handleBack = () => {
    if (step <= 1) { onClose(); return; }
    setError(null);
    setDirection("back");
    setAnimating(true);
    setTimeout(() => {
      setStep((s) => s - 1);
      setAnimating(false);
    }, 180);
  };

  const clubUrl = createdClubId
    ? `${window.location.origin}/clubs/${createdClubId}`
    : "";

  const handleCopy = () => {
    navigator.clipboard.writeText(clubUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("Link copied!");
    });
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({ title: data.name, text: data.tagline, url: clubUrl });
    } else {
      handleCopy();
    }
  };

  const handleViewClub = () => {
    onClose();
    if (createdClubId) navigate(`/clubs/${createdClubId}`);
  };

  // ── Colour palette ──────────────────────────────────────────────────────────
  const bg = isDark ? "bg-[#0d1a0f]" : "bg-white";
  const heroBg = isDark ? "bg-[#1a2e1d]" : "bg-[#3D6B47]";
  const inputBg = isDark
    ? "bg-white/6 border-white/10 text-white placeholder:text-white/30 focus:border-[#4CAF50]"
    : "bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-[#3D6B47]";
  const textMain = isDark ? "text-white" : "text-gray-900";
  const textMuted = isDark ? "text-white/50" : "text-gray-400";
  const labelCls = isDark ? "text-white/60" : "text-gray-500";
  const divider = isDark ? "border-white/8" : "border-gray-100";
  const cardBorder = isDark ? "border-white/8" : "border-gray-200";

  // Progress bar width
  const progressPct = step === 5 ? 100 : ((step - 1) / 4) * 100;

  // Animation classes
  const panelClass = animating
    ? direction === "forward"
      ? "opacity-0 translate-x-4"
      : "opacity-0 -translate-x-4"
    : "opacity-100 translate-x-0";

  const hero = STEP_HERO[Math.min(step - 1, 3)];

  return createPortal(
    <div
      className={`fixed inset-0 z-50 flex flex-col ${bg}`}
      role="dialog"
      aria-modal="true"
      aria-label="Create Club"
    >
      {/* ── Progress bar ─────────────────────────────────────────────────── */}
      <div className={`h-0.5 w-full ${isDark ? "bg-white/8" : "bg-gray-100"}`}>
        <div
          className="h-full bg-[#4CAF50] transition-all duration-500 ease-out"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <div className={`flex items-center justify-between px-4 sm:px-6 py-3 border-b ${divider}`}>
        <button
          onClick={handleBack}
          className={`flex items-center gap-1.5 text-sm font-medium transition-colors ${
            isDark ? "text-white/50 hover:text-white" : "text-gray-400 hover:text-gray-900"
          }`}
        >
          <ChevronLeft className="w-4 h-4" />
          {step === 1 ? "Cancel" : "Back"}
        </button>

        <div className="flex items-center gap-2">
          {step < 5 && Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className={`rounded-full transition-all duration-300 ${
                i + 1 < step
                  ? "w-2 h-2 bg-[#4CAF50]"
                  : i + 1 === step
                  ? "w-5 h-2 bg-[#4CAF50]"
                  : isDark
                  ? "w-2 h-2 bg-white/15"
                  : "w-2 h-2 bg-gray-200"
              }`}
            />
          ))}
        </div>

        <button
          onClick={onClose}
          className={`p-2 rounded-xl transition-colors ${
            isDark ? "text-white/40 hover:text-white hover:bg-white/8" : "text-gray-400 hover:text-gray-900 hover:bg-gray-100"
          }`}
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* ── Body ─────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        {step < 5 ? (
          /* Two-column layout for steps 1-4 */
          <div className="flex flex-col lg:flex-row min-h-full">

            {/* Left hero panel (desktop only) */}
            <div className={`hidden lg:flex flex-col justify-between w-80 xl:w-96 flex-shrink-0 ${heroBg} p-10`}>
              <div>
                <div className="w-16 h-16 rounded-3xl bg-white/10 flex items-center justify-center mb-8">
                  {hero.icon}
                </div>
                <p className="text-[#4CAF50] text-xs font-semibold uppercase tracking-widest mb-3">
                  {hero.eyebrow}
                </p>
                <h2
                  className="text-3xl font-bold text-white leading-tight mb-4 whitespace-pre-line"
                  style={{ fontFamily: "'Clash Display', sans-serif" }}
                >
                  {hero.title}
                </h2>
                <p className="text-white/60 text-sm leading-relaxed">{hero.body}</p>
              </div>
              <div className={`text-xs ${isDark ? "text-white/20" : "text-white/40"}`}>
                Create Club · Step {step} of 4
              </div>
            </div>

            {/* Right input panel */}
            <div className="flex-1 flex flex-col justify-center px-4 sm:px-8 lg:px-12 py-8 max-w-xl lg:max-w-none mx-auto w-full">

              {/* Mobile step label */}
              <p className={`lg:hidden text-xs font-semibold uppercase tracking-widest mb-2 ${isDark ? "text-[#4CAF50]" : "text-[#3D6B47]"}`}>
                {hero.eyebrow}
              </p>
              <h2
                className={`lg:hidden text-2xl font-bold mb-6 ${textMain}`}
                style={{ fontFamily: "'Clash Display', sans-serif" }}
              >
                {hero.title.replace("\n", " ")}
              </h2>

              {/* Step content */}
              <div
                className={`transition-all duration-180 ${panelClass}`}
                style={{ transition: "opacity 0.18s ease, transform 0.18s ease" }}
              >
                {step === 1 && (
                  <Step1Identity
                    data={data}
                    patch={patch}
                    isDark={isDark}
                    inputBg={inputBg}
                    textMain={textMain}
                    textMuted={textMuted}
                    labelCls={labelCls}
                    nameRef={nameRef}
                  />
                )}
                {step === 2 && (
                  <Step2Category
                    data={data}
                    patch={patch}
                    isDark={isDark}
                    textMain={textMain}
                    textMuted={textMuted}
                    cardBorder={cardBorder}
                  />
                )}
                {step === 3 && (
                  <Step3Location
                    data={data}
                    patch={patch}
                    isDark={isDark}
                    inputBg={inputBg}
                    textMain={textMain}
                    textMuted={textMuted}
                    labelCls={labelCls}
                  />
                )}
                {step === 4 && (
                  <Step4About
                    data={data}
                    patch={patch}
                    isDark={isDark}
                    inputBg={inputBg}
                    textMain={textMain}
                    textMuted={textMuted}
                    labelCls={labelCls}
                    divider={divider}
                  />
                )}
              </div>

              {/* Error message */}
              {error && (
                <p className="mt-3 text-sm text-red-400 font-medium">{error}</p>
              )}

              {/* Next button */}
              <button
                onClick={handleNext}
                className="mt-8 w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-base font-semibold bg-[#3D6B47] text-white hover:bg-[#2d5236] active:scale-98 transition-all"
              >
                {step === 4 ? "Create Club" : "Continue"}
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        ) : (
          /* Step 5 — Success / Share */
          <Step5Share
            data={data}
            clubUrl={clubUrl}
            isDark={isDark}
            textMain={textMain}
            textMuted={textMuted}
            cardBorder={cardBorder}
            copied={copied}
            onCopy={handleCopy}
            onShare={handleShare}
            onViewClub={handleViewClub}
          />
        )}
      </div>
    </div>,
    document.body
  );
}

// ── Step 1: Identity ──────────────────────────────────────────────────────────

function Step1Identity({
  data, patch, isDark, inputBg, textMain, textMuted, labelCls, nameRef,
}: {
  data: WizardData;
  patch: (f: Partial<WizardData>) => void;
  isDark: boolean;
  inputBg: string;
  textMain: string;
  textMuted: string;
  labelCls: string;
  nameRef: React.RefObject<HTMLInputElement | null>;
}) {
  const charLeft = 100 - data.tagline.length;

  return (
    <div className="space-y-5">
      {/* Avatar upload */}
      <div className="flex justify-center pb-2">
        <ClubAvatarUpload
          value={data.avatarUrl}
          onChange={(url) => patch({ avatarUrl: url })}
          accentColor={data.accentColor}
          clubName={data.name}
          isDark={isDark}
          size={96}
        />
      </div>
      <div>
        <label className={`block text-sm font-semibold mb-2 ${labelCls}`}>
          Club Name <span className="text-red-400">*</span>
        </label>
        <input
          ref={nameRef}
          type="text"
          value={data.name}
          onChange={(e) => patch({ name: e.target.value })}
          placeholder="e.g. London Chess Club"
          maxLength={60}
          className={`w-full px-4 py-3.5 rounded-2xl border text-base outline-none transition-colors ${inputBg}`}
          autoComplete="off"
        />
        {data.name && (
          <p className={`text-xs mt-1.5 ${textMuted}`}>
            URL: <span className="font-mono">/clubs/{slugPreview(data.name)}</span>
          </p>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className={`text-sm font-semibold ${labelCls}`}>
            Tagline <span className="text-red-400">*</span>
          </label>
          <span className={`text-xs ${charLeft < 20 ? "text-amber-400" : textMuted}`}>
            {charLeft} left
          </span>
        </div>
        <input
          type="text"
          value={data.tagline}
          onChange={(e) => patch({ tagline: e.target.value })}
          placeholder="e.g. The oldest chess club in the world, still playing strong."
          maxLength={100}
          className={`w-full px-4 py-3.5 rounded-2xl border text-base outline-none transition-colors ${inputBg}`}
          autoComplete="off"
        />
        <p className={`text-xs mt-1.5 ${textMuted}`}>
          One sentence that captures your club's spirit.
        </p>
      </div>

      {/* Visibility toggle */}
      <div className={`flex items-center justify-between p-4 rounded-2xl border ${isDark ? "border-white/8 bg-white/3" : "border-gray-100 bg-gray-50"}`}>
        <div>
          <p className={`text-sm font-semibold ${textMain}`}>Public club</p>
          <p className={`text-xs mt-0.5 ${textMuted}`}>Visible in discovery and search</p>
        </div>
        <button
          type="button"
          onClick={() => patch({ isPublic: !data.isPublic })}
          className={`relative w-11 h-6 rounded-full transition-colors ${data.isPublic ? "bg-[#4CAF50]" : isDark ? "bg-white/15" : "bg-gray-200"}`}
        >
          <span
            className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${data.isPublic ? "translate-x-5" : "translate-x-0.5"}`}
          />
        </button>
      </div>
    </div>
  );
}

// ── Step 2: Category ──────────────────────────────────────────────────────────

function Step2Category({
  data, patch, isDark, textMain, textMuted, cardBorder,
}: {
  data: WizardData;
  patch: (f: Partial<WizardData>) => void;
  isDark: boolean;
  textMain: string;
  textMuted: string;
  cardBorder: string;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {CATEGORIES.map((cat) => {
        const selected = data.category === cat.value;
        return (
          <button
            key={cat.value}
            type="button"
            onClick={() => patch({ category: cat.value })}
            className={`flex items-start gap-3 p-4 rounded-2xl border text-left transition-all ${
              selected
                ? isDark
                  ? "border-[#4CAF50] bg-[#4CAF50]/10"
                  : "border-[#3D6B47] bg-[#3D6B47]/8"
                : `${cardBorder} ${isDark ? "hover:bg-white/4" : "hover:bg-gray-50"}`
            }`}
          >
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${
                selected
                  ? "bg-[#3D6B47] text-white"
                  : isDark
                  ? "bg-white/8 text-white/50"
                  : "bg-gray-100 text-gray-500"
              }`}
            >
              {cat.icon}
            </div>
            <div className="min-w-0">
              <p className={`text-sm font-semibold ${textMain}`}>{cat.label}</p>
              <p className={`text-xs mt-0.5 leading-snug ${textMuted}`}>{cat.description}</p>
            </div>
            {selected && (
              <div className="ml-auto flex-shrink-0">
                <Check className="w-4 h-4 text-[#4CAF50]" />
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ── Step 3: Location ──────────────────────────────────────────────────────────

function Step3Location({
  data, patch, isDark, inputBg, textMain, textMuted, labelCls,
}: {
  data: WizardData;
  patch: (f: Partial<WizardData>) => void;
  isDark: boolean;
  inputBg: string;
  textMain: string;
  textMuted: string;
  labelCls: string;
}) {
  const selectCls = `w-full px-4 py-3.5 rounded-2xl border text-base outline-none transition-colors appearance-none ${inputBg}`;

  return (
    <div className="space-y-5">
      <div>
        <label className={`block text-sm font-semibold mb-2 ${labelCls}`}>
          City / Region <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          value={data.location}
          onChange={(e) => patch({ location: e.target.value })}
          placeholder="e.g. London, New York, Berlin"
          maxLength={80}
          className={`w-full px-4 py-3.5 rounded-2xl border text-base outline-none transition-colors ${inputBg}`}
          autoComplete="off"
        />
        <p className={`text-xs mt-1.5 ${textMuted}`}>
          This appears on your club card and profile page.
        </p>
      </div>

      <div>
        <label className={`block text-sm font-semibold mb-2 ${labelCls}`}>
          Country <span className="text-red-400">*</span>
        </label>
        <div className="relative">
          <select
            value={data.country}
            onChange={(e) => patch({ country: e.target.value })}
            className={selectCls}
          >
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>
          <div className={`absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none ${isDark ? "text-white/40" : "text-gray-400"}`}>
            ▾
          </div>
        </div>
      </div>

      {/* Location preview */}
      {data.location && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-2xl ${isDark ? "bg-white/5" : "bg-gray-50"}`}>
          <MapPin className={`w-4 h-4 flex-shrink-0 ${isDark ? "text-[#4CAF50]" : "text-[#3D6B47]"}`} />
          <span className={`text-sm font-medium ${textMain}`}>
            {data.location}{data.country && data.country !== "OTHER" ? `, ${COUNTRIES.find(c => c.code === data.country)?.name ?? ""}` : ""}
          </span>
        </div>
      )}
    </div>
  );
}

// ── Step 4: About ─────────────────────────────────────────────────────────────

function Step4About({
  data, patch, isDark, inputBg, textMain, textMuted, labelCls, divider,
}: {
  data: WizardData;
  patch: (f: Partial<WizardData>) => void;
  isDark: boolean;
  inputBg: string;
  textMain: string;
  textMuted: string;
  labelCls: string;
  divider: string;
}) {
  const descLeft = 500 - data.description.length;

  return (
    <div className="space-y-5">
      {/* Description */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className={`text-sm font-semibold ${labelCls}`}>
            Description <span className="text-red-400">*</span>
          </label>
          <span className={`text-xs ${descLeft < 50 ? "text-amber-400" : textMuted}`}>
            {descLeft} left
          </span>
        </div>
        <textarea
          value={data.description}
          onChange={(e) => patch({ description: e.target.value })}
          placeholder="Tell players about your club — history, what you do, who's welcome, when you meet…"
          maxLength={500}
          rows={5}
          className={`w-full px-4 py-3.5 rounded-2xl border text-sm outline-none transition-colors resize-none leading-relaxed ${inputBg}`}
        />
      </div>

      {/* Accent colour */}
      <div>
        <label className={`block text-sm font-semibold mb-3 ${labelCls}`}>
          Club Colour
        </label>
        <div className="flex flex-wrap gap-2.5">
          {ACCENT_COLORS.map((c) => (
            <button
              key={c.hex}
              type="button"
              title={c.label}
              onClick={() => patch({ accentColor: c.hex })}
              className={`w-9 h-9 rounded-xl transition-all ${
                data.accentColor === c.hex
                  ? "ring-2 ring-offset-2 ring-white scale-110"
                  : "hover:scale-105"
              }`}
              style={{ backgroundColor: c.hex }}
            />
          ))}
        </div>
        {/* Preview swatch */}
        <div
          className="mt-3 h-10 rounded-xl flex items-center px-4 gap-2 transition-colors"
          style={{ backgroundColor: data.accentColor + "33" }}
        >
          <div className="w-4 h-4 rounded-md" style={{ backgroundColor: data.accentColor }} />
          <span className={`text-xs font-medium ${textMuted}`}>{data.accentColor}</span>
        </div>
      </div>

      {/* Optional links */}
      <div className={`pt-4 border-t ${divider} space-y-3`}>
        <p className={`text-xs font-semibold uppercase tracking-wider ${textMuted}`}>
          Links (optional)
        </p>
        <div className="relative">
          <Link2 className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none ${textMuted}`} />
          <input
            type="url"
            value={data.website}
            onChange={(e) => patch({ website: e.target.value })}
            placeholder="https://yourclub.org"
            className={`w-full pl-10 pr-4 py-3 rounded-2xl border text-sm outline-none transition-colors ${inputBg}`}
          />
        </div>
        <div className="relative">
          <MessageSquare className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none ${textMuted}`} />
          <input
            type="url"
            value={data.discord}
            onChange={(e) => patch({ discord: e.target.value })}
            placeholder="https://discord.gg/yourserver"
            className={`w-full pl-10 pr-4 py-3 rounded-2xl border text-sm outline-none transition-colors ${inputBg}`}
          />
        </div>
      </div>
    </div>
  );
}

// ── Step 5: Share ─────────────────────────────────────────────────────────────

function Step5Share({
  data, clubUrl, isDark, textMain, textMuted, cardBorder,
  copied, onCopy, onShare, onViewClub,
}: {
  data: WizardData;
  clubUrl: string;
  isDark: boolean;
  textMain: string;
  textMuted: string;
  cardBorder: string;
  copied: boolean;
  onCopy: () => void;
  onShare: () => void;
  onViewClub: () => void;
}) {
  const card = isDark ? "bg-[#1a2e1d]" : "bg-gray-50";

  return (
    <div className="flex flex-col items-center justify-center min-h-full px-4 py-12 text-center max-w-md mx-auto">
      {/* Success icon */}
      <div className="w-20 h-20 rounded-3xl bg-[#3D6B47] flex items-center justify-center mb-6 shadow-xl shadow-[#3D6B47]/30">
        <Check className="w-10 h-10 text-white" strokeWidth={2.5} />
      </div>

      <h2
        className={`text-3xl font-bold mb-2 ${textMain}`}
        style={{ fontFamily: "'Clash Display', sans-serif" }}
      >
        Club Created!
      </h2>
      <p className={`text-base mb-2 ${textMuted}`}>{data.name}</p>
      <p className={`text-sm leading-relaxed mb-8 ${textMuted}`}>
        Your club is live. Share the link with your members so they can join.
      </p>

      {/* Club link card */}
      <div className={`w-full rounded-2xl border ${cardBorder} ${card} p-4 mb-6`}>
        <p className={`text-xs font-semibold uppercase tracking-wider mb-2 ${textMuted}`}>
          Club Link
        </p>
        <div className="flex items-center gap-2">
          <p className={`flex-1 text-sm font-mono truncate ${textMain}`}>{clubUrl}</p>
          <button
            onClick={onCopy}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
              copied
                ? "bg-[#4CAF50]/15 text-[#4CAF50]"
                : isDark
                ? "bg-white/8 text-white/70 hover:bg-white/15"
                : "bg-gray-200 text-gray-600 hover:bg-gray-300"
            }`}
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      </div>

      {/* Action buttons */}
      <div className="w-full space-y-3">
        <button
          onClick={onViewClub}
          className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-base font-semibold bg-[#3D6B47] text-white hover:bg-[#2d5236] transition-colors"
        >
          View Club Page
          <ArrowRight className="w-5 h-5" />
        </button>
        <button
          onClick={onShare}
          className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl text-sm font-semibold transition-colors border ${
            isDark
              ? "border-white/10 text-white/70 hover:bg-white/5"
              : "border-gray-200 text-gray-600 hover:bg-gray-50"
          }`}
        >
          <Share2 className="w-4 h-4" />
          Share Club
        </button>
      </div>
    </div>
  );
}
