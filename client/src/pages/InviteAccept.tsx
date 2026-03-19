/**
 * InviteAccept — /invite/:token
 *
 * Landing page for club email invites. Flow:
 *   1. Load invite details from GET /api/invite/:token (public)
 *   2. If user is already logged in → show "Join Club" button → POST /api/invite/:token/accept
 *   3. If user is not logged in → show login / register form → on success → accept invite
 *   4. After accepting → joinClub() in local registry → redirect to /clubs/:clubId/home
 */

import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { NavLogo } from "@/components/NavLogo";
import { useAuthContext } from "@/context/AuthContext";
import { joinClub, getClub, getClubBySlug, seedClubsIfEmpty } from "@/lib/clubRegistry";
import {
  Users,
  Mail,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ChevronRight,
  Lock,
  User,
} from "lucide-react";
import { toast } from "sonner";

// ── Types ─────────────────────────────────────────────────────────────────────

interface InviteDetails {
  id: string;
  clubId: string;
  email: string;
  status: string;
  expiresAt: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function InviteAccept() {
  const { token } = useParams<{ token: string }>();
  const [, navigate] = useLocation();
  const { user, login, register } = useAuthContext();

  // Invite state
  const [invite, setInvite] = useState<InviteDetails | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [loadingInvite, setLoadingInvite] = useState(true);

  // Auth form state
  const [authMode, setAuthMode] = useState<"login" | "register">("register");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  // Accept state
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState(false);

  // Load invite details on mount
  useEffect(() => {
    if (!token) return;
    fetch(`/api/invite/${token}`)
      .then(async (res) => {
        const data = await res.json() as InviteDetails & { error?: string };
        if (!res.ok) {
          setInviteError(data.error ?? "Invalid invite link.");
        } else {
          setInvite(data);
          setEmail(data.email); // Pre-fill email
        }
      })
      .catch(() => setInviteError("Could not load invite. Please check your connection."))
      .finally(() => setLoadingInvite(false));
  }, [token]);

  // Accept the invite via API, then join club locally
  async function acceptInvite() {
    if (!invite || !user) return;
    setAccepting(true);
    try {
      const res = await fetch(`/api/invite/${token}/accept`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json() as { ok?: boolean; clubId?: string; error?: string };
      if (!res.ok) {
        toast.error(data.error ?? "Could not accept invite.");
        return;
      }
      // Join club in local registry
      seedClubsIfEmpty();
      const club = getClub(data.clubId!) ?? getClubBySlug(data.clubId!);
      if (club) {
        joinClub(club.id, {
          userId: user.id,
          displayName: user.displayName,
          chesscomUsername: user.chesscomUsername,
          lichessUsername: user.lichessUsername,
          avatarUrl: user.avatarUrl,
        });
      }
      setAccepted(true);
      toast.success("You've joined the club!");
      // Redirect after a short delay
      setTimeout(() => {
        navigate(club ? `/clubs/${club.id}/home` : "/clubs");
      }, 1800);
    } catch {
      toast.error("Network error — could not accept invite.");
    } finally {
      setAccepting(false);
    }
  }

  // Auth then accept
  async function handleAuthAndAccept(e: React.FormEvent) {
    e.preventDefault();
    setAuthError("");
    setAuthLoading(true);
    try {
      if (authMode === "login") {
        await login(email, password);
      } else {
        await register(email, password, displayName || email.split("@")[0]);
      }
      // After successful auth, accept the invite
      await acceptInvite();
    } catch (err) {
      setAuthError((err as Error).message ?? "Authentication failed.");
    } finally {
      setAuthLoading(false);
    }
  }

  // ── Render helpers ───────────────────────────────────────────────────────────

  const inputCls =
    "w-full bg-white/07 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-white/30 outline-none focus:border-white/25 transition-colors";
  const labelCls = "block text-white/50 text-xs font-semibold uppercase tracking-wider mb-1.5";

  // ── Loading state ────────────────────────────────────────────────────────────

  if (loadingInvite) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "oklch(0.20 0.06 145)" }}>
        <Loader2 className="w-8 h-8 animate-spin text-white/40" />
      </div>
    );
  }

  // ── Error state ──────────────────────────────────────────────────────────────

  if (inviteError) {
    return (
      <div className="min-h-screen flex flex-col" style={{ background: "oklch(0.20 0.06 145)" }}>
        <nav className="flex items-center px-6 py-4 border-b border-white/08">
          <NavLogo />
        </nav>
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="max-w-sm w-full text-center space-y-4">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto" style={{ background: "oklch(0.30 0.10 25 / 0.3)" }}>
              <AlertCircle className="w-8 h-8 text-red-400" />
            </div>
            <h1 className="text-white text-xl font-bold">Invite Not Valid</h1>
            <p className="text-white/50 text-sm">{inviteError}</p>
            <button
              onClick={() => navigate("/clubs")}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:scale-105"
              style={{ background: "oklch(0.35 0.12 145)" }}
            >
              Browse Clubs
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Accepted state ───────────────────────────────────────────────────────────

  if (accepted) {
    return (
      <div className="min-h-screen flex flex-col" style={{ background: "oklch(0.20 0.06 145)" }}>
        <nav className="flex items-center px-6 py-4 border-b border-white/08">
          <NavLogo />
        </nav>
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="max-w-sm w-full text-center space-y-4">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto" style={{ background: "oklch(0.30 0.15 145 / 0.4)" }}>
              <CheckCircle2 className="w-8 h-8 text-green-400" />
            </div>
            <h1 className="text-white text-xl font-bold">Welcome to the club!</h1>
            <p className="text-white/50 text-sm">Redirecting you to the club dashboard…</p>
            <Loader2 className="w-5 h-5 animate-spin text-white/30 mx-auto" />
          </div>
        </div>
      </div>
    );
  }

  // ── Main layout ──────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "oklch(0.20 0.06 145)" }}>
      {/* Nav */}
      <nav className="flex items-center px-6 py-4 border-b border-white/08">
        <NavLogo />
      </nav>

      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="max-w-md w-full space-y-6">

          {/* Invite card */}
          <div
            className="rounded-2xl border border-white/08 p-6 text-center space-y-3"
            style={{ background: "oklch(0.16 0.05 145)" }}
          >
            <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto" style={{ background: "oklch(0.30 0.15 145 / 0.4)" }}>
              <Users className="w-7 h-7 text-green-400" />
            </div>
            <div>
              <p className="text-white/50 text-sm">You've been invited to join a chess club on</p>
              <p className="text-white font-bold text-lg mt-0.5">OTB Chess</p>
            </div>
            <div className="flex items-center justify-center gap-2 text-white/40 text-xs">
              <Mail className="w-3.5 h-3.5" />
              <span>Invite sent to <span className="text-white/70 font-medium">{invite?.email}</span></span>
            </div>
            <p className="text-white/30 text-xs">
              Expires {invite ? new Date(invite.expiresAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : ""}
            </p>
          </div>

          {/* If already logged in → show accept button */}
          {user ? (
            <div
              className="rounded-2xl border border-white/08 p-6 space-y-4"
              style={{ background: "oklch(0.16 0.05 145)" }}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-white font-bold text-sm" style={{ background: "oklch(0.35 0.12 145)" }}>
                  {user.displayName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-white font-semibold text-sm">{user.displayName}</p>
                  <p className="text-white/40 text-xs">{user.email}</p>
                </div>
              </div>
              <button
                onClick={acceptInvite}
                disabled={accepting}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold text-white transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
                style={{ background: "oklch(0.45 0.18 145)" }}
              >
                {accepting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                {accepting ? "Joining…" : "Accept Invite & Join Club"}
              </button>
              <p className="text-white/30 text-xs text-center">
                Not you?{" "}
                <button
                  onClick={() => navigate("/clubs")}
                  className="text-white/50 underline hover:text-white/70 transition-colors"
                >
                  Go to clubs
                </button>
              </p>
            </div>
          ) : (
            /* Not logged in → show auth form */
            <div
              className="rounded-2xl border border-white/08 overflow-hidden"
              style={{ background: "oklch(0.16 0.05 145)" }}
            >
              {/* Mode toggle */}
              <div className="flex border-b border-white/08">
                {(["register", "login"] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => { setAuthMode(mode); setAuthError(""); }}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-bold uppercase tracking-wider transition-colors ${
                      authMode === mode
                        ? "text-green-400 border-b-2 border-green-400"
                        : "text-white/40 hover:text-white/70"
                    }`}
                  >
                    {mode === "register" ? <User className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                    {mode === "register" ? "Create Account" : "Sign In"}
                  </button>
                ))}
              </div>

              <form onSubmit={handleAuthAndAccept} className="p-5 space-y-4">
                {authMode === "register" && (
                  <div>
                    <label className={labelCls}>Display Name</label>
                    <input
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Your chess name"
                      className={inputCls}
                    />
                  </div>
                )}
                <div>
                  <label className={labelCls}>Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    placeholder={authMode === "register" ? "At least 8 characters" : "Your password"}
                    className={inputCls}
                  />
                </div>

                {authError && (
                  <div className="flex items-center gap-2 text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                    {authError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold text-white transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
                  style={{ background: "oklch(0.45 0.18 145)" }}
                >
                  {authLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  {authLoading
                    ? "Please wait…"
                    : authMode === "register"
                    ? "Create Account & Join Club"
                    : "Sign In & Join Club"}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
