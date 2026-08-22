/**
 * OTB Chess — Tournament Performance Report Page
 * Route: /tournament/:id/report
 *
 * v6: Added per-card accent color picker (8-swatch palette) below each
 * player card. Choosing a swatch instantly updates the visible card and
 * the hidden export-quality card so the exported PNG reflects the chosen
 * color. Accent state is stored in a Map keyed by player id.
 */
import { useState, useRef, useCallback, useEffect } from "react";
import confetti from "canvas-confetti";
import { useChessAvatars, toProxiedAvatarUrl } from "@/hooks/useChessAvatar";
import { useClubAvatar } from "@/hooks/useClubAvatar";
import { useParams, Link, useLocation, useSearch } from "wouter";
import { NavLogo } from "@/components/NavLogo";
import { toast } from "sonner";

import { useTheme } from "@/contexts/ThemeContext";
import { ThemeToggle } from "@/components/ThemeToggle";
import { loadTournamentState } from "@/lib/directorState";
import { getTournamentConfig } from "@/lib/tournamentRegistry";
import { SpinBorderButton } from "@/components/ui/spin-border-button";
import { computeAllPerformances, computeQuadSectionPerformances, type PlayerPerformance, type QuadSectionPerformances } from "@/lib/performanceStats";
import { generateResultsPdf } from "@/lib/generateResultsPdf";
import { DEMO_TOURNAMENT } from "@/lib/tournamentData";
import { calculateCompletedGameDrawRate } from "@/lib/reportMetrics";
import PlayerStatsCard, {
  ACCENT_PALETTE,
  defaultAccentForBadge,
  type AccentSwatch,
} from "@/components/PlayerStatsCard";
import CrossTable from "@/components/CrossTable";
import RoundTimeline from "@/components/RoundTimeline";
import { ShareResultsModal, useShareModal } from "@/components/ShareResultsModal";
import PlayerCardExpandedModal from "@/components/PlayerCardExpandedModal";
import { OTBLoader } from "@/components/OTBLoader";
import {
  ChevronLeft,
  Download,
  Share2,
  Trophy,
  Users,
  BarChart3,
  Search,
  Crown,
  Loader2,
  ImageDown,
  Grid3x3,
  ListOrdered,
  LayoutGrid,
  MessageCircle,
  CheckCheck,
  Palette,
  ChevronRight,
  FileText,
  Instagram,
  Expand,
} from "lucide-react";

/** True on touch-primary devices (phones/tablets). */
const isTouchDevice = () =>
  typeof window !== "undefined" &&
  ("ontouchstart" in window || navigator.maxTouchPoints > 0);

// ─── Tab type ─────────────────────────────────────────────────────────────────
type ReportTab = "cards" | "crosstable" | "rounds";

// ─── Tab Bar ─────────────────────────────────────────────────────────────────
function TabBar({
  activeTab,
  onTabChange,
  isDark,
}: {
  activeTab: ReportTab;
  onTabChange: (tab: ReportTab) => void;
  isDark: boolean;
}) {
  const tabs: { id: ReportTab; label: string; icon: React.ElementType }[] = [
    { id: "cards",      label: "Player Cards",  icon: LayoutGrid  },
    { id: "crosstable", label: "Cross-Table",   icon: Grid3x3     },
    { id: "rounds",     label: "Rounds",        icon: ListOrdered },
  ];
  return (
    <div
      role="tablist"
      aria-label="Report sections"
      className={`flex border-b ${ isDark ? "border-white/08" : "border-[#ADBC9F]/70" }`}
      onKeyDown={(e) => {
        const ids = tabs.map(t => t.id);
        const idx = ids.indexOf(activeTab);
        if (e.key === "ArrowRight") { e.preventDefault(); onTabChange(ids[(idx + 1) % ids.length]); }
        if (e.key === "ArrowLeft")  { e.preventDefault(); onTabChange(ids[(idx - 1 + ids.length) % ids.length]); }
        if (e.key === "Home") { e.preventDefault(); onTabChange(ids[0]); }
        if (e.key === "End")  { e.preventDefault(); onTabChange(ids[ids.length - 1]); }
      }}
    >
      {tabs.map(({ id, label, icon: Icon }) => {
        const isActive = activeTab === id;
        return (
          <button
            key={id}
            role="tab"
            aria-selected={isActive}
            aria-controls={`tabpanel-${id}`}
            id={`tab-${id}`}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onTabChange(id)}
            className={`relative flex items-center gap-1.5 px-5 py-3 text-xs font-semibold transition-all ${
              isActive
                ? isDark ? "text-[#4CAF50]" : "text-[#436850]"
                : isDark ? "text-white/40 hover:text-white/70" : "text-[#436850]/70 hover:text-[#436850]"
            }`}
          >
            <Icon className="w-3.5 h-3.5 flex-shrink-0" />
            <span>{label}</span>
            {isActive && (
              <span
                className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t-full"
                style={{ background: isDark ? "#4CAF50" : "#436850" }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─── Export helper ────────────────────────────────────────────────────────────
/**
 * Export a DOM element as a PNG download.
 *
 * Uses html-to-image (not html2canvas) because html2canvas 1.4.1 does not
 * support the oklch() color function used throughout the OTB design system,
 * causing a silent throw and the "Export failed" toast.
 *
 * html-to-image serialises the element to SVG via the browser's native
 * rendering engine, so all modern CSS (oklch, backdrop-filter, etc.) works.
 * Avatar images are already served through /api/avatar-proxy with
 * Access-Control-Allow-Origin: * so cross-origin fetch succeeds.
 */
async function exportCardAsPng(
  element: HTMLElement,
  filename: string
): Promise<void> {
  const { toPng } = await import("html-to-image");
  const dataUrl = await toPng(element, {
    pixelRatio: 3,
    fetchRequestInit: { mode: "cors" },
    // Ensure the hidden off-screen element is fully captured
    width: element.offsetWidth || (element as HTMLElement).scrollWidth,
    height: element.offsetHeight || (element as HTMLElement).scrollHeight,
  });
  const link = document.createElement("a");
  link.download = filename;
  link.href = dataUrl;
  link.click();
}

/** Render a card element to a Blob (PNG). */
async function renderCardToBlob(element: HTMLElement): Promise<Blob> {
  const { toBlob } = await import("html-to-image");
  const blob = await toBlob(element, {
    pixelRatio: 3,
    fetchRequestInit: { mode: "cors" },
    width: element.offsetWidth || (element as HTMLElement).scrollWidth,
    height: element.offsetHeight || (element as HTMLElement).scrollHeight,
  });
  if (!blob) throw new Error("html-to-image toBlob returned null");
  return blob;
}

// ─── Summary Banner ───────────────────────────────────────────────────────────
function SummaryBanner({
  performances,
  rounds,
  tournamentName,
  isDark,
  isQuadsAllSections,
  numSections,
}: {
  performances: PlayerPerformance[];
  rounds: import("@/lib/tournamentData").Round[];
  tournamentName: string;
  isDark: boolean;
  /** When true (Quads all-sections view), suppress global champion and show section count instead. */
  isQuadsAllSections?: boolean;
  numSections?: number;
}) {
  const champion = performances[0];
  const avgPerf = Math.round(
    performances.reduce((s, p) => s + p.performanceRating, 0) / performances.length
  );
  const drawRate = calculateCompletedGameDrawRate(rounds);

  return (
    <div
      className={`rounded-2xl p-5 border mb-6 ${
        isDark
          ? "bg-[oklch(0.22_0.06_145)] border-white/10"
          : "bg-white border-[#ADBC9F]/70 shadow-sm"
      }`}
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className={`text-xs font-bold uppercase tracking-widest mb-1 ${isDark ? "text-white/40" : "text-[#436850]"}`}>
            Final Report
          </p>
          <h2
            className={`text-xl font-black ${isDark ? "text-white" : "text-[#12372A]"}`}
            style={{ fontFamily: "'Clash Display', sans-serif" }}
          >
            {tournamentName}
          </h2>
        </div>
        {/* For Quads all-sections view, there is no single global champion — each section has its own. */}
        {!isQuadsAllSections && (
          <div className="flex items-center gap-1.5">
            <Crown className="w-4 h-4 text-amber-500" />
            <span className={`text-sm font-bold ${isDark ? "text-white" : "text-[#12372A]"}`}>
              {champion?.player.name}
            </span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Players", value: performances.length, icon: Users },
          isQuadsAllSections
            ? { label: "Sections", value: numSections ?? "", icon: Trophy }
            : { label: "Champion Score", value: `${champion?.points ?? 0}pts`, icon: Trophy },
          { label: "Avg Performance", value: avgPerf, icon: BarChart3 },
          { label: "Draw Rate", value: `${drawRate}%`, icon: BarChart3 },
        ].map(({ label, value, icon: Icon }) => (
          <div
            key={label}
            className={`rounded-xl p-3 ${
              isDark ? "bg-white/06" : "bg-[#FBFADA]/70"
            }`}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <Icon className={`w-3 h-3 ${isDark ? "text-[#4CAF50]" : "text-[#436850]"}`} />
              <span className={`text-[10px] font-semibold uppercase tracking-wider ${isDark ? "text-white/40" : "text-[#436850]"}`}>
                {label}
              </span>
            </div>
            <span
              className={`text-lg font-black ${isDark ? "text-white" : "text-[#12372A]"}`}
              style={{ fontFamily: "'Clash Display', sans-serif" }}
            >
              {value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Accent Color Picker ──────────────────────────────────────────────────────
/**
 * A row of 8 color swatches that lets the player pick an accent color for
 * their card. The active swatch shows a white ring. Clicking a swatch calls
 * onChange with the new hex value.
 */
function AccentColorPicker({
  value,
  onChange,
  isDark,
}: {
  value: string;
  onChange: (hex: string) => void;
  isDark: boolean;
}) {
  return (
    <div
      className={`mt-2 rounded-2xl border px-3 py-2.5 ${
        isDark
          ? "bg-white/05 border-white/10"
          : "bg-[#FBFADA]/70 border-[#ADBC9F]"
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        <Palette className={`w-3 h-3 flex-shrink-0 ${isDark ? "text-white/40" : "text-[#436850]"}`} />
        <span className={`text-[10px] font-semibold uppercase tracking-wider ${isDark ? "text-white/40" : "text-[#436850]"}`}>
          Card Accent
        </span>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {ACCENT_PALETTE.map((swatch: AccentSwatch) => {
          const isActive = value.toLowerCase() === swatch.hex.toLowerCase();
          return (
            <button
              key={swatch.id}
              onClick={() => onChange(swatch.hex)}
              title={swatch.label}
              aria-label={`${swatch.label} accent color${isActive ? " (selected)" : ""}`}
              className="relative flex-shrink-0 transition-transform duration-150 hover:scale-110 active:scale-95"
              style={{ width: 24, height: 24 }}
            >
              {/* Outer ring when active */}
              {isActive && (
                <span
                  className="absolute inset-0 rounded-full"
                  style={{
                    boxShadow: `0 0 0 2px ${isDark ? "rgba(255,255,255,0.9)" : "rgba(0,0,0,0.7)"}`,
                    borderRadius: "50%",
                  }}
                />
              )}
              <span
                className="block rounded-full w-full h-full"
                style={{
                  background: swatch.hex,
                  boxShadow: isActive
                    ? `0 0 8px ${swatch.hex}80`
                    : "0 1px 3px rgba(0,0,0,0.3)",
                  transform: isActive ? "scale(0.82)" : "scale(1)",
                  transition: "transform 0.15s ease, box-shadow 0.15s ease",
                }}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Native Share Button ──────────────────────────────────────────────────────
function NativeShareButton({
  perf,
  tournamentName,
  exportRef,
  isDark,
}: {
  perf: PlayerPerformance;
  tournamentName: string;
  exportRef: React.RefObject<HTMLDivElement | null>;
  isDark: boolean;
}) {
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");

  const rankLabel = perf.rank === 1 ? "1st" : perf.rank === 2 ? "2nd" : perf.rank === 3 ? "3rd" : `${perf.rank}th`;
  const shareText = `I finished ${rankLabel} at ${tournamentName}! 🏆 ${perf.points} pts · Perf ${perf.performanceRating} · ${perf.wins}W ${perf.draws}D ${perf.losses}L #OTBChess`;

  const handleShare = useCallback(async () => {
    if (state === "loading") return;
    setState("loading");

    try {
      const el = exportRef.current;

      if (el) {
        const blob = await renderCardToBlob(el);
        const file = new File([blob], `${perf.player.username}-otbchess.png`, { type: "image/png" });

        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: `${perf.player.name} — ${tournamentName}`,
            text: shareText,
          });
          setState("done");
          setTimeout(() => setState("idle"), 2500);
          return;
        }

        if (typeof navigator.share === "function") {
          await navigator.share({
            title: `${perf.player.name} — ${tournamentName}`,
            text: shareText,
            url: window.location.href,
          });
          setState("done");
          setTimeout(() => setState("idle"), 2500);
          return;
        }

        try {
          await navigator.clipboard.write([
            new ClipboardItem({ "image/png": blob }),
          ]);
          toast.success("Card image copied to clipboard!", {
            description: "Paste it into WhatsApp, iMessage, or any app.",
          });
          setState("done");
          setTimeout(() => setState("idle"), 2500);
          return;
        } catch {
          // fall through to text copy
        }
      }

      await navigator.clipboard.writeText(shareText);
      toast.success("Stats copied to clipboard!", {
        description: "Paste into any message or post.",
      });
      setState("done");
      setTimeout(() => setState("idle"), 2500);
    } catch (err) {
      const cancelled =
        err instanceof Error &&
        (err.name === "AbortError" || err.message.includes("cancel"));
      if (!cancelled) {
        toast.error("Share failed — try the Download button instead.");
      }
      setState("idle");
    }
  }, [state, perf, tournamentName, shareText, exportRef]);

  return (
    <button
      onClick={handleShare}
      disabled={state === "loading"}
      aria-label={`Share ${perf.player.name}'s performance card`}
      className={`
        w-full flex items-center justify-center gap-2
        px-4 py-2.5 rounded-2xl text-sm font-semibold
        transition-all duration-200 select-none
        disabled:opacity-60 disabled:cursor-not-allowed
        ${
          state === "done"
            ? isDark
              ? "bg-[#4CAF50]/20 text-[#4CAF50] border border-[#4CAF50]/30"
              : "bg-[#436850]/10 text-[#436850] border border-[#436850]/20"
            : isDark
            ? "bg-white/08 text-white/80 hover:bg-white/14 border border-white/10 hover:border-white/20 active:scale-[0.98]"
            : "bg-[#FBFADA]/70 text-[#12372A]/85 hover:bg-[#ADBC9F]/50 border border-[#ADBC9F] active:scale-[0.98]"
        }
      `}
    >
      {state === "loading" ? (
        <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
      ) : state === "done" ? (
        <CheckCheck className="w-4 h-4 flex-shrink-0" />
      ) : (
        <Share2 className="w-4 h-4 flex-shrink-0" />
      )}
      {state === "done" ? "Shared!" : "Share My Performance"}
    </button>
  );
}

// ─── Card Wrapper with export controls ───────────────────────────────────────
function ExportableCard({
  perf,
  tournamentName,
  tournamentDate,
  isDark,
  avatarUrl,
  avatarStatus,
  onShareSingle,
  exportRef,
  accentColor,
  onAccentChange,
  chesscomWins,
  chesscomDraws,
  chesscomLosses,
  clubName,
}: {
  perf: PlayerPerformance;
  tournamentName: string;
  tournamentDate: string;
  isDark: boolean;
  avatarUrl?: string | null;
  avatarStatus?: "loading" | "loaded";
  onShareSingle: (perf: PlayerPerformance) => void;
  exportRef: React.RefObject<HTMLDivElement | null>;
  accentColor: string;
  onAccentChange: (hex: string) => void;
  chesscomWins?: number;
  chesscomDraws?: number;
  chesscomLosses?: number;
  clubName?: string;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);
  const [showExpanded, setShowExpanded] = useState(false);
  // Track whether the device is touch-primary so we can show actions persistently
  const [isTouch] = useState(() => isTouchDevice());

  const handleExport = useCallback(async () => {
    const target = exportRef.current ?? cardRef.current;
    if (!target) return;
    setExporting(true);
    try {
      const filename = `${perf.player.username}-${tournamentName.toLowerCase().replace(/\s+/g, "-")}.png`;
      await exportCardAsPng(target, filename);
      toast.success(`Card saved for ${perf.player.name}`);
    } catch {
      toast.error("Export failed — try again");
    } finally {
      setExporting(false);
    }
  }, [perf, tournamentName, exportRef]);

  // Instagram-optimised download: 1080×1350 PNG (4:5 portrait, ideal for feed + carousel)
  const handleInstagramDownload = useCallback(async () => {
    const target = exportRef.current ?? cardRef.current;
    if (!target) return;
    setExporting(true);
    try {
      const filename = `${perf.player.username}-instagram-${tournamentName.toLowerCase().replace(/\s+/g, "-")}.png`;
      await exportCardAsPng(target, filename);
      toast.success("Instagram card saved!", {
        description: "1080×1350 · Perfect for feed posts and carousel slides.",
      });
    } catch {
      toast.error("Export failed — try again");
    } finally {
      setExporting(false);
    }
  }, [perf, tournamentName, exportRef]);

  const handleShare = useCallback(async () => {
    const target = exportRef.current ?? cardRef.current;
    if (!target) return;
    setExporting(true);
    try {
      const blob = await renderCardToBlob(target);
      const file = new File([blob], `${perf.player.username}-stats.png`, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `${perf.player.name} — ${tournamentName}`,
          text: `Check out my performance at ${tournamentName}! 🏆 #OTBChess`,
        });
      } else {
        await navigator.clipboard.write([
          new ClipboardItem({ "image/png": blob }),
        ]);
        toast.success("Card copied to clipboard!");
      }
    } catch {
      toast.error("Share failed — try downloading instead");
    } finally {
      setExporting(false);
    }
  }, [perf, tournamentName, exportRef]);

  // Action buttons shared between the hover overlay (desktop) and the persistent bar (mobile)
  const ActionButtons = (
    <>
      <button
        onClick={() => setShowExpanded(true)}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-colors border border-white/20 text-white hover:bg-white/10 active:scale-95"
        style={{ background: accentColor + "22" }}
      >
        <Expand className="w-4 h-4" />
        View Full Card
      </button>
      <button
        onClick={handleInstagramDownload}
        disabled={exporting}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#833ab4] via-[#fd1d1d] to-[#fcb045] text-white font-semibold text-sm transition-all disabled:opacity-60 active:scale-95"
      >
        {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Instagram className="w-4 h-4" />}
        Save for Instagram
      </button>
      <button
        onClick={handleExport}
        disabled={exporting}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-[#12372A] font-semibold text-sm hover:bg-[#ADBC9F]/50 transition-colors disabled:opacity-60 active:scale-95"
      >
        {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageDown className="w-4 h-4" />}
        Download PNG
      </button>
      <button
        onClick={handleShare}
        disabled={exporting}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/20 text-white font-semibold text-sm hover:bg-white/30 transition-colors border border-white/30 disabled:opacity-60 active:scale-95"
      >
        <Share2 className="w-4 h-4" />
        Share Image
      </button>
      <button
        onClick={() => onShareSingle(perf)}
        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#25D366]/20 text-[#25D366] font-semibold text-sm hover:bg-[#25D366]/30 transition-colors border border-[#25D366]/30 active:scale-95"
      >
        <MessageCircle className="w-4 h-4" />
        Send via WhatsApp / Email
      </button>
    </>
  );

  return (
    <div className="group relative">
      {/* The visible card */}
      <PlayerStatsCard
        ref={cardRef}
        perf={perf}
        tournamentName={tournamentName}
        tournamentDate={tournamentDate}
        avatarUrl={avatarUrl}
        avatarStatus={avatarStatus}
        forExport={false}
        accentColor={accentColor}
        chesscomWins={chesscomWins}
        chesscomDraws={chesscomDraws}
        chesscomLosses={chesscomLosses}
        clubName={clubName}
      />

      {showExpanded && (
        <PlayerCardExpandedModal
          perf={perf}
          accentColor={accentColor}
          onClose={() => setShowExpanded(false)}
        />
      )}

      {/* Desktop hover overlay — hidden on touch devices */}
      {!isTouch && (
        <div className="absolute inset-0 rounded-3xl bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col items-center justify-center gap-2.5">
          {ActionButtons}
        </div>
      )}

      {/* Mobile persistent action bar — shown below the card on touch devices */}
      {isTouch && (
        <div className="mt-3 flex flex-col gap-2">
          {ActionButtons}
        </div>
      )}

      {/* ── Below-card controls: name label + color picker + share button ── */}
      <div className="mt-2">
        {/* Name / rank row */}
        <div className="text-center mb-2">
          <p className={`text-xs font-semibold ${isDark ? "text-white/70" : "text-[#436850]"}`}>
            {perf.player.name}
          </p>
          <p className={`text-[10px] ${isDark ? "text-white/40" : "text-[#436850]"}`}>
            #{perf.rank} · {perf.points}pts
          </p>
        </div>

        {/* Accent color picker */}
        <AccentColorPicker
          value={accentColor}
          onChange={onAccentChange}
          isDark={isDark}
        />

        {/* Native share button — shown on desktop only; mobile uses the persistent action bar above */}
        {!isTouch && (
          <div className="mt-2">
            <NativeShareButton
              perf={perf}
              tournamentName={tournamentName}
              exportRef={exportRef}
              isDark={isDark}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ReportPage() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const { id } = useParams<{ id: string }>();
  const tournamentId = id ?? "otb-demo-2026";

  // Load tournament data
  const isDemo = tournamentId === "otb-demo-2026";
  const config = getTournamentConfig(tournamentId);
  const localState = loadTournamentState(tournamentId);

  // ── Server hydration ─────────────────────────────────────────────────────
  // Mobile participants have sparse localStorage (only their own player entry
  // from addPlayerToTournament). Fetch the full DirectorState from the server
  // so every device sees all players and all rounds in the performance report.
  const [serverState, setServerState] = useState<import("@/lib/directorState").DirectorState | null>(null);
  const [serverLoading, setServerLoading] = useState(!isDemo);
  useEffect(() => {
    if (isDemo) return;
    fetch(`/api/tournament/${tournamentId}/state`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { state?: import("@/lib/directorState").DirectorState } | null) => {
        if (data?.state) {
          // Always prefer the server state — it is the authoritative full roster.
          // The director's device also benefits: server state is always at least
          // as fresh as localStorage after the 1500ms debounce.
          setServerState(data.state);
        }
      })
      .catch(() => { /* network unavailable — fall back to localStorage */ })
      .finally(() => setServerLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournamentId]);

  // Prefer server state (authoritative full roster) over localStorage
  const rawState = serverState ?? localState;
  const [, navigate] = useLocation();

  const players = isDemo ? DEMO_TOURNAMENT.players : (rawState?.players ?? []);
  const rounds = isDemo ? DEMO_TOURNAMENT.roundData : (rawState?.rounds ?? []);
  const tournamentName = config?.name ?? rawState?.tournamentName ?? DEMO_TOURNAMENT.name;
  const tournamentDate = config?.date ?? "";

  // ── Multi-Tournament Bracket context ────────────────────────────────────────
  const isBracketParent = !!config?.isBracketParent;
  const bracketGroupId = config?.bracketGroupId ?? null;
  const bracketLabel = config?.bracketLabel ?? (rawState as any)?.bracketLabel ?? null;
  const parentBracketGroupId = config?.parentBracketGroupId ?? (rawState as any)?.parentBracketGroupId ?? null;
  // For child brackets, find the parent tournament to link back
  const parentTournamentId = (() => {
    if (!parentBracketGroupId) return null;
    // Try to find parent from localStorage registry
    const registry = JSON.parse(localStorage.getItem("otb-tournaments") ?? "[]") as { id: string; bracketGroupId?: string; isBracketParent?: boolean }[];
    const parent = registry.find((t) => t.bracketGroupId === parentBracketGroupId && t.isBracketParent);
    return parent?.id ?? null;
  })();

  type ChildBracket = { tournamentId: string; label: string; order: number; format: string; rounds: number; status: string; playerCount: number };
  const [childBrackets, setChildBrackets] = useState<ChildBracket[]>([]);
  useEffect(() => {
    if (!isBracketParent || !bracketGroupId) return;
    fetch(`/api/brackets/${encodeURIComponent(bracketGroupId)}/brackets`)
      .then((r) => r.ok ? r.json() : null)
      .then((data: { brackets?: ChildBracket[] } | null) => {
        if (data?.brackets) setChildBrackets(data.brackets);
      })
      .catch(() => {});
  }, [isBracketParent, bracketGroupId]);

    const performances = computeAllPerformances(players, rounds);

  // ── Quads section-filtering ─────────────────────────────────────────────────
  const urlSearch = useSearch();
  const sectionParam = new URLSearchParams(urlSearch).get("section");
  const isQuads = !isDemo && rawState?.format === "quads";
  const quadSections = (rawState?.quadSections ?? []) as { id: string; name: string; type: "quad" | "bottom_swiss"; playerIds: string[] }[];

  const quadSectionPerfs: QuadSectionPerformances[] = isQuads
    ? computeQuadSectionPerformances(players, rounds, quadSections)
    : [];

  const [activeSection, setActiveSection] = useState<string>(sectionParam ?? "all");

  // Performances scoped to the active section (or all).
  // For Quads all-sections view, use the flattened section-scoped performances so that
  // each player's rank and points reflect their section, not a global ranking.
  const displayPerformances = isQuads
    ? (activeSection !== "all"
        ? (quadSectionPerfs.find(s => s.sectionId === activeSection)?.performances ?? performances)
        : quadSectionPerfs.flatMap(s => s.performances))
    : performances;

  const displayRounds = isQuads && activeSection !== "all"
    ? rounds.map((round) => ({
        ...round,
        games: round.games.filter((game) => game.sectionId === activeSection),
      }))
    : rounds;

  // Fetch club avatar for PDF branding
  const { avatarUrl: clubAvatarUrl } = useClubAvatar(config?.clubId ?? null);

  // Pre-fetch avatars for players who don't already have a stored avatarUrl.
  // Using player.avatarUrl directly avoids username-collision bugs where two
  // players with the same username (or a stale memCache entry) end up sharing
  // the same profile picture across multiple performance cards.
  const allUsernames = performances.map((p) => p.player.username);
  const usernamesNeedingFetch = performances
    .filter((p) => !p.player.avatarUrl && p.player.platform === "chesscom" && p.player.username)
    .map((p) => p.player.username);
  const { avatars: fetchedAvatars, allLoaded: fetchedLoaded } = useChessAvatars(usernamesNeedingFetch);

  // Build a unified id → url map: stored avatarUrl takes priority over fetched
  const avatarById = new Map<string, string | null>();
  for (const perf of performances) {
    const p = perf.player;
    if (p.avatarUrl) {
      avatarById.set(p.id, p.avatarUrl);
    } else {
      avatarById.set(p.id, fetchedAvatars.get(p.username.toLowerCase()) ?? null);
    }
  }
  const avatarsLoaded = performances.every((p) => p.player.avatarUrl) || fetchedLoaded;

  // chess.com recent form — keyed by lowercase username
  type ChesscomForm = { wins: number; draws: number; losses: number };
  const [chesscomForm, setChesscomForm] = useState<Map<string, ChesscomForm>>(new Map());
  useEffect(() => {
    if (allUsernames.length === 0) return;
    // Fetch analysis for each player in parallel, non-blocking
    allUsernames.forEach((username) => {
      const key = username.toLowerCase();
      fetch(`/api/chess/player/${encodeURIComponent(key)}/analysis`)
        .then((r) => r.ok ? r.json() : null)
        .then((data: { wins?: number; draws?: number; losses?: number } | null) => {
          if (!data || data.wins === undefined) return;
          setChesscomForm((prev) => {
            const next = new Map(prev);
            next.set(key, { wins: data.wins!, draws: data.draws ?? 0, losses: data.losses ?? 0 });
            return next;
          });
        })
        .catch(() => { /* silently ignore */ });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allUsernames.join(",")]);

  // Per-player accent color state — keyed by player id
  const [accentColors, setAccentColors] = useState<Map<string, string>>(() => {
    const m = new Map<string, string>();
    // Initialised lazily in the render loop below; this just seeds the Map
    return m;
  });

  function getAccent(perf: PlayerPerformance): string {
    return accentColors.get(perf.player.id) ?? defaultAccentForBadge(perf.badge);
  }

  function setAccent(playerId: string, hex: string) {
    setAccentColors((prev) => {
      const next = new Map(prev);
      next.set(playerId, hex);
      return next;
    });
  }

  // Map of hidden export-quality card refs, keyed by player id
  const exportRefs = useRef<Map<string, React.RefObject<HTMLDivElement | null>>>(new Map());
  function getExportRef(playerId: string): React.RefObject<HTMLDivElement | null> {
    if (!exportRefs.current.has(playerId)) {
      exportRefs.current.set(playerId, { current: null });
    }
    return exportRefs.current.get(playerId)!;
  }

  // Celebratory confetti + toast on auto-redirect from completed tournament
  useEffect(() => {
    if (isDemo) return;
    const key = `otb_redirect_complete_${tournamentId}`;
    if (sessionStorage.getItem(key)) {
      sessionStorage.removeItem(key);

      // Fire a multi-burst confetti sequence
      const fireConfetti = () => {
        // Left cannon
        confetti({
          particleCount: 80,
          angle: 60,
          spread: 55,
          origin: { x: 0, y: 0.65 },
          colors: ["#4CAF50", "#81C784", "#FFD700", "#FFFFFF", "#A5D6A7"],
          zIndex: 9999,
        });
        // Right cannon
        confetti({
          particleCount: 80,
          angle: 120,
          spread: 55,
          origin: { x: 1, y: 0.65 },
          colors: ["#4CAF50", "#81C784", "#FFD700", "#FFFFFF", "#A5D6A7"],
          zIndex: 9999,
        });
      };

      // Staggered bursts: immediate, 400ms, 800ms
      fireConfetti();
      const t1 = setTimeout(fireConfetti, 400);
      const t2 = setTimeout(fireConfetti, 800);

      // Toast after the first burst
      const t3 = setTimeout(() => {
        toast.success(
          `🏆 Tournament complete! Here are your results.`,
          { duration: 5000, description: tournamentName }
        );
      }, 600);

      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
        clearTimeout(t3);
      };
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Tab state
  const [activeTab, setActiveTab] = useState<ReportTab>("cards");

  // Search
  const [search, setSearch] = useState("");
  const filtered = displayPerformances.filter((p) =>
    !search ||
    p.player.name.toLowerCase().includes(search.toLowerCase()) ||
    p.player.username.toLowerCase().includes(search.toLowerCase())
  );

  // PDF download
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const handleDownloadPdf = async () => {
    setDownloadingPdf(true);
    try {
      await generateResultsPdf({
        tournamentName,
        location: config?.venue,
        date: config?.date,
        timeControl: config?.timePreset,
        players,
        rounds,
        clubName: config?.clubName ?? undefined,
        clubLogoUrl: clubAvatarUrl ?? undefined,
      });
    } finally {
      setDownloadingPdf(false);
    }
  };

  // Download all
  const [downloadingAll, setDownloadingAll] = useState(false);
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const handleDownloadAll = useCallback(async () => {
    setDownloadingAll(true);
    toast.info(`Exporting ${performances.length} cards...`);
    for (const perf of performances) {
      const el = cardRefs.current.get(perf.player.id);
      if (!el) continue;
      try {
        const filename = `${perf.player.username}-${tournamentName.toLowerCase().replace(/\s+/g, "-")}.png`;
        await exportCardAsPng(el, filename);
        await new Promise((r) => setTimeout(r, 300));
      } catch {
        // continue
      }
    }
    setDownloadingAll(false);
    toast.success("All cards downloaded!");
  }, [performances, tournamentName]);

  // Share modal
  const shareModal = useShareModal();
  const reportUrl =
    typeof window !== "undefined"
      ? window.location.href
      : "";

  // Loading state — show spinner while fetching full roster from server
  if (serverLoading) {
    return (
      <div
        className={`min-h-screen flex items-center justify-center ${
          isDark ? "bg-[oklch(0.18_0.05_145)]" : "bg-[#F7FAF8]"
        }`}
      >
        <OTBLoader size={80} />
      </div>
    );
  }

  // Empty state
  if (performances.length === 0) {
    return (
      <div
        className={`min-h-screen flex flex-col items-center justify-center p-8 ${
          isDark ? "bg-[oklch(0.18_0.05_145)]" : "bg-[#F7FAF8]"
        }`}
      >
        <div className={`text-center max-w-sm ${isDark ? "text-white" : "text-[#12372A]"}`}>
          <div className="text-5xl mb-4">📊</div>
          <h2 className="text-xl font-black mb-2" style={{ fontFamily: "'Clash Display', sans-serif" }}>
            No Results Yet
          </h2>
          <p className={`text-sm mb-6 ${isDark ? "text-white/50" : "text-[#436850]"}`}>
            Performance reports are generated after the tournament is complete and all results are entered.
          </p>
          <SpinBorderButton
            variant="glass"
            onClick={() => window.location.href = `/tournament/${tournamentId}/manage`}
          >
            Back to Dashboard
          </SpinBorderButton>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen transition-colors duration-300 ${
        isDark ? "bg-[oklch(0.18_0.05_145)]" : "bg-[#F7FAF8]"
      }`}
    >
      {/* ── Header ── */}
      <header
        className={`sticky top-0 z-40 backdrop-blur-xl otb-header-safe ${
          isDark
            ? "bg-[oklch(0.18_0.05_145/0.94)] border-b border-white/06"
            : "bg-white/92 border-b border-[#ADBC9F]/70"
        }`}
      >
        {/* Single consolidated row */}
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-3">
          {/* Back */}
          <Link
            href={`/tournament/${tournamentId}/manage`}
            title="Back to dashboard"
            className={`flex-shrink-0 p-1.5 rounded-lg transition-colors ${
              isDark ? "text-white/40 hover:text-white/80 hover:bg-white/06" : "text-[#436850] hover:text-[#12372A] hover:bg-[#ADBC9F]/50"
            }`}
          >
            <ChevronLeft className="w-4 h-4" />
          </Link>

          {/* Logo */}
          <NavLogo />

          {/* Divider */}
          <div className={`w-px h-4 flex-shrink-0 ${isDark ? "bg-white/10" : "bg-[#ADBC9F]"}`} />

          {/* Title + tournament badge + bracket label */}
          <div className="flex items-center gap-2 min-w-0">
            <h1
              className={`text-sm font-bold leading-none flex-shrink-0 ${
                isDark ? "text-white/90" : "text-[#12372A]"
              }`}
              style={{ fontFamily: "'Clash Display', sans-serif" }}
            >
              Performance Report
            </h1>
            <span
              className={`text-[11px] font-medium truncate ${
                isDark ? "text-white/35" : "text-[#436850]"
              }`}
            >
              {tournamentName}
            </span>
            {bracketLabel && (
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md flex-shrink-0 ${
                isDark ? "bg-amber-500/15 text-amber-400 border border-amber-500/25" : "bg-amber-50 text-amber-700 border border-amber-200"
              }`}>
                {bracketLabel}
              </span>
            )}
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Action buttons — icon-only, compact */}
          {activeTab === "cards" && (
            <div className="flex items-center gap-1">
              <button
                onClick={shareModal.openBroadcast}
                title="Share results"
                className={`p-2 rounded-lg transition-colors ${
                  isDark
                    ? "text-[#4CAF50]/80 hover:text-[#4CAF50] hover:bg-[#4CAF50]/10"
                    : "text-[#436850] hover:bg-[#436850]/08"
                }`}
              >
                <Share2 className="w-4 h-4" />
              </button>
              <button
                onClick={handleDownloadAll}
                disabled={downloadingAll}
                title="Download all cards"
                className={`p-2 rounded-lg transition-colors disabled:opacity-40 ${
                  isDark
                    ? "text-[#4CAF50]/80 hover:text-[#4CAF50] hover:bg-[#4CAF50]/10"
                    : "text-[#436850] hover:bg-[#436850]/08"
                }`}
              >
                {downloadingAll ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
              </button>
            </div>
          )}

          {/* PDF download button — always visible */}
          <button
            onClick={handleDownloadPdf}
            disabled={downloadingPdf}
            title="Download PDF results"
            className={`p-2 rounded-lg transition-colors disabled:opacity-40 ${
              isDark
                ? "text-[#4CAF50]/80 hover:text-[#4CAF50] hover:bg-[#4CAF50]/10"
                : "text-[#436850] hover:bg-[#436850]/08"
            }`}
          >
            {downloadingPdf ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <FileText className="w-4 h-4" />
            )}
          </button>

          {/* Theme toggle */}
          <ThemeToggle />
        </div>

        {/* Tab bar — slim underline style, sits flush below the row */}
        <div className="max-w-6xl mx-auto px-4">
          <TabBar activeTab={activeTab} onTabChange={setActiveTab} isDark={isDark} />
        </div>
      </header>

      {/* ── Bracket selector strip (parent tournament) ── */}
      {isBracketParent && childBrackets.length > 0 && (
        <div className={`border-b ${
          isDark ? "bg-[oklch(0.18_0.05_145/0.94)] border-white/06" : "bg-white/92 border-[#ADBC9F]/40"
        }`}>
          <div className="max-w-6xl mx-auto px-4 py-3">
            <div className="flex items-center gap-2 mb-2">
              <span className={`text-[11px] font-bold uppercase tracking-widest ${isDark ? "text-amber-400/70" : "text-amber-600"}`}>
                Rating Brackets
              </span>
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${isDark ? "bg-amber-400/15 text-amber-400" : "bg-amber-50 text-amber-600"}`}>
                {childBrackets.length}
              </span>
            </div>
            <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
              {/* Overview pill — current parent page */}
              <button
                className={`flex-shrink-0 flex items-center gap-2 px-3.5 py-2 rounded-xl border-2 text-xs font-bold transition-all active:scale-95 ${
                  isDark
                    ? "bg-amber-500/15 border-amber-500/40 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.15)]"
                    : "bg-amber-50 border-amber-400 text-amber-700 shadow-sm"
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" />
                Overview
              </button>
              {/* One pill per child bracket */}
              {childBrackets.map((b) => (
                <button
                  key={b.tournamentId}
                  onClick={() => navigate(`/tournament/${b.tournamentId}/report`)}
                  className={`flex-shrink-0 flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-semibold transition-all active:scale-95 ${
                    isDark
                      ? "bg-white/06 border-white/12 text-white/80 hover:bg-white/10 hover:border-white/20"
                      : "bg-white border-[#ADBC9F] text-[#12372A] hover:bg-[#f0f9f1] hover:border-[#436850] shadow-sm"
                  }`}
                >
                  <span>{b.label}</span>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                    isDark ? "bg-white/10 text-white/60" : "bg-[#ADBC9F]/40 text-[#436850]"
                  }`}>
                    {b.playerCount}p
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Back to main event (child bracket) ── */}
      {bracketLabel && parentTournamentId && (
        <div className={`border-b ${
          isDark ? "bg-[oklch(0.18_0.05_145/0.94)] border-white/06" : "bg-white/92 border-[#ADBC9F]/40"
        }`}>
          <div className="max-w-6xl mx-auto px-4 py-2">
            <button
              onClick={() => navigate(`/tournament/${parentTournamentId}/report`)}
              className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg transition-all active:scale-95 ${
                isDark ? "text-amber-400 hover:bg-amber-500/10" : "text-amber-600 hover:bg-amber-50"
              }`}
            >
              <ChevronLeft className="w-3 h-3" />
              Back to main event reports
            </button>
          </div>
        </div>
      )}

      {/* ── Content ── */}
      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Quads section tabs */}
        {isQuads && quadSectionPerfs.length > 0 && (
          <div className="mb-5">
            <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-1">
              <button
                onClick={() => setActiveSection("all")}
                className={`flex-shrink-0 px-3.5 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 border ${
                  activeSection === "all"
                    ? isDark
                      ? "bg-[#4CAF50]/15 border-[#4CAF50]/40 text-[#4CAF50] shadow-[0_0_12px_rgba(76,175,80,0.15)]"
                      : "bg-[#436850]/10 border-[#436850] text-[#436850] shadow-sm"
                    : isDark
                      ? "bg-white/06 border-white/12 text-white/70 hover:bg-white/10"
                      : "bg-white border-[#ADBC9F] text-[#12372A] hover:bg-[#f0f9f1]"
                }`}
              >
                All Sections
              </button>
              {quadSectionPerfs.map((sp) => {
                const isActive = activeSection === sp.sectionId;
                const champion = sp.performances[0];
                return (
                  <button
                    key={sp.sectionId}
                    onClick={() => setActiveSection(sp.sectionId)}
                    className={`flex-shrink-0 flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all active:scale-95 border ${
                      isActive
                        ? isDark
                          ? "bg-[#4CAF50]/15 border-[#4CAF50]/40 text-[#4CAF50] shadow-[0_0_12px_rgba(76,175,80,0.15)]"
                          : "bg-[#436850]/10 border-[#436850] text-[#436850] shadow-sm"
                        : isDark
                          ? "bg-white/06 border-white/12 text-white/70 hover:bg-white/10"
                          : "bg-white border-[#ADBC9F] text-[#12372A] hover:bg-[#f0f9f1]"
                    }`}
                  >
                    <span>{sp.sectionName}</span>
                    {champion && (
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                        isDark ? "bg-amber-400/15 text-amber-400" : "bg-amber-50 text-amber-600"
                      }`}>
                        🏆 {champion.player.name.split(" ")[0]}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Summary banner */}
        <SummaryBanner
          performances={displayPerformances}
          rounds={displayRounds}
          tournamentName={
            isQuads && activeSection !== "all"
              ? `${quadSectionPerfs.find(s => s.sectionId === activeSection)?.sectionName ?? tournamentName}`
              : tournamentName
          }
          isDark={isDark}
          isQuadsAllSections={isQuads && activeSection === "all"}
          numSections={quadSectionPerfs.length}
        />

        {/* Club CTA — prompt player to join the hosting club */}
        {config?.clubId && config?.clubName && (
          <Link
            href={`/clubs/${config.clubId}`}
            className={`flex items-center gap-4 rounded-2xl border p-4 mb-6 transition-all ${
              isDark
                ? "bg-[#1a2e1e] border-white/10 hover:border-[#4CAF50]/40"
                : "bg-white border-[#ADBC9F] hover:border-[#436850]/40"
            }`}
          >
            <div className="w-12 h-12 bg-[#436850] rounded-2xl flex items-center justify-center flex-shrink-0 shadow-md shadow-[#436850]/25">
              <Users className="w-6 h-6 text-white" strokeWidth={1.5} />
            </div>
            <div className="flex-1 min-w-0">
              <p className={`font-bold text-sm ${isDark ? "text-white" : "text-[#12372A]"}`}
                style={{ fontFamily: "'Clash Display', sans-serif" }}>
                Join {config.clubName}
              </p>
              <p className={`text-xs mt-0.5 ${isDark ? "text-white/50" : "text-[#436850]"}`}>
                Follow this club for future tournaments and events
              </p>
            </div>
            <ChevronRight className={`w-5 h-5 flex-shrink-0 ${isDark ? "text-white/30" : "text-[#436850]/70"}`} />
          </Link>
        )}

        {/* ── Tab: Player Cards ── */}
        {activeTab === "cards" && (
          <div role="tabpanel" id="tabpanel-cards" aria-labelledby="tab-cards">
            {/* Search */}
            <div className="mb-5">
              <div className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border ${
                isDark
                  ? "bg-white/06 border-white/10 text-white"
                  : "bg-white border-[#ADBC9F] text-[#12372A]"
              }`}>
                <Search className={`w-4 h-4 flex-shrink-0 ${isDark ? "text-white/40" : "text-[#436850]"}`} />
                <input
                  aria-label="Search players"
                  type="text"
                  placeholder="Search players…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="flex-1 bg-transparent text-sm outline-none placeholder:opacity-40"
                />
              </div>
            </div>


            {/* Podium highlight */}
            {isQuads && quadSectionPerfs.length > 0 && activeSection === "all" ? (
              /* Per-Quad section champions grid */
              <div className="mt-10">
                <h3
                  className={`text-base font-black mb-4 ${isDark ? "text-white" : "text-[#12372A]"}`}
                  style={{ fontFamily: "'Clash Display', sans-serif" }}
                >
                  🏆 Section Champions
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {quadSectionPerfs.map((sp) => {
                    const champ = sp.performances[0];
                    if (!champ) return null;
                    return (
                      <button
                        key={sp.sectionId}
                        onClick={() => setActiveSection(sp.sectionId)}
                        className={`rounded-2xl p-4 text-left border transition-all active:scale-[0.98] ${
                          isDark
                            ? "bg-[#4CAF50]/08 border-[#4CAF50]/20 hover:border-[#4CAF50]/40"
                            : "bg-[#436850]/05 border-[#436850]/20 hover:border-[#436850]/40 shadow-sm"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="text-2xl">🏆</div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-xs font-bold uppercase tracking-widest mb-0.5 ${
                              isDark ? "text-[#4CAF50]/70" : "text-[#436850]"
                            }`}>
                              {sp.sectionName}
                            </p>
                            <p className={`text-base font-black truncate ${
                              isDark ? "text-white" : "text-[#12372A]"
                            }`} style={{ fontFamily: "'Clash Display', sans-serif" }}>
                              {champ.player.name}
                            </p>
                            <p className={`text-xs mt-0.5 ${
                              isDark ? "text-white/50" : "text-[#436850]"
                            }`}>
                              {champ.points}pts · {champ.wins}W {champ.draws}D {champ.losses}L
                            </p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : displayPerformances.length >= 3 ? (
              /* Standard podium for non-Quads or single-section view */
              <div className="mt-10">
                <h3
                  className={`text-base font-black mb-4 ${isDark ? "text-white" : "text-[#12372A]"}`}
                  style={{ fontFamily: "'Clash Display', sans-serif" }}
                >
                  🏆 Podium
                </h3>
                <div className="grid grid-cols-3 gap-3 items-end">
                  {/* 2nd */}
                  <div className="flex flex-col items-center mt-6">
                    <div className={`w-full rounded-2xl p-3 text-center ${isDark ? "bg-white/08 border border-white/10" : "bg-white border border-[#ADBC9F]/70 shadow-sm"}`}>
                      <div className="text-2xl mb-1">🥈</div>
                      <p className={`text-xs font-bold truncate ${isDark ? "text-white" : "text-[#12372A]"}`}>{displayPerformances[1].player.name}</p>
                      <p className={`text-[10px] ${isDark ? "text-white/40" : "text-[#436850]"}`}>{displayPerformances[1].points}pts</p>
                    </div>
                    <div className={`w-full h-8 rounded-b-xl ${isDark ? "bg-white/06" : "bg-[#ADBC9F]/40"}`} />
                  </div>
                  {/* 1st */}
                  <div className="flex flex-col items-center">
                    <div className={`w-full rounded-2xl p-3 text-center border-2 ${isDark ? "bg-[#4CAF50]/10 border-[#4CAF50]/40" : "bg-[#436850]/05 border-[#436850]/30 shadow-md"}`}>
                      <div className="text-2xl mb-1">🏆</div>
                      <p className={`text-xs font-bold truncate ${isDark ? "text-white" : "text-[#12372A]"}`}>{displayPerformances[0].player.name}</p>
                      <p className={`text-[10px] ${isDark ? "text-[#4CAF50]" : "text-[#436850]"} font-semibold`}>{displayPerformances[0].points}pts</p>
                    </div>
                    <div className={`w-full h-12 rounded-b-xl ${isDark ? "bg-[#4CAF50]/10" : "bg-[#436850]/08"}`} />
                  </div>
                  {/* 3rd */}
                  <div className="flex flex-col items-center mt-8">
                    <div className={`w-full rounded-2xl p-3 text-center ${isDark ? "bg-white/08 border border-white/10" : "bg-white border border-[#ADBC9F]/70 shadow-sm"}`}>
                      <div className="text-2xl mb-1">🥉</div>
                      <p className={`text-xs font-bold truncate ${isDark ? "text-white" : "text-[#12372A]"}`}>{displayPerformances[2].player.name}</p>
                      <p className={`text-[10px] ${isDark ? "text-white/40" : "text-[#436850]"}`}>{displayPerformances[2].points}pts</p>
                    </div>
                    <div className={`w-full h-5 rounded-b-xl ${isDark ? "bg-white/06" : "bg-[#ADBC9F]/40"}`} />
                  </div>
                </div>
              </div>
            ) : null}

            {/* Section heading */}
            <div className="flex items-center justify-between mb-4">
              <h3
                className={`text-base font-black ${isDark ? "text-white" : "text-[#12372A]"}`}
                style={{ fontFamily: "'Clash Display', sans-serif" }}
              >
                Player Cards
              </h3>
              <span className={`text-xs ${isDark ? "text-white/40" : "text-[#436850]"}`}>
                Pick a color · Tap Share · {filtered.length} players
              </span>
            </div>

            {/* Card grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              {filtered.map((perf) => {
                const exportRef = getExportRef(perf.player.id);
                const accent = getAccent(perf);
                const form = chesscomForm.get(perf.player.username.toLowerCase());
                // For Quads, use the section name the player belongs to as the card tournament name.
                // This ensures the share text and card header say "Quad 1" not the global tournament name.
                const cardTournamentName = isQuads
                  ? ((perf as PlayerPerformance & { sectionName?: string }).sectionName ?? tournamentName)
                  : tournamentName;
                return (
                  <div key={perf.player.id}>
                    {/* Hidden export-quality card — positioned off-screen but with real dimensions */}
                    {/* sr-only would collapse dimensions to 0; instead use fixed position far off-screen */}
                    {/* aria-hidden + inert: excluded from a11y tree and keyboard nav */}
                    <div aria-hidden="true" inert style={{ position: "fixed", left: "-9999px", top: 0, pointerEvents: "none", zIndex: -1 }}>
                      <PlayerStatsCard
                        ref={(el) => {
                          if (el) {
                            cardRefs.current.set(perf.player.id, el);
                            exportRef.current = el;
                          } else {
                            cardRefs.current.delete(perf.player.id);
                            exportRef.current = null;
                          }
                        }}
                        perf={perf}
                        tournamentName={cardTournamentName}
                        tournamentDate={tournamentDate}
                        avatarUrl={toProxiedAvatarUrl(avatarById.get(perf.player.id))}
                        avatarStatus="loaded"
                        forExport
                        accentColor={accent}
                        chesscomWins={form?.wins}
                        chesscomDraws={form?.draws}
                        chesscomLosses={form?.losses}
                        clubName={config?.clubName ?? undefined}
                      />
                    </div>
                    {/* Visible responsive card */}
                    <ExportableCard
                      perf={perf}
                      tournamentName={cardTournamentName}
                      tournamentDate={tournamentDate}
                      isDark={isDark}
                      avatarUrl={toProxiedAvatarUrl(avatarById.get(perf.player.id))}
                      avatarStatus={avatarsLoaded ? "loaded" : "loading"}
                      onShareSingle={shareModal.openSingle}
                      exportRef={exportRef}
                      accentColor={accent}
                      onAccentChange={(hex) => setAccent(perf.player.id, hex)}
                      chesscomWins={form?.wins}
                      chesscomDraws={form?.draws}
                      chesscomLosses={form?.losses}
                      clubName={config?.clubName ?? undefined}
                    />
                  </div>
                );
              })}
            </div>

          </div>
        )}

        {/* ── Tab: Cross-Table ── */}
        {activeTab === "crosstable" && (
          <div role="tabpanel" id="tabpanel-crosstable" aria-labelledby="tab-crosstable">
          <CrossTable
            players={isQuads && activeSection !== "all"
              ? players.filter(p => quadSections.find(s => s.id === activeSection)?.playerIds.includes(p.id))
              : players
            }
            rounds={isQuads && activeSection !== "all"
              ? rounds.map(r => ({
                  ...r,
                  games: r.games.filter(g => {
                    const ids = new Set(quadSections.find(s => s.id === activeSection)?.playerIds ?? []);
                    return ids.has(g.whiteId) && (ids.has(g.blackId) || g.blackId === "BYE");
                  }),
                }))
              : rounds
            }
            tournamentName={isQuads && activeSection !== "all"
              ? quadSectionPerfs.find(s => s.sectionId === activeSection)?.sectionName ?? tournamentName
              : tournamentName
            }
            isDark={isDark}
          />
          </div>
        )}

        {/* ── Tab: Rounds ── */}
        {activeTab === "rounds" && (
          <div role="tabpanel" id="tabpanel-rounds" aria-labelledby="tab-rounds">
          <RoundTimeline
            players={isQuads && activeSection !== "all"
              ? players.filter(p => quadSections.find(s => s.id === activeSection)?.playerIds.includes(p.id))
              : players
            }
            rounds={isQuads && activeSection !== "all"
              ? rounds.map(r => ({
                  ...r,
                  games: r.games.filter(g => {
                    const ids = new Set(quadSections.find(s => s.id === activeSection)?.playerIds ?? []);
                    return ids.has(g.whiteId) && (ids.has(g.blackId) || g.blackId === "BYE");
                  }),
                }))
              : rounds
            }
            tournamentName={isQuads && activeSection !== "all"
              ? quadSectionPerfs.find(s => s.sectionId === activeSection)?.sectionName ?? tournamentName
              : tournamentName
            }
            isDark={isDark}
          />
          </div>
        )}

        {/* Bottom padding */}
        <div className="h-16" />
      </div>

      {/* ── Share Results Modal ── */}
      {shareModal.open && (
        <ShareResultsModal
          performances={performances}
          tournamentName={tournamentName}
          tournamentId={tournamentId}
          reportUrl={reportUrl}
          isDark={isDark}
          onClose={shareModal.close}
          singlePlayer={shareModal.singlePlayer}
          pdfPlayers={players}
          pdfRounds={rounds}
          pdfClubName={config?.clubName ?? undefined}
          pdfClubLogoUrl={clubAvatarUrl ?? undefined}
        />
      )}
    </div>
  );
}
