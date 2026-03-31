/**
 * DashboardDropdown — shown below the Dashboard nav tab on hover.
 *
 * Two sections:
 *   1. My Tournaments — director sessions + player registrations
 *   2. My Leagues — fetched from /api/leagues/mine
 */

import { useState, useEffect } from "react";
import { Shield, User, Plus, ChevronRight, Trophy, Swords } from "lucide-react";
import { listTournaments, hasDirectorSession, resolveTournament } from "@/lib/tournamentRegistry";
import { getAllRegistrations } from "@/lib/registrationStore";

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

function buildEntries(): TournamentEntry[] {
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

  return entries
    .sort((a, b) => b.sortKey.localeCompare(a.sortKey))
    .slice(0, 5);
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

function statusLabel(s: string): { text: string; cls: string } {
  switch (s) {
    case "draft":
      return { text: "Draft", cls: "bg-amber-500/20 text-amber-400" };
    case "active":
      return { text: "Active", cls: "bg-emerald-500/20 text-emerald-400" };
    case "completed":
      return { text: "Completed", cls: "bg-white/10 text-white/50" };
    default:
      return { text: s, cls: "bg-white/10 text-white/50" };
  }
}

export function DashboardDropdown() {
  const entries = buildEntries();
  const [myLeagues, setMyLeagues] = useState<MyLeague[]>([]);

  useEffect(() => {
    fetch("/api/leagues/mine", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setMyLeagues(data))
      .catch(() => {});
  }, []);

  return (
    <div
      className="w-80 rounded-2xl border border-white/10 shadow-2xl overflow-hidden max-h-[70vh] overflow-y-auto"
      style={{
        background: "rgba(10,31,10,0.96)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
      }}
    >
      {/* ── My Tournaments Section ── */}
      <div className="px-4 py-3 border-b border-white/08 flex items-center gap-2">
        <Trophy className="w-3.5 h-3.5 text-[#4CAF50]" />
        <span className="text-xs font-bold text-white/60 uppercase tracking-widest">
          My Tournaments
        </span>
      </div>

      {entries.length === 0 ? (
        <div className="px-4 py-4 text-center">
          <p className="text-sm text-white/40">No recent tournaments</p>
          <p className="text-xs text-white/25 mt-1">Host or join one to get started</p>
        </div>
      ) : (
        <ul>
          {entries.map((entry) => (
            <li key={`${entry.role}-${entry.id}`}>
              <a
                href={entry.url}
                onClick={(e) => {
                  e.preventDefault();
                  window.location.href = entry.url;
                }}
                className="flex items-center gap-3 px-4 py-3 hover:bg-white/06 transition-colors group"
              >
                <div
                  className={`flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center ${
                    entry.role === "director"
                      ? "bg-[#3D6B47]/30 text-[#4CAF50]"
                      : "bg-white/08 text-white/50"
                  }`}
                >
                  {entry.role === "director" ? (
                    <Shield className="w-4 h-4" />
                  ) : (
                    <User className="w-4 h-4" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white/90 truncate leading-tight">
                    {entry.name}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full ${
                        entry.role === "director"
                          ? "bg-[#3D6B47]/30 text-[#4CAF50]"
                          : "bg-white/08 text-white/40"
                      }`}
                    >
                      {entry.role === "director" ? "Director" : "Player"}
                    </span>
                    {entry.date && (
                      <span className="text-[10px] text-white/30">
                        {formatDate(entry.date)}
                      </span>
                    )}
                  </div>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-white/20 group-hover:text-white/50 transition-colors flex-shrink-0" />
              </a>
            </li>
          ))}
        </ul>
      )}

      {/* Footer: New Tournament */}
      <div className="border-t border-white/08">
        <a
          href="/"
          onClick={(e) => {
            e.preventDefault();
            window.location.href = "/";
          }}
          className="flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-[#4CAF50] hover:bg-[#3D6B47]/15 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          New Tournament
        </a>
      </div>

      {/* ── My Leagues Section ── */}
      <div className="px-4 py-3 border-t border-white/08 flex items-center gap-2">
        <Swords className="w-3.5 h-3.5 text-[#4CAF50]" />
        <span className="text-xs font-bold text-white/60 uppercase tracking-widest">
          My Leagues
        </span>
      </div>

      {myLeagues.length === 0 ? (
        <div className="px-4 py-4 text-center">
          <p className="text-sm text-white/40">No active leagues</p>
          <p className="text-xs text-white/25 mt-1">Join a club league to compete</p>
        </div>
      ) : (
        <ul>
          {myLeagues.map((lg) => {
            const st = statusLabel(lg.status);
            return (
              <li key={lg.id}>
                <a
                  href={`/leagues/${lg.id}`}
                  onClick={(e) => {
                    e.preventDefault();
                    window.location.href = `/leagues/${lg.id}`;
                  }}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-white/06 transition-colors group"
                >
                  <div className="flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center bg-[#3D6B47]/30 text-[#4CAF50]">
                    <Swords className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white/90 truncate leading-tight">
                      {lg.name}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full ${st.cls}`}>
                        {st.text}
                      </span>
                      {lg.status === "active" && (
                        <span className="text-[10px] text-white/30">
                          Week {lg.currentWeek}/{lg.totalWeeks}
                        </span>
                      )}
                      {lg.myStanding && lg.status === "active" && (
                        <span className="text-[10px] text-white/40">
                          #{lg.myStanding.rank} · {lg.myStanding.points}pts
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-white/20 group-hover:text-white/50 transition-colors flex-shrink-0" />
                </a>
              </li>
            );
          })}
        </ul>
      )}

      {/* Footer: Browse Clubs */}
      <div className="border-t border-white/08">
        <a
          href="/clubs"
          onClick={(e) => {
            e.preventDefault();
            window.location.href = "/clubs";
          }}
          className="flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-[#4CAF50] hover:bg-[#3D6B47]/15 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Browse Clubs & Leagues
        </a>
      </div>
    </div>
  );
}
