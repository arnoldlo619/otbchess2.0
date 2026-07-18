/**
 * AuthModal — Sign In / Sign Up / Guest overlay for OTB Chess
 *
 * Three tabs:
 *  - "signin"  — email + password login
 *  - "signup"  — full account registration
 *  - "guest"   — ephemeral 24-hour session with just a display name
 *
 * UX improvements:
 *  - Auto-focus first field when modal opens
 *  - Inline per-field error messages (not just a top banner)
 *  - Password strength indicator (weak / fair / strong)
 *  - Show/hide password toggle
 *  - Remember Me checkbox (signals 30-day session to server)
 *  - Improved loading state (spinner inside button, button disabled)
 *  - Animated success state (checkmark + welcome message)
 *  - Tab switch clears all errors and resets form fields
 *  - Enter key submits from any field
 *  - Escape key closes modal
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { X, Eye, EyeOff, Loader2, ChevronRight, CheckCircle2, Ghost } from "lucide-react";
import { useAuthContext } from "../context/AuthContext";

type Tab = "signin" | "signup" | "guest";

/* ─── Password strength ─────────────────────────────── */
export type StrengthLevel = "empty" | "weak" | "fair" | "strong";
export function scorePassword(pw: string): StrengthLevel {
  if (!pw) return "empty";
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 1) return "weak";
  if (score <= 3) return "fair";
  return "strong";
}
const strengthLabel: Record<StrengthLevel, string> = {
  empty: "",
  weak: "Weak",
  fair: "Fair",
  strong: "Strong",
};
const strengthColor: Record<StrengthLevel, string> = {
  empty: "bg-transparent",
  weak: "bg-red-500",
  fair: "bg-yellow-400",
  strong: "bg-emerald-500",
};
const strengthWidth: Record<StrengthLevel, string> = {
  empty: "w-0",
  weak: "w-1/3",
  fair: "w-2/3",
  strong: "w-full",
};

/* ─── Field-level error helper ──────────────────────── */
function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return (
    <p className="mt-1.5 text-xs text-red-400 flex items-center gap-1">
      <span className="inline-block w-1 h-1 rounded-full bg-red-400 shrink-0" />
      {msg}
    </p>
  );
}

/* ─── Password input with show/hide toggle ──────────── */
function PasswordInput({
  value,
  onChange,
  placeholder,
  id,
  isDark,
  hasError,
  autoComplete,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  id: string;
  isDark: boolean;
  hasError?: boolean;
  autoComplete?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        id={id}
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? "Password"}
        autoComplete={autoComplete ?? (id === "signin-password" ? "current-password" : "new-password")}
        enterKeyHint="done"
        className={`w-full rounded-xl border px-4 py-3.5 pr-11 text-base outline-none transition
          ${hasError
            ? "border-red-400 focus:border-red-400"
            : isDark
              ? "bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-[#4ade80]"
              : "bg-[#FBFADA]/70 border-[#ADBC9F] text-[#12372A] placeholder:text-[#436850]/60 focus:border-[#436850]"
          }
          ${isDark && !hasError ? "bg-white/5 text-white placeholder:text-white/30" : ""}
          ${!isDark && !hasError ? "bg-[#FBFADA]/70 text-[#12372A] placeholder:text-[#436850]/60" : ""}
        `}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className={`absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg transition
          ${isDark ? "text-white/40 hover:text-white/70" : "text-[#436850] hover:text-[#436850]"}`}
        tabIndex={-1}
        aria-label={show ? "Hide password" : "Show password"}
      >
        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
}

/* ─── Password strength bar ─────────────────────────── */
function PasswordStrengthBar({ password, isDark }: { password: string; isDark: boolean }) {
  const level = scorePassword(password);
  if (!password) return null;
  return (
    <div className="mt-2 space-y-1">
      <div className={`h-1.5 w-full rounded-full ${isDark ? "bg-white/10" : "bg-[#ADBC9F]"}`}>
        <div
          className={`h-full rounded-full transition-all duration-300 ${strengthColor[level]} ${strengthWidth[level]}`}
        />
      </div>
      <p className={`text-xs ${
        level === "weak" ? "text-red-400" :
        level === "fair" ? "text-yellow-400" :
        "text-emerald-500"
      }`}>
        {strengthLabel[level]}
      </p>
    </div>
  );
}

/* ─── Remember Me checkbox ──────────────────────────── */
function RememberMe({
  checked,
  onChange,
  isDark,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  isDark: boolean;
}) {
  return (
    <label className="flex items-center gap-2.5 cursor-pointer select-none group">
      <div
        className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition
          ${checked
            ? "bg-[#436850] border-[#436850]"
            : isDark
              ? "border-white/20 group-hover:border-white/40"
              : "border-[#ADBC9F] group-hover:border-[#436850]/40"
          }`}
        onClick={() => onChange(!checked)}
      >
        {checked && (
          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 12 12">
            <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only"
      />
      <span className={`text-sm ${isDark ? "text-white/60" : "text-[#436850]"}`}>
        Remember me for 30 days
      </span>
    </label>
  );
}

/* ─── Validate helpers ──────────────────────────────── */
export function validateEmail(email: string): string | undefined {
  if (!email) return "Email is required.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Enter a valid email address.";
}
export function validatePassword(pw: string, isSignUp = false): string | undefined {
  if (!pw) return "Password is required.";
  if (isSignUp && pw.length < 8) return "Password must be at least 8 characters.";
}
export function validateDisplayName(name: string): string | undefined {
  if (!name) return "Display name is required.";
  if (name.trim().length < 2) return "Display name must be at least 2 characters.";
}
export function validateGuestName(name: string): string | undefined {
  if (!name || name.trim().length < 2) return "Enter a name of at least 2 characters.";
  if (name.trim().length > 30) return "Name must be 30 characters or fewer.";
}

/* ─── Main component ────────────────────────────────── */
interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called immediately after a successful sign-in, sign-up, or guest login (before modal closes). */
  onSuccess?: () => void;
  isDark?: boolean;
  initialTab?: Tab;
  /** Pre-fill the sign-up name field (e.g. from a guest QR join). */
  initialName?: string;
}

export default function AuthModal({
  isOpen,
  onClose,
  onSuccess,
  isDark = false,
  initialTab = "signin",
  initialName = "",
}: AuthModalProps) {
  const { login, register, loginAsGuest, user } = useAuthContext();
  const [tab, setTab] = useState<Tab>(initialTab);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // Sign In fields + errors
  // Pre-fill email and Remember Me from localStorage if the user has signed in before
  const savedEmail = typeof window !== "undefined" ? (localStorage.getItem("otb-last-signin-email") ?? "") : "";
  const savedRemember = typeof window !== "undefined" ? localStorage.getItem("otb-remember-me") === "true" : false;
  const [siEmail, setSiEmail] = useState(savedEmail);
  const [siPassword, setSiPassword] = useState("");
  const [siRemember, setSiRemember] = useState(savedRemember);
  const [siErrors, setSiErrors] = useState<{ email?: string; password?: string; general?: string }>({})

  // Sign Up fields + errors
  const [suName, setSuName] = useState("");
  const [suEmail, setSuEmail] = useState("");
  const [suPassword, setSuPassword] = useState("");
  const [suChesscom, setSuChesscom] = useState("");
  const [suErrors, setSuErrors] = useState<{
    name?: string; email?: string; password?: string; general?: string;
  }>({});

  // Guest fields + errors
  const [guestName, setGuestName] = useState("");
  const [guestError, setGuestError] = useState<string | undefined>();

  const firstInputRef = useRef<HTMLInputElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const resetAll = useCallback(() => {
    // Restore saved email and Remember Me preference on reset so they persist across opens
    const lastEmail = typeof window !== "undefined" ? (localStorage.getItem("otb-last-signin-email") ?? "") : "";
    const lastRemember = typeof window !== "undefined" ? localStorage.getItem("otb-remember-me") === "true" : false;
    setSiEmail(lastEmail); setSiPassword(""); setSiRemember(lastRemember); setSiErrors({});
    setSuName(""); setSuEmail(""); setSuPassword(""); setSuChesscom(""); setSuErrors({});
    setGuestName(""); setGuestError(undefined);
    setSuccess(false); setLoading(false);
  }, []);

  // Open/close — when a guest opens the modal, land on Sign Up and pre-fill their name
  useEffect(() => {
    if (isOpen) {
      const guestUpgrade = user?.isGuest;
      setTab(guestUpgrade ? "signup" : initialTab);
      resetAll();
      // Pre-populate name from initialName prop (e.g. guest QR join) or guest session
      if (initialName) {
        setSuName(initialName);
      }
      if (guestUpgrade && user?.displayName) {
        setSuName(user.displayName);
      }
      setTimeout(() => firstInputRef.current?.focus(), 80);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Tab switch clears errors
  const switchTab = (t: Tab) => {
    setTab(t);
    setSiErrors({}); setSuErrors({}); setGuestError(undefined);
    setTimeout(() => firstInputRef.current?.focus(), 80);
  };

  // Escape to close
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  // Track mousedown target so we only close when the full click starts AND ends on the backdrop
  const mousedownTargetRef = useRef<EventTarget | null>(null);
  const handleOverlayMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    mousedownTargetRef.current = e.target;
  };
  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Only close if both mousedown and mouseup landed on the overlay itself (not the card)
    if (e.target === overlayRef.current && mousedownTargetRef.current === overlayRef.current) {
      onClose();
    }
    mousedownTargetRef.current = null;
  };

  if (!isOpen) return null;

  /* ── Sign In submit ── */
  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    const errors: typeof siErrors = {
      email: validateEmail(siEmail),
      password: validatePassword(siPassword),
    };
    if (errors.email || errors.password) { setSiErrors(errors); return; }
    setLoading(true); setSiErrors({});
    try {
      await login(siEmail, siPassword, siRemember);
      // Persist email and Remember Me preference so they auto-fill on the next sign-in
      if (typeof window !== "undefined") {
        localStorage.setItem("otb-last-signin-email", siEmail.trim().toLowerCase());
        localStorage.setItem("otb-remember-me", String(siRemember));
      }
      setSuccess(true);
      onSuccess?.();
      setTimeout(onClose, 1200);
    } catch (err) {
      setSiErrors({ general: (err as Error).message });
    } finally {
      setLoading(false);
    }
  }

  /* ── Sign Up submit ── */
  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    const errors: typeof suErrors = {
      name: validateDisplayName(suName),
      email: validateEmail(suEmail),
      password: validatePassword(suPassword, true),
    };
    if (errors.name || errors.email || errors.password) { setSuErrors(errors); return; }
    setLoading(true); setSuErrors({});
    try {
      await register(suEmail, suPassword, suName, suChesscom || undefined);
      setSuccess(true);
      onSuccess?.();
      setTimeout(onClose, 1200);
    } catch (err) {
      setSuErrors({ general: (err as Error).message });
    } finally {
      setLoading(false);
    }
  }

  /* ── Guest submit ── */
  async function handleGuest(e: React.FormEvent) {
    e.preventDefault();
    const err = validateGuestName(guestName);
    if (err) { setGuestError(err); return; }
    setLoading(true); setGuestError(undefined);
    try {
      await loginAsGuest(guestName.trim());
      setSuccess(true);
      onSuccess?.();
      setTimeout(onClose, 1200);
    } catch (err) {
      setGuestError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  /* ── Styles ── */
  const bg = isDark ? "bg-[#0d1f12]" : "bg-white";
  const border = isDark ? "border-white/10" : "border-[#ADBC9F]";
  const text = isDark ? "text-white" : "text-[#12372A]";
  const muted = isDark ? "text-white/50" : "text-[#436850]";
  const inputCls = (hasError?: boolean) =>
    `w-full rounded-xl border px-4 py-3.5 text-base outline-none transition ${
      hasError
        ? "border-red-400 focus:border-red-400 " + (isDark ? "bg-white/5 text-white placeholder:text-white/30" : "bg-[#FBFADA]/70 text-[#12372A] placeholder:text-[#436850]/60")
        : isDark
          ? "bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-[#4ade80]"
          : "bg-[#FBFADA]/70 border-[#ADBC9F] text-[#12372A] placeholder:text-[#436850]/60 focus:border-[#436850]"
    }`;
  const tabActive = isDark
    ? "bg-[#4ade80]/10 text-[#4ade80] font-semibold"
    : "bg-[#436850]/10 text-[#436850] font-semibold";
  const tabInactive = isDark
    ? "text-white/40 hover:text-white/70"
    : "text-[#436850] hover:text-[#436850]";

  const headerSubtitle =
    tab === "signin" ? "Welcome back" :
    tab === "signup" ? "Create your account" :
    "Quick guest access";

  return (
    <div
      ref={overlayRef}
      className="modal-overlay z-[200]"
      role="dialog"
      aria-modal="true"
      aria-label="Authentication"
      onMouseDown={handleOverlayMouseDown}
      onClick={handleOverlayClick}
    >
      {/* Backdrop — purely visual, pointer-events-none so overlay handles all clicks */}
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm pointer-events-none" />

      {/* Modal card — bottom-sheet on xs (≤480px), centered dialog on sm+ */}
      <div
        className={`modal-card max-w-md rounded-3xl border shadow-2xl ${bg} ${border}`}
        style={{ marginTop: "max(1rem, 8vh)", marginBottom: "max(1rem, 8vh)" }}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`flex items-center justify-between px-7 pt-7 pb-5 border-b ${border}`}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl overflow-hidden flex-shrink-0">
              <img
                src="https://d2xsxph8kpxj0f.cloudfront.net/117675823/J6FsDoRMH9x5xbUvpyzxyf/otb-logo-exclamation_0b3fa613.png"
                alt="OTB Chess"
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <h2 className={`text-lg font-bold leading-tight ${text}`}>OTB Chess</h2>
              <p className={`text-xs ${muted}`}>{headerSubtitle}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-2 rounded-xl transition ${
              isDark ? "hover:bg-white/10 text-white/50" : "hover:bg-[#ADBC9F]/50 text-[#436850]"
            }`}
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex gap-1 px-7 pt-5 pb-1">
          {(["signin", "signup", "guest"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => switchTab(t)}
              className={`flex-1 py-2.5 rounded-xl text-sm transition flex items-center justify-center gap-1.5 ${
                tab === t ? tabActive : tabInactive
              }`}
            >
              {t === "guest" && <Ghost className="w-3.5 h-3.5" />}
              {t === "signin" ? "Sign In" : t === "signup" ? "Sign Up" : "Guest"}
            </button>
          ))}
        </div>

        {/* Success state */}
        {success ? (
          <div className="flex flex-col items-center justify-center gap-4 px-7 py-14">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center animate-pulse">
              <CheckCircle2 className="w-9 h-9 text-emerald-500" />
            </div>
            <div className="text-center">
              <p className={`text-xl font-bold ${text}`}>
                {tab === "signin" ? "Welcome back!" : tab === "signup" ? "Account created!" : `Welcome, ${guestName.trim()}!`}
              </p>
              <p className={`text-sm mt-1 ${muted}`}>
                {tab === "signin" ? "Signing you in…" : tab === "signup" ? "Setting up your profile…" : "Starting your guest session…"}
              </p>
            </div>
          </div>
        ) : (
          <div className="px-7 pb-7 pt-4">

            {/* ── Sign In form ── */}
            {tab === "signin" && (
              <form onSubmit={handleSignIn} className="space-y-4" noValidate>
                {siErrors.general && (
                  <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
                    {siErrors.general}
                  </div>
                )}
                <div>
                  <label className={`block text-sm font-medium mb-1.5 ${muted}`}>
                    Email address
                  </label>
                  <input
                    ref={firstInputRef}
                    id="signin-email"
                    type="email"
                    value={siEmail}
                    onChange={(e) => { setSiEmail(e.target.value); setSiErrors((p) => ({ ...p, email: undefined })); }}
                    placeholder="you@example.com"
                    autoComplete="email"
                    inputMode="email"
                    enterKeyHint="next"
                    className={inputCls(!!siErrors.email)}
                  />
                  {/* Subtle hint when email was remembered from a previous sign-in */}
                  {siEmail && !siErrors.email && (
                    <p className={`mt-1 text-xs flex items-center gap-1 ${isDark ? "text-emerald-400/70" : "text-emerald-600/80"}`}>
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-current" />
                      Remembered from last sign-in
                    </p>
                  )}
                  <FieldError msg={siErrors.email} />
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1.5 ${muted}`}>
                    Password
                  </label>
                  <PasswordInput
                    id="signin-password"
                    value={siPassword}
                    onChange={(v) => { setSiPassword(v); setSiErrors((p) => ({ ...p, password: undefined })); }}
                    isDark={isDark}
                    hasError={!!siErrors.password}
                  />
                  <FieldError msg={siErrors.password} />
                </div>
                <RememberMe
                  checked={siRemember}
                  onChange={(val) => {
                    setSiRemember(val);
                    // Persist preference immediately so it survives page refreshes
                    if (typeof window !== "undefined") {
                      localStorage.setItem("otb-remember-me", String(val));
                    }
                  }}
                  isDark={isDark}
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#436850] hover:bg-[#245a41] text-white font-semibold py-3.5 text-base transition disabled:opacity-60 mt-2"
                >
                  {loading ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Signing in…</>
                  ) : (
                    <>Sign In <ChevronRight className="w-4 h-4" /></>
                  )}
                </button>
                <p className={`text-center text-sm ${muted}`}>
                  No account?{" "}
                  <button
                    type="button"
                    onClick={() => switchTab("signup")}
                    className="text-[#436850] dark:text-[#4ade80] font-medium hover:underline"
                  >
                    Create one free
                  </button>
                </p>
                {/* ── Google OAuth divider + button ── */}
                <div className="flex items-center gap-3 my-1">
                  <div className={`flex-1 h-px ${isDark ? "bg-white/10" : "bg-[#ADBC9F]/60"}`} />
                  <span className={`text-xs ${muted}`}>or</span>
                  <div className={`flex-1 h-px ${isDark ? "bg-white/10" : "bg-[#ADBC9F]/60"}`} />
                </div>
                <a
                  href="/api/auth/google"
                  className={`w-full flex items-center justify-center gap-3 rounded-xl border font-medium py-3.5 text-base transition ${
                    isDark
                      ? "bg-white/5 border-white/15 text-white hover:bg-white/10"
                      : "bg-white border-[#ADBC9F] text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  Continue with Google
                </a>
              </form>
            )}

            {/* ── Sign Up form ── */}
            {tab === "signup" && (
              <form onSubmit={handleSignUp} className="space-y-4" noValidate>
                {suErrors.general && (
                  <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
                    {suErrors.general}
                  </div>
                )}
                <div>
                  <label className={`block text-sm font-medium mb-1.5 ${muted}`}>
                    Display name <span className="text-red-400">*</span>
                  </label>
                  <input
                    ref={firstInputRef}
                    type="text"
                    value={suName}
                    onChange={(e) => { setSuName(e.target.value); setSuErrors((p) => ({ ...p, name: undefined })); }}
                    placeholder="Magnus Carlsen"
                    autoComplete="name"
                    inputMode="text"
                    enterKeyHint="next"
                    className={inputCls(!!suErrors.name)}
                  />
                  <FieldError msg={suErrors.name} />
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1.5 ${muted}`}>
                    Email address <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="email"
                    value={suEmail}
                    onChange={(e) => { setSuEmail(e.target.value); setSuErrors((p) => ({ ...p, email: undefined })); }}
                    placeholder="you@example.com"
                    autoComplete="email"
                    inputMode="email"
                    enterKeyHint="next"
                    className={inputCls(!!suErrors.email)}
                  />
                  <FieldError msg={suErrors.email} />
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1.5 ${muted}`}>
                    Password <span className="text-red-400">*</span>
                  </label>
                  <PasswordInput
                    id="signup-password"
                    value={suPassword}
                    onChange={(v) => { setSuPassword(v); setSuErrors((p) => ({ ...p, password: undefined })); }}
                    placeholder="At least 8 characters"
                    isDark={isDark}
                    hasError={!!suErrors.password}
                  />
                  <PasswordStrengthBar password={suPassword} isDark={isDark} />
                  <FieldError msg={suErrors.password} />
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1.5 ${muted}`}>
                    Chess.com username{" "}
                    <span className={`text-xs ${muted}`}>(optional — for ELO sync)</span>
                  </label>
                  <input
                    type="text"
                    value={suChesscom}
                    onChange={(e) => setSuChesscom(e.target.value)}
                    placeholder="your-chess-username"
                    autoComplete="off"
                    inputMode="text"
                    enterKeyHint="done"
                    className={inputCls()}
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#436850] hover:bg-[#245a41] text-white font-semibold py-3.5 text-base transition disabled:opacity-60 mt-2"
                >
                  {loading ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Creating account…</>
                  ) : (
                    <>Create Account <ChevronRight className="w-4 h-4" /></>
                  )}
                </button>
                <p className={`text-center text-sm ${muted}`}>
                  Already have an account?{" "}
                  <button
                    type="button"
                    onClick={() => switchTab("signin")}
                    className="text-[#436850] dark:text-[#4ade80] font-medium hover:underline"
                  >
                    Sign in
                  </button>
                </p>
                {/* ── Google OAuth divider + button ── */}
                <div className="flex items-center gap-3 my-1">
                  <div className={`flex-1 h-px ${isDark ? "bg-white/10" : "bg-[#ADBC9F]/60"}`} />
                  <span className={`text-xs ${muted}`}>or</span>
                  <div className={`flex-1 h-px ${isDark ? "bg-white/10" : "bg-[#ADBC9F]/60"}`} />
                </div>
                <a
                  href="/api/auth/google"
                  className={`w-full flex items-center justify-center gap-3 rounded-xl border font-medium py-3.5 text-base transition ${
                    isDark
                      ? "bg-white/5 border-white/15 text-white hover:bg-white/10"
                      : "bg-white border-[#ADBC9F] text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  Continue with Google
                </a>
              </form>
            )}

            {/* ── Guest form ── */}
            {tab === "guest" && (
              <form onSubmit={handleGuest} className="space-y-4" noValidate>
                {/* What guests can/can't do */}
                <div className={`rounded-2xl border px-4 py-3.5 space-y-2 ${
                  isDark ? "bg-white/3 border-white/8" : "bg-[#FBFADA]/70 border-[#ADBC9F]"
                }`}>
                  <p className={`text-xs font-semibold uppercase tracking-wide ${muted}`}>Guest access</p>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-emerald-500 font-bold">✓</span>
                      <span className={isDark ? "text-white/70" : "text-[#436850]"}>Join 1v1 Battle rooms</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-emerald-500 font-bold">✓</span>
                      <span className={isDark ? "text-white/70" : "text-[#436850]"}>View tournaments as spectator</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className={isDark ? "text-white/30" : "text-[#436850]"}>✗</span>
                      <span className={isDark ? "text-white/30" : "text-[#436850]"}>Host battles or create tournaments</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className={isDark ? "text-white/30" : "text-[#436850]"}>✗</span>
                      <span className={isDark ? "text-white/30" : "text-[#436850]"}>Save history (session lasts 24 h)</span>
                    </div>
                  </div>
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-1.5 ${muted}`}>
                    Your name <span className="text-red-400">*</span>
                  </label>
                  <input
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
                  className={`w-full flex items-center justify-center gap-2 rounded-xl font-semibold py-3.5 text-base transition disabled:opacity-60 mt-2 ${
                    isDark
                      ? "bg-white/10 hover:bg-white/15 text-white border border-white/15"
                      : "bg-gray-900 hover:bg-gray-800 text-white"
                  }`}
                >
                  {loading ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Starting session…</>
                  ) : (
                    <><Ghost className="w-4 h-4" /> Continue as Guest</>
                  )}
                </button>

                <p className={`text-center text-xs ${muted}`}>
                  Want to save your progress?{" "}
                  <button
                    type="button"
                    onClick={() => switchTab("signup")}
                    className="text-[#436850] dark:text-[#4ade80] font-medium hover:underline"
                  >
                    Create a free account
                  </button>
                </p>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
