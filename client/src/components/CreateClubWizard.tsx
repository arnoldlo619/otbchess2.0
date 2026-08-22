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

import { useState, useEffect, useRef, useCallback, useTransition } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "wouter";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuthContext } from "@/context/AuthContext";
import { createClub, type ClubCategory } from "@/lib/clubRegistry";
import { apiCreateClub } from "@/lib/clubsApi";
import { ClubAvatarUpload } from "@/components/ClubAvatarUpload";
import { ClubBackgroundPicker } from "@/components/ClubBackgroundPicker";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
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
  Camera,
  Video,
  Play,
  Mail,
  Phone,
  KeyRound,
} from "lucide-react";

import { authFetch } from "@/lib/apiFetch";
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
  instagram: string;
  tiktok: string;
  youtube: string;
  linktree: string;
  contactEmail: string;
  contactPhone: string;
  meetingSchedule: string;
  meetingDay: string;
  meetingTime: string;
  meetingNotes: string;
  joinPolicy: "public" | "approval" | "invite";
  intakeQuestions: string;
  status: "draft" | "published";
  isPublic: boolean;
  /** Base64 data URL for the club avatar (null = use initials) */
  avatarUrl: string | null;
  /** /manus-storage path for the selected background template (null = default) */
  backgroundImage: string | null;
}

const DEFAULT_DATA: WizardData = {
  name: "",
  tagline: "",
  category: "club",
  location: "",
  country: "US",
  description: "",
  accentColor: "#436850",
  website: "",
  discord: "",
  instagram: "",
  tiktok: "",
  youtube: "",
  linktree: "",
  contactEmail: "",
  contactPhone: "",
  meetingSchedule: "weekly",
  meetingDay: "",
  meetingTime: "",
  meetingNotes: "",
  joinPolicy: "public",
  intakeQuestions: "",
  status: "published",
  isPublic: true,
  avatarUrl: null,
  backgroundImage: null,
};

// ── Constants ─────────────────────────────────────────────────────────────────

const TOTAL_STEPS = 7; // 6 input steps + 1 success screen

const ACCENT_COLORS = [
  // Greens
  { hex: "#4CAF50", label: "Forest Green" },
  { hex: "#22c55e", label: "Emerald" },
  { hex: "#16a34a", label: "Deep Green" },
  { hex: "#86efac", label: "Mint" },
  { hex: "#a3e635", label: "Lime" },
  { hex: "#14b8a6", label: "Teal" },
  // Blues
  { hex: "#3b82f6", label: "Royal Blue" },
  { hex: "#0ea5e9", label: "Sky Blue" },
  { hex: "#06b6d4", label: "Cyan" },
  { hex: "#6366f1", label: "Indigo" },
  { hex: "#8b5cf6", label: "Violet" },
  { hex: "#1d4ed8", label: "Deep Blue" },
  // Warm
  { hex: "#f59e0b", label: "Amber" },
  { hex: "#f97316", label: "Orange" },
  { hex: "#ef4444", label: "Red" },
  { hex: "#dc2626", label: "Crimson" },
  { hex: "#e11d48", label: "Rose" },
  { hex: "#ec4899", label: "Pink" },
  { hex: "#d946ef", label: "Fuchsia" },
  { hex: "#c026d3", label: "Purple" },
  // Chess-themed
  { hex: "#b45309", label: "Chestnut" },
  { hex: "#92400e", label: "Mahogany" },
  { hex: "#78350f", label: "Walnut" },
  // Neutrals & Metallics
  { hex: "#fbbf24", label: "Gold" },
  { hex: "#d4af37", label: "Classic Gold" },
  { hex: "#c0c0c0", label: "Platinum" },
  { hex: "#94a3b8", label: "Slate" },
  { hex: "#e2e8f0", label: "Silver" },
  { hex: "#ffffff", label: "White" },
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
    eyebrow: "Step 1 of 6",
    title: "Name your\nclub",
    body: "Give your club a name that players will remember. A great tagline tells visitors what you're about in one sentence.",
    icon: <img src="https://d2xsxph8kpxj0f.cloudfront.net/117675823/J6FsDoRMH9x5xbUvpyzxyf/otb-logo-thumbnail_8939ab7b.png" alt="OTB" className="w-10 h-10 object-contain drop-shadow-sm" />,
  },
  {
    eyebrow: "Step 2 of 6",
    title: "Choose a\ncategory",
    body: "Help players find you. Selecting the right category puts your club in front of the right audience.",
    icon: <Users className="w-10 h-10 text-white" strokeWidth={1.5} />,
  },
  {
    eyebrow: "Step 3 of 6",
    title: "Where are\nyou based?",
    body: "Location helps nearby players discover your club and lets you appear in local search results.",
    icon: <MapPin className="w-10 h-10 text-white" strokeWidth={1.5} />,
  },
  {
    eyebrow: "Step 4 of 6",
    title: "Tell your\nstory",
    body: "A compelling description and a distinctive colour make your club page stand out.",
    icon: <Sparkles className="w-10 h-10 text-white" strokeWidth={1.5} />,
  },
  {
    eyebrow: "Step 5 of 6",
    title: "Connect &\nschedule",
    body: "Add your social links and meeting schedule so players know when and where to find you.",
    icon: <Link2 className="w-10 h-10 text-white" strokeWidth={1.5} />,
  },
  {
    eyebrow: "Step 6 of 6",
    title: "Membership\nsettings",
    body: "Choose how players join your club and whether it's publicly discoverable.",
    icon: <Globe className="w-10 h-10 text-white" strokeWidth={1.5} />,
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
  const [createdClubSlug, setCreatedClubSlug] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [creating, setCreating] = useState(false);
  const [, _startTransition] = useTransition();
  const nameRef = useRef<HTMLInputElement>(null);

  // Focus first input on mount
  useEffect(() => {
    setTimeout(() => nameRef.current?.focus(), 100);
  }, []);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Enter" && step < TOTAL_STEPS && !animating) {
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

  const handleNext = async () => {
    if (step === TOTAL_STEPS) return;
    if (creating) return;
    const err = validateStep(step, data);
    if (err) { setError(err); return; }
    setError(null);

    // On step 6 → create the club (server-first)
    if (step === 6) {
      if (!user) { toast.error("Sign in to create a club"); return; }
      setCreating(true);
      try {
        // 1. If the user uploaded an avatar (base64 data URL), upload it to the
        //    server first so we store a served URL instead of a raw base64 string.
        //    This avoids the varchar(500) truncation and the 512kb JSON body limit.
        let resolvedAvatarUrl: string | null = data.avatarUrl;
        if (data.avatarUrl && data.avatarUrl.startsWith("data:image/")) {
          const uploadRes = await authFetch("/api/clubs/upload-avatar", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ dataUrl: data.avatarUrl }),
          });
          if (uploadRes.ok) {
            const { url } = await uploadRes.json() as { url: string };
            resolvedAvatarUrl = url;
          } else {
            // Avatar upload failed — continue without avatar rather than blocking
            logger.warn("[CreateClubWizard] Avatar upload failed, continuing without avatar");
            resolvedAvatarUrl = null;
          }
        }

        const clubData = {
          name: data.name.trim(),
          tagline: data.tagline.trim(),
          category: data.category,
          location: data.location.trim(),
          country: data.country,
          description: data.description.trim(),
          accentColor: data.accentColor,
          avatarUrl: resolvedAvatarUrl,
          bannerUrl: null as null,
          backgroundImage: data.backgroundImage || undefined,
          ownerId: user.id,
          ownerName: user.displayName,
          isPublic: data.isPublic,
          website: data.website.trim() || undefined,
          discord: data.discord.trim() || undefined,
          instagram: data.instagram.trim() || undefined,
          tiktok: data.tiktok.trim() || undefined,
          youtube: data.youtube.trim() || undefined,
          linktree: data.linktree.trim() || undefined,
          contactEmail: data.contactEmail.trim() || undefined,
          contactPhone: data.contactPhone.trim() || undefined,
          meetingSchedule: data.meetingSchedule || undefined,
          meetingDay: data.meetingDay.trim() || undefined,
          meetingTime: data.meetingTime.trim() || undefined,
          meetingNotes: data.meetingNotes.trim() || undefined,
          joinPolicy: data.joinPolicy,
          intakeQuestions: data.intakeQuestions.trim() || undefined,
          status: data.status,
        };

        // 2. Persist to localStorage immediately (offline-capable, instant feedback)
        const localClub = createClub(
          clubData,
          { userId: user.id, displayName: user.displayName, avatarUrl: user.avatarUrl }
        );

        // 3. Persist to server (required so club appears in Discover for all users)
        const serverClub = await apiCreateClub({ ...clubData, id: localClub.id });
        if (!serverClub) {
          setCreating(false);
          setError("Failed to save club to server. Please check your connection and try again.");
          toast.error("Club creation failed — please try again.");
          return;
        }

        setCreatedClubId(serverClub.id);
        setCreatedClubSlug((serverClub as { id: string; slug?: string }).slug ?? null);
        setCreating(false);
      } catch (err) {
        logger.error("[CreateClubWizard] handleNext error:", err);
        setCreating(false);
        const msg = err instanceof Error ? err.message : "An unexpected error occurred";
        setError(msg);
        toast.error("Club creation failed — " + msg);
        return;
      }
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

  // Use the server-returned slug (most reliable) for share links
  const clubSlug = createdClubSlug
    || (createdClubId
      ? data.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
      : "");
  const clubUrl = createdClubId
    ? `https://chessotb.club/clubs/${clubSlug || createdClubId}`
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
    // Navigate using slug if available (matches the server-side route resolution)
    if (createdClubId) navigate(`/clubs/${createdClubSlug || createdClubId}`);
  };

  // ── Colour palette ──────────────────────────────────────────────────────────
  const bg = isDark ? "bg-[#0d1a0f]" : "bg-white";
  const heroBg = isDark ? "bg-[#1a2e1d]" : "bg-[#436850]";
  const inputBg = isDark
    ? "bg-white/6 border-white/10 text-white placeholder:text-white/30 focus:border-[#4CAF50]"
    : "bg-[#FBFADA]/70 border-[#ADBC9F] text-[#12372A] placeholder:text-[#436850]/60 focus:border-[#436850]";
  const textMain = isDark ? "text-white" : "text-[#12372A]";
  const textMuted = isDark ? "text-white/50" : "text-[#436850]";
  const labelCls = isDark ? "text-white/60" : "text-[#436850]";
  const divider = isDark ? "border-white/8" : "border-[#ADBC9F]/70";
  const cardBorder = isDark ? "border-white/8" : "border-[#ADBC9F]";

  // Progress bar width
  const progressPct = step === TOTAL_STEPS ? 100 : ((step - 1) / 6) * 100;

  // Animation classes
  const panelClass = animating
    ? direction === "forward"
      ? "opacity-0 translate-x-4"
      : "opacity-0 -translate-x-4"
    : "opacity-100 translate-x-0";

  const hero = STEP_HERO[Math.min(step - 1, 5)];

  return createPortal(
    <div
      className={`fixed inset-0 z-50 flex flex-col ${bg}`}
      role="dialog"
      aria-modal="true"
      aria-label="Create Club"
    >
      {/* ── Progress bar ─────────────────────────────────────────────────── */}
      <div className={`h-0.5 w-full ${isDark ? "bg-white/8" : "bg-[#ADBC9F]/40"}`}>
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
            isDark ? "text-white/50 hover:text-white" : "text-[#436850] hover:text-[#12372A]"
          }`}
        >
          <ChevronLeft className="w-4 h-4" />
          {step === 1 ? "Cancel" : "Back"}
        </button>

        <div className="flex items-center gap-2">
          {step < TOTAL_STEPS && Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className={`rounded-full transition-all duration-300 ${
                i + 1 < step
                  ? "w-2 h-2 bg-[#4CAF50]"
                  : i + 1 === step
                  ? "w-5 h-2 bg-[#4CAF50]"
                  : isDark
                  ? "w-2 h-2 bg-white/15"
                  : "w-2 h-2 bg-[#ADBC9F]"
              }`}
            />
          ))}
        </div>

        <button
          onClick={onClose}
          className={`p-2 rounded-xl transition-colors ${
            isDark ? "text-white/40 hover:text-white hover:bg-white/8" : "text-[#436850] hover:text-[#12372A] hover:bg-[#ADBC9F]/50"
          }`}
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* ── Body ─────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        {step < TOTAL_STEPS ? (
          /* Two-column layout for steps 1-6 */
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
                Create Club · Step {step} of 6
              </div>
            </div>

            {/* Right input panel */}
            <div className="flex-1 flex flex-col justify-center px-4 sm:px-8 lg:px-12 py-8 max-w-xl lg:max-w-none mx-auto w-full">

              {/* Mobile step label */}
              <p className={`lg:hidden text-xs font-semibold uppercase tracking-widest mb-2 ${isDark ? "text-[#4CAF50]" : "text-[#436850]"}`}>
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
                {step === 5 && (
                  <Step5Socials
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
                {step === 6 && (
                  <Step6Membership
                    data={data}
                    patch={patch}
                    isDark={isDark}
                    inputBg={inputBg}
                    textMain={textMain}
                    textMuted={textMuted}
                    labelCls={labelCls}
                    divider={divider}
                    cardBorder={cardBorder}
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
                disabled={creating}
                className="mt-8 w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-base font-semibold bg-[#436850] text-white hover:bg-[#3a5230] active:scale-98 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {creating ? (
                  <>
                    <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                    </svg>
                    Creating Club...
                  </>
                ) : (
                  <>
                    {step === 6 ? (creating ? "Creating Club..." : "Create Club") : "Continue"}
                    <ChevronRight className="w-5 h-5" />
                  </>
                )}
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
          aria-label="Club Name"
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
          aria-label="Club Tagline"
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
      <div className={`flex items-center justify-between gap-4 p-4 rounded-2xl border ${isDark ? "border-white/8 bg-white/3" : "border-[#ADBC9F]/70 bg-[#FBFADA]/70"}`}>
        <div className="min-w-0">
          <p className={`text-sm font-semibold ${textMain}`}>
            {data.isPublic ? "Public club" : "Private club"}
          </p>
          <p className={`text-xs mt-0.5 ${textMuted}`}>
            {data.isPublic ? "Visible in discovery and search" : "Invite-only — not listed publicly"}
          </p>
        </div>
        {/* Clean iOS-style pill toggle */}
        <button
          type="button"
          role="switch"
          aria-checked={data.isPublic}
          onClick={() => patch({ isPublic: !data.isPublic })}
          className={`relative flex-shrink-0 w-12 h-7 rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4CAF50] focus-visible:ring-offset-2 ${
            data.isPublic
              ? "bg-[#4CAF50]"
              : isDark ? "bg-white/20" : "bg-[#ADBC9F]"
          }`}
        >
          <span
            className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
              data.isPublic ? "translate-x-5" : "translate-x-0"
            }`}
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
                  : "border-[#436850] bg-[#436850]/8"
                : `${cardBorder} ${isDark ? "hover:bg-white/4" : "hover:bg-[#FBFADA]"}`
            }`}
          >
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${
                selected
                  ? "bg-[#436850] text-white"
                  : isDark
                  ? "bg-white/8 text-white/50"
                  : "bg-[#ADBC9F]/40 text-[#436850]"
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
          aria-label="Club City"
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
            aria-label="Club Country"
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
          <div className={`absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none ${isDark ? "text-white/40" : "text-[#436850]"}`}>
            ▾
          </div>
        </div>
      </div>

      {/* Location preview */}
      {data.location && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-2xl ${isDark ? "bg-white/5" : "bg-[#FBFADA]/70"}`}>
          <MapPin className={`w-4 h-4 flex-shrink-0 ${isDark ? "text-[#4CAF50]" : "text-[#436850]"}`} />
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
  data, patch, isDark: _isDark, inputBg, textMain: _textMain, textMuted, labelCls, divider,
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
          aria-label="Club Description"
          value={data.description}
          onChange={(e) => patch({ description: e.target.value })}
          placeholder="Tell players about your club — history, what you do, who's welcome, when you meet…"
          maxLength={500}
          rows={5}
          className={`w-full px-4 py-3.5 rounded-2xl border text-sm outline-none transition-colors resize-none leading-relaxed ${inputBg}`}
        />
      </div>

      {/* Background Image */}
      <div className={`pt-4 border-t ${divider}`}>
        <ClubBackgroundPicker
          value={data.backgroundImage}
          onChange={(path) => patch({ backgroundImage: path })}
          accent={data.accentColor}
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
            aria-label="Website URL"
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
            aria-label="Discord Server URL"
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
  const card = isDark ? "bg-[#1a2e1d]" : "bg-[#FBFADA]/70";

  return (
    <div className="flex flex-col items-center justify-center min-h-full px-4 py-12 text-center max-w-md mx-auto">
      {/* Success icon */}
      <div className="w-20 h-20 rounded-3xl bg-[#436850] flex items-center justify-center mb-6 shadow-xl shadow-[#436850]/30">
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
                : "bg-[#ADBC9F] text-[#436850] hover:bg-[#ADBC9F]"
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
          className="group w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-base font-semibold bg-[#436850] text-white hover:bg-[#3a5230] transition-colors"
        >
          View Club Page
          <ArrowRight className="w-5 h-5 transition-transform duration-200 ease-out group-hover:translate-x-1" />
        </button>
        <button
          onClick={onShare}
          className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl text-sm font-semibold transition-colors border ${
            isDark
              ? "border-white/10 text-white/70 hover:bg-white/5"
              : "border-[#ADBC9F] text-[#436850] hover:bg-[#FBFADA]"
          }`}
        >
          <Share2 className="w-4 h-4" />
          Share Club
        </button>
      </div>
    </div>
  );
}

// ── Step 5: Socials & Schedule ────────────────────────────────────────────────

function Step5Socials({
  data, patch, isDark, inputBg, textMain: _textMain, textMuted, labelCls, divider,
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
  const iconCls = `absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none ${textMuted}`;

  return (
    <div className="space-y-5">
      {/* Social links */}
      <div className="space-y-3">
        <p className={`text-xs font-semibold uppercase tracking-wider ${textMuted}`}>
          Social Links (optional)
        </p>
        {/* Website */}
        <div className="relative">
          <Globe className={iconCls} />
          <input type="url" value={data.website} onChange={(e) => patch({ website: e.target.value })}
            aria-label="Website URL"
            placeholder="https://yourclub.org"
            className={`w-full pl-10 pr-4 py-3 rounded-2xl border text-sm outline-none transition-colors ${inputBg}`} />
        </div>
        {/* Discord */}
        <div className="relative">
          <MessageSquare className={iconCls} />
          <input type="url" value={data.discord} onChange={(e) => patch({ discord: e.target.value })}
            aria-label="Discord Server URL"
            placeholder="https://discord.gg/yourserver"
            className={`w-full pl-10 pr-4 py-3 rounded-2xl border text-sm outline-none transition-colors ${inputBg}`} />
        </div>
        {/* Instagram */}
        <div className="relative">
          <Camera className={iconCls} />
          <input type="text" value={data.instagram} onChange={(e) => patch({ instagram: e.target.value })}
            aria-label="Instagram Handle"
            placeholder="@yourclub (Instagram)"
            className={`w-full pl-10 pr-4 py-3 rounded-2xl border text-sm outline-none transition-colors ${inputBg}`} />
        </div>
        {/* TikTok */}
        <div className="relative">
          <Video className={iconCls} />
          <input type="text" value={data.tiktok} onChange={(e) => patch({ tiktok: e.target.value })}
            aria-label="TikTok Handle"
            placeholder="@yourclub (TikTok)"
            className={`w-full pl-10 pr-4 py-3 rounded-2xl border text-sm outline-none transition-colors ${inputBg}`} />
        </div>
        {/* YouTube */}
        <div className="relative">
          <Play className={iconCls} />
          <input type="url" value={data.youtube} onChange={(e) => patch({ youtube: e.target.value })}
            aria-label="YouTube Channel URL"
            placeholder="https://youtube.com/@yourclub"
            className={`w-full pl-10 pr-4 py-3 rounded-2xl border text-sm outline-none transition-colors ${inputBg}`} />
        </div>
        {/* Linktree */}
        <div className="relative">
          <Link2 className={iconCls} />
          <input type="url" value={data.linktree} onChange={(e) => patch({ linktree: e.target.value })}
            aria-label="Linktree URL"
            placeholder="https://linktr.ee/yourclub"
            className={`w-full pl-10 pr-4 py-3 rounded-2xl border text-sm outline-none transition-colors ${inputBg}`} />
        </div>
      </div>

      {/* Meeting schedule */}
      <div className={`pt-4 border-t ${divider} space-y-3`}>
        <p className={`text-xs font-semibold uppercase tracking-wider ${textMuted}`}>
          Meeting Schedule (optional)
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={`block text-xs font-medium mb-1.5 ${labelCls}`}>Day</label>
            <input type="text" value={data.meetingDay} onChange={(e) => patch({ meetingDay: e.target.value })}
              aria-label="Meeting Day"
              placeholder="e.g. Every Tuesday"
              className={`w-full px-3 py-2.5 rounded-2xl border text-sm outline-none transition-colors ${inputBg}`} />
          </div>
          <div>
            <label className={`block text-xs font-medium mb-1.5 ${labelCls}`}>Time</label>
            <input type="text" value={data.meetingTime} onChange={(e) => patch({ meetingTime: e.target.value })}
              aria-label="Meeting Time"
              placeholder="e.g. 7:00 PM"
              className={`w-full px-3 py-2.5 rounded-2xl border text-sm outline-none transition-colors ${inputBg}`} />
          </div>
        </div>
        <input type="text" value={data.meetingNotes} onChange={(e) => patch({ meetingNotes: e.target.value })}
          aria-label="Additional meeting notes"
          placeholder="Additional notes (venue, parking, etc.)"
          className={`w-full px-4 py-3 rounded-2xl border text-sm outline-none transition-colors ${inputBg}`} />
      </div>

      {/* Contact */}
      <div className={`pt-4 border-t ${divider} space-y-3`}>
        <p className={`text-xs font-semibold uppercase tracking-wider ${textMuted}`}>
          Contact (optional)
        </p>
        <div className="relative">
          <Mail className={iconCls} />
          <input type="email" value={data.contactEmail} onChange={(e) => patch({ contactEmail: e.target.value })}
            aria-label="Contact Email"
            placeholder="club@email.com"
            className={`w-full pl-10 pr-4 py-3 rounded-2xl border text-sm outline-none transition-colors ${inputBg}`} />
        </div>
        <div className="relative">
          <Phone className={iconCls} />
          <input type="tel" value={data.contactPhone} onChange={(e) => patch({ contactPhone: e.target.value })}
            aria-label="Contact Phone"
            placeholder="+1 (555) 000-0000"
            className={`w-full pl-10 pr-4 py-3 rounded-2xl border text-sm outline-none transition-colors ${inputBg}`} />
        </div>
      </div>
    </div>
  );
}

// ── Step 6: Membership & Publish ──────────────────────────────────────────────

function Step6Membership({
  data, patch, isDark, inputBg: _inputBg, textMain, textMuted, labelCls: _labelCls, divider, cardBorder,
}: {
  data: WizardData;
  patch: (f: Partial<WizardData>) => void;
  isDark: boolean;
  inputBg: string;
  textMain: string;
  textMuted: string;
  labelCls: string;
  divider: string;
  cardBorder: string;
}) {
  const JOIN_POLICIES = [
    {
      value: "public" as const,
      label: "Open to All",
      desc: "Anyone can join instantly — no approval needed.",
      icon: <Globe className="w-5 h-5" />,
    },
    {
      value: "approval" as const,
      label: "Request to Join",
      desc: "Players request membership; you approve or decline.",
      icon: <Users className="w-5 h-5" />,
    },
    {
      value: "invite" as const,
      label: "Invite Only",
      desc: "Members can only join via a direct invite link.",
      icon: <KeyRound className="w-5 h-5" />,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Join policy */}
      <div>
        <p className={`text-sm font-semibold mb-3 ${textMain}`}>How do players join?</p>
        <div className="space-y-2.5">
          {JOIN_POLICIES.map((policy) => {
            const selected = data.joinPolicy === policy.value;
            return (
              <button
                key={policy.value}
                type="button"
                onClick={() => patch({ joinPolicy: policy.value })}
                className={`w-full flex items-start gap-3 px-4 py-3.5 rounded-2xl border text-left transition-all ${
                  selected
                    ? isDark
                      ? "border-[#4CAF50]/60 bg-[#4CAF50]/10"
                      : "border-[#436850]/50 bg-[#436850]/8"
                    : isDark
                    ? "border-white/8 hover:border-white/20"
                    : "border-[#ADBC9F] hover:border-[#ADBC9F]"
                }`}
              >
                <div className={`mt-0.5 flex-shrink-0 ${selected ? "text-[#4CAF50]" : textMuted}`}>
                  {policy.icon}
                </div>
                <div>
                  <p className={`text-sm font-semibold ${textMain}`}>{policy.label}</p>
                  <p className={`text-xs mt-0.5 leading-snug ${textMuted}`}>{policy.desc}</p>
                </div>
                {selected && (
                  <div className="ml-auto flex-shrink-0 mt-0.5">
                    <Check className="w-4 h-4 text-[#4CAF50]" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Visibility */}
      <div className={`pt-4 border-t ${divider}`}>
        <div className="flex items-center justify-between">
          <div>
            <p className={`text-sm font-semibold ${textMain}`}>Public Club</p>
            <p className={`text-xs mt-0.5 ${textMuted}`}>Visible in search and the Clubs directory</p>
          </div>
          <button
            type="button"
            onClick={() => patch({ isPublic: !data.isPublic })}
            className={`relative w-11 h-6 rounded-full transition-colors ${
              data.isPublic ? "bg-[#4CAF50]" : isDark ? "bg-white/15" : "bg-[#ADBC9F]"
            }`}
          >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
              data.isPublic ? "translate-x-5" : "translate-x-0"
            }`} />
          </button>
        </div>
      </div>

      {/* Draft vs Publish */}
      <div className={`pt-4 border-t ${divider}`}>
        <p className={`text-sm font-semibold mb-3 ${textMain}`}>Ready to go live?</p>
        <div className="grid grid-cols-2 gap-3">
          {(["published", "draft"] as const).map((s) => {
            const selected = data.status === s;
            return (
              <button
                key={s}
                type="button"
                onClick={() => patch({ status: s })}
                className={`flex flex-col items-center gap-1.5 px-4 py-3.5 rounded-2xl border transition-all ${
                  selected
                    ? isDark
                      ? "border-[#4CAF50]/60 bg-[#4CAF50]/10"
                      : "border-[#436850]/50 bg-[#436850]/8"
                    : isDark
                    ? "border-white/8 hover:border-white/20"
                    : "border-[#ADBC9F] hover:border-[#ADBC9F]"
                }`}
              >
                {s === "published" ? (
                  <Globe className={`w-5 h-5 ${selected ? "text-[#4CAF50]" : textMuted}`} />
                ) : (
                  <BookOpen className={`w-5 h-5 ${selected ? "text-[#4CAF50]" : textMuted}`} />
                )}
                <p className={`text-sm font-semibold ${textMain}`}>
                  {s === "published" ? "Publish Now" : "Save as Draft"}
                </p>
                <p className={`text-xs text-center leading-snug ${textMuted}`}>
                  {s === "published" ? "Club goes live immediately" : "Finish later, not visible yet"}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Summary card */}
      <div className={`rounded-2xl border ${cardBorder} ${isDark ? "bg-white/3" : "bg-[#FBFADA]/70"} p-4`}>
        <p className={`text-xs font-semibold uppercase tracking-wider mb-2 ${textMuted}`}>Summary</p>
        <p className={`text-sm font-bold ${textMain}`}>{data.name || "—"}</p>
        <p className={`text-xs mt-0.5 ${textMuted}`}>{data.tagline || "No tagline"}</p>
        <p className={`text-xs mt-1 ${textMuted}`}>
          {data.location ? `${data.location}${data.country ? `, ${data.country}` : ""}` : "No location"}
          {" · "}
          {data.joinPolicy === "public" ? "Open" : data.joinPolicy === "approval" ? "Approval" : "Invite Only"}
          {" · "}
          {data.status === "published" ? "🟢 Live" : "📝 Draft"}
        </p>
      </div>
    </div>
  );
}
