/**
 * OTB Chess — Tournament Performance Report Page
 * Route: /tournament/:id/report
 *
 * Displays post-tournament performance cards for every player.
 * Each card can be downloaded as a 1080×1080 PNG for social media sharing.
 * Also supports a "Download All" flow that exports every card sequentially.
 * "Share Results" broadcasts player stats via WhatsApp or email.
 */
import { useState, useRef, useCallback } from "react";
import { useChessAvatars } from "@/hooks/useChessAvatar";
import { useParams, Link } from "wouter";
import { NavLogo } from "@/components/NavLogo";
import { toast } from "sonner";

import { useTheme } from "@/contexts/ThemeContext";
import { ThemeToggle } from "@/components/ThemeToggle";
import { loadTournamentState } from "@/lib/directorState";
import { getTournamentConfig } from "@/lib/tournamentRegistry";
import { computeAllPerformances, type PlayerPerformance } from "@/lib/performanceStats";
import { DEMO_TOURNAMENT } from "@/lib/tournamentData";
import PlayerStatsCard from "@/components/PlayerStatsCard";
import CrossTable from "@/components/CrossTable";
import RoundTimeline from "@/components/RoundTimeline";
import { ShareResultsModal, useShareModal } from "@/components/ShareResultsModal";
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
} from "lucide-react";

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
    <div className={`flex gap-1 p-1 rounded-xl ${isDark ? "bg-white/06" : "bg-gray-100"}`}>
      {tabs.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          onClick={() => onTabChange(id)}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
            activeTab === id
              ? isDark
                ? "bg-[#3D6B47] text-white shadow-sm"
                : "bg-white text-[#3D6B47] shadow-sm"
              : isDark
              ? "text-white/50 hover:text-white/80"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          <Icon className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="hidden sm:inline">{label}</span>
        </button>
      ))}
    </div>
  );
}

// ─── Export helper ────────────────────────────────────────────────────────────
async function exportCardAsPng(
  element: HTMLElement,
  filename: string
): Promise<void> {
  const { default: html2canvas } = await import("html2canvas");
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: null,
    logging: false,
  });
  const link = document.createElement("a");
  link.download = filename;
  link.href = canvas.toDataURL("image/png");
  link.click();
}

// ─── Summary Banner ───────────────────────────────────────────────────────────
function SummaryBanner({
  performances,
  tournamentName,
  isDark,
}: {
  performances: PlayerPerformance[];
  tournamentName: string;
  isDark: boolean;
}) {
  const champion = performances[0];
  const avgPerf = Math.round(
    performances.reduce((s, p) => s + p.performanceRating, 0) / performances.length
  );
  const totalGames = performances.reduce((s, p) => s + p.wins + p.draws + p.losses, 0) / 2;
  const decisiveGames = performances.reduce((s, p) => s + p.wins, 0) / 2;
  const drawRate = totalGames > 0 ? Math.round((1 - decisiveGames / totalGames) * 100) : 0;

  return (
    <div
      className={`rounded-2xl p-5 border mb-6 ${
        isDark
          ? "bg-[oklch(0.22_0.06_145)] border-white/10"
          : "bg-white border-gray-100 shadow-sm"
      }`}
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className={`text-xs font-bold uppercase tracking-widest mb-1 ${isDark ? "text-white/40" : "text-gray-400"}`}>
            Final Report
          </p>
          <h2
            className={`text-xl font-black ${isDark ? "text-white" : "text-gray-900"}`}
            style={{ fontFamily: "'Clash Display', sans-serif" }}
          >
            {tournamentName}
          </h2>
        </div>
        <div className="flex items-center gap-1.5">
          <Crown className="w-4 h-4 text-amber-500" />
          <span className={`text-sm font-bold ${isDark ? "text-white" : "text-gray-900"}`}>
            {champion?.player.name}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Players", value: performances.length, icon: Users },
          { label: "Champion Score", value: `${champion?.points ?? 0}pts`, icon: Trophy },
          { label: "Avg Performance", value: avgPerf, icon: BarChart3 },
          { label: "Draw Rate", value: `${drawRate}%`, icon: BarChart3 },
        ].map(({ label, value, icon: Icon }) => (
          <div
            key={label}
            className={`rounded-xl p-3 ${
              isDark ? "bg-white/06" : "bg-gray-50"
            }`}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <Icon className={`w-3 h-3 ${isDark ? "text-[#4CAF50]" : "text-[#3D6B47]"}`} />
              <span className={`text-[10px] font-semibold uppercase tracking-wider ${isDark ? "text-white/40" : "text-gray-400"}`}>
                {label}
              </span>
            </div>
            <span
              className={`text-lg font-black ${isDark ? "text-white" : "text-gray-900"}`}
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

// ─── Card Wrapper with export controls ───────────────────────────────────────
function ExportableCard({
  perf,
  tournamentName,
  tournamentDate,
  isDark,
  avatarUrl,
  avatarStatus,
  onShareSingle,
}: {
  perf: PlayerPerformance;
  tournamentName: string;
  tournamentDate: string;
  isDark: boolean;
  avatarUrl?: string | null;
  avatarStatus?: "loading" | "loaded";
  onShareSingle: (perf: PlayerPerformance) => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);

  const handleExport = useCallback(async () => {
    if (!cardRef.current) return;
    setExporting(true);
    try {
      const filename = `${perf.player.username}-${tournamentName.toLowerCase().replace(/\s+/g, "-")}.png`;
      await exportCardAsPng(cardRef.current, filename);
      toast.success(`Card saved for ${perf.player.name}`);
    } catch {
      toast.error("Export failed — try again");
    } finally {
      setExporting(false);
    }
  }, [perf, tournamentName]);

  const handleShare = useCallback(async () => {
    if (!cardRef.current) return;
    setExporting(true);
    try {
      const { default: html2canvas } = await import("html2canvas");
      const canvas = await html2canvas(cardRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: null,
        logging: false,
      });
      canvas.toBlob(async (blob: Blob | null) => {
        if (!blob) { toast.error("Could not generate image"); setExporting(false); return; }
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
        setExporting(false);
      }, "image/png");
    } catch {
      toast.error("Share failed — try downloading instead");
      setExporting(false);
    }
  }, [perf, tournamentName]);

  return (
    <div className="group relative">
      {/* The card itself */}
      <PlayerStatsCard
        ref={cardRef}
        perf={perf}
        tournamentName={tournamentName}
        tournamentDate={tournamentDate}
        avatarUrl={avatarUrl}
        avatarStatus={avatarStatus}
        forExport={false}
      />

      {/* Overlay controls — appear on hover */}
      <div className="absolute inset-0 rounded-3xl bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col items-center justify-center gap-2.5">
        <button
          onClick={handleExport}
          disabled={exporting}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-gray-900 font-semibold text-sm hover:bg-gray-100 transition-colors disabled:opacity-60"
        >
          {exporting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <ImageDown className="w-4 h-4" />
          )}
          Download PNG
        </button>
        <button
          onClick={handleShare}
          disabled={exporting}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/20 text-white font-semibold text-sm hover:bg-white/30 transition-colors border border-white/30 disabled:opacity-60"
        >
          <Share2 className="w-4 h-4" />
          Share Image
        </button>
        <button
          onClick={() => onShareSingle(perf)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#25D366]/20 text-[#25D366] font-semibold text-sm hover:bg-[#25D366]/30 transition-colors border border-[#25D366]/30"
        >
          <MessageCircle className="w-4 h-4" />
          Send via WhatsApp / Email
        </button>
      </div>

      {/* Player name label below card */}
      <div className="mt-2 text-center">
        <p className={`text-xs font-semibold ${isDark ? "text-white/70" : "text-gray-600"}`}>
          {perf.player.name}
        </p>
        <p className={`text-[10px] ${isDark ? "text-white/40" : "text-gray-400"}`}>
          #{perf.rank} · {perf.points}pts
        </p>
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
  const rawState = loadTournamentState(tournamentId);

  const players = isDemo ? DEMO_TOURNAMENT.players : (rawState?.players ?? []);
  const rounds = isDemo ? DEMO_TOURNAMENT.roundData : (rawState?.rounds ?? []);
  const tournamentName = config?.name ?? rawState?.tournamentName ?? DEMO_TOURNAMENT.name;
  const tournamentDate = config?.date ?? "";

  const performances = computeAllPerformances(players, rounds);

  // Pre-fetch all player avatars in parallel
  const usernames = performances.map((p) => p.player.username);
  const { avatars, allLoaded: avatarsLoaded } = useChessAvatars(usernames);

  // Tab state
  const [activeTab, setActiveTab] = useState<ReportTab>("cards");

  // Search
  const [search, setSearch] = useState("");
  const filtered = performances.filter((p) =>
    !search ||
    p.player.name.toLowerCase().includes(search.toLowerCase()) ||
    p.player.username.toLowerCase().includes(search.toLowerCase())
  );

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
  // Build a shareable report URL from current window location
  const reportUrl =
    typeof window !== "undefined"
      ? window.location.href
      : "";

  // Empty state
  if (performances.length === 0) {
    return (
      <div
        className={`min-h-screen flex flex-col items-center justify-center p-8 ${
          isDark ? "bg-[oklch(0.18_0.05_145)]" : "bg-[#F7FAF8]"
        }`}
      >
        <div className={`text-center max-w-sm ${isDark ? "text-white" : "text-gray-900"}`}>
          <div className="text-5xl mb-4">📊</div>
          <h2 className="text-xl font-black mb-2" style={{ fontFamily: "'Clash Display', sans-serif" }}>
            No Results Yet
          </h2>
          <p className={`text-sm mb-6 ${isDark ? "text-white/50" : "text-gray-500"}`}>
            Performance reports are generated after the tournament is complete and all results are entered.
          </p>
          <Link href={`/tournament/${tournamentId}/manage`}>
            <button className="px-4 py-2 rounded-xl bg-[#3D6B47] text-white text-sm font-semibold hover:bg-[#2d5235] transition-colors">
              Back to Dashboard
            </button>
          </Link>
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
        className={`sticky top-0 z-40 border-b backdrop-blur-xl ${
          isDark
            ? "bg-[oklch(0.18_0.05_145/0.92)] border-white/08"
            : "bg-white/90 border-gray-100"
        }`}
      >
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href={`/tournament/${tournamentId}/manage`}>
              <button
                className={`p-2 rounded-xl transition-colors ${
                  isDark ? "hover:bg-white/08 text-white/60" : "hover:bg-gray-100 text-gray-500"
                }`}
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            </Link>
            <NavLogo />
            <div className={`w-px h-5 ${isDark ? "bg-white/10" : "bg-gray-200"}`} />
            <div>
              <p
                className={`text-sm font-black leading-none ${isDark ? "text-white" : "text-gray-900"}`}
                style={{ fontFamily: "'Clash Display', sans-serif" }}
              >
                Performance Report
              </p>
              <p className={`text-[10px] mt-0.5 ${isDark ? "text-white/40" : "text-gray-400"}`}>
                {tournamentName}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {activeTab === "cards" && (
              <>
                {/* Share Results button */}
                <button
                  onClick={shareModal.openBroadcast}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                    isDark
                      ? "bg-[#25D366]/15 text-[#25D366] hover:bg-[#25D366]/25"
                      : "bg-[#25D366]/10 text-[#1a9e4e] hover:bg-[#25D366]/20 border border-[#25D366]/30"
                  }`}
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Share Results</span>
                </button>

                {/* Download All button */}
                <button
                  onClick={handleDownloadAll}
                  disabled={downloadingAll}
                  className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                    isDark
                      ? "bg-[#4CAF50]/20 text-[#4CAF50] hover:bg-[#4CAF50]/30"
                      : "bg-[#3D6B47] text-white hover:bg-[#2d5235]"
                  } disabled:opacity-60`}
                >
                  {downloadingAll ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Download className="w-3.5 h-3.5" />
                  )}
                  Download All
                </button>
              </>
            )}
            <ThemeToggle />
          </div>
        </div>
        {/* Tab bar */}
        <div className="max-w-6xl mx-auto px-4 pb-3">
          <TabBar activeTab={activeTab} onTabChange={setActiveTab} isDark={isDark} />
        </div>
      </header>

      {/* ── Content ── */}
      <main className="max-w-6xl mx-auto px-4 py-6">
        {/* Summary banner */}
        <SummaryBanner
          performances={performances}
          tournamentName={tournamentName}
          isDark={isDark}
        />

        {/* ── Tab: Player Cards ── */}
        {activeTab === "cards" && (<div>
        {/* Search */}
        <div className="mb-5">
          <div className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border ${
            isDark
              ? "bg-white/06 border-white/10 text-white"
              : "bg-white border-gray-200 text-gray-900"
          }`}>
            <Search className={`w-4 h-4 flex-shrink-0 ${isDark ? "text-white/40" : "text-gray-400"}`} />
            <input
              type="text"
              placeholder="Search players…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-transparent text-sm outline-none placeholder:opacity-40"
            />
          </div>
        </div>

        {/* Section heading */}
        <div className="flex items-center justify-between mb-4">
          <h3
            className={`text-base font-black ${isDark ? "text-white" : "text-gray-900"}`}
            style={{ fontFamily: "'Clash Display', sans-serif" }}
          >
            Player Cards
          </h3>
          <span className={`text-xs ${isDark ? "text-white/40" : "text-gray-400"}`}>
            Hover to download · {filtered.length} players
          </span>
        </div>

        {/* Card grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {filtered.map((perf) => (
            <div key={perf.player.id}>
              {/* Hidden export-quality card (captured by html2canvas) */}
              <div className="sr-only absolute -left-[9999px] top-0 pointer-events-none">
                <PlayerStatsCard
                  ref={(el) => {
                    if (el) cardRefs.current.set(perf.player.id, el);
                    else cardRefs.current.delete(perf.player.id);
                  }}
                  perf={perf}
                  tournamentName={tournamentName}
                  tournamentDate={tournamentDate}
                  avatarUrl={avatars.get(perf.player.username.toLowerCase())}
                  avatarStatus="loaded"
                  forExport
                />
              </div>
              {/* Visible responsive card */}
              <ExportableCard
                perf={perf}
                tournamentName={tournamentName}
                tournamentDate={tournamentDate}
                isDark={isDark}
                avatarUrl={avatars.get(perf.player.username.toLowerCase())}
                avatarStatus={avatarsLoaded ? "loaded" : "loading"}
                onShareSingle={shareModal.openSingle}
              />
            </div>
          ))}
        </div>

        {/* Podium highlight */}
        {performances.length >= 3 && (
          <div className="mt-10">
            <h3
              className={`text-base font-black mb-4 ${isDark ? "text-white" : "text-gray-900"}`}
              style={{ fontFamily: "'Clash Display', sans-serif" }}
            >
              🏆 Podium
            </h3>
            <div className="grid grid-cols-3 gap-4 max-w-lg mx-auto">
              {/* 2nd */}
              <div className="flex flex-col items-center mt-6">
                <div className={`w-full rounded-2xl p-3 text-center ${isDark ? "bg-white/08 border border-white/10" : "bg-white border border-gray-100 shadow-sm"}`}>
                  <div className="text-2xl mb-1">🥈</div>
                  <p className={`text-xs font-bold truncate ${isDark ? "text-white" : "text-gray-900"}`}>{performances[1].player.name}</p>
                  <p className={`text-[10px] ${isDark ? "text-white/40" : "text-gray-400"}`}>{performances[1].points}pts</p>
                </div>
                <div className={`w-full h-8 rounded-b-xl ${isDark ? "bg-white/06" : "bg-gray-100"}`} />
              </div>
              {/* 1st */}
              <div className="flex flex-col items-center">
                <div className={`w-full rounded-2xl p-3 text-center border-2 ${isDark ? "bg-[#4CAF50]/10 border-[#4CAF50]/40" : "bg-[#3D6B47]/05 border-[#3D6B47]/30 shadow-md"}`}>
                  <div className="text-2xl mb-1">🏆</div>
                  <p className={`text-xs font-bold truncate ${isDark ? "text-white" : "text-gray-900"}`}>{performances[0].player.name}</p>
                  <p className={`text-[10px] ${isDark ? "text-[#4CAF50]" : "text-[#3D6B47]"} font-semibold`}>{performances[0].points}pts</p>
                </div>
                <div className={`w-full h-12 rounded-b-xl ${isDark ? "bg-[#4CAF50]/10" : "bg-[#3D6B47]/08"}`} />
              </div>
              {/* 3rd */}
              <div className="flex flex-col items-center mt-8">
                <div className={`w-full rounded-2xl p-3 text-center ${isDark ? "bg-white/08 border border-white/10" : "bg-white border border-gray-100 shadow-sm"}`}>
                  <div className="text-2xl mb-1">🥉</div>
                  <p className={`text-xs font-bold truncate ${isDark ? "text-white" : "text-gray-900"}`}>{performances[2].player.name}</p>
                  <p className={`text-[10px] ${isDark ? "text-white/40" : "text-gray-400"}`}>{performances[2].points}pts</p>
                </div>
                <div className={`w-full h-5 rounded-b-xl ${isDark ? "bg-white/06" : "bg-gray-100"}`} />
              </div>
            </div>
          </div>
        )}

        </div>)} {/* end cards tab */}

        {/* ── Tab: Cross-Table ── */}
        {activeTab === "crosstable" && (
          <CrossTable
            players={players}
            rounds={rounds}
            tournamentName={tournamentName}
            isDark={isDark}
          />
        )}

        {/* ── Tab: Rounds ── */}
        {activeTab === "rounds" && (
          <RoundTimeline
            players={players}
            rounds={rounds}
            tournamentName={tournamentName}
            isDark={isDark}
          />
        )}

        {/* Bottom padding */}
        <div className="h-16" />
      </main>

      {/* ── Share Results Modal ── */}
      {shareModal.open && (
        <ShareResultsModal
          performances={performances}
          tournamentName={tournamentName}
          reportUrl={reportUrl}
          isDark={isDark}
          onClose={shareModal.close}
          singlePlayer={shareModal.singlePlayer}
        />
      )}
    </div>
  );
}
