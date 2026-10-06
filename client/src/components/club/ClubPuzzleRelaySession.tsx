import { useCallback, useEffect, useMemo, useState } from "react";
import { Chessboard } from "react-chessboard";
import { Clock3, Flag, Loader2, Puzzle, Trophy, Users } from "lucide-react";
import { toast } from "sonner";
import {
  getPuzzleRelaySession,
  startPuzzleRelaySession,
  submitPuzzleRelayAttempt,
  type PuzzleRelaySession,
  type PuzzleRelayTeam,
} from "@/lib/clubPuzzleRelayApi";

interface ClubPuzzleRelaySessionProps {
  clubId: string;
  eventId: string;
  currentUserId?: string;
  canManage: boolean;
}

function elapsedLabel(startedAt: string, now: number): string {
  const elapsedSeconds = Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 1000));
  const minutes = Math.floor(elapsedSeconds / 60).toString().padStart(2, "0");
  const seconds = (elapsedSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function activeMember(team: PuzzleRelayTeam) {
  return team.members[team.currentMemberIndex] ?? null;
}

export function ClubPuzzleRelaySession({
  clubId,
  eventId,
  currentUserId,
  canManage,
}: ClubPuzzleRelaySessionProps) {
  const [session, setSession] = useState<PuzzleRelaySession | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [now, setNow] = useState(Date.now());

  const refresh = useCallback(async () => {
    try {
      setSession(await getPuzzleRelaySession(clubId, eventId));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load Puzzle Relay");
    } finally {
      setLoading(false);
    }
  }, [clubId, eventId]);

  useEffect(() => { void refresh(); }, [refresh]);

  const relayIsActive = session?.status === "active";

  useEffect(() => {
    if (!relayIsActive) return;
    const tick = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(tick);
  }, [relayIsActive]);

  const rankedTeams = useMemo(() => (session?.teams ?? [])
    .slice()
    .sort((left, right) => right.score - left.score || left.teamNumber - right.teamNumber), [session]);
  const viewerTeam = session?.teams.find((team) => team.members.some((member) => member.userId === currentUserId)) ?? null;
  const viewerIsActive = Boolean(viewerTeam && activeMember(viewerTeam)?.userId === currentUserId && session?.status === "active");
  const displayTeam = viewerTeam ?? rankedTeams[0] ?? null;
  const currentPuzzle = displayTeam?.currentPuzzle ?? null;

  async function startRelay() {
    setStarting(true);
    try {
      const nextSession = await startPuzzleRelaySession(clubId, eventId);
      setSession(nextSession);
      toast.success("Puzzle Relay is live. Teams are set from the attendee roster.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to start Puzzle Relay");
    } finally {
      setStarting(false);
    }
  }

  async function submitMove(from: string, to: string, promotion?: string) {
    if (!viewerTeam || !viewerIsActive || submitting) return false;
    setSubmitting(true);
    try {
      const result = await submitPuzzleRelayAttempt({ clubId, eventId, teamId: viewerTeam.id, from, to, promotion });
      setSession(result.session);
      if (result.correct) {
        toast.success(result.completed ? "Relay complete. Final standings are ready." : "Solved. Hand the board to your next teammate.");
      } else {
        toast.error("Not this move. Recheck the position and keep working together.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to score that move");
    } finally {
      setSubmitting(false);
    }
    return false;
  }

  if (loading) {
    return <div className="rounded-2xl border border-white/10 bg-black/20 p-5 text-sm text-white/50">Loading Puzzle Relay…</div>;
  }

  if (!session) {
    return (
      <section className="rounded-2xl border border-white/10 bg-black/20 p-5 sm:p-6" aria-labelledby="puzzle-relay-title">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#7cf562]/12 text-[#7cf562]">
            <Puzzle size={20} aria-hidden="true" />
          </span>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#7cf562]">Club format</p>
            <h2 id="puzzle-relay-title" className="mt-1 text-lg font-semibold text-white">Puzzle Relay</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-white/58">Teams solve a sequence of positions. Each correct move hands the board to the next teammate.</p>
          </div>
        </div>
        <div className="mt-5 flex flex-col gap-3 border-t border-white/8 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs leading-5 text-white/46">The director starts the relay from checked-in players and members marked Going.</p>
          {canManage ? (
            <button
              type="button"
              onClick={() => void startRelay()}
              disabled={starting}
              className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#7cf562] px-4 text-sm font-semibold text-[#0b180d] transition hover:bg-[#95fb80] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7cf562] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0c180e] disabled:cursor-not-allowed disabled:opacity-55"
            >
              {starting ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Flag size={16} aria-hidden="true" />}
              Start relay
            </button>
          ) : null}
        </div>
      </section>
    );
  }

  const winner = session.status === "completed" ? rankedTeams[0] ?? null : null;
  const currentPlayer = displayTeam ? activeMember(displayTeam) : null;

  return (
    <section className="rounded-2xl border border-white/10 bg-[#0a150d]/78 shadow-[0_18px_50px_rgba(0,0,0,0.18)]" aria-labelledby="puzzle-relay-title">
      <header className="flex flex-col gap-4 border-b border-white/8 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#7cf562]/12 text-[#7cf562]">
            <Puzzle size={20} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h2 id="puzzle-relay-title" className="text-lg font-semibold text-white">Puzzle Relay</h2>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.13em] ${session.status === "active" ? "bg-[#7cf562]/12 text-[#9cff88]" : "bg-white/8 text-white/56"}`}>
                {session.status === "active" ? "Live" : "Complete"}
              </span>
            </div>
            <p className="mt-1 text-sm text-white/52">{session.puzzlesPerTeam} positions per team · {session.difficulty} difficulty</p>
          </div>
        </div>
        <div className="inline-flex min-h-10 items-center gap-2 self-start rounded-xl border border-white/10 bg-black/20 px-3 text-sm font-medium tabular-nums text-white sm:self-auto" aria-label="Elapsed relay time">
          <Clock3 size={16} className="text-[#7cf562]" aria-hidden="true" />
          {elapsedLabel(session.startedAt, now)}
        </div>
      </header>

      {winner ? (
        <div className="mx-5 mt-5 flex items-center gap-3 rounded-xl border border-[#7cf562]/25 bg-[#7cf562]/8 px-4 py-3 sm:mx-6">
          <Trophy size={18} className="shrink-0 text-[#a5fb85]" aria-hidden="true" />
          <p className="text-sm text-white"><span className="font-semibold">{winner.name}</span> finished first with {winner.score} solved {winner.score === 1 ? "puzzle" : "puzzles"}.</p>
        </div>
      ) : null}

      <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="min-w-0">
          {currentPuzzle && displayTeam ? (
            <div className="overflow-hidden rounded-xl border border-white/10 bg-black/25">
              <div className="flex flex-col gap-3 border-b border-white/8 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#7cf562]">{displayTeam.name} · Position {displayTeam.currentPuzzleIndex + 1} of {session.puzzlesPerTeam}</p>
                  <h3 className="mt-1 text-base font-semibold text-white">{currentPuzzle.title}</h3>
                  <p className="mt-1 text-sm text-white/55">{currentPuzzle.prompt}</p>
                </div>
                <div className="rounded-lg bg-white/5 px-3 py-2 text-xs text-white/62">
                  <span className="font-semibold text-white">{currentPlayer?.displayName ?? "Team turn"}</span>
                  <span className="ml-1">is at the board</span>
                </div>
              </div>
              <div className="mx-auto max-w-[560px] p-3 sm:p-5">
                <Chessboard
                  options={{
                    id: `puzzle-relay-${session.id}-${displayTeam.id}-${displayTeam.currentPuzzleIndex}`,
                    position: currentPuzzle.fen,
                    allowDragging: viewerIsActive && !submitting,
                    onPieceDrop: ({ sourceSquare, targetSquare }) => {
                      if (targetSquare) void submitMove(sourceSquare, targetSquare);
                      return false;
                    },
                    boardStyle: { borderRadius: "12px", boxShadow: "0 18px 32px rgba(0,0,0,0.24)" },
                    darkSquareStyle: { backgroundColor: "#3f6d4c" },
                    lightSquareStyle: { backgroundColor: "#dbe7d8" },
                  }}
                />
              </div>
              <div className="border-t border-white/8 px-4 py-3 text-sm text-white/56">
                {viewerIsActive ? "Your move — solve this position for your team." : viewerTeam ? `Waiting for ${currentPlayer?.displayName ?? "your teammate"} to complete the handoff.` : "Follow the live progress from the sideline."}
              </div>
            </div>
          ) : (
            <div className="flex min-h-56 flex-col items-center justify-center rounded-xl border border-dashed border-white/12 bg-black/15 px-5 text-center">
              <Trophy size={22} className="text-[#7cf562]" aria-hidden="true" />
              <p className="mt-3 text-sm font-medium text-white">Your team has completed the relay.</p>
              <p className="mt-1 text-sm text-white/52">Watch the final positions resolve in the standings.</p>
            </div>
          )}
        </div>

        <aside className="min-w-0 rounded-xl border border-white/8 bg-black/18 p-4" aria-label="Puzzle Relay standings">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-white">Team standings</h3>
            <Users size={16} className="text-white/45" aria-hidden="true" />
          </div>
          <ol className="mt-3 space-y-2">
            {rankedTeams.map((team, index) => {
              const nextPlayer = activeMember(team);
              return (
                <li key={team.id} className={`rounded-lg border px-3 py-3 ${team.id === viewerTeam?.id ? "border-[#7cf562]/30 bg-[#7cf562]/7" : "border-white/7 bg-white/[0.025]"}`}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="min-w-0 truncate text-sm font-semibold text-white"><span className="mr-2 text-xs text-white/42">{index + 1}</span>{team.name}</p>
                    <p className="shrink-0 text-sm font-semibold text-[#a5fb85]">{team.score}</p>
                  </div>
                  <p className="mt-1 truncate text-xs text-white/48">{team.completed ? "Finished" : `${nextPlayer?.displayName ?? "Waiting"} at the board`}</p>
                  <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/8" aria-label={`${team.name} progress`}>
                    <div className="h-full rounded-full bg-[#7cf562] transition-[width] duration-300 motion-reduce:transition-none" style={{ width: `${Math.min(100, (team.currentPuzzleIndex / session.puzzlesPerTeam) * 100)}%` }} />
                  </div>
                </li>
              );
            })}
          </ol>
        </aside>
      </div>
    </section>
  );
}
