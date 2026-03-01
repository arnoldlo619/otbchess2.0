/**
 * AuthModal — Sign In / Sign Up overlay for OTB Chess
 *
 * Two-tab design (Sign In / Create Account) with:
 *  - Email + password fields (Sign In)
 *  - Display name + email + password + optional chess.com username (Sign Up)
 *  - Inline error messages
 *  - Loading spinner on submit
 *  - Keyboard: Enter to submit, Escape to close
 *  - Respects dark / light mode via isDark prop
 */
import { useState, useEffect, useRef } from "react";
import { X, Eye, EyeOff, Crown, Loader2, ChevronRight } from "lucide-react";
import { useAuthContext } from "../context/AuthContext";

type Tab = "signin" | "signup";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDark?: boolean;
  /** Which tab to open first (default: "signin") */
  initialTab?: Tab;
}

function PasswordInput({
  value,
  onChange,
  placeholder,
  id,
  isDark,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  id: string;
  isDark: boolean;
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
        autoComplete={id === "signin-password" ? "current-password" : "new-password"}
        className={`w-full rounded-xl border px-4 py-3.5 pr-11 text-base outline-none transition
          ${
            isDark
              ? "bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-[#4ade80]"
              : "bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-[#2d6a4f]"
          }`}
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

export default function AuthModal({
  isOpen,
  onClose,
  isDark = false,
  initialTab = "signin",
}: AuthModalProps) {
  const { login, register } = useAuthContext();
  const [tab, setTab] = useState<Tab>(initialTab);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Sign In fields
  const [siEmail, setSiEmail] = useState("");
  const [siPassword, setSiPassword] = useState("");

  // Sign Up fields
  const [suName, setSuName] = useState("");
  const [suEmail, setSuEmail] = useState("");
  const [suPassword, setSuPassword] = useState("");
  const [suChesscom, setSuChesscom] = useState("");

  const firstInputRef = useRef<HTMLInputElement>(null);

  // Reset state when modal opens/closes or tab changes
  useEffect(() => {
    if (isOpen) {
      setTab(initialTab);
      setError(null);
      setSuccess(false);
      setLoading(false);
      setTimeout(() => firstInputRef.current?.focus(), 80);
    }
  }, [isOpen, initialTab]);

  useEffect(() => {
    setError(null);
  }, [tab]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    if (!siEmail || !siPassword) {
      setError("Please fill in all fields.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await login(siEmail, siPassword);
      setSuccess(true);
      setTimeout(onClose, 800);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    if (!suName || !suEmail || !suPassword) {
      setError("Please fill in all required fields.");
      return;
    }
    if (suPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await register(suEmail, suPassword, suName, suChesscom || undefined);
      setSuccess(true);
      setTimeout(onClose, 800);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const bg = isDark ? "bg-[#0d1f12]" : "bg-white";
  const border = isDark ? "border-white/10" : "border-gray-200";
  const text = isDark ? "text-white" : "text-gray-900";
  const muted = isDark ? "text-white/50" : "text-gray-500";
  const inputCls = `w-full rounded-xl border px-4 py-3.5 text-base outline-none transition ${
    isDark
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
        <div className={`flex gap-1 px-7 pt-5 pb-1`}>
          {(["signin", "signup"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
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
          <div className="flex flex-col items-center justify-center gap-3 px-7 py-12">
            <div className="text-5xl">✅</div>
            <p className={`text-lg font-semibold ${text}`}>
              {tab === "signin" ? "Welcome back!" : "Account created!"}
            </p>
          </div>
        ) : (
          <div className="px-7 pb-7 pt-4">
            {/* Error banner */}
            {error && (
              <div className="mb-4 rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}

            {/* ── Sign In form ── */}
            {tab === "signin" && (
              <form onSubmit={handleSignIn} className="space-y-4">
                <div>
                  <label className={`block text-sm font-medium mb-1.5 ${muted}`}>
                    Email address
                  </label>
                  <input
                    ref={firstInputRef}
                    id="signin-email"
                    type="email"
                    value={siEmail}
                    onChange={(e) => setSiEmail(e.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1.5 ${muted}`}>
                    Password
                  </label>
                  <PasswordInput
                    id="signin-password"
                    value={siPassword}
                    onChange={setSiPassword}
                    isDark={isDark}
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#2d6a4f] hover:bg-[#245a41] text-white font-semibold py-3.5 text-base transition disabled:opacity-60 mt-2"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      Sign In <ChevronRight className="w-4 h-4" />
                    </>
                  )}
                </button>
                <p className={`text-center text-sm ${muted}`}>
                  No account?{" "}
                  <button
                    type="button"
                    onClick={() => setTab("signup")}
                    className="text-[#2d6a4f] dark:text-[#4ade80] font-medium hover:underline"
                  >
                    Create one free
                  </button>
                </p>
              </form>
            )}

            {/* ── Sign Up form ── */}
            {tab === "signup" && (
              <form onSubmit={handleSignUp} className="space-y-4">
                <div>
                  <label className={`block text-sm font-medium mb-1.5 ${muted}`}>
                    Display name <span className="text-red-400">*</span>
                  </label>
                  <input
                    ref={firstInputRef}
                    type="text"
                    value={suName}
                    onChange={(e) => setSuName(e.target.value)}
                    placeholder="Magnus Carlsen"
                    autoComplete="name"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1.5 ${muted}`}>
                    Email address <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="email"
                    value={suEmail}
                    onChange={(e) => setSuEmail(e.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1.5 ${muted}`}>
                    Password <span className="text-red-400">*</span>
                  </label>
                  <PasswordInput
                    id="signup-password"
                    value={suPassword}
                    onChange={setSuPassword}
                    placeholder="At least 8 characters"
                    isDark={isDark}
                  />
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
                    className={inputCls}
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#2d6a4f] hover:bg-[#245a41] text-white font-semibold py-3.5 text-base transition disabled:opacity-60 mt-2"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      Create Account <ChevronRight className="w-4 h-4" />
                    </>
                  )}
                </button>
                <p className={`text-center text-sm ${muted}`}>
                  Already have an account?{" "}
                  <button
                    type="button"
                    onClick={() => setTab("signin")}
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
