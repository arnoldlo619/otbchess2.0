/**
 * AuthModal — Sign In / Sign Up overlay for OTB Chess
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
import { X, Eye, EyeOff, Crown, Loader2, ChevronRight, CheckCircle2 } from "lucide-react";
import { useAuthContext } from "../context/AuthContext";

type Tab = "signin" | "signup";

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
        className={`w-full rounded-xl border px-4 py-3.5 pr-11 text-base outline-none transition
          ${hasError
            ? "border-red-400 focus:border-red-400"
            : isDark
              ? "bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-[#4ade80]"
              : "bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-[#2d6a4f]"
          }
          ${isDark && !hasError ? "bg-white/5 text-white placeholder:text-white/30" : ""}
          ${!isDark && !hasError ? "bg-gray-50 text-gray-900 placeholder:text-gray-400" : ""}
        `}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className={`absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg transition
          ${isDark ? "text-white/40 hover:text-white/70" : "text-gray-400 hover:text-gray-600"}`}
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
      <div className={`h-1.5 w-full rounded-full ${isDark ? "bg-white/10" : "bg-gray-200"}`}>
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
            ? "bg-[#2d6a4f] border-[#2d6a4f]"
            : isDark
              ? "border-white/20 group-hover:border-white/40"
              : "border-gray-300 group-hover:border-gray-400"
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
      <span className={`text-sm ${isDark ? "text-white/60" : "text-gray-500"}`}>
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

/* ─── Main component ────────────────────────────────── */
interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDark?: boolean;
  initialTab?: Tab;
}

export default function AuthModal({
  isOpen,
  onClose,
  isDark = false,
  initialTab = "signin",
}: AuthModalProps) {
  const { login, register } = useAuthContext();
  const [tab, setTab] = useState<Tab>(initialTab);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // Sign In fields + errors
  const [siEmail, setSiEmail] = useState("");
  const [siPassword, setSiPassword] = useState("");
  const [siRemember, setSiRemember] = useState(false);
  const [siErrors, setSiErrors] = useState<{ email?: string; password?: string; general?: string }>({});

  // Sign Up fields + errors
  const [suName, setSuName] = useState("");
  const [suEmail, setSuEmail] = useState("");
  const [suPassword, setSuPassword] = useState("");
  const [suChesscom, setSuChesscom] = useState("");
  const [suErrors, setSuErrors] = useState<{
    name?: string; email?: string; password?: string; general?: string;
  }>({});

  const firstInputRef = useRef<HTMLInputElement>(null);

  const resetAll = useCallback(() => {
    setSiEmail(""); setSiPassword(""); setSiRemember(false); setSiErrors({});
    setSuName(""); setSuEmail(""); setSuPassword(""); setSuChesscom(""); setSuErrors({});
    setSuccess(false); setLoading(false);
  }, []);

  // Open/close
  useEffect(() => {
    if (isOpen) {
      setTab(initialTab);
      resetAll();
      setTimeout(() => firstInputRef.current?.focus(), 80);
    }
  }, [isOpen, initialTab, resetAll]);

  // Tab switch clears errors
  const switchTab = (t: Tab) => {
    setTab(t);
    setSiErrors({}); setSuErrors({});
  };

  // Escape to close
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

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
      setSuccess(true);
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
      setTimeout(onClose, 1200);
    } catch (err) {
      setSuErrors({ general: (err as Error).message });
    } finally {
      setLoading(false);
    }
  }

  /* ── Styles ── */
  const bg = isDark ? "bg-[#0d1f12]" : "bg-white";
  const border = isDark ? "border-white/10" : "border-gray-200";
  const text = isDark ? "text-white" : "text-gray-900";
  const muted = isDark ? "text-white/50" : "text-gray-500";
  const inputCls = (hasError?: boolean) =>
    `w-full rounded-xl border px-4 py-3.5 text-base outline-none transition ${
      hasError
        ? "border-red-400 focus:border-red-400 " + (isDark ? "bg-white/5 text-white placeholder:text-white/30" : "bg-gray-50 text-gray-900 placeholder:text-gray-400")
        : isDark
          ? "bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-[#4ade80]"
          : "bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-[#2d6a4f]"
    }`;
  const tabActive = isDark
    ? "bg-[#4ade80]/10 text-[#4ade80] font-semibold"
    : "bg-[#2d6a4f]/10 text-[#2d6a4f] font-semibold";
  const tabInactive = isDark
    ? "text-white/40 hover:text-white/70"
    : "text-gray-400 hover:text-gray-600";

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal card */}
      <div
        className={`relative z-10 w-full max-w-md rounded-3xl border shadow-2xl ${bg} ${border} overflow-hidden`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`flex items-center justify-between px-7 pt-7 pb-5 border-b ${border}`}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#2d6a4f] flex items-center justify-center">
              <Crown className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className={`text-lg font-bold leading-tight ${text}`}>OTB Chess</h2>
              <p className={`text-xs ${muted}`}>
                {tab === "signin" ? "Welcome back" : "Create your account"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-2 rounded-xl transition ${
              isDark ? "hover:bg-white/10 text-white/50" : "hover:bg-gray-100 text-gray-400"
            }`}
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex gap-1 px-7 pt-5 pb-1">
          {(["signin", "signup"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => switchTab(t)}
              className={`flex-1 py-2.5 rounded-xl text-sm transition ${
                tab === t ? tabActive : tabInactive
              }`}
            >
              {t === "signin" ? "Sign In" : "Create Account"}
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
                {tab === "signin" ? "Welcome back!" : "Account created!"}
              </p>
              <p className={`text-sm mt-1 ${muted}`}>
                {tab === "signin" ? "Signing you in…" : "Setting up your profile…"}
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
                    className={inputCls(!!siErrors.email)}
                  />
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
                <RememberMe checked={siRemember} onChange={setSiRemember} isDark={isDark} />
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#2d6a4f] hover:bg-[#245a41] text-white font-semibold py-3.5 text-base transition disabled:opacity-60 mt-2"
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
                    className="text-[#2d6a4f] dark:text-[#4ade80] font-medium hover:underline"
                  >
                    Create one free
                  </button>
                </p>
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
                    className={inputCls()}
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#2d6a4f] hover:bg-[#245a41] text-white font-semibold py-3.5 text-base transition disabled:opacity-60 mt-2"
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
                    className="text-[#2d6a4f] dark:text-[#4ade80] font-medium hover:underline"
                  >
                    Sign in
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
