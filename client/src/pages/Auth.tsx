/**
 * Auth — Dedicated sign-in / sign-up / guest page
 *
 * Layout: SignIn6 two-panel design remixed with OTB Chess design system
 *  - Left panel (md+): deep forest green, chess-board pattern, OTB logo, tagline, social proof
 *  - Right panel: Sign In / Sign Up / Guest tabs, Google OAuth, full form logic
 *  - Mobile: left panel collapses to a compact branded top bar
 *
 * URL params:
 *  - ?tab=signin|signup|guest  — deep-link to a specific tab
 *  - ?redirect=/path           — navigate here after successful auth
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { Eye, EyeOff, Loader2, ChevronRight, CheckCircle2, Ghost, ArrowLeft } from "lucide-react";
import { useAuthContext } from "../context/AuthContext";
import { ApiErrorNotice } from "@/components/ApiErrorNotice";
import {
  validateEmail,
  validatePassword,
  validateDisplayName,
  validateGuestName,
  scorePassword,
  type StrengthLevel,
} from "../components/AuthModal";

/* ── Types ─────────────────────────────────────────── */
type Tab = "signin" | "signup" | "guest" | "forgot";

/* ── Strength helpers ──────────────────────────────── */
const strengthLabel: Record<StrengthLevel, string> = {
  empty: "", weak: "Weak", fair: "Fair", strong: "Strong",
};
const strengthColor: Record<StrengthLevel, string> = {
  empty: "bg-transparent", weak: "bg-red-500", fair: "bg-yellow-400", strong: "bg-emerald-500",
};
const strengthWidth: Record<StrengthLevel, string> = {
  empty: "w-0", weak: "w-1/3", fair: "w-2/3", strong: "w-full",
};

/* ── Sub-components ────────────────────────────────── */
function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return (
    <p className="mt-1.5 text-xs text-red-400 flex items-center gap-1">
      <span className="inline-block w-1 h-1 rounded-full bg-red-400 shrink-0" />
      {msg}
    </p>
  );
}

function PasswordInput({
  value, onChange, placeholder, id, hasError, autoComplete,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  id: string;
  hasError?: boolean;
  autoComplete?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        aria-label="Password"
        id={id}
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? "Password"}
        autoComplete={autoComplete ?? (id === "auth-signin-password" ? "current-password" : "new-password")}
        enterKeyHint="done"
        className={`w-full rounded-xl border px-4 py-3 pr-11 text-sm outline-none transition
          ${hasError
            ? "border-red-400 focus:border-red-400 bg-red-500/5"
            : "bg-white/5 border-white/15 text-white placeholder:text-white/30 focus:border-[#4ade80] focus:bg-white/8"
          }`}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg text-white/40 hover:text-white/70 transition"
        tabIndex={-1}
        aria-label={show ? "Hide password" : "Show password"}
      >
        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
}

function PasswordStrengthBar({ password }: { password: string }) {
  const level = scorePassword(password);
  if (!password) return null;
  return (
    <div className="mt-2 space-y-1">
      <div className="h-1 w-full rounded-full bg-white/10">
        <div className={`h-full rounded-full transition-all duration-300 ${strengthColor[level]} ${strengthWidth[level]}`} />
      </div>
      <p className={`text-xs ${level === "weak" ? "text-red-400" : level === "fair" ? "text-yellow-400" : "text-emerald-500"}`}>
        {strengthLabel[level]}
      </p>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="w-4.5 h-4.5 shrink-0" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

/* ── Social proof avatars ──────────────────────────── */
const PROOF_AVATARS = [
  { initials: "MC", src: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&facepad=2&w=80&h=80&q=80" },
  { initials: "AK", src: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&facepad=2&w=80&h=80&q=80" },
  { initials: "LR", src: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&facepad=2&w=80&h=80&q=80" },
  { initials: "DS", src: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&facepad=2&w=80&h=80&q=80" },
];

/* ── Main page ─────────────────────────────────────── */
export default function AuthPage() {
  const [, navigate] = useLocation();
  const { login, register, loginAsGuest, user, loading: authLoading } = useAuthContext();

  // Parse query params
  const params = new URLSearchParams(window.location.search);
  const initialTab = (["signin", "signup", "guest"].includes(params.get("tab") ?? "")
    ? params.get("tab")
    : "signin") as Tab;
  const redirectPath = params.get("redirect") ?? "/";

  // Redirect already-authenticated users
  useEffect(() => {
    if (!authLoading && user && !user.isGuest) {
      navigate(redirectPath);
    }
  }, [user, authLoading, navigate, redirectPath]);

  const [tab, setTab] = useState<Tab>(initialTab);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // Sign In
  const savedEmail = typeof window !== "undefined" ? (localStorage.getItem("otb-last-signin-email") ?? "") : "";
  const savedRemember = typeof window !== "undefined" ? localStorage.getItem("otb-remember-me") === "true" : false;
  const [siEmail, setSiEmail] = useState(savedEmail);
  const [siPassword, setSiPassword] = useState("");
  const [siRemember, setSiRemember] = useState(savedRemember);
  const [siErrors, setSiErrors] = useState<{ email?: string; password?: string; general?: unknown }>({});

  // Sign Up
  const [suName, setSuName] = useState("");
  const [suEmail, setSuEmail] = useState("");
  const [suPassword, setSuPassword] = useState("");
  const [suChesscom, setSuChesscom] = useState("");
  const [suErrors, setSuErrors] = useState<{ name?: string; email?: string; password?: string; general?: unknown }>({});

  // Guest
  const [guestName, setGuestName] = useState("");
  const [guestError, setGuestError] = useState<string | undefined>();

  // Forgot password
  const [fpEmail, setFpEmail] = useState("");
  const [fpError, setFpError] = useState<string | undefined>();
  const [fpSent, setFpSent] = useState(false);
  const [fpLoading, setFpLoading] = useState(false);

  const firstInputRef = useRef<HTMLInputElement>(null);

  const switchTab = useCallback((t: Tab) => {
    setTab(t);
    setSiErrors({}); setSuErrors({}); setGuestError(undefined);
    setFpError(undefined); setFpSent(false);
    setTimeout(() => firstInputRef.current?.focus(), 80);
  }, []);

  useEffect(() => {
    setTimeout(() => firstInputRef.current?.focus(), 120);
  }, []);

  /* ── Sign In ── */
  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    const errors = { email: validateEmail(siEmail), password: validatePassword(siPassword) };
    if (errors.email || errors.password) { setSiErrors(errors); return; }
    setLoading(true); setSiErrors({});
    try {
      await login(siEmail, siPassword, siRemember);
      if (typeof window !== "undefined") {
        localStorage.setItem("otb-last-signin-email", siEmail.trim().toLowerCase());
        localStorage.setItem("otb-remember-me", String(siRemember));
      }
      setSuccess(true);
      setTimeout(() => navigate(redirectPath), 1000);
    } catch (err) {
      setSiErrors({ general: err });
    } finally {
      setLoading(false);
    }
  }

  /* ── Sign Up ── */
  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    const errors = {
      name: validateDisplayName(suName),
      email: validateEmail(suEmail),
      password: validatePassword(suPassword, true),
    };
    if (errors.name || errors.email || errors.password) { setSuErrors(errors); return; }
    setLoading(true); setSuErrors({});
    try {
      await register(suEmail, suPassword, suName, suChesscom || undefined);
      setSuccess(true);
      setTimeout(() => navigate(redirectPath), 1000);
    } catch (err) {
      setSuErrors({ general: err });
    } finally {
      setLoading(false);
    }
  }

  /* ── Guest ── */
  async function handleGuest(e: React.FormEvent) {
    e.preventDefault();
    const err = validateGuestName(guestName);
    if (err) { setGuestError(err); return; }
    setLoading(true); setGuestError(undefined);
    try {
      await loginAsGuest(guestName.trim());
      setSuccess(true);
      setTimeout(() => navigate(redirectPath), 1000);
    } catch (err) {
      setGuestError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  /* ── Forgot password (stub — shows success message) ── */
  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    const err = validateEmail(fpEmail);
    if (err) { setFpError(err); return; }
    setFpLoading(true); setFpError(undefined);
    try {
      // POST to server — gracefully handles "user not found" by always returning 200
      await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: fpEmail }),
      });
      setFpSent(true);
    } catch {
      setFpError("Something went wrong. Please try again.");
    } finally {
      setFpLoading(false);
    }
  }

  const tabLabel: Record<Tab, string> = {
    signin: "Welcome back",
    signup: "Create account",
    guest: "Quick access",
    forgot: "Reset password",
  };

  /* ── Shared input class ── */
  const inputCls = (hasError?: boolean) =>
    `w-full rounded-xl border px-4 py-3 text-sm outline-none transition
    ${hasError
      ? "border-red-400 focus:border-red-400 bg-red-500/5 text-white placeholder:text-white/30"
      : "bg-white/5 border-white/15 text-white placeholder:text-white/30 focus:border-[#4ade80] focus:bg-white/8"
    }`;

  /* ── Google OAuth URL (preserve redirect) ── */
  const googleHref = redirectPath && redirectPath !== "/"
    ? `/api/auth/google?redirect=${encodeURIComponent(redirectPath)}`
    : "/api/auth/google";

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center p-4 sm:p-6 relative"
      style={{
        backgroundImage: "url('/manus-storage/auth-bg_d6364218.jpeg')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      {/* Dark semi-transparent overlay for minimalist smoothness */}
      <div className="pointer-events-none absolute inset-0 bg-black/40" />
      {/* Back to home link */}
      <a
        href="/"
        aria-label="Back to home"
        className="fixed top-4 left-4 z-10 flex items-center gap-1.5 text-white/80 hover:text-white text-sm font-medium transition"
      >
        <ArrowLeft className="w-4 h-4" />
        <span className="hidden sm:inline">Back to home</span>
      </a>

      <div className="w-full max-w-3xl relative z-10">
        {/* Card */}
        <div className="grid w-full overflow-hidden rounded-2xl border border-white/10 shadow-2xl md:grid-cols-2"
          style={{ background: "oklch(0.20 0.06 145)" }}>

          {/* ── Left panel (desktop only) ── */}
          <div
            className="relative hidden flex-col justify-between overflow-hidden p-10 md:flex"
            style={{
              background: "linear-gradient(160deg, oklch(0.24 0.08 148) 0%, oklch(0.17 0.06 145) 100%)",
            }}
          >
            {/* Chess board subtle overlay */}
            <div
              className="pointer-events-none absolute inset-0 opacity-[0.03]"
              style={{
                backgroundImage: "repeating-conic-gradient(oklch(0.97 0.02 110) 0% 25%, oklch(0.73 0.07 145) 0% 50%)",
                backgroundSize: "32px 32px",
              }}
            />
            {/* Glow orb */}
            <div className="pointer-events-none absolute -top-20 -right-20 w-64 h-64 rounded-full bg-[oklch(0.55_0.13_145)] opacity-10 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-16 -left-16 w-48 h-48 rounded-full bg-[oklch(0.44_0.12_145)] opacity-10 blur-3xl" />

            {/* Logo */}
            <div className="relative flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl overflow-hidden flex-shrink-0 ring-1 ring-white/20">
                <img
                  src="https://d2xsxph8kpxj0f.cloudfront.net/117675823/J6FsDoRMH9x5xbUvpyzxyf/otb-logo-exclamation_0b3fa613.png"
                  alt="OTB Chess"
                  className="w-full h-full object-contain"
                />
              </div>
              <span className="text-base font-semibold tracking-tight text-white">OTB Chess</span>
            </div>

            {/* Tagline */}
            <div className="relative mt-auto">
              <h1 className="max-w-[16ch] text-[42px] leading-[1.1] font-extrabold tracking-tight text-white text-balance">
                Where chess happens.{" "}
                <span className="text-[oklch(0.75_0.14_145)]">Over the board.</span>
              </h1>
              <p className="mt-3 text-base text-white/60 max-w-[22ch] leading-relaxed">
                Host tournaments, track ratings, and connect with your chess community.
              </p>
            </div>

            {/* Social proof */}
            <div className="relative mt-8 flex items-center gap-3">
              <div className="flex -space-x-2">
                {PROOF_AVATARS.map((p) => (
                  <div
                    key={p.initials}
                    className="w-7 h-7 rounded-full ring-2 ring-[oklch(0.20_0.06_145)] overflow-hidden bg-[oklch(0.30_0.08_145)] flex items-center justify-center text-[10px] font-semibold text-white/70"
                  >
                    <img
                      loading="lazy"
                      decoding="async"
                      src={p.src}
                      alt=""
                      className="w-full h-full object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                    />
                  </div>
                ))}
              </div>
              <span className="text-sm text-white/60">
                Join 700+ OTB players
              </span>
            </div>
          </div>

          {/* ── Right panel ── */}
          <div className="flex flex-col justify-center gap-5 p-8">

            {/* Mobile logo bar */}
            <div className="flex items-center gap-2.5 md:hidden">
              <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0">
                <img
                  src="https://d2xsxph8kpxj0f.cloudfront.net/117675823/J6FsDoRMH9x5xbUvpyzxyf/otb-logo-exclamation_0b3fa613.png"
                  alt="OTB Chess"
                  className="w-full h-full object-contain"
                />
              </div>
              <span className="text-sm font-semibold text-white">OTB Chess</span>
            </div>

            {/* Heading */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                {tab === "forgot" && (
                  <button
                    onClick={() => switchTab("signin")}
                    className="text-white/40 hover:text-white/70 transition"
                    aria-label="Back to sign in"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                )}
                <span className="text-lg font-semibold text-white">{tabLabel[tab]}</span>
              </div>
              <span className="text-xs text-white/55">
                {tab === "signin" && "Sign in to your OTB Chess account."}
                {tab === "signup" && "Create your free OTB Chess account."}
                {tab === "guest" && "Jump in without an account."}
                {tab === "forgot" && "We'll send a reset link to your email."}
              </span>
            </div>

            {/* Tab switcher (not shown on forgot) */}
            {tab !== "forgot" && (
              <div className="flex gap-1 rounded-xl bg-white/5 p-1">
                {(["signin", "signup", "guest"] as Tab[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => switchTab(t)}
                    className={`flex-1 py-2 rounded-lg text-xs font-medium transition ${
                      tab === t
                        ? "bg-[oklch(0.55_0.13_145)] text-white shadow-sm"
                        : "text-white/55 hover:text-white/80"
                    }`}
                  >
                    {t === "signin" ? "Sign In" : t === "signup" ? "Sign Up" : (
                      <span className="flex items-center justify-center gap-1">
                        <Ghost className="w-3 h-3" /> Guest
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* ── Success state ── */}
            {success ? (
              <div className="flex flex-col items-center justify-center gap-4 py-8">
                <div className="w-14 h-14 rounded-full bg-emerald-500/10 flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                </div>
                <div className="text-center">
                  <p className="text-base font-semibold text-white">
                    {tab === "signin" ? "Welcome back!" : tab === "signup" ? "Account created!" : `Welcome, ${guestName.trim()}!`}
                  </p>
                  <p className="text-xs text-white/40 mt-1">Redirecting you now…</p>
                </div>
              </div>
            ) : (
              <>
                {/* ── Sign In form ── */}
                {tab === "signin" && (
                  <form onSubmit={handleSignIn} className="space-y-4" noValidate>
                    {Boolean(siErrors.general) && (
                      <ApiErrorNotice error={siErrors.general} title="Sign-in unavailable" />
                    )}

                    {/* Google OAuth */}
                    <a
                      href={googleHref}
                      className="w-full flex items-center justify-center gap-2.5 rounded-xl border border-white/15 bg-white/5 text-white text-sm font-medium py-3 hover:bg-white/10 transition"
                    >
                      <GoogleIcon />
                      Continue with Google
                    </a>

                    {/* Divider */}
                    <div className="flex items-center gap-3">
                      <span className="flex-1 h-px bg-white/10" />
                      <span className="text-[11px] uppercase text-white/55 tracking-wide">or</span>
                      <span className="flex-1 h-px bg-white/10" />
                    </div>

                    <div className="space-y-3">
                      <div>
                        <label htmlFor="auth-signin-email" className="block text-xs font-medium text-white/50 mb-1.5">
                          Email
                        </label>
                        <input
                          aria-label="Email"
                          ref={firstInputRef}
                          id="auth-signin-email"
                          type="email"
                          value={siEmail}
                          onChange={(e) => { setSiEmail(e.target.value); setSiErrors((p) => ({ ...p, email: undefined })); }}
                          placeholder="you@example.com"
                          autoComplete="email"
                          inputMode="email"
                          className={inputCls(!!siErrors.email)}
                        />
                        <FieldError msg={siErrors.email} />
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label htmlFor="auth-signin-password" className="text-xs font-medium text-white/50">
                            Password
                          </label>
                          <button
                            type="button"
                            onClick={() => switchTab("forgot")}
                            className="text-[11px] text-white/55 hover:text-white/80 transition"
                          >
                            Forgot?
                          </button>
                        </div>
                        <PasswordInput
                          id="auth-signin-password"
                          value={siPassword}
                          onChange={(v) => { setSiPassword(v); setSiErrors((p) => ({ ...p, password: undefined })); }}
                          placeholder="••••••••"
                          hasError={!!siErrors.password}
                        />
                        <FieldError msg={siErrors.password} />
                      </div>
                    </div>

                    {/* Remember me */}
                    <label className="flex items-center gap-2.5 cursor-pointer select-none group">
                      <div
                        className={`w-4.5 h-4.5 rounded-md border-2 flex items-center justify-center transition ${
                          siRemember ? "bg-[oklch(0.55_0.13_145)] border-[oklch(0.55_0.13_145)]" : "border-white/20 group-hover:border-white/40"
                        }`}
                        onClick={() => setSiRemember((r) => !r)}
                      >
                        {siRemember && (
                          <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 12 12">
                            <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </div>
                      <input type="checkbox" checked={siRemember} onChange={(e) => setSiRemember(e.target.checked)} className="sr-only" aria-label="Remember me for 30 days" />
                      <span className="text-xs text-white/50">Remember me for 30 days</span>
                    </label>

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full flex items-center justify-center gap-2 rounded-xl bg-[oklch(0.55_0.13_145)] hover:bg-[oklch(0.60_0.14_145)] text-white text-sm font-semibold py-3 transition disabled:opacity-60"
                    >
                      {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Signing in…</> : <>Sign In <ChevronRight className="w-4 h-4" /></>}
                    </button>

                    <p className="text-center text-xs text-white/55">
                      No account?{" "}
                      <button type="button" onClick={() => switchTab("signup")} className="text-[oklch(0.75_0.14_145)] font-medium hover:underline">
                        Create one free
                      </button>
                    </p>
                  </form>
                )}

                {/* ── Sign Up form ── */}
                {tab === "signup" && (
                  <form onSubmit={handleSignUp} className="space-y-4" noValidate>
                    {Boolean(suErrors.general) && (
                      <ApiErrorNotice error={suErrors.general} title="Account creation unavailable" />
                    )}

                    {/* Google OAuth */}
                    <a
                      href={googleHref}
                      className="w-full flex items-center justify-center gap-2.5 rounded-xl border border-white/15 bg-white/5 text-white text-sm font-medium py-3 hover:bg-white/10 transition"
                    >
                      <GoogleIcon />
                      Continue with Google
                    </a>

                    {/* Divider */}
                    <div className="flex items-center gap-3">
                      <span className="flex-1 h-px bg-white/10" />
                      <span className="text-[11px] uppercase text-white/30 tracking-wide">or</span>
                      <span className="flex-1 h-px bg-white/10" />
                    </div>

                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-medium text-white/50 mb-1.5">
                          Display name <span className="text-red-400">*</span>
                        </label>
                        <input
                          aria-label="Display name"
                          ref={firstInputRef}
                          type="text"
                          value={suName}
                          onChange={(e) => { setSuName(e.target.value); setSuErrors((p) => ({ ...p, name: undefined })); }}
                          placeholder="Magnus Carlsen"
                          autoComplete="name"
                          className={inputCls(!!suErrors.name)}
                        />
                        <FieldError msg={suErrors.name} />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-white/50 mb-1.5">
                          Email <span className="text-red-400">*</span>
                        </label>
                        <input
                          aria-label="Email"
                          type="email"
                          value={suEmail}
                          onChange={(e) => { setSuEmail(e.target.value); setSuErrors((p) => ({ ...p, email: undefined })); }}
                          placeholder="you@example.com"
                          autoComplete="email"
                          inputMode="email"
                          className={inputCls(!!suErrors.email)}
                        />
                        <FieldError msg={suErrors.email} />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-white/50 mb-1.5">
                          Password <span className="text-red-400">*</span>
                        </label>
                        <PasswordInput
                          id="auth-signup-password"
                          value={suPassword}
                          onChange={(v) => { setSuPassword(v); setSuErrors((p) => ({ ...p, password: undefined })); }}
                          placeholder="At least 8 characters"
                          hasError={!!suErrors.password}
                        />
                        <PasswordStrengthBar password={suPassword} />
                        <FieldError msg={suErrors.password} />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-white/50 mb-1.5">
                          Chess.com username <span className="text-white/25 text-[11px]">(optional)</span>
                        </label>
                        <input
                          aria-label="Auth Signup Chesscom"
                          type="text"
                          value={suChesscom}
                          onChange={(e) => setSuChesscom(e.target.value)}
                          placeholder="your-chess-username"
                          autoComplete="off"
                          className={inputCls()}
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full flex items-center justify-center gap-2 rounded-xl bg-[oklch(0.55_0.13_145)] hover:bg-[oklch(0.60_0.14_145)] text-white text-sm font-semibold py-3 transition disabled:opacity-60"
                    >
                      {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating account…</> : <>Create Account <ChevronRight className="w-4 h-4" /></>}
                    </button>

                    <p className="text-center text-xs text-white/40">
                      Already have an account?{" "}
                      <button type="button" onClick={() => switchTab("signin")} className="text-[oklch(0.75_0.14_145)] font-medium hover:underline">
                        Sign in
                      </button>
                    </p>
                  </form>
                )}

                {/* ── Guest form ── */}
                {tab === "guest" && (
                  <form onSubmit={handleGuest} className="space-y-4" noValidate>
                    {/* What guests can/can't do */}
                    <div className="rounded-xl border border-white/8 bg-white/3 px-4 py-3.5 space-y-2">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-white/30">Guest access</p>
                      <div className="space-y-1.5">
                        {[
                          { allowed: true, text: "Join 1v1 Battle rooms" },
                          { allowed: true, text: "View tournaments as spectator" },
                          { allowed: false, text: "Host battles or create tournaments" },
                          { allowed: false, text: "Save history (session lasts 24 h)" },
                        ].map((item) => (
                          <div key={item.text} className="flex items-center gap-2 text-xs">
                            <span className={item.allowed ? "text-emerald-500 font-bold" : "text-white/20"}>
                              {item.allowed ? "✓" : "✗"}
                            </span>
                            <span className={item.allowed ? "text-white/60" : "text-white/25"}>{item.text}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-white/50 mb-1.5">
                        Your name <span className="text-red-400">*</span>
                      </label>
                      <input
                        aria-label="Auth Guest Name"
                        ref={firstInputRef}
                        type="text"
                        value={guestName}
                        onChange={(e) => { setGuestName(e.target.value); setGuestError(undefined); }}
                        placeholder="e.g. Magnus"
                        autoComplete="nickname"
                        maxLength={30}
                        className={inputCls(!!guestError)}
                      />
                      <FieldError msg={guestError} />
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full flex items-center justify-center gap-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white text-sm font-semibold py-3 transition disabled:opacity-60"
                    >
                      {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Starting session…</> : <><Ghost className="w-4 h-4" /> Continue as Guest</>}
                    </button>

                    <p className="text-center text-xs text-white/40">
                      Want to save your progress?{" "}
                      <button type="button" onClick={() => switchTab("signup")} className="text-[oklch(0.75_0.14_145)] font-medium hover:underline">
                        Create a free account
                      </button>
                    </p>
                  </form>
                )}

                {/* ── Forgot password ── */}
                {tab === "forgot" && (
                  <form onSubmit={handleForgotPassword} className="space-y-4" noValidate>
                    {fpSent ? (
                      <div className="flex flex-col items-center gap-3 py-6 text-center">
                        <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center">
                          <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                        </div>
                        <p className="text-sm font-semibold text-white">Check your inbox</p>
                        <p className="text-xs text-white/40 max-w-[22ch]">
                          If an account exists for <span className="text-white/60">{fpEmail}</span>, we've sent a reset link.
                        </p>
                        <button
                          type="button"
                          onClick={() => switchTab("signin")}
                          className="mt-2 text-xs text-[oklch(0.75_0.14_145)] hover:underline"
                        >
                          Back to sign in
                        </button>
                      </div>
                    ) : (
                      <>
                        {fpError && (
                          <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-xs text-red-400">
                            {fpError}
                          </div>
                        )}
                        <div>
                          <label className="block text-xs font-medium text-white/50 mb-1.5">Email address</label>
                          <input
                            aria-label="Auth Forgot Email"
                            ref={firstInputRef}
                            type="email"
                            value={fpEmail}
                            onChange={(e) => { setFpEmail(e.target.value); setFpError(undefined); }}
                            placeholder="you@example.com"
                            autoComplete="email"
                            inputMode="email"
                            className={inputCls(!!fpError)}
                          />
                        </div>
                        <button
                          type="submit"
                          disabled={fpLoading}
                          className="w-full flex items-center justify-center gap-2 rounded-xl bg-[oklch(0.55_0.13_145)] hover:bg-[oklch(0.60_0.14_145)] text-white text-sm font-semibold py-3 transition disabled:opacity-60"
                        >
                          {fpLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending…</> : "Send reset link"}
                        </button>
                        <p className="text-center text-xs text-white/40">
                          Remembered it?{" "}
                          <button type="button" onClick={() => switchTab("signin")} className="text-[oklch(0.75_0.14_145)] font-medium hover:underline">
                            Sign in
                          </button>
                        </p>
                      </>
                    )}
                  </form>
                )}
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-[12px] text-white/55 mt-5">
          By continuing, you agree to our{" "}
          <a href="/terms" className="hover:text-white/50 underline underline-offset-2">Terms</a>
          {" & "}
          <a href="/privacy" className="hover:text-white/50 underline underline-offset-2">Privacy Policy</a>.
        </p>
      </div>
    </div>
  );
}
