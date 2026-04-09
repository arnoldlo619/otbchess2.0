/**
 * LeagueDemo — /league-demo
 * A fully interactive demo of the Chess Club League Dashboard
 * using popular chess.com usernames as mock players.
 * Mirrors the exact UI design system of LeagueDashboard.tsx.
 */
import { useState } from "react";
import { useChessAvatars } from "@/hooks/useChessAvatar";
import { useLocation } from "wouter";
import { useTheme } from "@/contexts/ThemeContext";
import {
  Trophy, Users, Calendar, BarChart3, ListOrdered,
  Clock, Swords, Target, ArrowLeft, Crown, ChevronRight,
  History, Shield, Zap, CheckCircle2,
} from "lucide-react";

// ── Mock Data ─────────────────────────────────────────────────────────────────

interface DemoPlayer {
  id: string;
  displayName: string;
  chesscomUsername: string;
  avatarUrl: string;
  rating: number;
  wins: number;
  draws: number;
  losses: number;
  points: number;
  streak: string;
  movement: "up" | "down" | "same";
  lastResults: string; // e.g. "W,W,L,D,W"
}

const DEMO_PLAYERS: DemoPlayer[] = [
  { id: "1",  displayName: "Magnus Carlsen",    chesscomUsername: "magnuscarlsen",      avatarUrl: "https://www.chess.com/bundles/web/images/user-image.007dad08.svg", rating: 2882, wins: 10, draws: 3, losses: 1, points: 23, streak: "W3",  movement: "up",   lastResults: "W,W,W,D,W" },
  { id: "2",  displayName: "Hikaru Nakamura",   chesscomUsername: "hikaru",             avatarUrl: "https://www.chess.com/bundles/web/images/user-image.007dad08.svg", rating: 2794, wins: 9,  draws: 4, losses: 1, points: 22, streak: "W2",  movement: "up",   lastResults: "W,W,D,W,D" },
  { id: "3",  displayName: "Fabiano Caruana",   chesscomUsername: "fabianocaruana",     avatarUrl: "https://www.chess.com/bundles/web/images/user-image.007dad08.svg", rating: 2805, wins: 8,  draws: 5, losses: 1, points: 21, streak: "D2",  movement: "same", lastResults: "D,D,W,W,W" },
  { id: "4",  displayName: "Javokhir Sindarov", chesscomUsername: "javokhir_sindarov05",avatarUrl: "https://www.chess.com/bundles/web/images/user-image.007dad08.svg", rating: 2740, wins: 8,  draws: 3, losses: 3, points: 19, streak: "W2",  movement: "up",   lastResults: "W,W,L,W,D" },
  { id: "5",  displayName: "Gukesh D",          chesscomUsername: "gukeshdommaraju",    avatarUrl: "https://www.chess.com/bundles/web/images/user-image.007dad08.svg", rating: 2783, wins: 7,  draws: 4, losses: 3, points: 18, streak: "W1",  movement: "up",   lastResults: "W,L,D,W,W" },
  { id: "6",  displayName: "Alireza Firouzja",  chesscomUsername: "firouzja2003",       avatarUrl: "https://www.chess.com/bundles/web/images/user-image.007dad08.svg", rating: 2760, wins: 7,  draws: 3, losses: 4, points: 17, streak: "L2",  movement: "down", lastResults: "L,L,W,W,D" },
  { id: "7",  displayName: "Praggnanandhaa",    chesscomUsername: "rpragchess",         avatarUrl: "https://www.chess.com/bundles/web/images/user-image.007dad08.svg", rating: 2748, wins: 6,  draws: 4, losses: 4, points: 16, streak: "D2",  movement: "same", lastResults: "D,D,W,L,W" },
  { id: "8",  displayName: "Danny Rensch",      chesscomUsername: "dannyrensch",        avatarUrl: "https://www.chess.com/bundles/web/images/user-image.007dad08.svg", rating: 2480, wins: 6,  draws: 3, losses: 5, points: 15, streak: "W1",  movement: "up",   lastResults: "W,L,D,L,W" },
  { id: "9",  displayName: "Levy Rozman",       chesscomUsername: "gothamchess",        avatarUrl: "https://www.chess.com/bundles/web/images/user-image.007dad08.svg", rating: 2420, wins: 5,  draws: 5, losses: 4, points: 15, streak: "D1",  movement: "same", lastResults: "D,W,L,D,W" },
  { id: "10", displayName: "Anna Cramling",     chesscomUsername: "annacramling",       avatarUrl: "https://www.chess.com/bundles/web/images/user-image.007dad08.svg", rating: 2380, wins: 5,  draws: 4, losses: 5, points: 14, streak: "L1",  movement: "down", lastResults: "L,W,D,W,L" },
  { id: "11", displayName: "Dina Belenkaya",    chesscomUsername: "dinabelenkaya",      avatarUrl: "https://www.chess.com/bundles/web/images/user-image.007dad08.svg", rating: 2360, wins: 5,  draws: 3, losses: 6, points: 13, streak: "W2",  movement: "up",   lastResults: "W,W,L,L,D" },
  { id: "12", displayName: "Nemsko",            chesscomUsername: "nemsko",             avatarUrl: "https://www.chess.com/bundles/web/images/user-image.007dad08.svg", rating: 2310, wins: 4,  draws: 5, losses: 5, points: 13, streak: "D1",  movement: "same", lastResults: "D,L,W,D,L" },
  { id: "13", displayName: "Alexandra Botez",  chesscomUsername: "alexandrabotez",     avatarUrl: "https://www.chess.com/bundles/web/images/user-image.007dad08.svg", rating: 2280, wins: 4,  draws: 4, losses: 6, points: 12, streak: "L2",  movement: "down", lastResults: "L,L,W,D,W" },
  { id: "14", displayName: "Wesley So",        chesscomUsername: "gmwso",              avatarUrl: "https://www.chess.com/bundles/web/images/user-image.007dad08.svg", rating: 2760, wins: 4,  draws: 3, losses: 7, points: 11, streak: "L3",  movement: "down", lastResults: "L,L,L,W,D" },
  { id: "15", displayName: "Canty GM",         chesscomUsername: "gmcanty",            avatarUrl: "https://www.chess.com/bundles/web/images/user-image.007dad08.svg", rating: 2490, wins: 3,  draws: 5, losses: 6, points: 11, streak: "D2",  movement: "same", lastResults: "D,D,L,W,L" },
  { id: "16", displayName: "GHANDEEVAM",       chesscomUsername: "ghandeevam2003",     avatarUrl: "https://www.chess.com/bundles/web/images/user-image.007dad08.svg", rating: 2620, wins: 3,  draws: 4, losses: 7, points: 10, streak: "L1",  movement: "down", lastResults: "L,D,W,L,D" },
  { id: "17", displayName: "Lordillidan",      chesscomUsername: "lordillidan",        avatarUrl: "https://www.chess.com/bundles/web/images/user-image.007dad08.svg", rating: 2540, wins: 3,  draws: 3, losses: 8, points: 9,  streak: "L2",  movement: "down", lastResults: "L,L,W,D,L" },
  { id: "18", displayName: "Alex Banzea",      chesscomUsername: "alex_banzea",        avatarUrl: "https://www.chess.com/bundles/web/images/user-image.007dad08.svg", rating: 2390, wins: 2,  draws: 5, losses: 7, points: 9,  streak: "D1",  movement: "same", lastResults: "D,L,L,W,D" },
  { id: "19", displayName: "Hanson",           chesscomUsername: "hansontwitch",       avatarUrl: "https://www.chess.com/bundles/web/images/user-image.007dad08.svg", rating: 2210, wins: 2,  draws: 4, losses: 8, points: 8,  streak: "L3",  movement: "down", lastResults: "L,L,L,D,W" },
  { id: "20", displayName: "lachesisQ",        chesscomUsername: "lachesisq",          avatarUrl: "https://www.chess.com/bundles/web/images/user-image.007dad08.svg", rating: 2180, wins: 2,  draws: 3, losses: 9, points: 7,  streak: "L2",  movement: "down", lastResults: "L,L,W,L,D" },
  { id: "21", displayName: "Pircuhset",        chesscomUsername: "pircuhset",          avatarUrl: "https://www.chess.com/bundles/web/images/user-image.007dad08.svg", rating: 2150, wins: 1,  draws: 4, losses: 9, points: 6,  streak: "L4",  movement: "down", lastResults: "L,L,L,L,D" },
  { id: "22", displayName: "Arnoldadri",       chesscomUsername: "arnoldadri",         avatarUrl: "https://www.chess.com/bundles/web/images/user-image.007dad08.svg", rating: 2090, wins: 1,  draws: 3, losses: 10,points: 5,  streak: "L3",  movement: "down", lastResults: "L,L,L,D,W" },
  { id: "23", displayName: "ChessWarrior",     chesscomUsername: "chesswarrior7197",   avatarUrl: "https://www.chess.com/bundles/web/images/user-image.007dad08.svg", rating: 1980, wins: 0,  draws: 3, losses: 11,points: 3,  streak: "L5",  movement: "down", lastResults: "L,L,L,L,L" },
];

// Current week matchups (week 14 of 16)
const CURRENT_WEEK_MATCHUPS = [
  { white: DEMO_PLAYERS[0], black: DEMO_PLAYERS[1], result: null },        // Magnus vs Hikaru — pending
  { white: DEMO_PLAYERS[2], black: DEMO_PLAYERS[3], result: "white_win" }, // Caruana vs Sindarov — completed
  { white: DEMO_PLAYERS[4], black: DEMO_PLAYERS[5], result: null },        // Gukesh vs Firouzja — pending
  { white: DEMO_PLAYERS[6], black: DEMO_PLAYERS[7], result: "draw" },      // Pragg vs Danny — completed
  { white: DEMO_PLAYERS[8], black: DEMO_PLAYERS[9], result: null },        // Levy vs Anna — pending
  { white: DEMO_PLAYERS[10], black: DEMO_PLAYERS[11], result: "black_win" },
  { white: DEMO_PLAYERS[12], black: DEMO_PLAYERS[13], result: null },
  { white: DEMO_PLAYERS[14], black: DEMO_PLAYERS[15], result: "white_win" },
  { white: DEMO_PLAYERS[16], black: DEMO_PLAYERS[17], result: null },
  { white: DEMO_PLAYERS[18], black: DEMO_PLAYERS[19], result: "black_win" },
  { white: DEMO_PLAYERS[20], black: DEMO_PLAYERS[21], result: null },
  { white: DEMO_PLAYERS[22], black: DEMO_PLAYERS[0], result: null },
];

// ── Helper Components ─────────────────────────────────────────────────────────

function Avatar({ name, size = 9, url }: { name: string; size?: number; url?: string | null }) {
  const px = size * 4;
  if (url) {
    return (
      <img
        src={url}
        alt={name}
        className="rounded-full object-cover flex-shrink-0"
        style={{ width: px, height: px }}
      />
    );
  }
  const initials = name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  const colors = [
    "oklch(0.45 0.15 145)", "oklch(0.45 0.15 200)", "oklch(0.45 0.15 260)",
    "oklch(0.45 0.15 30)", "oklch(0.45 0.15 320)", "oklch(0.45 0.15 80)",
  ];
  const bg = colors[name.charCodeAt(0) % colors.length];
  return (
    <div
      className="rounded-full flex items-center justify-center font-bold text-white flex-shrink-0"
      style={{ width: px, height: px, background: bg, fontSize: px * 0.35 }}
    >
      {initials}
    </div>
  );
}

function ResultDot({ r }: { r: string }) {
  const color = r === "W" ? "oklch(0.65 0.2 145)" : r === "L" ? "oklch(0.6 0.2 25)" : "oklch(0.55 0.04 145)";
  return (
    <div
      className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black"
      style={{ background: `${color}22`, color, border: `1px solid ${color}44` }}
    >
      {r}
    </div>
  );
}

function MovementIcon({ movement }: { movement: "up" | "down" | "same" }) {
  if (movement === "up") return <span className="text-[10px] font-bold" style={{ color: "oklch(0.65 0.2 145)" }}>▲</span>;
  if (movement === "down") return <span className="text-[10px] font-bold" style={{ color: "oklch(0.6 0.2 25)" }}>▼</span>;
  return <span className="text-[10px]" style={{ color: "oklch(0.55 0.04 145)" }}>—</span>;
}

function FormBadge({ result }: { result: string }) {
  const isW = result === "W", isL = result === "L";
  return (
    <span
      className="inline-flex items-center justify-center w-6 h-6 rounded text-[10px] font-black"
      style={{
        background: isW ? "oklch(0.65 0.2 145 / 0.15)" : isL ? "oklch(0.6 0.2 25 / 0.15)" : "oklch(0.55 0.04 145 / 0.15)",
        color: isW ? "oklch(0.65 0.2 145)" : isL ? "oklch(0.6 0.2 25)" : "oklch(0.65 0.04 145)",
        border: `1px solid ${isW ? "oklch(0.65 0.2 145 / 0.3)" : isL ? "oklch(0.6 0.2 25 / 0.3)" : "oklch(0.55 0.04 145 / 0.3)"}`,
      }}
    >
      {result}
    </span>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

type TabId = "overview" | "matchup" | "standings" | "schedule" | "history";

const TABS: { id: TabId; label: string; icon: React.ComponentType<{ size?: number }> }[] = [
  { id: "overview",  label: "Dashboard",  icon: BarChart3 },
  { id: "matchup",   label: "Matchup",    icon: Swords },
  { id: "standings", label: "Standings",  icon: ListOrdered },
  { id: "schedule",  label: "Schedule",   icon: Calendar },
  { id: "history",   label: "History",    icon: History },
];

export default function LeagueDemo() {
  const [, navigate] = useLocation();
  const themeCtx = useTheme();
  const isDark = (themeCtx as any).isDark ?? true;
  const [activeTab, setActiveTab] = useState<TabId>("overview");

  // Color tokens — identical to LeagueDashboard
  const pageBg    = isDark ? "oklch(0.15 0.04 145)" : "#f0f5ee";
  const cardBg    = isDark ? "oklch(0.20 0.06 145)" : "#ffffff";
  const cardBorder = isDark ? "oklch(0.28 0.07 145)" : "#e5e7eb";
  const textMain  = isDark ? "#f0f5ee" : "#111827";
  const textMuted = isDark ? "oklch(0.65 0.04 145)" : "#6b7280";
  const accent    = "oklch(0.55 0.13 145)";

  const featuredMatchup = CURRENT_WEEK_MATCHUPS[0]; // Magnus vs Hikaru
  const upcomingMatchups = CURRENT_WEEK_MATCHUPS.slice(0, 5);
  // Fetch chess.com avatars for all demo players in parallel
  const allDemoUsernames = DEMO_PLAYERS.map(p => p.chesscomUsername);
  const { avatars: demoAvatars } = useChessAvatars(allDemoUsernames);
  function getAvatar(chesscomUsername: string): string | null {
    return demoAvatars.get(chesscomUsername.toLowerCase()) ?? null;
  }

  // H2H between Magnus and Hikaru (mock)
  const h2hW = 3, h2hD = 2, h2hL = 2;
  const h2hTotal = h2hW + h2hD + h2hL;

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen" style={{ background: pageBg }}>
      {/* Demo Banner */}
      <div
        className="sticky top-0 z-50 flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold"
        style={{ background: "oklch(0.45 0.15 85)", color: "#fff" }}
      >
        <Zap size={12} />
        <span>DEMO MODE — This is a preview of the Chess Club League Dashboard</span>
        <button
          onClick={() => navigate("/")}
          className="ml-4 px-3 py-0.5 rounded-full text-xs font-bold transition-opacity hover:opacity-80"
          style={{ background: "rgba(255,255,255,0.25)", color: "#fff" }}
        >
          Get Started →
        </button>
      </div>

      {/* ── MAIN LAYOUT ─────────────────────────────────────────────────────── */}
      <div className="flex h-[calc(100vh-32px)] overflow-hidden">

        {/* ── LEFT ICON RAIL (desktop) ──────────────────────────────────────── */}
        <aside
          className="hidden lg:flex flex-col items-center w-[60px] flex-shrink-0 h-full py-4 gap-1"
          style={{
            background: isDark ? "oklch(0.15 0.04 145)" : "#0f1f14",
            borderRight: `1px solid ${isDark ? "oklch(0.22 0.06 145)" : "oklch(0.25 0.08 145)"}`,
          }}
        >
          {/* Club logo */}
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center mb-3 flex-shrink-0 overflow-hidden"
            style={{ background: accent }}
            title="ChessOTB Club League"
          >
            <img
              src="https://d2xsxph8kpxj0f.cloudfront.net/117675823/J6FsDoRMH9x5xbUvpyzxyf/otb-logo-exclamation_0b3fa613.png"
              alt="OTB!!"
              className="w-8 h-8 object-contain"
            />
          </div>

          {/* Divider */}
          <div className="w-8 h-px mb-2" style={{ background: "oklch(0.30 0.06 145)" }} />

          {/* Nav icons */}
          <nav className="flex flex-col items-center gap-1 flex-1">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className="relative w-10 h-10 rounded-xl flex items-center justify-center transition-all group"
                  style={{
                    background: isActive ? accent : "transparent",
                    color: isActive ? "#fff" : "oklch(0.55 0.08 145)",
                  }}
                  title={tab.label}
                >
                  <Icon size={17} />
                  {/* Tooltip */}
                  <span
                    className="absolute left-full ml-2 px-2 py-1 rounded-lg text-xs font-medium whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-50"
                    style={{ background: isDark ? "oklch(0.25 0.06 145)" : "#1a2e1f", color: "#fff" }}
                  >
                    {tab.label}
                  </span>
                </button>
              );
            })}
          </nav>

          {/* Divider */}
          <div className="w-8 h-px mt-2 mb-2" style={{ background: "oklch(0.30 0.06 145)" }} />

          {/* Back to home */}
          <button
            onClick={() => navigate("/")}
            className="w-10 h-10 rounded-xl flex items-center justify-center transition-all hover:opacity-80"
            style={{ color: "oklch(0.55 0.08 145)" }}
            title="Back to Home"
          >
            <ArrowLeft size={16} />
          </button>
        </aside>

        {/* ── MAIN CONTENT AREA ─────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

          {/* ── BRANDED TOP BAR ───────────────────────────────────────────── */}
          <div
            className="flex-shrink-0 flex items-center gap-3 px-4 lg:px-5 py-2.5"
            style={{
              background: isDark ? "oklch(0.15 0.04 145 / 0.97)" : "#0f1f14",
              backdropFilter: "blur(12px)",
              borderBottom: `1px solid ${isDark ? "oklch(0.22 0.06 145)" : "oklch(0.22 0.08 145)"}`,
            }}
          >
            {/* Mobile back */}
            <button
              onClick={() => navigate("/")}
              className="lg:hidden p-1.5 rounded-lg transition-opacity hover:opacity-70"
              style={{ color: "oklch(0.65 0.12 145)" }}
            >
              <ArrowLeft size={15} />
            </button>



            {/* Mobile title */}
            <div className="lg:hidden flex-1 min-w-0">
              <span className="text-sm font-bold truncate" style={{ color: "#ffffff" }}>ChessOTB Club League</span>
            </div>

            {/* Centered Live pill */}
            <div className="flex-1 flex justify-center">
              <div
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold"
                style={{
                  background: "oklch(0.22 0.10 145)",
                  color: accent,
                  border: `1px solid ${accent}44`,
                }}
              >
                <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: accent }} />
                Live · Week 14/16
              </div>
            </div>

            {/* Right: section label */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold hidden sm:block" style={{ color: "oklch(0.65 0.12 145)" }}>
                {TABS.find(t => t.id === activeTab)?.label}
              </span>
            </div>
          </div>

          {/* ── SCROLLABLE CONTENT ────────────────────────────────────────── */}
          <div className="flex-1 overflow-y-auto">

            {/* ── OVERVIEW TAB ──────────────────────────────────────────────── */}
            {activeTab === "overview" && (
              <div className="flex h-full">
                {/* Main content */}
                <div className="flex-1 p-4 lg:p-6 space-y-5 overflow-y-auto">

                  {/* Featured Matchup Hero */}
                  <div
                    className="rounded-2xl overflow-hidden"
                    style={{ background: cardBg, border: `1px solid ${cardBorder}` }}
                  >
                    <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: `1px solid ${cardBorder}` }}>
                      <div className="flex items-center gap-2">
                        <Swords size={14} style={{ color: accent }} />
                        <span className="text-sm font-bold" style={{ color: textMain }}>Featured Matchup — Week 14</span>
                      </div>
                      <span
                        className="text-xs font-semibold px-2 py-0.5 rounded-full animate-pulse"
                        style={{ background: `${accent}22`, color: accent }}
                      >
                        Live
                      </span>
                    </div>
                    <div className="p-5">
                      <div className="flex items-center justify-between gap-4">
                        {/* White player */}
                        <div className="flex flex-col items-center gap-2 flex-1">
                          <div className="relative">
                            <Avatar name={featuredMatchup.white.displayName} size={14} url={getAvatar(featuredMatchup.white.chesscomUsername)} />
                            <span
                              className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-[9px] font-black px-1.5 py-0.5 rounded-full whitespace-nowrap"
                              style={{ background: "#f0f5ee", color: "#111827" }}
                            >
                              WHITE
                            </span>
                          </div>
                          <div className="text-center mt-2">
                            <div className="font-bold text-sm" style={{ color: textMain }}>{featuredMatchup.white.displayName}</div>
                            <div className="text-xs" style={{ color: textMuted }}>{featuredMatchup.white.rating} ELO</div>
                          </div>
                        </div>

                        {/* VS */}
                        <div className="flex flex-col items-center gap-1">
                          <div className="text-2xl font-black" style={{ color: textMuted }}>VS</div>
                          <div className="flex items-center gap-1 text-[11px]" style={{ color: textMuted }}>
                            <Clock size={10} />
                            <span>90m + 30s</span>
                          </div>
                        </div>

                        {/* Black player */}
                        <div className="flex flex-col items-center gap-2 flex-1">
                          <div className="relative">
                            <Avatar name={featuredMatchup.black.displayName} size={14} url={getAvatar(featuredMatchup.black.chesscomUsername)} />
                            <span
                              className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-[9px] font-black px-1.5 py-0.5 rounded-full whitespace-nowrap"
                              style={{ background: "#111827", color: "#f0f5ee" }}
                            >
                              BLACK
                            </span>
                          </div>
                          <div className="text-center mt-2">
                            <div className="font-bold text-sm" style={{ color: textMain }}>{featuredMatchup.black.displayName}</div>
                            <div className="text-xs" style={{ color: textMuted }}>{featuredMatchup.black.rating} ELO</div>
                          </div>
                        </div>
                      </div>

                      {/* H2H strip */}
                      <div className="mt-4 pt-4" style={{ borderTop: `1px solid ${cardBorder}` }}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-semibold" style={{ color: textMain }}>{featuredMatchup.white.displayName.split(" ")[0]}</span>
                          <span className="text-[10px] uppercase tracking-wider font-bold" style={{ color: textMuted }}>Head to Head</span>
                          <span className="text-xs font-semibold" style={{ color: textMain }}>{featuredMatchup.black.displayName.split(" ")[0]}</span>
                        </div>
                        <div className="flex items-center justify-between mb-1.5 text-xs font-bold">
                          <span style={{ color: "oklch(0.65 0.2 145)" }}>{h2hW}W</span>
                          <span style={{ color: textMuted }}>{h2hD}D</span>
                          <span style={{ color: "oklch(0.6 0.2 25)" }}>{h2hL}L</span>
                        </div>
                        <div className="flex rounded-full overflow-hidden h-2">
                          <div style={{ width: `${(h2hW / h2hTotal) * 100}%`, background: "oklch(0.65 0.2 145)" }} />
                          <div style={{ width: `${(h2hD / h2hTotal) * 100}%`, background: "oklch(0.45 0.04 145)" }} />
                          <div style={{ width: `${(h2hL / h2hTotal) * 100}%`, background: "oklch(0.6 0.2 25)" }} />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Compact Standings Preview */}
                  <div
                    className="rounded-2xl overflow-hidden"
                    style={{ background: cardBg, border: `1px solid ${cardBorder}` }}
                  >
                    <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: `1px solid ${cardBorder}` }}>
                      <div className="flex items-center gap-2">
                        <ListOrdered size={14} style={{ color: accent }} />
                        <span className="text-sm font-bold" style={{ color: textMain }}>Premier League Standings</span>
                      </div>
                      <button
                        onClick={() => setActiveTab("standings")}
                        className="text-xs font-semibold flex items-center gap-1 transition-opacity hover:opacity-70"
                        style={{ color: accent }}
                      >
                        View all <ChevronRight size={12} />
                      </button>
                    </div>

                    {/* Table header */}
                    <div
                      className="hidden sm:grid items-center px-4 py-2 text-xs font-bold uppercase tracking-widest"
                      style={{
                        borderBottom: `1px solid ${cardBorder}`,
                        color: textMuted,
                        background: isDark ? "oklch(0.17 0.05 145)" : "#f3f4f6",
                        gridTemplateColumns: "2.5rem 1fr 4rem 2.5rem 2.5rem 2.5rem 3rem 4.5rem",
                        gap: "0.5rem",
                      }}
                    >
                      <span className="text-center">POS</span>
                      <span>Player</span>
                      <span className="text-center">Rating</span>
                      <span className="text-center">W</span>
                      <span className="text-center">D</span>
                      <span className="text-center">L</span>
                      <span className="text-center">PTS</span>
                      <span className="text-center">Form</span>
                    </div>

                    {/* Top 8 rows */}
                    {DEMO_PLAYERS.slice(0, 8).map((p, i) => {
                      const podiumColor = i === 0 ? "#f59e0b" : i === 1 ? "#9ca3af" : i === 2 ? "#cd7c2f" : null;
                      const lastArr = p.lastResults.split(",");
                      return (
                        <div
                          key={p.id}
                          className="hidden sm:grid items-center px-4 py-2.5 transition-colors hover:bg-white/5"
                          style={{
                            gridTemplateColumns: "2.5rem 1fr 4rem 2.5rem 2.5rem 2.5rem 3rem 4.5rem",
                            gap: "0.5rem",
                            borderBottom: i < 7 ? `1px solid ${cardBorder}` : "none",
                            background: i < 3 && podiumColor ? `${podiumColor}06` : "transparent",
                          }}
                        >
                          <div className="flex justify-center">
                            {podiumColor ? (
                              <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black" style={{ background: `${podiumColor}20`, color: podiumColor }}>
                                {i + 1}
                              </div>
                            ) : (
                              <span className="text-xs font-medium" style={{ color: textMuted }}>{i + 1}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 min-w-0">
                            <Avatar name={p.displayName} size={8} url={getAvatar(p.chesscomUsername)} />
                            <div className="min-w-0">
                              <div className="flex items-center gap-1">
                                <MovementIcon movement={p.movement} />
                                <span className="text-sm font-semibold truncate" style={{ color: textMain }}>{p.displayName}</span>
                              </div>
                              <span className="text-xs truncate block" style={{ color: textMuted }}>@{p.chesscomUsername}</span>
                            </div>
                          </div>
                          <span className="text-center text-sm font-bold" style={{ color: textMain }}>{p.rating}</span>
                          <span className="text-center text-sm font-semibold" style={{ color: "oklch(0.65 0.2 145)" }}>{p.wins}</span>
                          <span className="text-center text-sm" style={{ color: textMuted }}>{p.draws}</span>
                          <span className="text-center text-sm" style={{ color: "oklch(0.6 0.2 25)" }}>{p.losses}</span>
                          <div className="flex justify-center">
                            <span className="text-sm font-black px-1.5 py-0.5 rounded" style={{ color: accent, background: `${accent}18` }}>{p.points}</span>
                          </div>
                          <div className="flex gap-0.5 justify-center">
                            {lastArr.map((r, j) => <ResultDot key={j} r={r} />)}
                          </div>
                        </div>
                      );
                    })}

                    {/* Mobile rows */}
                    {DEMO_PLAYERS.slice(0, 8).map((p, i) => (
                      <div
                        key={`m-${p.id}`}
                        className="sm:hidden flex items-center gap-3 px-4 py-3"
                        style={{ borderBottom: i < 7 ? `1px solid ${cardBorder}` : "none" }}
                      >
                        <span className="text-xs font-bold w-5 text-center flex-shrink-0" style={{ color: textMuted }}>{i + 1}</span>
                        <Avatar name={p.displayName} size={9} url={getAvatar(p.chesscomUsername)} />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold truncate" style={{ color: textMain }}>{p.displayName}</div>
                          <div className="text-[11px]" style={{ color: textMuted }}>{p.rating} ELO</div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="text-base font-black" style={{ color: accent }}>{p.points}</div>
                          <div className="text-[10px]" style={{ color: textMuted }}>{p.wins}W {p.draws}D {p.losses}L</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ── RIGHT PANEL: Upcoming Matchups ─────────────────────────── */}
                <div
                  className="hidden xl:flex flex-col w-72 flex-shrink-0 border-l overflow-y-auto"
                  style={{ borderColor: cardBorder, background: isDark ? "oklch(0.17 0.05 145)" : "#f9fafb" }}
                >
                  <div className="px-4 py-3 flex items-center justify-between sticky top-0 z-10" style={{ borderBottom: `1px solid ${cardBorder}`, background: isDark ? "oklch(0.17 0.05 145)" : "#f9fafb" }}>
                    <span className="text-sm font-bold" style={{ color: textMain }}>Week 14 Matchups</span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: `${accent}22`, color: accent }}>
                      {CURRENT_WEEK_MATCHUPS.filter(m => !m.result).length} pending
                    </span>
                  </div>
                  <div className="p-3 space-y-2">
                    {CURRENT_WEEK_MATCHUPS.map((m, i) => {
                      const resultLabel = m.result === "white_win" ? `${m.white.displayName.split(" ")[0]} won` : m.result === "black_win" ? `${m.black.displayName.split(" ")[0]} won` : m.result === "draw" ? "Draw" : null;
                      const resultColor = m.result === "white_win" ? "oklch(0.65 0.2 145)" : m.result === "black_win" ? "oklch(0.65 0.2 145)" : m.result === "draw" ? textMuted : null;
                      return (
                        <div
                          key={i}
                          className="rounded-xl p-3"
                          style={{
                            background: cardBg,
                            border: `1px solid ${m.result ? cardBorder : `${accent}33`}`,
                          }}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: textMuted }}>Board {i + 1}</span>
                            {resultLabel ? (
                              <span className="text-[10px] font-bold" style={{ color: resultColor ?? textMuted }}>{resultLabel}</span>
                            ) : (
                              <span className="text-[10px] font-semibold animate-pulse" style={{ color: accent }}>Pending</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Avatar name={m.white.displayName} size={7} url={getAvatar(m.white.chesscomUsername)} />
                            <span className="text-xs font-semibold flex-1 truncate" style={{ color: textMain }}>{m.white.displayName}</span>
                            <span className="text-[10px] font-bold" style={{ color: textMuted }}>vs</span>
                            <span className="text-xs font-semibold flex-1 truncate text-right" style={{ color: textMain }}>{m.black.displayName}</span>
                            <Avatar name={m.black.displayName} size={7} url={getAvatar(m.black.chesscomUsername)} />
                          </div>
                          <div className="flex items-center justify-between mt-1.5">
                            <span className="text-[10px]" style={{ color: textMuted }}>{m.white.rating}</span>
                            <span className="text-[10px]" style={{ color: textMuted }}>{m.black.rating}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* ── MATCHUP TAB ───────────────────────────────────────────────── */}
            {activeTab === "matchup" && (
              <div className="p-4 lg:p-6 max-w-3xl mx-auto space-y-5">
                {/* Hero card */}
                <div
                  className="rounded-2xl overflow-hidden"
                  style={{ background: cardBg, border: `1.5px solid ${accent}44` }}
                >
                  {/* Header */}
                  <div
                    className="px-5 py-3.5 flex items-center justify-between"
                    style={{ borderBottom: `1px solid ${cardBorder}`, background: isDark ? `${accent}0a` : `${accent}08` }}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <Swords size={15} style={{ color: accent }} />
                        <span className="font-bold text-sm" style={{ color: textMain }}>Current Matchup</span>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full animate-pulse" style={{ background: `${accent}22`, color: accent }}>Live</span>
                      </div>
                      <div className="text-xs mt-0.5" style={{ color: textMuted }}>Round 14 · Premier League · 90m + 30s</div>
                    </div>
                  </div>

                  {/* Players */}
                  <div className="p-6">
                    <div className="flex items-center justify-between gap-6">
                      {/* White */}
                      <div className="flex flex-col items-center gap-3 flex-1">
                        <div className="relative">
                          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden" style={{ outline: `4px solid ${accent}`, outlineOffset: "2px" }}>
                            <Avatar name={featuredMatchup.white.displayName} size={24} url={getAvatar(featuredMatchup.white.chesscomUsername)} />
                          </div>
                          <span
                            className="absolute -bottom-2 left-1/2 -translate-x-1/2 text-[9px] font-black px-2 py-0.5 rounded-full whitespace-nowrap shadow-md"
                            style={{ background: "#f0f5ee", color: "#111827", border: "1px solid #e5e7eb" }}
                          >
                            WHITE
                          </span>
                        </div>
                        <div className="text-center mt-2">
                          <div className="font-black text-base" style={{ color: textMain }}>{featuredMatchup.white.displayName}</div>
                          <div className="text-xs font-medium" style={{ color: textMuted }}>@{featuredMatchup.white.chesscomUsername}</div>
                          <div className="text-sm font-bold mt-1" style={{ color: accent }}>{featuredMatchup.white.rating} ELO</div>
                        </div>
                      </div>

                      {/* VS center */}
                      <div className="flex flex-col items-center gap-2 flex-shrink-0">
                        <div className="text-3xl font-black" style={{ color: textMuted }}>VS</div>
                        <div className="flex items-center gap-1 text-xs" style={{ color: textMuted }}>
                          <Clock size={11} />
                          <span>90m + 30s</span>
                        </div>
                      </div>

                      {/* Black */}
                      <div className="flex flex-col items-center gap-3 flex-1">
                        <div className="relative">
                          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden">
                            <Avatar name={featuredMatchup.black.displayName} size={24} url={getAvatar(featuredMatchup.black.chesscomUsername)} />
                          </div>
                          <span
                            className="absolute -bottom-2 left-1/2 -translate-x-1/2 text-[9px] font-black px-2 py-0.5 rounded-full whitespace-nowrap shadow-md"
                            style={{ background: "#111827", color: "#f0f5ee", border: "1px solid #374151" }}
                          >
                            BLACK
                          </span>
                        </div>
                        <div className="text-center mt-2">
                          <div className="font-black text-base" style={{ color: textMain }}>{featuredMatchup.black.displayName}</div>
                          <div className="text-xs font-medium" style={{ color: textMuted }}>@{featuredMatchup.black.chesscomUsername}</div>
                          <div className="text-sm font-bold mt-1" style={{ color: accent }}>{featuredMatchup.black.rating} ELO</div>
                        </div>
                      </div>
                    </div>

                    {/* H2H */}
                    <div className="mt-6 pt-5" style={{ borderTop: `1px solid ${cardBorder}` }}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold" style={{ color: textMain }}>{featuredMatchup.white.displayName.split(" ")[0]}</span>
                        <span className="text-[10px] uppercase tracking-widest font-bold" style={{ color: textMuted }}>Head to Head</span>
                        <span className="text-xs font-semibold" style={{ color: textMain }}>{featuredMatchup.black.displayName.split(" ")[0]}</span>
                      </div>
                      <div className="flex items-center justify-between mb-2 text-sm font-bold">
                        <span style={{ color: "oklch(0.65 0.2 145)" }}>{h2hW}W</span>
                        <span style={{ color: textMuted }}>{h2hD}D</span>
                        <span style={{ color: "oklch(0.6 0.2 25)" }}>{h2hL}L</span>
                      </div>
                      <div className="flex rounded-full overflow-hidden h-2.5">
                        <div className="transition-all" style={{ width: `${(h2hW / h2hTotal) * 100}%`, background: "oklch(0.65 0.2 145)" }} />
                        <div className="transition-all" style={{ width: `${(h2hD / h2hTotal) * 100}%`, background: "oklch(0.45 0.04 145)" }} />
                        <div className="transition-all" style={{ width: `${(h2hL / h2hTotal) * 100}%`, background: "oklch(0.6 0.2 25)" }} />
                      </div>
                    </div>

                    {/* League Form */}
                    <div className="mt-5 pt-5" style={{ borderTop: `1px solid ${cardBorder}` }}>
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-bold uppercase tracking-wider" style={{ color: textMuted }}>League Form</span>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: isDark ? "oklch(0.25 0.06 145)" : "#f3f4f6", color: textMuted }}>Last 5 Games</span>
                      </div>
                      {[featuredMatchup.white, featuredMatchup.black].map((p) => (
                        <div key={p.id} className="flex items-center gap-3 mb-2">
                          <Avatar name={p.displayName} size={7} url={getAvatar(p.chesscomUsername)} />
                          <span className="text-xs font-semibold flex-1 truncate" style={{ color: textMain }}>{p.displayName}</span>
                          <div className="flex gap-1">
                            {p.lastResults.split(",").map((r, j) => <FormBadge key={j} result={r} />)}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* CTA */}
                    <div className="mt-5 pt-4" style={{ borderTop: `1px solid ${cardBorder}` }}>
                      <button
                        onClick={() => navigate("/")}
                        className="w-full py-3 rounded-xl font-bold text-sm transition-all hover:opacity-90 hover:-translate-y-0.5"
                        style={{ background: accent, color: "#fff" }}
                      >
                        Start Your Own League →
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── STANDINGS TAB ─────────────────────────────────────────────── */}
            {activeTab === "standings" && (
              <div className="p-4 lg:p-6">
                <div className="rounded-2xl overflow-hidden" style={{ background: cardBg, border: `1px solid ${cardBorder}` }}>
                  {/* Header */}
                  <div
                    className="hidden sm:grid items-center px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest"
                    style={{
                      borderBottom: `1px solid ${cardBorder}`,
                      color: textMuted,
                      background: isDark ? "oklch(0.17 0.05 145)" : "#f3f4f6",
                      gridTemplateColumns: "3rem 1fr 4.5rem 3rem 2.5rem 2.5rem 2.5rem 3.5rem 5rem",
                      gap: "0.5rem",
                    }}
                  >
                    <span className="text-center">POS</span>
                    <span>Player</span>
                    <span className="text-center">Rating</span>
                    <span className="text-center">MP</span>
                    <span className="text-center">W</span>
                    <span className="text-center">D</span>
                    <span className="text-center">L</span>
                    <span className="text-center">PTS</span>
                    <span className="text-center">Form</span>
                  </div>

                  {DEMO_PLAYERS.map((p, i) => {
                    const podiumColor = i === 0 ? "#f59e0b" : i === 1 ? "#9ca3af" : i === 2 ? "#cd7c2f" : null;
                    const gamesPlayed = p.wins + p.draws + p.losses;
                    const lastArr = p.lastResults.split(",");
                    return (
                      <div key={p.id}>
                        {/* Desktop row */}
                        <div
                          className="hidden sm:grid items-center px-4 py-2.5 transition-colors hover:bg-white/5"
                          style={{
                            gridTemplateColumns: "3rem 1fr 4.5rem 3rem 2.5rem 2.5rem 2.5rem 3.5rem 5rem",
                            gap: "0.5rem",
                            borderBottom: i < DEMO_PLAYERS.length - 1 ? `1px solid ${cardBorder}` : "none",
                            background: i < 3 && podiumColor ? `${podiumColor}06` : "transparent",
                          }}
                        >
                          <div className="flex justify-center">
                            {podiumColor ? (
                              <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black" style={{ background: `${podiumColor}20`, color: podiumColor, boxShadow: i === 0 ? `0 0 12px ${podiumColor}33` : "none" }}>
                                {i + 1}
                              </div>
                            ) : (
                              <span className="text-sm font-medium" style={{ color: textMuted }}>{i + 1}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2.5 min-w-0">
                            <Avatar name={p.displayName} size={9} url={getAvatar(p.chesscomUsername)} />
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <MovementIcon movement={p.movement} />
                                <span className="text-sm font-semibold truncate" style={{ color: textMain }}>{p.displayName}</span>
                                {p.streak.length >= 3 && (
                                  <span
                                    className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                                    style={{
                                      background: p.streak.startsWith("W") ? "#4ade8022" : p.streak.startsWith("L") ? "#ef444422" : "transparent",
                                      color: p.streak.startsWith("W") ? "#4ade80" : p.streak.startsWith("L") ? "#ef4444" : textMuted,
                                    }}
                                  >
                                    {p.streak}
                                  </span>
                                )}
                              </div>
                              <span className="text-[11px] truncate block" style={{ color: textMuted }}>@{p.chesscomUsername}</span>
                            </div>
                          </div>
                          <div className="flex flex-col items-center">
                            <span className="text-sm font-bold" style={{ color: textMain }}>{p.rating}</span>
                            <span className="text-[9px] uppercase tracking-wide" style={{ color: textMuted }}>ELO</span>
                          </div>
                          <span className="text-center text-sm font-medium" style={{ color: textMuted }}>{gamesPlayed}</span>
                          <span className="text-center text-sm font-semibold" style={{ color: "oklch(0.65 0.2 145)" }}>{p.wins}</span>
                          <span className="text-center text-sm font-medium" style={{ color: textMuted }}>{p.draws}</span>
                          <span className="text-center text-sm font-medium" style={{ color: "oklch(0.6 0.2 25)" }}>{p.losses}</span>
                          <div className="flex items-center justify-center">
                            <span className="text-sm font-black px-2 py-0.5 rounded-lg" style={{ color: accent, background: `${accent}18` }}>{p.points}</span>
                          </div>
                          <div className="flex gap-1 justify-center">
                            {lastArr.map((r, j) => <ResultDot key={j} r={r} />)}
                          </div>
                        </div>

                        {/* Mobile card */}
                        <div
                          className="sm:hidden flex items-center gap-3 px-4 py-3"
                          style={{ borderBottom: i < DEMO_PLAYERS.length - 1 ? `1px solid ${cardBorder}` : "none" }}
                        >
                          <div className="w-7 text-center flex-shrink-0">
                            {podiumColor ? (
                              <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black mx-auto" style={{ background: `${podiumColor}20`, color: podiumColor }}>{i + 1}</div>
                            ) : (
                              <span className="text-xs font-medium" style={{ color: textMuted }}>{i + 1}</span>
                            )}
                          </div>
                          <Avatar name={p.displayName} size={9} url={getAvatar(p.chesscomUsername)} />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold truncate" style={{ color: textMain }}>{p.displayName}</div>
                            <div className="text-[11px]" style={{ color: textMuted }}>{p.rating} ELO</div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <div className="text-base font-black" style={{ color: accent }}>{p.points}</div>
                            <div className="text-[10px]" style={{ color: textMuted }}>{p.wins}W {p.draws}D {p.losses}L</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── SCHEDULE TAB ──────────────────────────────────────────────── */}
            {activeTab === "schedule" && (
              <div className="p-4 lg:p-6 space-y-4">
                {Array.from({ length: 16 }, (_, i) => i + 1).map((week) => {
                  const isCurrentWeek = week === 14;
                  const isPast = week < 14;
                  return (
                    <div
                      key={week}
                      className="rounded-2xl overflow-hidden"
                      style={{ background: cardBg, border: `1.5px solid ${isCurrentWeek ? `${accent}55` : cardBorder}` }}
                    >
                      <div
                        className="flex items-center justify-between px-4 py-3"
                        style={{
                          borderBottom: `1px solid ${cardBorder}`,
                          background: isCurrentWeek ? `${accent}10` : isDark ? "oklch(0.23 0.06 145)" : "#f9fafb",
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <Calendar size={14} style={{ color: isCurrentWeek ? accent : textMuted }} />
                          <span className="font-semibold text-sm" style={{ color: textMain }}>Week {week}</span>
                          {isCurrentWeek && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse" style={{ background: `${accent}22`, color: accent }}>Current</span>
                          )}
                          {isPast && (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: isDark ? "oklch(0.25 0.06 145)" : "#f3f4f6", color: textMuted }}>Complete</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {isPast && <CheckCircle2 size={14} style={{ color: "oklch(0.65 0.2 145)" }} />}
                          {isCurrentWeek && <Clock size={14} style={{ color: accent }} />}
                          <span className="text-xs" style={{ color: textMuted }}>
                            {isPast ? `${Math.floor(Math.random() * 5) + 8}/12 completed` : isCurrentWeek ? "7/12 completed" : "Upcoming"}
                          </span>
                        </div>
                      </div>
                      {isCurrentWeek && (
                        <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {CURRENT_WEEK_MATCHUPS.slice(0, 4).map((m, j) => (
                            <div key={j} className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: isDark ? "oklch(0.23 0.06 145)" : "#f9fafb" }}>
                              <span className="text-[10px] font-bold w-4 text-center flex-shrink-0" style={{ color: textMuted }}>{j + 1}</span>
                              <span className="text-xs font-semibold truncate flex-1" style={{ color: textMain }}>{m.white.displayName.split(" ")[0]}</span>
                              <span className="text-[10px] font-bold" style={{ color: textMuted }}>vs</span>
                              <span className="text-xs font-semibold truncate flex-1 text-right" style={{ color: textMain }}>{m.black.displayName.split(" ")[0]}</span>
                              {m.result ? (
                                <CheckCircle2 size={12} style={{ color: "oklch(0.65 0.2 145)", flexShrink: 0 }} />
                              ) : (
                                <Clock size={12} style={{ color: accent, flexShrink: 0 }} />
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── HISTORY TAB ───────────────────────────────────────────────── */}
            {activeTab === "history" && (
              <div className="p-4 lg:p-6 space-y-4">
                <div className="rounded-2xl p-6 text-center" style={{ background: cardBg, border: `1px solid ${cardBorder}` }}>
                  <History size={36} className="mx-auto mb-3 opacity-40" style={{ color: accent }} />
                  <div className="text-base font-bold mb-1" style={{ color: textMain }}>Season in Progress</div>
                  <div className="text-sm" style={{ color: textMuted }}>Season history will appear here once the current season completes (Week 16/16).</div>
                  <div className="mt-4 text-xs font-semibold" style={{ color: textMuted }}>2 weeks remaining</div>
                </div>

                {/* Past seasons teaser */}
                <div className="rounded-2xl overflow-hidden" style={{ background: cardBg, border: `1px solid ${cardBorder}` }}>
                  <div className="px-5 py-3" style={{ borderBottom: `1px solid ${cardBorder}` }}>
                    <span className="text-sm font-bold" style={{ color: textMain }}>Past Seasons</span>
                  </div>
                  {[
                    { season: "Season 1", winner: "Magnus Carlsen", weeks: 12, year: "2025" },
                    { season: "Season 2", winner: "Hikaru Nakamura", weeks: 14, year: "2025" },
                    { season: "Season 3", winner: "Fabiano Caruana", weeks: 16, year: "2026" },
                  ].map((s, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-4 px-5 py-4"
                      style={{ borderBottom: i < 2 ? `1px solid ${cardBorder}` : "none" }}
                    >
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${accent}18` }}>
                        <Trophy size={16} style={{ color: accent }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold" style={{ color: textMain }}>{s.season}</div>
                        <div className="text-xs" style={{ color: textMuted }}>{s.weeks} weeks · {s.year}</div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="flex items-center gap-1">
                          <Crown size={12} style={{ color: "#f59e0b" }} />
                          <span className="text-xs font-semibold" style={{ color: textMain }}>{s.winner}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── MOBILE BOTTOM NAV ─────────────────────────────────────────── */}
            <div
              className="lg:hidden fixed bottom-0 left-0 right-0 flex items-center justify-around px-2 py-2 z-40"
              style={{
                background: isDark ? "oklch(0.15 0.04 145 / 0.97)" : "#0f1f14",
                borderTop: `1px solid ${isDark ? "oklch(0.22 0.06 145)" : "oklch(0.22 0.08 145)"}`,
                backdropFilter: "blur(12px)",
              }}
            >
              {TABS.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all"
                    style={{
                      background: isActive ? `${accent}22` : "transparent",
                      color: isActive ? accent : "oklch(0.55 0.08 145)",
                    }}
                  >
                    <Icon size={18} />
                    <span className="text-[9px] font-semibold">{tab.label}</span>
                  </button>
                );
              })}
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
