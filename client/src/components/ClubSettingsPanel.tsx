/**
 * ClubSettingsPanel — full settings UI for club owners/directors inside ClubDashboard.
 * Covers: logo upload, banner upload, accent color picker, club info editing.
 */
import React, { useState, useRef } from "react";
import { Settings2, Save, Globe, Lock, MapPin, FileText, Type, Palette, Check } from "lucide-react";
import { ClubAvatarUpload } from "./ClubAvatarUpload";
import { ClubBannerUpload } from "./ClubBannerUpload";
import { toast } from "sonner";
import type { Club } from "@/lib/clubRegistry";
import { authFetch } from "@/lib/apiFetch";

// ── Preset accent swatches ────────────────────────────────────────────────────
const ACCENT_PRESETS = [
  // Greens (chess / OTB brand family)
  { hex: "#4CAF50", label: "Forest Green" },
  { hex: "#22c55e", label: "Emerald" },
  { hex: "#16a34a", label: "Deep Green" },
  { hex: "#86efac", label: "Mint" },
  { hex: "#a3e635", label: "Lime" },
  { hex: "#14b8a6", label: "Teal" },
  // Blues
  { hex: "#3b82f6", label: "Royal Blue" },
  { hex: "#06b6d4", label: "Cyan" },
  { hex: "#6366f1", label: "Indigo" },
  { hex: "#8b5cf6", label: "Violet" },
  { hex: "#0ea5e9", label: "Sky Blue" },
  { hex: "#1d4ed8", label: "Deep Blue" },
  // Warm
  { hex: "#f59e0b", label: "Amber" },
  { hex: "#ef4444", label: "Red" },
  { hex: "#ec4899", label: "Pink" },
  { hex: "#f97316", label: "Orange" },
  { hex: "#e11d48", label: "Rose" },
  { hex: "#dc2626", label: "Crimson" },
  { hex: "#d946ef", label: "Fuchsia" },
  { hex: "#c026d3", label: "Purple" },
  // Chess-themed
  { hex: "#b45309", label: "Chestnut" },
  { hex: "#92400e", label: "Mahogany" },
  { hex: "#78350f", label: "Walnut" },
  { hex: "#713f12", label: "Dark Wood" },
  // Neutrals & Metallics
  { hex: "#94a3b8", label: "Slate" },
  { hex: "#e2e8f0", label: "Silver" },
  { hex: "#fbbf24", label: "Gold" },
  { hex: "#d4af37", label: "Classic Gold" },
  { hex: "#c0c0c0", label: "Platinum" },
  { hex: "#ffffff", label: "White" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
/** Returns black or white depending on which has better contrast against `hex` */
function contrastText(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  // Perceived luminance
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.55 ? "#0a1a0f" : "#ffffff";
}

/** Normalise a hex string — ensure it starts with # and is 6 chars */
function normaliseHex(raw: string): string | null {
  const clean = raw.trim().replace(/^#*/, "");
  if (/^[0-9a-fA-F]{6}$/.test(clean)) return `#${clean.toLowerCase()}`;
  if (/^[0-9a-fA-F]{3}$/.test(clean)) {
    const [r, g, b] = clean.split("");
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return null;
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface ClubSettingsPanelProps {
  club: Club;
  accent: string;
  isDark: boolean;
  onClubChange: (patch: Partial<Omit<Club, "id" | "slug" | "foundedAt">>) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────
export function ClubSettingsPanel({ club, accent, isDark, onClubChange }: ClubSettingsPanelProps) {
  // Club info form state
  const [name, setName] = useState(club.name);
  const [description, setDescription] = useState(club.description ?? "");
  const [location, setLocation] = useState(club.location ?? "");
  const [isPublic, setIsPublic] = useState(club.isPublic);
  const [saving, setSaving] = useState(false);

  // Accent color state
  const [accentColor, setAccentColor] = useState(club.accentColor ?? accent);
  const [hexInput, setHexInput] = useState(club.accentColor ?? accent);
  const [hexError, setHexError] = useState(false);
  const [savingColor, setSavingColor] = useState(false);
  const nativePickerRef = useRef<HTMLInputElement>(null);

  // ── Style helpers ──────────────────────────────────────────────────────────
  const inputCls = `w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 transition ${
    isDark
      ? "bg-white/8 border border-white/10 text-white placeholder-white/25 focus:ring-white/20"
      : "bg-black/5 border border-black/10 text-[#1A1A1A] placeholder-gray-400 focus:ring-black/20"
  }`;
  const labelCls = `text-xs font-semibold mb-1.5 block ${isDark ? "text-white/60" : "text-[#6B6B50]"}`;
  const cardCls = `rounded-2xl border p-5 space-y-4 ${isDark ? "border-white/10 bg-white/5" : "border-[#E8D9B0] bg-white"}`;
  const sectionTitle = `text-xs font-bold uppercase tracking-widest mb-4 ${isDark ? "text-white/50" : "text-[#6B6B50]"}`;

  // ── Accent color handlers ──────────────────────────────────────────────────
  async function applyAccentColor(hex: string) {
    setAccentColor(hex);
    setHexInput(hex);
    setHexError(false);
    setSavingColor(true);
    try {
      const res = await authFetch(`/api/clubs/${club.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ accentColor: hex }),
      });
      if (!res.ok) throw new Error(await res.text());
      onClubChange({ accentColor: hex });
      toast.success("Accent color updated!");
    } catch {
      toast.error("Failed to update color.");
    } finally {
      setSavingColor(false);
    }
  }

  function handleHexInputChange(raw: string) {
    setHexInput(raw);
    const norm = normaliseHex(raw);
    if (norm) {
      setHexError(false);
      setAccentColor(norm);
    } else {
      setHexError(true);
    }
  }

  function handleHexInputBlur() {
    const norm = normaliseHex(hexInput);
    if (norm) applyAccentColor(norm);
    else setHexError(true);
  }

  // ── Club info save ─────────────────────────────────────────────────────────
  async function handleSaveInfo() {
    if (!name.trim()) { toast.error("Club name cannot be empty."); return; }
    setSaving(true);
    try {
      const res = await authFetch(`/api/clubs/${club.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          location: location.trim() || null,
          isPublic,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      onClubChange({
        name: name.trim(),
        description: description.trim() || undefined,
        location: location.trim() || undefined,
        isPublic,
      });
      toast.success("Club info saved!");
    } catch {
      toast.error("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: `${accentColor}22` }}>
          <Settings2 className="w-4 h-4" style={{ color: accentColor }} />
        </div>
        <div>
          <h2 className={`font-bold text-base ${isDark ? "text-white" : "text-[#1A1A1A]"}`}>Club Settings</h2>
          <p className={`text-xs ${isDark ? "text-white/40" : "text-[#6B6B50]"}`}>Manage your club's identity and appearance</p>
        </div>
      </div>

      {/* ── Identity: Logo + Banner ── */}
      <div className={cardCls}>
        <h3 className={sectionTitle}>Club Identity</h3>
        <div className="flex flex-col sm:flex-row items-start gap-6">
          {/* Avatar */}
          <div className="flex-shrink-0">
            <p className={labelCls}>Club Logo</p>
            <ClubAvatarUpload
              value={club.avatarUrl ?? null}
              onChange={(dataUrl) => {
                if (dataUrl === null) return;
                onClubChange({ avatarUrl: dataUrl });
                authFetch(`/api/clubs/${club.id}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  credentials: "include",
                  body: JSON.stringify({ avatarUrl: dataUrl }),
                }).then((r) => {
                  if (r.ok) toast.success("Club logo updated!");
                  else toast.error("Logo upload failed.");
                }).catch(() => toast.error("Logo upload failed."));
              }}
              accentColor={accentColor}
              clubName={club.name}
              isDark={isDark}
              size={96}
            />
            <p className={`text-[10px] mt-1.5 text-center max-w-[96px] ${isDark ? "text-white/30" : "text-[#6B6B50]"}`}>
              Square, max 1 MB
            </p>
          </div>

          {/* Banner */}
          <div className="flex-1 min-w-0">
            <p className={labelCls}>Banner Image</p>
            <ClubBannerUpload
              value={club.bannerUrl ?? null}
              onChange={(dataUrl) => {
                onClubChange({ bannerUrl: dataUrl ?? undefined });
                authFetch(`/api/clubs/${club.id}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  credentials: "include",
                  body: JSON.stringify({ bannerUrl: dataUrl }),
                }).then((r) => {
                  if (r.ok) {
                    if (dataUrl) toast.success("Banner updated!");
                    else toast.success("Banner removed.");
                  } else {
                    toast.error("Banner update failed.");
                  }
                }).catch(() => toast.error("Banner update failed."));
              }}
              accentColor={accentColor}
              isDark={isDark}
            />
            <p className={`text-[10px] mt-1.5 ${isDark ? "text-white/30" : "text-[#6B6B50]"}`}>
              Landscape 16:4 recommended · max 1 MB
            </p>
          </div>
        </div>
      </div>

      {/* ── Accent Color ── */}
      <div className={cardCls}>
        <h3 className={sectionTitle}>
          <span className="flex items-center gap-1.5"><Palette className="w-3 h-3" /> Brand Color</span>
        </h3>

        {/* Live preview strip */}
        <div
          className="w-full h-12 rounded-xl flex items-center justify-between px-4 transition-colors duration-200"
          style={{ background: accentColor }}
        >
          <span className="text-sm font-bold" style={{ color: contrastText(accentColor) }}>
            {club.name}
          </span>
          <span className="text-xs font-mono font-semibold opacity-80" style={{ color: contrastText(accentColor) }}>
            {accentColor.toUpperCase()}
          </span>
        </div>

        {/* Preset swatches */}
        <div>
          <p className={labelCls}>Preset Colors</p>
          <div className="flex flex-wrap gap-2">
            {ACCENT_PRESETS.map(({ hex, label }) => {
              const isSelected = accentColor.toLowerCase() === hex.toLowerCase();
              return (
                <button
                  key={hex}
                  title={label}
                  disabled={savingColor}
                  onClick={() => applyAccentColor(hex)}
                  className="relative w-8 h-8 rounded-lg transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50"
                  style={{
                    background: hex,
                    border: isSelected ? `2px solid ${isDark ? "#fff" : "#000"}` : "2px solid transparent",
                    boxShadow: isSelected ? `0 0 0 2px ${hex}` : undefined,
                  }}
                >
                  {isSelected && (
                    <Check
                      className="absolute inset-0 m-auto w-3.5 h-3.5"
                      style={{ color: contrastText(hex) }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Custom hex input + native color picker */}
        <div>
          <p className={labelCls}>Custom Hex Color</p>
          <div className="flex items-center gap-2">
            {/* Native color picker — hidden, triggered by the swatch button */}
            <input
              ref={nativePickerRef}
              type="color"
              value={accentColor}
              onChange={(e) => {
                setAccentColor(e.target.value);
                setHexInput(e.target.value);
                setHexError(false);
              }}
              onBlur={(e) => applyAccentColor(e.target.value)}
              className="sr-only"
              aria-label="Open color picker"
            />
            <button
              onClick={() => nativePickerRef.current?.click()}
              className="w-10 h-10 rounded-xl border-2 flex-shrink-0 transition hover:scale-105"
              style={{
                background: accentColor,
                borderColor: isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.15)",
              }}
              title="Open color picker"
              aria-label="Open color picker"
            />
            <div className="flex-1 relative">
              <span className={`absolute left-3 top-1/2 -translate-y-1/2 text-sm font-mono ${isDark ? "text-white/30" : "text-[#6B6B50]"}`}>#</span>
              <input
                className={`${inputCls} pl-7 font-mono uppercase`}
                value={hexInput.replace(/^#/, "")}
                onChange={(e) => handleHexInputChange(`#${e.target.value}`)}
                onBlur={handleHexInputBlur}
                maxLength={6}
                placeholder="4CAF50"
                style={hexError ? { borderColor: "#ef4444" } : {}}
              />
            </div>
            {hexError && (
              <p className="text-xs text-red-400 mt-1">Invalid hex color</p>
            )}
          </div>
        </div>

        {savingColor && (
          <p className={`text-xs ${isDark ? "text-white/40" : "text-[#6B6B50]"}`}>Saving color…</p>
        )}
      </div>

      {/* ── Club Info ── */}
      <div className={cardCls}>
        <h3 className={sectionTitle}>Club Info</h3>

        <div className="space-y-4">
          {/* Name */}
          <div>
            <label className={labelCls}>
              <span className="flex items-center gap-1.5"><Type className="w-3 h-3" /> Club Name</span>
            </label>
            <input
              className={inputCls}
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
              placeholder="e.g. Chicago Chess Club"
            />
          </div>

          {/* Description */}
          <div>
            <label className={labelCls}>
              <span className="flex items-center gap-1.5"><FileText className="w-3 h-3" /> Description</span>
            </label>
            <textarea
              className={`${inputCls} resize-none`}
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={280}
              placeholder="Tell players what your club is about…"
            />
            <p className={`text-[10px] mt-1 text-right ${isDark ? "text-white/25" : "text-[#6B6B50]"}`}>
              {description.length}/280
            </p>
          </div>

          {/* Location */}
          <div>
            <label className={labelCls}>
              <span className="flex items-center gap-1.5"><MapPin className="w-3 h-3" /> Location</span>
            </label>
            <input
              className={inputCls}
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              maxLength={80}
              placeholder="e.g. Chicago, IL"
            />
          </div>

          {/* Visibility */}
          <div>
            <label className={labelCls}>Visibility</label>
            <div className="flex gap-3">
              <button
                onClick={() => setIsPublic(true)}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold border transition ${
                  isPublic
                    ? "border-transparent text-white"
                    : isDark
                    ? "border-white/10 text-white/40 bg-white/5 hover:bg-white/8"
                    : "border-[#E8D9B0] text-[#6B6B50] bg-[#FFF3D5]/70 hover:bg-[#E8D9B0]/50"
                }`}
                style={isPublic ? { background: accentColor, borderColor: accentColor } : {}}
              >
                <Globe className="w-3.5 h-3.5" />
                Public
              </button>
              <button
                onClick={() => setIsPublic(false)}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold border transition ${
                  !isPublic
                    ? "border-transparent text-white"
                    : isDark
                    ? "border-white/10 text-white/40 bg-white/5 hover:bg-white/8"
                    : "border-[#E8D9B0] text-[#6B6B50] bg-[#FFF3D5]/70 hover:bg-[#E8D9B0]/50"
                }`}
                style={!isPublic ? { background: "#374151", borderColor: "#374151" } : {}}
              >
                <Lock className="w-3.5 h-3.5" />
                Private
              </button>
            </div>
          </div>
        </div>

        {/* Save button */}
        <div className="pt-2">
          <button
            onClick={handleSaveInfo}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all hover:opacity-90 disabled:opacity-50"
            style={{ background: accentColor, color: contrastText(accentColor) }}
          >
            <Save className="w-3.5 h-3.5" />
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
