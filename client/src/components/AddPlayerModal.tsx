/*
 * AddPlayerModal — Director can manually add a player to the tournament.
 *
 * Modes:
 *   chess.com  — enter username → auto-fetch rapid ELO from chess.com API
 *   lichess    — enter username → auto-fetch rating from Lichess API
 *   manual     — enter name + ELO directly (no API lookup)
 *
 * On confirm, calls onAdd(player) and closes.
 */

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useTheme } from "@/contexts/ThemeContext";
import { toast } from "sonner";
import { nanoid } from "nanoid";
import {
  X,
  Search,
  User,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
} from "lucide-react";
import type { Player } from "@/lib/tournamentData";

// ─── Types ────────────────────────────────────────────────────────────────────

type Platform = "chess.com" | "lichess" | "manual";

interface LookupResult {
  name: string;
  username: string;
  elo: number;
  rapid?: number;
  blitz?: number;
  bullet?: number;
  avatar?: string;
  country?: string;
  title?: string;
}

// ─── Design tokens ────────────────────────────────────────────────────────────

const G = "#3D6B47";
const G_DARK = "#2A4A32";
const G_BG = "rgba(61,107,71,0.08)";
const G_RING = "rgba(61,107,71,0.25)";

// ─── ELO lookup helpers ───────────────────────────────────────────────────────

async function lookupChessCom(username: string): Promise<LookupResult> {
  const [profileRes, statsRes] = await Promise.all([
    fetch(`https://api.chess.com/pub/player/${username.toLowerCase()}`),
    fetch(`https://api.chess.com/pub/player/${username.toLowerCase()}/stats`),
  ]);
  if (!profileRes.ok) throw new Error("Player not found on chess.com");
  const profile = await profileRes.json();
  const stats = statsRes.ok ? await statsRes.json() : {};
  const rapid = stats?.chess_rapid?.last?.rating ?? 0;
  const blitz = stats?.chess_blitz?.last?.rating ?? 0;
  const bullet = stats?.chess_bullet?.last?.rating ?? 0;
  return {
    name: profile.name || profile.username,
    username: profile.username,
    rapid,
    blitz,
    bullet,
    elo: rapid || blitz || bullet || 1200,
    avatar: profile.avatar,
    country: profile.country?.split("/").pop()?.toUpperCase(),
    title: profile.title,
  };
}

async function lookupLichess(username: string): Promise<LookupResult> {
  const res = await fetch(`https://lichess.org/api/user/${username.toLowerCase()}`);
  if (!res.ok) throw new Error("Player not found on Lichess");
  const data = await res.json();
  const perfs = data.perfs ?? {};
  const elo =
    perfs.rapid?.rating ?? perfs.blitz?.rating ?? perfs.bullet?.rating ?? perfs.classical?.rating ?? 1500;
  return {
    name: data.profile?.realName || data.username,
    username: data.username,
    elo,
    avatar: undefined,
    country: data.profile?.country,
    title: data.title,
  };
}

// ─── Platform selector ────────────────────────────────────────────────────────

function PlatformPill({
  value,
  active,
  onClick,
  isDark,
}: {
  value: Platform;
  active: boolean;
  onClick: () => void;
  isDark: boolean;
}) {
  const label = value === "chess.com" ? "chess.com" : value === "lichess" ? "Lichess" : "Manual";
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex-1 py-2 rounded-lg text-sm font-semibold transition-all duration-200"
      style={{
        background: active ? G : isDark ? "rgba(255,255,255,0.06)" : "#F3F4F6",
        color: active ? "#FFFFFF" : isDark ? "rgba(255,255,255,0.55)" : "#6B7280",
        boxShadow: active ? `0 2px 8px ${G_RING}` : "none",
      }}
    >
      {label}
    </button>
  );
}

// ─── Main Modal ───────────────────────────────────────────────────────────────

interface AddPlayerModalProps {
  open: boolean;
  onClose: () => void;
  onAdd: (player: Player) => void;
  existingUsernames: string[];
  /** Which chess.com rating category to use: "rapid" (default) or "blitz". */
  ratingType?: "rapid" | "blitz";
}

export function AddPlayerModal({ open, onClose, onAdd, existingUsernames, ratingType = "rapid" }: AddPlayerModalProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [platform, setPlatform] = useState<Platform>("chess.com");
  const [username, setUsername] = useState("");
  const [manualName, setManualName] = useState("");
  const [manualElo, setManualElo] = useState("");
  const [lookupState, setLookupState] = useState<"idle" | "loading" | "found" | "error">("idle");
  const [lookupResult, setLookupResult] = useState<LookupResult | null>(null);
  const [lookupError, setLookupError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset on open/platform change
  useEffect(() => {
    if (open) {
      setUsername("");
      setManualName("");
      setManualElo("");
      setLookupState("idle");
      setLookupResult(null);
      setLookupError("");
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [open, platform]);

  // Escape to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    if (open) window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const handleLookup = async () => {
    const u = username.trim();
    if (!u) return;
    if (existingUsernames.map((x) => x.toLowerCase()).includes(u.toLowerCase())) {
      setLookupState("error");
      setLookupError("This player is already registered.");
      return;
    }
    setLookupState("loading");
    setLookupResult(null);
    setLookupError("");
    try {
      const result = platform === "chess.com" ? await lookupChessCom(u) : await lookupLichess(u);
      setLookupResult(result);
      setLookupState("found");
    } catch (err) {
      setLookupState("error");
      setLookupError(err instanceof Error ? err.message : "Lookup failed. Check the username.");
    }
  };

  const handleAdd = () => {
    if (platform === "manual") {
      const name = manualName.trim();
      const elo = parseInt(manualElo, 10);
      if (!name) { toast.error("Please enter a player name."); return; }
      if (isNaN(elo) || elo < 100 || elo > 3500) { toast.error("Please enter a valid ELO (100–3500)."); return; }
      const player: Player = {
        id: nanoid(),
        name,
        username: name.toLowerCase().replace(/\s+/g, "_"),
        elo,
        country: "Unknown",
        wins: 0, draws: 0, losses: 0,
        points: 0, buchholz: 0,
        colorHistory: [],
      };
      onAdd(player);
      toast.success(`${name} added to the tournament.`);
      onClose();
      return;
    }
    if (lookupState !== "found" || !lookupResult) return;
    const player: Player = {
      id: nanoid(),
      name: lookupResult.name || lookupResult.username,
      username: lookupResult.username,
      elo: platform === "chess.com" && ratingType === "blitz"
        ? (lookupResult.blitz || lookupResult.rapid || lookupResult.bullet || lookupResult.elo)
        : (lookupResult.rapid || lookupResult.blitz || lookupResult.bullet || lookupResult.elo),
      platform: platform === "chess.com" ? "chesscom" : "lichess",
      country: lookupResult.country ?? "Unknown",
      title: lookupResult.title as Player["title"],
      avatarUrl: lookupResult.avatar,
      wins: 0, draws: 0, losses: 0,
        points: 0, buchholz: 0,
        colorHistory: [],
      };
      onAdd(player);
      toast.success(`${player.name} (${player.elo}) added to the tournament.`);
    onClose();
  };

  const canAdd =
    platform === "manual"
      ? manualName.trim().length > 0 && parseInt(manualElo, 10) >= 100
      : lookupState === "found";

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-md rounded-2xl shadow-2xl overflow-hidden"
        style={{
          background: isDark ? "oklch(0.22 0.06 145)" : "#FFFFFF",
          border: `1px solid ${isDark ? "rgba(255,255,255,0.10)" : "#E5E7EB"}`,
          animation: "modalIn 0.22s cubic-bezier(0.34,1.56,0.64,1) both",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 border-b"
          style={{ borderColor: isDark ? "rgba(255,255,255,0.08)" : "#F0F0F0" }}
        >
          <div className="flex items-center gap-2.5">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: G }}
            >
              <User className="w-3.5 h-3.5 text-white" />
            </div>
            <span
              className="text-sm font-bold"
              style={{
                fontFamily: "'Clash Display', sans-serif",
                color: isDark ? "#FFFFFF" : "#1A1A1A",
              }}
            >
              Add Player
            </span>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center transition-colors"
            style={{
              background: isDark ? "rgba(255,255,255,0.06)" : "#F3F4F6",
              color: isDark ? "rgba(255,255,255,0.55)" : "#6B7280",
            }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5">
          {/* Platform selector */}
          <div>
            <label
              className="text-xs font-semibold uppercase tracking-widest mb-2 block"
              style={{ color: isDark ? "rgba(255,255,255,0.40)" : "#9CA3AF" }}
            >
              Platform
            </label>
            <div
              className="flex gap-1.5 p-1 rounded-xl"
              style={{ background: isDark ? "rgba(255,255,255,0.04)" : "#F3F4F6" }}
            >
              {(["chess.com", "lichess", "manual"] as Platform[]).map((p) => (
                <PlatformPill
                  key={p}
                  value={p}
                  active={platform === p}
                  onClick={() => setPlatform(p)}
                  isDark={isDark}
                />
              ))}
            </div>
          </div>

          {/* Username lookup (chess.com / lichess) */}
          {platform !== "manual" && (
            <div>
              <label
                className="text-xs font-semibold uppercase tracking-widest mb-2 block"
                style={{ color: isDark ? "rgba(255,255,255,0.40)" : "#9CA3AF" }}
              >
                {platform === "chess.com" ? "chess.com Username" : "Lichess Username"}
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
                    style={{ color: isDark ? "rgba(255,255,255,0.30)" : "#9CA3AF" }}
                  />
                  <input
                    ref={inputRef}
                    type="text"
                    value={username}
                    onChange={(e) => { setUsername(e.target.value); setLookupState("idle"); setLookupResult(null); }}
                    onKeyDown={(e) => { if (e.key === "Enter") handleLookup(); }}
                    placeholder={platform === "chess.com" ? "e.g. hikaru" : "e.g. DrNykterstein"}
                    className="w-full rounded-xl border outline-none transition-all duration-200"
                    style={{
                      padding: "10px 14px 10px 38px",
                      fontSize: 14,
                      background: isDark ? "oklch(0.25 0.07 145)" : "#FAFAFA",
                      border: `1.5px solid ${isDark ? "rgba(255,255,255,0.12)" : "#D1D5DB"}`,
                      color: isDark ? "#FFFFFF" : "#1A1A1A",
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = G;
                      e.target.style.boxShadow = `0 0 0 3px ${G_RING}`;
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = isDark ? "rgba(255,255,255,0.12)" : "#D1D5DB";
                      e.target.style.boxShadow = "none";
                    }}
                  />
                </div>
                <button
                  type="button"
                  onClick={handleLookup}
                  disabled={!username.trim() || lookupState === "loading"}
                  className="flex items-center gap-1.5 rounded-xl text-sm font-semibold transition-all duration-200 flex-shrink-0"
                  style={{
                    padding: "10px 18px",
                    background: username.trim() ? G : isDark ? "rgba(255,255,255,0.08)" : "#F0F5EE",
                    color: username.trim() ? "#FFFFFF" : isDark ? "rgba(255,255,255,0.25)" : "#9CA3AF",
                    cursor: username.trim() ? "pointer" : "not-allowed",
                  }}
                >
                  {lookupState === "loading" ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    "Look up"
                  )}
                </button>
              </div>

              {/* Lookup result */}
              {lookupState === "found" && lookupResult && (
                <div
                  className="mt-3 flex items-center gap-3 rounded-xl border p-3"
                  style={{
                    background: isDark ? G_BG : "#F0FDF4",
                    border: `1.5px solid ${isDark ? "rgba(61,107,71,0.35)" : "#BBF7D0"}`,
                    animation: "fadeInUp 0.2s ease both",
                  }}
                >
                  {lookupResult.avatar ? (
                    <img
                      src={lookupResult.avatar}
                      alt={lookupResult.name}
                      className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                    />
                  ) : (
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold text-white"
                      style={{ background: G }}
                    >
                      {(lookupResult.name || lookupResult.username)[0]?.toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-sm font-semibold truncate"
                      style={{ color: isDark ? "#FFFFFF" : "#1A1A1A" }}
                    >
                      {lookupResult.title && (
                        <span className="text-amber-500 mr-1">{lookupResult.title}</span>
                      )}
                      {lookupResult.name || lookupResult.username}
                    </p>
                    <p className="text-xs" style={{ color: isDark ? "rgba(255,255,255,0.50)" : "#6B7280" }}>
                      @{lookupResult.username} · ELO {lookupResult.elo}
                      {lookupResult.country && ` · ${lookupResult.country}`}
                    </p>
                  </div>
                  <CheckCircle2 className="w-5 h-5 flex-shrink-0" style={{ color: G }} />
                </div>
              )}

              {/* Error */}
              {lookupState === "error" && (
                <div
                  className="mt-3 flex items-center gap-2 rounded-xl border p-3 text-sm"
                  style={{
                    background: isDark ? "rgba(239,68,68,0.10)" : "#FEF2F2",
                    border: `1.5px solid ${isDark ? "rgba(239,68,68,0.25)" : "#FECACA"}`,
                    color: isDark ? "#FCA5A5" : "#DC2626",
                    animation: "fadeInUp 0.2s ease both",
                  }}
                >
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {lookupError}
                </div>
              )}
            </div>
          )}

          {/* Manual entry */}
          {platform === "manual" && (
            <div className="space-y-4">
              <div>
                <label
                  className="text-xs font-semibold uppercase tracking-widest mb-2 block"
                  style={{ color: isDark ? "rgba(255,255,255,0.40)" : "#9CA3AF" }}
                >
                  Full Name
                </label>
                <input
                  ref={inputRef}
                  type="text"
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  placeholder="e.g. Magnus Carlsen"
                  className="w-full rounded-xl border outline-none transition-all duration-200"
                  style={{
                    padding: "10px 14px",
                    fontSize: 14,
                    background: isDark ? "oklch(0.25 0.07 145)" : "#FAFAFA",
                    border: `1.5px solid ${isDark ? "rgba(255,255,255,0.12)" : "#D1D5DB"}`,
                    color: isDark ? "#FFFFFF" : "#1A1A1A",
                  }}
                  onFocus={(e) => { e.target.style.borderColor = G; e.target.style.boxShadow = `0 0 0 3px ${G_RING}`; }}
                  onBlur={(e) => { e.target.style.borderColor = isDark ? "rgba(255,255,255,0.12)" : "#D1D5DB"; e.target.style.boxShadow = "none"; }}
                />
              </div>
              <div>
                <label
                  className="text-xs font-semibold uppercase tracking-widest mb-2 block"
                  style={{ color: isDark ? "rgba(255,255,255,0.40)" : "#9CA3AF" }}
                >
                  ELO Rating
                </label>
                <input
                  type="number"
                  value={manualElo}
                  onChange={(e) => setManualElo(e.target.value)}
                  placeholder="e.g. 1500"
                  min={100}
                  max={3500}
                  className="w-full rounded-xl border outline-none transition-all duration-200"
                  style={{
                    padding: "10px 14px",
                    fontSize: 14,
                    background: isDark ? "oklch(0.25 0.07 145)" : "#FAFAFA",
                    border: `1.5px solid ${isDark ? "rgba(255,255,255,0.12)" : "#D1D5DB"}`,
                    color: isDark ? "#FFFFFF" : "#1A1A1A",
                  }}
                  onFocus={(e) => { e.target.style.borderColor = G; e.target.style.boxShadow = `0 0 0 3px ${G_RING}`; }}
                  onBlur={(e) => { e.target.style.borderColor = isDark ? "rgba(255,255,255,0.12)" : "#D1D5DB"; e.target.style.boxShadow = "none"; }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-between px-6 py-4 border-t"
          style={{ borderColor: isDark ? "rgba(255,255,255,0.08)" : "#F0F0F0" }}
        >
          <button
            type="button"
            onClick={onClose}
            className="text-sm font-medium px-4 py-2 rounded-xl transition-colors"
            style={{ color: isDark ? "rgba(255,255,255,0.55)" : "#6B7280" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = isDark ? "rgba(255,255,255,0.06)" : "#F3F4F6"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleAdd}
            disabled={!canAdd}
            className="flex items-center gap-2 text-sm font-semibold rounded-xl transition-all duration-200"
            style={{
              padding: "10px 22px",
              background: canAdd ? G : isDark ? "rgba(255,255,255,0.08)" : "#F0F5EE",
              color: canAdd ? "#FFFFFF" : isDark ? "rgba(255,255,255,0.25)" : "#9CA3AF",
              cursor: canAdd ? "pointer" : "not-allowed",
              boxShadow: canAdd ? `0 4px 14px ${G_RING}` : "none",
            }}
          >
            Add to Tournament
          </button>
        </div>
      </div>

      <style>{`
        @keyframes modalIn {
          from { opacity: 0; transform: scale(0.94) translateY(12px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>,
    document.body
  );
}
