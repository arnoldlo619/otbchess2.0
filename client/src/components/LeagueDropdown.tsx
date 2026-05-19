/**
 * LeagueDropdown — shown below the League nav tab on hover/click.
 *
 * Layout:
 *   1. My Leagues list (user's active/draft/completed leagues)
 *   2. Footer: Browse All Leagues / Create League
 */

import { useState, useEffect } from "react";
import { Swords, Plus, ChevronRight, Trophy } from "lucide-react";
import { useAuthContext } from "@/context/AuthContext";

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

function leagueStatusLabel(s: string): { text: string; cls: string } {
  switch (s) {
    case "draft":     return { text: "Draft",     cls: "bg-amber-500/20 text-amber-400" };
    case "active":    return { text: "Active",    cls: "bg-emerald-500/20 text-emerald-400" };
    case "completed": return { text: "Completed", cls: "bg-white/10 text-white/50" };
    default:          return { text: s,           cls: "bg-white/10 text-white/50" };
  }
}

export function LeagueDropdown() {
  const { user } = useAuthContext();
  const [myLeagues, setMyLeagues] = useState<MyLeague[]>([]);
  const isGuest = !user || user.isGuest;

  useEffect(() => {
    if (isGuest) { setMyLeagues([]); return; }
    fetch("/api/leagues/mine", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : []))
      .then((data: MyLeague[]) => setMyLeagues(Array.isArray(data) ? data : []))
      .catch(() => setMyLeagues([]));
  }, [isGuest]);

  return (
    <div
      className="w-72 rounded-2xl border border-white/10 shadow-2xl overflow-hidden"
      style={{
        background: "rgba(10,31,10,0.96)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        maxHeight: "70vh",
        overflowY: "auto",
      }}
    >
      {/* ── My Leagues Section ── */}
      {myLeagues.length > 0 ? (
        <>
          <div className="px-4 py-2.5 flex items-center gap-2">
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
                    href={`/league/${lg.id}`}
                    onClick={(e) => { e.preventDefault(); window.location.href = `/league/${lg.id}`; }}
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
        </>
      ) : (
        /* Empty state */
        <div className="px-4 py-6 text-center">
          <Trophy className="w-8 h-8 text-white/15 mx-auto mb-2" />
          <p className="text-sm text-white/40">No leagues yet</p>
          <p className="text-xs text-white/25 mt-1">Join or create a league to get started</p>
        </div>
      )}

      {/* Footer */}
      <div className="border-t border-white/08">
        <a
          href="/league-demo"
          onClick={(e) => { e.preventDefault(); window.location.href = "/league-demo"; }}
          className="flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-[#4CAF50] hover:bg-[#3D6B47]/15 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Browse Leagues
        </a>
      </div>
    </div>
  );
}
