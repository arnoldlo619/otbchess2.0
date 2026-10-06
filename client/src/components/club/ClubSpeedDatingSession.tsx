import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Play,
  RotateCw,
  Users,
} from "lucide-react";
import {
  advanceSpeedDatingSession,
  getSpeedDatingSession,
  startSpeedDatingSession,
  type ClubEvent,
  type ClubSpeedDatingSession,
} from "@/lib/clubEventRegistry";

interface ClubSpeedDatingSessionProps {
  event: ClubEvent;
  viewerId?: string;
  canManage: boolean;
  accentColor: string;
}

function formatRemainingTime(endAt: string | null, now: number): string {
  if (!endAt) return "00:00";
  const remainingSeconds = Math.max(0, Math.ceil((new Date(endAt).getTime() - now) / 1000));
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function readableError(error: unknown): string {
  return error instanceof Error ? error.message : "The Speed Dating session could not be updated.";
}

export function ClubSpeedDatingSession({
  event,
  viewerId,
  canManage,
  accentColor,
}: ClubSpeedDatingSessionProps) {
  const [session, setSession] = useState<ClubSpeedDatingSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionPending, setActionPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const refresh = useCallback(async () => {
    const response = await getSpeedDatingSession(event.clubId, event.id);
    setSession(response.session);
  }, [event.clubId, event.id]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    refresh()
      .catch((requestError) => active && setError(readableError(requestError)))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [refresh]);

  useEffect(() => {
    if (!session || session.status !== "active") return;
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [session]);

  const myPairing = useMemo(() => {
    if (!viewerId || !session) return null;
    return session.pairings.find((pairing) => pairing.white.userId === viewerId || pairing.black.userId === viewerId) ?? null;
  }, [session, viewerId]);

  const myOpponent = myPairing
    ? myPairing.white.userId === viewerId ? myPairing.black : myPairing.white
    : null;
  const myColor = myPairing && myPairing.white.userId === viewerId ? "White" : "Black";
  const roundIsOver = Boolean(session?.currentRoundEndsAt && new Date(session.currentRoundEndsAt).getTime() <= now);

  async function runSessionAction(action: "start" | "advance") {
    setActionPending(true);
    setError(null);
    try {
      const nextSession = action === "start"
        ? await startSpeedDatingSession(event.clubId, event.id)
        : await advanceSpeedDatingSession(event.clubId, event.id);
      setSession(nextSession);
      setNow(Date.now());
    } catch (requestError) {
      setError(readableError(requestError));
    } finally {
      setActionPending(false);
    }
  }

  return (
    <section
      aria-labelledby="speed-dating-title"
      className="overflow-hidden rounded-2xl"
      style={{ background: "oklch(0.15 0.05 145)", border: `1px solid ${accentColor}44` }}
    >
      <header className="flex items-start justify-between gap-4 border-b border-white/8 px-5 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ background: `${accentColor}22`, color: accentColor }}>
            <Users className="h-5 w-5" strokeWidth={1.8} aria-hidden="true" />
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: accentColor }}>Live social rounds</p>
            <h2 id="speed-dating-title" className="mt-0.5 text-base font-bold text-white">Speed Dating</h2>
          </div>
        </div>
        {session?.status === "active" && (
          <div className="shrink-0 text-right">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/45">Round timer</p>
            <output aria-live="polite" className={`mt-0.5 block font-mono text-xl font-bold tabular-nums ${roundIsOver ? "text-amber-300" : "text-white"}`}>
              {formatRemainingTime(session.currentRoundEndsAt, now)}
            </output>
          </div>
        )}
      </header>

      <div className="space-y-4 p-5">
        {loading ? (
          <div className="space-y-3" aria-label="Loading Speed Dating session">
            <div className="h-5 w-40 animate-pulse rounded bg-white/8" />
            <div className="h-20 animate-pulse rounded-xl bg-white/5" />
          </div>
        ) : !session ? (
          <div className="space-y-4">
            <p className="max-w-prose text-sm leading-relaxed text-white/60">
              Each round gives members who marked Going a new chess opponent. The organizer starts with the current RSVP roster and the schedule stays shared for everyone.
            </p>
            {canManage ? (
              <button
                type="button"
                onClick={() => runSessionAction("start")}
                disabled={actionPending}
                className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold text-white transition-transform hover:brightness-110 active:scale-[0.99] disabled:cursor-wait disabled:opacity-60"
                style={{ background: accentColor }}
              >
                <Play className="h-4 w-4" aria-hidden="true" />
                {actionPending ? "Starting rounds…" : "Start Speed Dating"}
              </button>
            ) : (
              <div className="flex items-start gap-3 rounded-xl bg-white/[0.04] p-3 text-sm text-white/55">
                <Clock3 className="mt-0.5 h-4 w-4 shrink-0" style={{ color: accentColor }} aria-hidden="true" />
                <p>The organizer will start the shared first round after checking the RSVP roster.</p>
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-white">
                {session.status === "completed" ? "Social rounds complete" : `Round ${session.currentRound} of ${session.totalRounds}`}
              </p>
              <p className="text-xs text-white/45">{session.participants.length} players in the rotation</p>
            </div>

            {session.status === "active" && myOpponent && (
              <div className="rounded-xl p-4" style={{ background: `${accentColor}14`, border: `1px solid ${accentColor}44` }}>
                <p className="text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: accentColor }}>Your table</p>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-lg font-bold text-white">{myOpponent.displayName}</p>
                    <p className="mt-0.5 text-xs text-white/55">You play as {myColor} · Table {myPairing?.boardNumber}</p>
                  </div>
                  <ArrowRight className="h-5 w-5 shrink-0 text-white/45" aria-hidden="true" />
                </div>
              </div>
            )}

            {session.status === "active" && !myOpponent && viewerId && (
              <p className="rounded-xl bg-white/[0.04] px-3 py-3 text-sm leading-relaxed text-white/55">
                Your RSVP was not in the roster when this session began. Ask an organizer to include you in the next Speed Dating event.
              </p>
            )}

            <div className="divide-y divide-white/6 overflow-hidden rounded-xl border border-white/8">
              {session.pairings.map((pairing) => (
                <div key={pairing.id} className="flex items-center gap-3 px-3 py-3 text-sm">
                  <span className="w-7 shrink-0 text-center text-xs font-bold text-white/38">{pairing.boardNumber}</span>
                  <div className="min-w-0 flex-1 text-right font-semibold text-white/82">{pairing.white.displayName}</div>
                  <span className="rounded-md bg-white/8 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-white/45">vs</span>
                  <div className="min-w-0 flex-1 font-semibold text-white/82">{pairing.black.displayName}</div>
                </div>
              ))}
            </div>

            {canManage && session.status === "active" && (
              <button
                type="button"
                onClick={() => runSessionAction("advance")}
                disabled={actionPending}
                className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border px-4 text-sm font-bold transition-transform hover:bg-white/[0.08] active:scale-[0.99] disabled:cursor-wait disabled:opacity-60"
                style={{ borderColor: `${accentColor}66`, color: accentColor }}
              >
                {session.currentRound >= session.totalRounds ? <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> : <RotateCw className="h-4 w-4" aria-hidden="true" />}
                {actionPending ? "Updating round…" : session.currentRound >= session.totalRounds ? "Finish Speed Dating" : roundIsOver ? "Start next round" : "Advance to next round"}
              </button>
            )}
          </>
        )}

        {error && (
          <p role="alert" className="flex items-start gap-2 rounded-xl border border-red-400/30 bg-red-400/10 px-3 py-3 text-sm text-red-100">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            {error}
          </p>
        )}
      </div>
    </section>
  );
}
