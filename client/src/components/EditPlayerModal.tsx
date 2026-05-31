/**
 * EditPlayerModal
 * ───────────────
 * Allows a tournament director to:
 *   1. Edit a player's display name
 *   2. Manually override the player's active ELO
 *   3. Fetch the player's alternate ELO from chess.com
 *      (e.g. if the tournament uses Rapid, offer to pull Blitz, and vice versa)
 *
 * On save, calls onSave(updatedPlayer) — the parent is responsible for
 * persisting the change to state and the server.
 */

import { useState, useEffect, useRef } from "react";
import { X, RefreshCw, Check, AlertCircle, ChevronDown } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import type { Player } from "@/lib/tournamentData";
import { resolvePairingRating } from "@/lib/swiss";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChessComStats {
  chess_rapid?: { last?: { rating: number } };
  chess_blitz?: { last?: { rating: number } };
  chess_bullet?: { last?: { rating: number } };
}

export interface EditPlayerModalProps {
  open: boolean;
  player: Player | null;
  /** The rating type the tournament is using — determines which "alternate" to offer */
  tournamentRatingType: "rapid" | "blitz";
  onSave: (updated: Player) => void;
  onClose: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseElo(val: string): number | null {
  const n = parseInt(val.trim(), 10);
  if (isNaN(n) || n < 0 || n > 4000) return null;
  return n;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function EditPlayerModal({
  open,
  player,
  tournamentRatingType,
  onSave,
  onClose,
}: EditPlayerModalProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  // ── Form state ──────────────────────────────────────────────────────────────
  const [name, setName] = useState("");
  const [eloStr, setEloStr] = useState("");
  const [rapidEloStr, setRapidEloStr] = useState("");
  const [blitzEloStr, setBlitzEloStr] = useState("");
  const [manualPairingRatingStr, setManualPairingRatingStr] = useState("");

  // ── Fetch state ─────────────────────────────────────────────────────────────
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [fetchSuccess, setFetchSuccess] = useState(false);
  const [showAllRatings, setShowAllRatings] = useState(false);

  // ── Validation ──────────────────────────────────────────────────────────────
  const nameError = name.trim().length === 0 ? "Name cannot be empty" : null;
  const eloError = eloStr.trim() !== "" && parseElo(eloStr) === null ? "Enter a valid ELO (0–4000)" : null;

  const nameRef = useRef<HTMLInputElement>(null);

  // Populate form when player changes
  useEffect(() => {
    if (!player) return;
    setName(player.name);
    setEloStr(player.elo != null ? String(player.elo) : "");
    setRapidEloStr(player.rapidElo != null ? String(player.rapidElo) : "");
    setBlitzEloStr(player.blitzElo != null ? String(player.blitzElo) : "");
    setManualPairingRatingStr(player.manualPairingRating != null ? String(player.manualPairingRating) : "");
    setFetchError(null);
    setFetchSuccess(false);
    setShowAllRatings(false);
  }, [player, open]);

  // Focus name field on open
  useEffect(() => {
    if (open) setTimeout(() => nameRef.current?.focus(), 60);
  }, [open]);

  // Escape key
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);

  if (!open || !player) return null;

  // ── Alternate ELO fetch ──────────────────────────────────────────────────────
  const altRatingType = tournamentRatingType === "rapid" ? "blitz" : "rapid";
  const altLabel = altRatingType === "blitz" ? "Blitz" : "Rapid";
  const currentLabel = tournamentRatingType === "rapid" ? "Rapid" : "Blitz";

  async function fetchAlternateElo() {
    if (!player?.username) return;
    // player is non-null here (guarded above)
    const p = player!;
    setFetching(true);
    setFetchError(null);
    setFetchSuccess(false);
    try {
      // Route through server proxy to avoid browser IP restrictions and 404s
      // for high-profile accounts (e.g. @magnuscarlsen, @hikaru)
      const res = await fetch(
        `/api/chess/player/${encodeURIComponent(p.username.toLowerCase())}`
      );
      if (!res.ok) throw new Error(`chess.com returned ${res.status}`);
      const proxyData = await res.json() as { profile: Record<string, unknown>; stats: ChessComStats };
      const data: ChessComStats = proxyData.stats ?? {};

      const rapidRating = data.chess_rapid?.last?.rating ?? null;
      const blitzRating = data.chess_blitz?.last?.rating ?? null;

      if (rapidRating != null) setRapidEloStr(String(rapidRating));
      if (blitzRating != null) setBlitzEloStr(String(blitzRating));

      // Auto-fill the active ELO field with the tournament's rating type
      if (tournamentRatingType === "rapid" && rapidRating != null) {
        setEloStr(String(rapidRating));
      } else if (tournamentRatingType === "blitz" && blitzRating != null) {
        setEloStr(String(blitzRating));
      }
      // suppress unused var warning
      void p;

      setFetchSuccess(true);
      setTimeout(() => setFetchSuccess(false), 3000);
    } catch (err) {
      setFetchError(
        err instanceof Error ? err.message : "Could not reach chess.com"
      );
    } finally {
      setFetching(false);
    }
  }

  // ── Save ────────────────────────────────────────────────────────────────────
  function handleSave() {
    if (nameError || eloError || !player) return;
    const p = player;
    const activeElo = eloStr.trim() !== "" ? parseElo(eloStr) : p.elo;
    const newRapidElo = rapidEloStr.trim() !== "" ? (parseElo(rapidEloStr) ?? p.rapidElo) : p.rapidElo;
    const newBlitzElo = blitzEloStr.trim() !== "" ? (parseElo(blitzEloStr) ?? p.blitzElo) : p.blitzElo;
    const newManualPairingRating = manualPairingRatingStr.trim() !== "" ? (parseElo(manualPairingRatingStr) ?? p.manualPairingRating) : undefined;
    const partialPlayer = { ...p, rapidElo: newRapidElo, blitzElo: newBlitzElo, bulletElo: p.bulletElo, manualPairingRating: newManualPairingRating };
    const { pairingRating, ratingSource } = resolvePairingRating(partialPlayer, tournamentRatingType);
    const updated: Player = {
      ...p,
      name: name.trim(),
      elo: activeElo ?? p.elo,
      rapidElo: newRapidElo,
      blitzElo: newBlitzElo,
      manualPairingRating: newManualPairingRating,
      pairingRating,
      ratingSource,
    };
    onSave(updated);
    onClose();
  }

  // ── Styles ──────────────────────────────────────────────────────────────────
  const surface = isDark
    ? "bg-[oklch(0.20_0.06_145)] border-white/10"
    : "bg-white border-gray-200";
  const inputBase = `w-full px-3 py-2.5 rounded-xl border text-sm outline-none transition-all ${
    isDark
      ? "bg-[oklch(0.25_0.07_145)] border-white/10 text-white placeholder:text-white/30 focus:border-[#3D6B47]/60 focus:ring-1 focus:ring-[#3D6B47]/20"
      : "bg-white border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-[#3D6B47]/50 focus:ring-1 focus:ring-[#3D6B47]/15"
  }`;
  const labelBase = `block text-xs font-semibold mb-1.5 ${isDark ? "text-white/50" : "text-gray-500"}`;

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className={`w-full max-w-md rounded-2xl border shadow-2xl ${surface}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`flex items-center justify-between px-5 py-4 border-b ${isDark ? "border-white/08" : "border-gray-100"}`}>
          <div>
            <h2 className={`text-base font-bold ${isDark ? "text-white" : "text-gray-900"}`}>
              Edit Player
            </h2>
            <p className={`text-xs mt-0.5 ${isDark ? "text-white/40" : "text-gray-400"}`}>
              @{player.username}
            </p>
          </div>
          <button
            onClick={onClose}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
              isDark ? "hover:bg-white/08 text-white/50" : "hover:bg-gray-100 text-gray-400"
            }`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          {/* Name */}
          <div>
            <label className={labelBase}>Display Name</label>
            <input
              ref={nameRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={`${inputBase} ${nameError ? "border-red-400/60" : ""}`}
              placeholder="Player full name"
              maxLength={80}
            />
            {nameError && (
              <p className="text-xs text-red-400 mt-1">{nameError}</p>
            )}
          </div>

          {/* Active ELO */}
          <div>
            <label className={labelBase}>
              Active ELO
              <span className={`ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded ${
                isDark ? "bg-[#3D6B47]/25 text-[#6FCF7F]" : "bg-[#3D6B47]/10 text-[#3D6B47]"
              }`}>
                {currentLabel} · used for pairings
              </span>
            </label>
            <input
              type="number"
              value={eloStr}
              onChange={(e) => setEloStr(e.target.value)}
              className={`${inputBase} ${eloError ? "border-red-400/60" : ""}`}
              placeholder="e.g. 1450"
              min={0}
              max={4000}
            />
            {eloError && (
              <p className="text-xs text-red-400 mt-1">{eloError}</p>
            )}
          </div>

          {/* Fetch from chess.com */}
          {player.username && (
            <div className={`rounded-xl border p-3.5 ${isDark ? "border-white/08 bg-white/03" : "border-gray-100 bg-gray-50"}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-semibold ${isDark ? "text-white/70" : "text-gray-700"}`}>
                    Pull ratings from chess.com
                  </p>
                  <p className={`text-[11px] mt-0.5 ${isDark ? "text-white/35" : "text-gray-400"}`}>
                    Fetches latest {currentLabel} &amp; {altLabel} ELOs for @{player.username}
                  </p>
                </div>
                <button
                  onClick={fetchAlternateElo}
                  disabled={fetching}
                  className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    fetchSuccess
                      ? isDark ? "bg-[#3D6B47]/30 text-[#6FCF7F]" : "bg-[#3D6B47]/10 text-[#3D6B47]"
                      : isDark
                      ? "bg-white/08 text-white/70 hover:bg-white/12 disabled:opacity-40"
                      : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                  }`}
                >
                  {fetchSuccess ? (
                    <><Check className="w-3.5 h-3.5" /> Updated</>
                  ) : fetching ? (
                    <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Fetching…</>
                  ) : (
                    <><RefreshCw className="w-3.5 h-3.5" /> Fetch</>
                  )}
                </button>
              </div>
              {fetchError && (
                <div className="flex items-center gap-1.5 mt-2">
                  <AlertCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                  <p className="text-xs text-red-400">{fetchError}</p>
                </div>
              )}
            </div>
          )}

          {/* Manual Pairing Rating Override */}
          <div>
            <label className={labelBase}>
              Manual Pairing Rating
              <span className={`ml-1.5 text-[10px] font-normal px-1.5 py-0.5 rounded ${isDark ? "bg-amber-500/15 text-amber-300" : "bg-amber-50 text-amber-700"}`}>
                overrides auto-detected rating
              </span>
            </label>
            <input
              type="number"
              value={manualPairingRatingStr}
              onChange={(e) => setManualPairingRatingStr(e.target.value)}
              className={inputBase}
              placeholder="Leave blank to use auto-detected rating"
              min={0}
              max={4000}
            />
            <p className={`text-[11px] mt-1 ${isDark ? "text-white/30" : "text-gray-400"}`}>
              Use this to set a rating for unrated players or correct an inaccurate chess.com rating.
            </p>
          </div>

          {/* Expandable: individual rapid/blitz fields */}
          <div>
            <button
              onClick={() => setShowAllRatings((v) => !v)}
              className={`flex items-center gap-1.5 text-xs font-semibold transition-colors ${
                isDark ? "text-white/40 hover:text-white/70" : "text-gray-400 hover:text-gray-600"
              }`}
            >
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showAllRatings ? "rotate-180" : ""}`} />
              {showAllRatings ? "Hide" : "Show"} individual Rapid / Blitz fields
            </button>

            {showAllRatings && (
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div>
                  <label className={labelBase}>Rapid ELO ⚡</label>
                  <input
                    type="number"
                    value={rapidEloStr}
                    onChange={(e) => setRapidEloStr(e.target.value)}
                    className={inputBase}
                    placeholder="e.g. 1450"
                    min={0}
                    max={4000}
                  />
                </div>
                <div>
                  <label className={labelBase}>Blitz ELO 🔥</label>
                  <input
                    type="number"
                    value={blitzEloStr}
                    onChange={(e) => setBlitzEloStr(e.target.value)}
                    className={inputBase}
                    placeholder="e.g. 1380"
                    min={0}
                    max={4000}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className={`flex items-center justify-end gap-2.5 px-5 py-4 border-t ${isDark ? "border-white/08" : "border-gray-100"}`}>
          <button
            onClick={onClose}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
              isDark ? "text-white/50 hover:text-white/80 hover:bg-white/06" : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
            }`}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!!nameError || !!eloError}
            className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all disabled:opacity-40 ${
              isDark
                ? "bg-[#3D6B47] text-white hover:bg-[#4CAF50]"
                : "bg-[#3D6B47] text-white hover:bg-[#2D5437]"
            }`}
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
