/**
 * ArchivePasswordModal — full-screen overlay that gates access to the
 * Tournament Archive page. Shows a password input with:
 *   - Shake animation on wrong password
 *   - "Show / Hide" password toggle
 *   - Loading spinner while validating
 *   - Accessible labels and keyboard support (Enter to submit)
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { useTheme } from "@/contexts/ThemeContext";
import { Lock, Eye, EyeOff, ArrowLeft, ShieldAlert } from "lucide-react";
import { Link } from "wouter";

interface ArchivePasswordModalProps {
  /** Called with the entered password; return true if correct, false otherwise */
  onAttempt: (password: string) => boolean;
}

export default function ArchivePasswordModal({ onAttempt }: ArchivePasswordModalProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [shaking, setShaking] = useState(false);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const triggerShake = useCallback(() => {
    setShaking(true);
    setTimeout(() => setShaking(false), 600);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!password.trim()) {
      setError("Please enter the admin password.");
      triggerShake();
      return;
    }
    setLoading(true);
    setError("");

    // Small artificial delay so the spinner is visible (feels more secure)
    await new Promise((r) => setTimeout(r, 350));

    const ok = onAttempt(password);
    setLoading(false);

    if (!ok) {
      setError("Incorrect password. Access denied.");
      setPassword("");
      triggerShake();
      inputRef.current?.focus();
    }
    // If ok, the parent will unmount this modal
  }, [password, onAttempt, triggerShake]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") handleSubmit();
    },
    [handleSubmit]
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{
        background: isDark
          ? "oklch(0.14 0.06 145 / 0.97)"
          : "rgba(247,250,248,0.97)",
        backdropFilter: "blur(12px)",
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Archive password required"
    >
      {/* Back to home */}
      <Link href="/">
        <button
          className={`absolute top-5 left-5 flex items-center gap-1.5 text-sm font-medium transition-colors ${
            isDark ? "text-white/50 hover:text-white/80" : "text-gray-400 hover:text-gray-700"
          }`}
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </button>
      </Link>

      {/* Card */}
      <div
        className={`w-full max-w-sm rounded-3xl border shadow-2xl overflow-hidden ${
          isDark
            ? "bg-[oklch(0.20_0.06_145)] border-white/10"
            : "bg-white border-gray-100"
        }`}
        style={{
          animation: shaking ? "archiveShake 0.55s ease" : undefined,
        }}
      >
        {/* Header strip */}
        <div
          className="px-8 pt-8 pb-6 text-center"
          style={{
            background: isDark
              ? "linear-gradient(160deg, oklch(0.22 0.07 148), oklch(0.17 0.07 148))"
              : "linear-gradient(160deg, #f0f7f2, #e8f3ec)",
          }}
        >
          <div
            className={`w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center ${
              isDark ? "bg-[#3D6B47]/40" : "bg-[#3D6B47]/12"
            }`}
          >
            <ShieldAlert
              className={`w-7 h-7 ${isDark ? "text-[#4CAF50]" : "text-[#3D6B47]"}`}
            />
          </div>
          <h1
            className={`text-xl font-black mb-1 ${isDark ? "text-white" : "text-gray-900"}`}
            style={{ fontFamily: "'Clash Display', sans-serif" }}
          >
            Admin Access Only
          </h1>
          <p className={`text-sm ${isDark ? "text-white/50" : "text-gray-500"}`}>
            The Tournament Archive is restricted to platform administrators.
          </p>
        </div>

        {/* Body */}
        <div className="px-8 py-6 space-y-4">
          {/* Password field */}
          <div>
            <label
              htmlFor="archive-password"
              className={`block text-xs font-semibold uppercase tracking-wider mb-1.5 ${
                isDark ? "text-white/50" : "text-gray-500"
              }`}
            >
              Admin Password
            </label>
            <div className="relative">
              <div
                className={`absolute left-3 top-1/2 -translate-y-1/2 ${
                  isDark ? "text-white/30" : "text-gray-400"
                }`}
              >
                <Lock className="w-4 h-4" />
              </div>
              <input
                ref={inputRef}
                id="archive-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError("");
                }}
                onKeyDown={handleKeyDown}
                placeholder="Enter password…"
                autoComplete="current-password"
                className={`w-full pl-10 pr-10 py-3 rounded-xl border text-sm outline-none transition-all ${
                  error
                    ? isDark
                      ? "border-red-500/60 bg-red-500/08 text-white placeholder:text-white/30"
                      : "border-red-400 bg-red-50 text-gray-900 placeholder:text-gray-400"
                    : isDark
                    ? "border-white/12 bg-white/06 text-white placeholder:text-white/30 focus:border-[#4CAF50]/60 focus:bg-white/08"
                    : "border-gray-200 bg-gray-50 text-gray-900 placeholder:text-gray-400 focus:border-[#3D6B47]/50 focus:bg-white"
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className={`absolute right-3 top-1/2 -translate-y-1/2 transition-colors ${
                  isDark ? "text-white/30 hover:text-white/60" : "text-gray-400 hover:text-gray-600"
                }`}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
            {/* Error message */}
            {error && (
              <p className="mt-1.5 text-xs font-medium text-red-500" role="alert">
                {error}
              </p>
            )}
          </div>

          {/* Submit button */}
          <button
            onClick={handleSubmit}
            disabled={loading}
            className={`w-full py-3 rounded-xl text-sm font-bold transition-all active:scale-[0.98] disabled:opacity-60 ${
              isDark
                ? "bg-[#3D6B47] text-white hover:bg-[#4CAF50]/80"
                : "bg-[#3D6B47] text-white hover:bg-[#2d5235]"
            }`}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg
                  className="w-4 h-4 animate-spin"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v8H4z"
                  />
                </svg>
                Verifying…
              </span>
            ) : (
              "Unlock Archive"
            )}
          </button>
        </div>
      </div>

      {/* Shake keyframes injected via a style tag */}
      <style>{`
        @keyframes archiveShake {
          0%   { transform: translateX(0); }
          15%  { transform: translateX(-8px); }
          30%  { transform: translateX(8px); }
          45%  { transform: translateX(-6px); }
          60%  { transform: translateX(6px); }
          75%  { transform: translateX(-3px); }
          90%  { transform: translateX(3px); }
          100% { transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}
