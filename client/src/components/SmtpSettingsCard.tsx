/**
 * SmtpSettingsCard — lets tournament directors configure a personal SMTP
 * account so results emails can be sent server-side without opening their
 * email client.
 *
 * Features:
 *  - Load existing config on mount (password always masked)
 *  - Save / update config via PUT /api/email/smtp-config
 *  - Test connection via POST /api/email/test-smtp
 *  - Clear visual feedback: saved ✓, testing spinner, error messages
 *
 * Auth: uses httpOnly cookie (credentials: "include") — no token prop needed.
 */

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import {
  Mail,
  Server,
  Eye,
  EyeOff,
  CheckCircle,
  AlertCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  smtpUser: string;
  smtpPass: string; // empty string when loaded (masked on server)
  fromName: string;
  fromEmail: string;
}

const EMPTY_CONFIG: SmtpConfig = {
  host: "",
  port: 587,
  secure: false,
  smtpUser: "",
  smtpPass: "",
  fromName: "",
  fromEmail: "",
};

const PRESET_HOSTS: Array<{ label: string; host: string; port: number; secure: boolean }> = [
  { label: "Gmail", host: "smtp.gmail.com", port: 587, secure: false },
  { label: "Outlook", host: "smtp-mail.outlook.com", port: 587, secure: false },
  { label: "Yahoo", host: "smtp.mail.yahoo.com", port: 587, secure: false },
  { label: "Custom", host: "", port: 587, secure: false },
];

interface Props {
  isDark: boolean;
}

export function SmtpSettingsCard({ isDark }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [config, setConfig] = useState<SmtpConfig>(EMPTY_CONFIG);
  const [isConfigured, setIsConfigured] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  // ── Load existing config ──────────────────────────────────────────────────
  const loadConfig = useCallback(async () => {
    try {
      const res = await fetch("/api/email/smtp-config", { credentials: "include" });
      if (!res.ok) return;
      const data = await res.json();
      if (data.configured) {
        setIsConfigured(true);
        setConfig({
          host: data.host ?? "",
          port: data.port ?? 587,
          secure: data.secure ?? false,
          smtpUser: data.smtpUser ?? "",
          smtpPass: "", // always blank — server never returns the real password
          fromName: data.fromName ?? "",
          fromEmail: data.fromEmail ?? "",
        });
      }
    } catch {
      // silently ignore — not critical on load
    }
  }, []);

  useEffect(() => {
    if (expanded) loadConfig();
  }, [expanded, loadConfig]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  function applyPreset(preset: (typeof PRESET_HOSTS)[number]) {
    if (!preset.host) return; // "Custom" — don't overwrite
    setConfig((c) => ({ ...c, host: preset.host, port: preset.port, secure: preset.secure }));
  }

  function field(key: keyof SmtpConfig, value: string | number | boolean) {
    setConfig((c) => ({ ...c, [key]: value }));
    setTestResult(null);
  }

  // ── Save ──────────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!config.host || !config.smtpUser || !config.fromEmail) {
      return toast.error("Host, username, and From email are required");
    }
    if (!isConfigured && !config.smtpPass) {
      return toast.error("Password is required for initial setup");
    }

    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        host: config.host,
        port: config.port,
        secure: config.secure,
        smtpUser: config.smtpUser,
        fromName: config.fromName || "ChessOTB Director",
        fromEmail: config.fromEmail,
      };
      // Only send password if the director typed a new one
      if (config.smtpPass) body.smtpPass = config.smtpPass;

      const res = await fetch("/api/email/smtp-config", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as Record<string, string>).error ?? "Failed to save");
      }

      setIsConfigured(true);
      setConfig((c) => ({ ...c, smtpPass: "" })); // clear after save
      toast.success("SMTP settings saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save SMTP settings");
    } finally {
      setSaving(false);
    }
  }

  // ── Test ──────────────────────────────────────────────────────────────────
  async function handleTest() {
    if (!isConfigured) return toast.error("Save your SMTP settings first");

    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/email/test-smtp", {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setTestResult({ ok: true, message: data.message ?? "Test email sent!" });
        toast.success(data.message ?? "Test email sent!");
      } else {
        setTestResult({ ok: false, message: data.error ?? "Connection failed" });
        toast.error(data.error ?? "SMTP connection failed");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Connection failed";
      setTestResult({ ok: false, message: msg });
      toast.error(msg);
    } finally {
      setTesting(false);
    }
  }

  // ── Styles ────────────────────────────────────────────────────────────────
  const cardBg = isDark ? "bg-[oklch(0.22_0.06_145)] border-white/08" : "bg-white border-gray-100";
  const labelCls = `text-xs font-medium mb-1 block ${isDark ? "text-white/50" : "text-gray-500"}`;
  const inputCls = `w-full text-sm rounded-lg px-3 py-2 border outline-none transition-colors ${
    isDark
      ? "bg-white/05 border-white/10 text-white placeholder-white/25 focus:border-[oklch(0.7_0.2_145)]"
      : "bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400 focus:border-green-500"
  }`;

  return (
    <div className={`rounded-xl border overflow-hidden ${cardBg}`}>
      {/* ── Header (toggle) ─────────────────────────────────────────────── */}
      <button
        onClick={() => setExpanded((e) => !e)}
        className={`w-full flex items-center justify-between px-5 py-3.5 text-left transition-colors ${
          isDark ? "hover:bg-white/04" : "hover:bg-gray-50"
        }`}
      >
        <div className="flex items-center gap-2.5">
          <Mail size={15} className={isDark ? "text-[oklch(0.7_0.2_145)]" : "text-green-600"} />
          <span
            className={`text-sm font-semibold ${isDark ? "text-white/80" : "text-gray-700"}`}
            style={{ fontFamily: "'Clash Display', sans-serif" }}
          >
            Email Settings (SMTP)
          </span>
          {isConfigured && (
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-500/15 text-green-500">
              Configured
            </span>
          )}
        </div>
        {expanded ? (
          <ChevronUp size={15} className={isDark ? "text-white/30" : "text-gray-400"} />
        ) : (
          <ChevronDown size={15} className={isDark ? "text-white/30" : "text-gray-400"} />
        )}
      </button>

      {/* ── Body ────────────────────────────────────────────────────────── */}
      {expanded && (
        <div className={`px-5 pb-5 pt-3 border-t ${isDark ? "border-white/08" : "border-gray-100"}`}>
          {/* Description */}
          <p className={`text-xs mb-4 leading-relaxed ${isDark ? "text-white/40" : "text-gray-500"}`}>
            Connect your own email account so results are sent directly from your address — no copy-paste required.
            Gmail users: use an{" "}
            <a
              href="https://support.google.com/accounts/answer/185833"
              target="_blank"
              rel="noreferrer"
              className="underline text-green-500"
            >
              App Password
            </a>
            , not your regular password.
          </p>

          {/* Quick-pick presets */}
          <div className="flex flex-wrap gap-2 mb-4">
            {PRESET_HOSTS.map((p) => (
              <button
                key={p.label}
                onClick={() => applyPreset(p)}
                className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                  config.host === p.host && p.host !== ""
                    ? isDark
                      ? "bg-[oklch(0.7_0.2_145)]/20 border-[oklch(0.7_0.2_145)]/40 text-[oklch(0.7_0.2_145)]"
                      : "bg-green-50 border-green-300 text-green-700"
                    : isDark
                    ? "border-white/10 text-white/50 hover:border-white/20"
                    : "border-gray-200 text-gray-500 hover:border-gray-300"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Form grid */}
          <div className="grid grid-cols-2 gap-3 mb-3">
            {/* Host */}
            <div className="col-span-2 sm:col-span-1">
              <label className={labelCls}>SMTP Host</label>
              <input
                className={inputCls}
                placeholder="smtp.gmail.com"
                value={config.host}
                onChange={(e) => field("host", e.target.value)}
              />
            </div>
            {/* Port */}
            <div className="col-span-1">
              <label className={labelCls}>Port</label>
              <input
                className={inputCls}
                type="number"
                placeholder="587"
                value={config.port}
                onChange={(e) => field("port", Number(e.target.value))}
              />
            </div>
            {/* Secure toggle */}
            <div className="col-span-2 flex items-center gap-3">
              <button
                onClick={() => field("secure", !config.secure)}
                className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 ${
                  config.secure ? "bg-green-500" : isDark ? "bg-white/15" : "bg-gray-300"
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                    config.secure ? "translate-x-4" : "translate-x-0"
                  }`}
                />
              </button>
              <span className={`text-xs ${isDark ? "text-white/50" : "text-gray-500"}`}>
                Use SSL/TLS (port 465) — leave off for STARTTLS (port 587)
              </span>
            </div>
            {/* SMTP Username */}
            <div className="col-span-2 sm:col-span-1">
              <label className={labelCls}>SMTP Username</label>
              <input
                className={inputCls}
                placeholder="you@gmail.com"
                value={config.smtpUser}
                onChange={(e) => field("smtpUser", e.target.value)}
              />
            </div>
            {/* SMTP Password */}
            <div className="col-span-2 sm:col-span-1">
              <label className={labelCls}>
                {isConfigured ? "New Password (leave blank to keep)" : "Password / App Password"}
              </label>
              <div className="relative">
                <input
                  className={`${inputCls} pr-9`}
                  type={showPass ? "text" : "password"}
                  placeholder={isConfigured ? "••••••••" : "App password or SMTP password"}
                  value={config.smtpPass}
                  onChange={(e) => field("smtpPass", e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPass((s) => !s)}
                  className={`absolute right-2.5 top-1/2 -translate-y-1/2 ${
                    isDark ? "text-white/30" : "text-gray-400"
                  }`}
                >
                  {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
            {/* From Name */}
            <div className="col-span-2 sm:col-span-1">
              <label className={labelCls}>From Name</label>
              <input
                className={inputCls}
                placeholder="Brooklyn Chess Club"
                value={config.fromName}
                onChange={(e) => field("fromName", e.target.value)}
              />
            </div>
            {/* From Email */}
            <div className="col-span-2 sm:col-span-1">
              <label className={labelCls}>From Email</label>
              <input
                className={inputCls}
                placeholder="director@mychessclub.com"
                value={config.fromEmail}
                onChange={(e) => field("fromEmail", e.target.value)}
              />
            </div>
          </div>

          {/* Test result banner */}
          {testResult && (
            <div
              className={`flex items-center gap-2 text-xs rounded-lg px-3 py-2 mb-3 ${
                testResult.ok
                  ? isDark
                    ? "bg-green-500/10 text-green-400"
                    : "bg-green-50 text-green-700"
                  : isDark
                  ? "bg-red-500/10 text-red-400"
                  : "bg-red-50 text-red-600"
              }`}
            >
              {testResult.ok ? <CheckCircle size={13} /> : <AlertCircle size={13} />}
              <span>{testResult.message}</span>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-2 mt-1">
            <button
              onClick={handleSave}
              disabled={saving}
              className={`flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-lg transition-colors ${
                isDark
                  ? "bg-[oklch(0.7_0.2_145)] text-[oklch(0.15_0.05_145)] hover:bg-[oklch(0.65_0.2_145)]"
                  : "bg-green-600 text-white hover:bg-green-700"
              } disabled:opacity-50`}
            >
              {saving && <Loader2 size={12} className="animate-spin" />}
              {saving ? "Saving…" : isConfigured ? "Update Settings" : "Save Settings"}
            </button>

            {isConfigured && (
              <button
                onClick={handleTest}
                disabled={testing}
                className={`flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-lg border transition-colors ${
                  isDark
                    ? "border-white/15 text-white/60 hover:bg-white/05"
                    : "border-gray-200 text-gray-600 hover:bg-gray-50"
                } disabled:opacity-50`}
              >
                {testing ? <Loader2 size={12} className="animate-spin" /> : <Server size={12} />}
                {testing ? "Testing…" : "Send Test Email"}
              </button>
            )}
          </div>

          {/* Hint */}
          <p className={`text-xs mt-3 ${isDark ? "text-white/25" : "text-gray-400"}`}>
            Your password is encrypted with AES-256 before storage and never exposed in plain text.
          </p>
        </div>
      )}
    </div>
  );
}
