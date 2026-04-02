/**
 * DashboardDropdown — shown below the Tournaments nav tab on hover/click.
 *
 * Layout:
 *   1. Active Tournament card (prominent, with live status badge) — only if one exists
 *   2. Recent Tournaments list (past / other tournaments, up to 4)
 *   3. My Leagues section
 *   4. Footer: New Tournament / Browse Clubs
 */

import { useState, useEffect } from "react";
import { Shield, User, Plus, ChevronRight, Trophy, Swords, Pause, Clock } from "lucide-react";
import { listTournaments, hasDirectorSession, resolveTournament } from "@/lib/tournamentRegistry";
import { getAllRegistrations } from "@/lib/registrationStore";
import { useActiveTournament } from "@/hooks/useActiveTournament";

interface TournamentEntry {
  id: string;
  name: string;
  date: string;
  role: "director" | "player";
  url: string;
  sortKey: string;
}

interface MyLeague {
  id: string;
  name: string;
  status: string;
  currentWeek: number;
  totalWeeks: number;
  maxPlayers: number;
  playerCount: number;
  myStanding: { rank: number; points: number; wins: number; draws: number; losses: number } | null;
}

function buildAllEntries(): TournamentEntry[] {
  const entries: TournamentEntry[] = [];
  const seen = new Set<string>();

  const allTournaments = listTournaments();
  for (const t of allTournaments) {
    if (hasDirectorSession(t.id) && !seen.has(t.id)) {
      seen.add(t.id);
      entries.push({
        id: t.id,
        name: t.name || t.id,
        date: t.date || t.createdAt?.slice(0, 10) || "",
        role: "director",
        url: `/tournament/${t.id}/manage`,
        sortKey: t.createdAt || t.date || "",
      });
    }
  }

  const registrations = getAllRegistrations();
  for (const reg of registrations) {
    const config = resolveTournament(reg.tournamentId);
    const id = config?.id ?? reg.tournamentId;
    if (!seen.has(id)) {
      seen.add(id);
      entries.push({
        id,
        name: reg.tournamentName || config?.name || id,
        date: config?.date || reg.registeredAt?.slice(0, 10) || "",
        role: "player",
        url: `/tournament/${id}`,
        sortKey: reg.registeredAt || "",
      });
    }
  }

  return entries.sort((a, b) => b.sortKey.localeCompare(a.sortKey));
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  try {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function leagueStatusLabel(s: string): { text: string; cls: string } {
  switch (s) {
    case "draft":     return { text: "Draft",     cls: "bg-amber-500/20 text-amber-400" };
    case "active":    return { text: "Active",    cls: "bg-emerald-500/20 text-emerald-400" };
    case "completed": return { text: "Completed", cls: "bg-white/10 text-white/50" };
    default:          return { text: s,           cls: "bg-white/10 text-white/50" };
  }
}

export function DashboardDropdown() {
  const activeTournament = useActiveTournament();
  const allEntries = buildAllEntries();
  const [myLeagues, setMyLeagues] = useState<MyLeague[]>([]);

  useEffect(() => {
    fetch("/api/leagues/mine", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setMyLeagues(data))
      .catch(() => {});
  }, []);

  // Entries that are NOT the active tournament (shown in "Recent" section)
  const recentEntries = allEntries
    .filter((e) => !activeTournament || e.id !== activeTournament.id)
    .slice(0, 4);

  // Status badge config for active tournament
  type StatusKey = "in_progress" | "paused" | "registration" | "unknown" | "completed";
  const statusConfig: Record<StatusKey, { label: string; color: string; bg: string; pulse: boolean; icon: React.ElementType | null }> = {
    in_progress:  { label: "LIVE",   color: "#4CAF50", bg: "rgba(76,175,80,0.15)",   pulse: true,  icon: null  },
    paused:       { label: "PAUSED", color: "#F59E0B", bg: "rgba(245,158,11,0.15)", pulse: false, icon: Pause },
    registration: { label: "LOBBY",  color: "#60A5FA", bg: "rgba(96,165,250,0.15)", pulse: false, icon: Clock },
    unknown:      { label: "ACTIVE", color: "#4CAF50", bg: "rgba(76,175,80,0.12)",  pulse: true,  icon: null  },
    completed:    { label: "DONE",   color: "#9CA3AF", bg: "rgba(156,163,175,0.12)",pulse: false, icon: null  },
  };

  return (
    <div
      className="w-80 rounded-2xl border border-white/10 shadow-2xl overflow-hidden"
      style={{
        background: "rgba(10,31,10,0.96)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        maxHeight: "70vh",
        overflowY: "auto",
      }}
    >
      {/* ── Active Tournament Card ── */}
      {activeTournament && (() => {
        const st = statusConfig[activeTournament.status as StatusKey] ?? statusConfig.unknown;
        const StatusIcon = st.icon;
        return (
          <div className="p-3">
            <a
              href={activeTournament.href}
              onClick={(e) => { e.preventDefault(); window.location.href = activeTournament.href; }}
              className="flex items-center gap-3 p-3 rounded-xl border border-[#4CAF50]/25 bg-[#3D6B47]/15 hover:bg-[#3D6B47]/25 transition-all group active:scale-[0.98]"
            >
              {/* Role icon */}
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-[#4CAF50]/20 text-[#4CAF50]">
                {activeTournament.role === "director"
                  ? <Shield className="w-5 h-5" />
                  : <Trophy className="w-5 h-5" />}
              </div>

              {/* Text */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  {/* Status badge */}
                  <span
                    className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full"
                    style={{ color: st.color, background: st.bg }}
                  >
                    {st.pulse && (
                      <span
                        className="w-1.5 h-1.5 rounded-full animate-pulse flex-shrink-0"
                        style={{ background: st.color }}
                      />
                    )}
                    {StatusIcon && <StatusIcon className="w-2.5 h-2.5" />}
                    {st.label}
                  </span>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
                    {activeTournament.role === "director" ? "Director" : "Player"}
                  </span>
                </div>
                <p className="text-sm font-bold text-white truncate leading-tight" style={{ fontFamily: "'Clash Display', sans-serif" }}>
                  {activeTournament.name}
                </p>
                <p className="text-xs text-white/45 mt-0.5">
                  {activeTournament.role === "director" ? "Tap to manage" : "Tap to view standings"}
                </p>
              </div>

              <ChevronRight className="w-4 h-4 text-[#4CAF50]/50 group-hover:text-[#4CAF50] group-hover:translate-x-0.5 transition-all flex-shrink-0" />
            </a>
          </div>
        );
      })()}

      {/* ── Recent Tournaments Section ── */}
      {recentEntries.length > 0 && (
        <>
          <div className={`px-4 py-2.5 flex items-center gap-2 ${activeTournament ? "border-t border-white/08" : ""}`}>
            <Trophy className="w-3.5 h-3.5 text-white/30" />
            <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">
              {activeTournament ? "Recent" : "My Tournaments"}
            </span>
          </div>
          <ul>
            {recentEntries.map((entry) => (
              <li key={`${entry.role}-${entry.id}`}>
                <a
                  href={entry.url}
                  onClick={(e) => { e.preventDefault(); window.location.href = entry.url; }}
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/06 transition-colors group"
                >
                  <div className={`flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center ${
                    entry.role === "director" ? "bg-[#3D6B47]/30 text-[#4CAF50]" : "bg-white/08 text-white/40"
                  }`}>
                    {entry.role === "director" ? <Shield className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white/80 truncate leading-tight font-medium">{entry.name}</p>
                    {entry.date && (
                      <p className="text-[10px] text-white/30 mt-0.5">{formatDate(entry.date)}</p>
                    )}
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-white/15 group-hover:text-white/40 transition-colors flex-shrink-0" />
                </a>
              </li>
            ))}
          </ul>
        </>
      )}

      {/* Empty state when no tournaments at all */}
      {!activeTournament && recentEntries.length === 0 && (
        <div className="px-4 py-6 text-center">
          <Trophy className="w-8 h-8 text-white/15 mx-auto mb-2" />
          <p className="text-sm text-white/40">No tournaments yet</p>
          <p className="text-xs text-white/25 mt-1">Host or join one to get started</p>
        </div>
      )}

      {/* Footer: New Tournament */}
      <div className="border-t border-white/08">
        <a
          href="/"
          onClick={(e) => { e.preventDefault(); window.location.href = "/"; }}
          className="flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-[#4CAF50] hover:bg-[#3D6B47]/15 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          New Tournament
        </a>
      </div>

      {/* ── My Leagues Section ── */}
      {myLeagues.length > 0 && (
        <>
          <div className="px-4 py-2.5 border-t border-white/08 flex items-center gap-2">
            <Swords className="w-3.5 h-3.5 text-[#4CAF50]" />
            <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">
              My Leagues
            </span>
          </div>
          <ul>
            {myLeagues.map((lg) => {
              const st = leagueStatusLabel(lg.status);
              return (
                <li key={lg.id}>
                  <a
                    href={`/leagues/${lg.id}`}
                    onClick={(e) => { e.preventDefault(); window.location.href = `/leagues/${lg.id}`; }}
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/06 transition-colors group"
                  >
                    <div className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center bg-[#3D6B47]/30 text-[#4CAF50]">
                      <Swords className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white/80 truncate leading-tight font-medium">{lg.name}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full ${st.cls}`}>
                          {st.text}
                        </span>
                        {lg.status === "active" && (
                          <span className="text-[10px] text-white/30">Week {lg.currentWeek}/{lg.totalWeeks}</span>
                        )}
                        {lg.myStanding && lg.status === "active" && (
                          <span className="text-[10px] text-white/40">#{lg.myStanding.rank} · {lg.myStanding.points}pts</span>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-white/15 group-hover:text-white/40 transition-colors flex-shrink-0" />
                  </a>
                </li>
              );
            })}
          </ul>

          <div className="border-t border-white/08">
            <a
              href="/clubs"
              onClick={(e) => { e.preventDefault(); window.location.href = "/clubs"; }}
              className="flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-[#4CAF50] hover:bg-[#3D6B47]/15 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Browse Clubs &amp; Leagues
            </a>
          </div>
        </>
      )}
    </div>
  );
}
