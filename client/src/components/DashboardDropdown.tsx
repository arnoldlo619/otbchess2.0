/**
 * DashboardDropdown — shown below the Dashboard nav tab on hover.
 *
 * Merges director sessions and player registrations into a unified
 * list of up to 5 recent tournaments, each with a role badge.
 * A "New Tournament" footer link is always shown at the bottom.
 */

import { Shield, User, Plus, ChevronRight, Trophy } from "lucide-react";
import { listTournaments, hasDirectorSession, resolveTournament } from "@/lib/tournamentRegistry";
import { getAllRegistrations } from "@/lib/registrationStore";

interface TournamentEntry {
  id: string;
  name: string;
  date: string;
  role: "director" | "player";
  url: string;
  /** ISO timestamp for sorting */
  sortKey: string;
}

function buildEntries(): TournamentEntry[] {
  const entries: TournamentEntry[] = [];
  const seen = new Set<string>();

  // Director sessions — from tournament registry
  const allTournaments = listTournaments(); // newest-first
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

  // Player registrations — newest-first
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

  // Sort newest-first, cap at 5
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

export function DashboardDropdown() {
  const entries = buildEntries();

  return (
    <div
      className="w-72 rounded-2xl border border-white/10 shadow-2xl overflow-hidden"
      style={{
        background: "rgba(10,31,10,0.96)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
      }}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/08 flex items-center gap-2">
        <Trophy className="w-3.5 h-3.5 text-[#4CAF50]" />
        <span className="text-xs font-bold text-white/60 uppercase tracking-widest">
          My Tournaments
        </span>
      </div>

      {/* Tournament list */}
      {entries.length === 0 ? (
        <div className="px-4 py-5 text-center">
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
                {/* Role icon */}
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

                {/* Name + meta */}
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

                {/* Chevron */}
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
          className="flex items-center gap-2 px-4 py-3 text-xs font-semibold text-[#4CAF50] hover:bg-[#3D6B47]/15 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          New Tournament
        </a>
      </div>
    </div>
  );
}
