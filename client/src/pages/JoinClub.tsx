/**
 * JoinClub — /join-club/:clubId
 *
 * Deep-link landing page for the "Join Club" QR code.
 * Flow:
 *   1. Load club info (name, avatar, accent) for a branded splash
 *   2. If user is NOT signed in → show AuthModal; on success → auto-join → confetti → redirect
 *   3. If user IS signed in → immediately join → confetti → redirect to club dashboard
 *   4. If user is already a member → skip join, go straight to club dashboard
 */

import React, { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { NavLogo } from "@/components/NavLogo";
import AuthModal from "@/components/AuthModal";
import { useAuthContext } from "@/context/AuthContext";
import { apiJoinClub } from "@/lib/clubsApi";
import { joinClub, getClub, getClubBySlug } from "@/lib/clubRegistry";
import { toast } from "sonner";
import { Users, CheckCircle2, Loader2 } from "lucide-react";
import confetti from "canvas-confetti";

type Phase = "loading" | "auth" | "joining" | "done" | "error";

/** Fire a multi-burst confetti celebration anchored to the center of the screen */
function fireConfetti(accentHex: string) {
  const count = 180;
  const defaults = {
    origin: { y: 0.6 },
    colors: [accentHex, "#ffffff", "#a3e635", "#fbbf24", accentHex],
    zIndex: 9999,
  };

  function fire(particleRatio: number, opts: confetti.Options) {
    confetti({ ...defaults, ...opts, particleCount: Math.floor(count * particleRatio) });
  }

  fire(0.25, { spread: 26, startVelocity: 55 });
  fire(0.2, { spread: 60 });
  fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8 });
  fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 });
  fire(0.1, { spread: 120, startVelocity: 45 });
}

export default function JoinClub() {
  const { clubId } = useParams<{ clubId: string }>();
  const [, navigate] = useLocation();
  const { user } = useAuthContext();

  const [phase, setPhase] = useState<Phase>("loading");
  const [club, setClub] = useState<{ id: string; name: string; avatarUrl?: string | null; accentColor?: string | null } | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [authOpen, setAuthOpen] = useState(false);
  const confettiFired = useRef(false);

  // ── Resolve club info ──────────────────────────────────────────────────────
  useEffect(() => {
    async function resolveClub() {
      if (!clubId) { setPhase("error"); setErrorMsg("No club ID provided."); return; }
      let found = getClub(clubId) ?? getClubBySlug(clubId) ?? null;
      if (!found) {
        try {
          const res = await fetch(`/api/clubs/${clubId}`);
          if (res.ok) found = await res.json();
        } catch { /* ignore */ }
      }
      if (!found) { setPhase("error"); setErrorMsg("Club not found."); return; }
      setClub(found);
      if (user) {
        setPhase("joining");
      } else {
        setPhase("auth");
        setAuthOpen(true);
      }
    }
    resolveClub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clubId]);

  // ── Auto-join once we have a user ─────────────────────────────────────────
  const doJoin = useCallback(async () => {
    if (!club || !user) return;
    setPhase("joining");
    try {
      await apiJoinClub(club.id, {
        displayName: user.displayName ?? "Player",
        chesscomUsername: user.chesscomUsername ?? null,
        lichessUsername: user.lichessUsername ?? null,
        avatarUrl: user.avatarUrl ?? null,
      });
      joinClub(club.id, {
        userId: user.id,
        displayName: user.displayName ?? "Player",
        chesscomUsername: user.chesscomUsername ?? null,
        lichessUsername: user.lichessUsername ?? null,
        avatarUrl: user.avatarUrl ?? null,
      });

      // Confetti + haptic + toast — fire once
      if (!confettiFired.current) {
        confettiFired.current = true;
        const accent = club.accentColor ?? "#4CAF50";
        // Haptic: short-pause-long pattern (supported on iOS Safari 13+ and Android Chrome)
        if (navigator.vibrate) {
          navigator.vibrate([40, 60, 80]);
        }
        fireConfetti(accent);
        toast.custom(
          (t) => (
            <div
              className="flex items-center gap-3 w-full max-w-sm rounded-2xl border border-white/10 shadow-xl px-4 py-3"
              style={{ background: "oklch(0.22 0.06 145)", borderColor: `${accent}44` }}
            >
              {/* Club avatar */}
              <div
                className="flex-shrink-0 w-10 h-10 rounded-xl overflow-hidden flex items-center justify-center"
                style={{ background: `${accent}22`, border: `1.5px solid ${accent}55` }}
              >
                {club.avatarUrl ? (
                  <img src={club.avatarUrl} alt={club.name} className="w-full h-full object-cover" />
                ) : (
                  <Users className="w-5 h-5" style={{ color: accent }} />
                )}
              </div>
              {/* Text */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white leading-tight">
                  🎉 Welcome to {club.name}!
                </p>
                <p className="text-xs text-white/50 mt-0.5">You're now a member.</p>
              </div>
              {/* Action */}
              <button
                onClick={() => { toast.dismiss(t); navigate(`/clubs/${club.id}/home?tab=events`); }}
                className="flex-shrink-0 text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-all hover:opacity-90 active:scale-95"
                style={{ background: accent, color: "#fff" }}
              >
                Events
              </button>
            </div>
          ),
          { duration: 4500 }
        );
      }

      setPhase("done");
      setTimeout(() => navigate(`/clubs/${club.id}/home`), 2000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to join club.";
      if (msg.includes("409") || msg.toLowerCase().includes("already")) {
        // Already a member — silent redirect
        setPhase("done");
        setTimeout(() => navigate(`/clubs/${club.id}/home`), 900);
      } else {
        setPhase("error");
        setErrorMsg(msg);
      }
    }
  }, [club, user, navigate]);

  useEffect(() => {
    if (phase === "joining") doJoin();
  }, [phase, doJoin]);

  useEffect(() => {
    if (user && phase === "auth") {
      setAuthOpen(false);
      setPhase("joining");
    }
  }, [user, phase]);

  const accent = club?.accentColor ?? "#4CAF50";

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 chess-board-bg"
      style={{ background: "oklch(0.18 0.06 145)" }}
    >
      {/* Gradient overlay */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{ background: `radial-gradient(ellipse at 50% 40%, ${accent}22 0%, transparent 70%)` }}
      />

      <div className="relative z-10 flex flex-col items-center gap-6 w-full max-w-sm">
        <NavLogo />

        {/* Club card */}
        {club && (
          <div
            className="w-full rounded-3xl border border-white/10 overflow-hidden shadow-2xl"
            style={{ background: "oklch(0.22 0.06 145)" }}
          >
            {/* Accent bar */}
            <div className="h-1" style={{ background: `linear-gradient(90deg, ${accent}88, ${accent}, ${accent}88)` }} />

            <div className="px-6 py-6 flex flex-col items-center gap-4 text-center">
              {/* Club avatar */}
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center overflow-hidden shadow-lg"
                style={{ background: `${accent}22`, border: `2px solid ${accent}55` }}
              >
                {club.avatarUrl ? (
                  <img src={club.avatarUrl} alt={club.name} className="w-full h-full object-cover" />
                ) : (
                  <Users className="w-7 h-7" style={{ color: accent }} />
                )}
              </div>

              {/* Club name */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-white/30 mb-1">You're joining</p>
                <h1 className="text-xl font-bold text-white" style={{ fontFamily: "'Clash Display', sans-serif" }}>
                  {club.name}
                </h1>
              </div>

              {/* Status indicator */}
              <div className="w-full">
                {phase === "loading" && (
                  <div className="flex items-center justify-center gap-2 py-3 text-white/40 text-sm">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Loading…</span>
                  </div>
                )}

                {phase === "auth" && (
                  <div className="rounded-2xl border border-white/08 bg-white/04 px-4 py-3 text-sm text-white/50 leading-relaxed">
                    Sign in or create a free account to join{" "}
                    <span className="text-white/80 font-semibold">{club.name}</span>. You'll be added automatically.
                  </div>
                )}

                {phase === "joining" && (
                  <div className="flex items-center justify-center gap-2 py-3 text-white/60 text-sm">
                    <Loader2 className="w-4 h-4 animate-spin" style={{ color: accent }} />
                    <span>Joining club…</span>
                  </div>
                )}

                {phase === "done" && (
                  <div
                    className="flex flex-col items-center gap-1.5 py-4"
                    style={{ color: accent }}
                  >
                    <CheckCircle2 className="w-8 h-8" />
                    <span className="text-sm font-bold">You're in!</span>
                    <span className="text-xs text-white/40">Taking you to the club…</span>
                  </div>
                )}

                {phase === "error" && (
                  <div className="rounded-2xl border border-red-500/20 bg-red-500/08 px-4 py-3 text-sm text-red-400 leading-relaxed">
                    {errorMsg || "Something went wrong. Please try again."}
                    <button
                      onClick={() => navigate(`/clubs/${clubId}`)}
                      className="block mt-2 text-white/50 hover:text-white/80 text-xs underline"
                    >
                      Go to club page instead →
                    </button>
                  </div>
                )}
              </div>

              {/* Sign in CTA for auth phase */}
              {phase === "auth" && (
                <button
                  onClick={() => setAuthOpen(true)}
                  className="w-full py-3 rounded-2xl text-sm font-bold text-white transition-all hover:opacity-90 active:scale-95 shadow-lg"
                  style={{ background: accent, boxShadow: `0 4px 20px ${accent}44` }}
                >
                  Sign in to join
                </button>
              )}
            </div>
          </div>
        )}

        {/* Loading skeleton */}
        {!club && phase === "loading" && (
          <div className="w-full rounded-3xl border border-white/08 bg-white/04 p-8 flex flex-col items-center gap-4 animate-pulse">
            <div className="w-16 h-16 rounded-2xl bg-white/08" />
            <div className="h-4 w-32 rounded-lg bg-white/08" />
            <div className="h-3 w-48 rounded-lg bg-white/05" />
          </div>
        )}
      </div>

      {/* Auth modal */}
      <AuthModal
        isOpen={authOpen}
        onClose={() => {
          setAuthOpen(false);
          if (!user) setPhase("auth");
        }}
        onSuccess={() => {
          setAuthOpen(false);
        }}
      />
    </div>
  );
}
