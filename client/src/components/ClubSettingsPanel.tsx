/**
 * ClubSettingsPanel — full settings UI for club owners/directors inside ClubDashboard.
 * Covers: logo upload, banner upload, club name/description/location/visibility editing.
 */
import React, { useState } from "react";
import { Settings2, Save, Globe, Lock, MapPin, FileText, Type } from "lucide-react";
import { ClubAvatarUpload } from "./ClubAvatarUpload";
import { ClubBannerUpload } from "./ClubBannerUpload";
import { toast } from "sonner";
import type { Club } from "@/lib/clubRegistry";
import { authFetch } from "@/lib/apiFetch";

interface ClubSettingsPanelProps {
  club: Club;
  accent: string;
  isDark: boolean;
  onClubChange: (patch: Partial<Omit<Club, "id" | "slug" | "foundedAt">>) => void;
}

export function ClubSettingsPanel({ club, accent, isDark, onClubChange }: ClubSettingsPanelProps) {
  const [name, setName] = useState(club.name);
  const [description, setDescription] = useState(club.description ?? "");
  const [location, setLocation] = useState(club.location ?? "");
  const [isPublic, setIsPublic] = useState(club.isPublic);
  const [saving, setSaving] = useState(false);

  const inputCls = `w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 transition ${
    isDark
      ? "bg-white/8 border border-white/10 text-white placeholder-white/25 focus:ring-white/20"
      : "bg-black/5 border border-black/10 text-gray-900 placeholder-gray-400 focus:ring-black/20"
  }`;

  const labelCls = `text-xs font-semibold mb-1.5 block ${isDark ? "text-white/60" : "text-gray-500"}`;

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
      onClubChange({ name: name.trim(), description: description.trim() || undefined, location: location.trim() || undefined, isPublic });
      toast.success("Club info saved!");
    } catch (err) {
      toast.error("Failed to save. Please try again.");
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  const cardCls = `rounded-2xl border p-5 space-y-4 ${
    isDark ? "border-white/10 bg-white/5" : "border-gray-200 bg-white"
  }`;

  const sectionTitle = `text-xs font-bold uppercase tracking-widest mb-4 ${isDark ? "text-white/50" : "text-gray-400"}`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: `${accent}22` }}>
          <Settings2 className="w-4 h-4" style={{ color: accent }} />
        </div>
        <div>
          <h2 className={`font-bold text-base ${isDark ? "text-white" : "text-gray-900"}`}>Club Settings</h2>
          <p className={`text-xs ${isDark ? "text-white/40" : "text-gray-400"}`}>Manage your club's identity and appearance</p>
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
                if (dataUrl === null) return; // remove handled separately if needed
                onClubChange({ avatarUrl: dataUrl });
                // Persist to server
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
              accentColor={accent}
              clubName={club.name}
              isDark={isDark}
              size={96}
            />
            <p className={`text-[10px] mt-1.5 text-center max-w-[96px] ${isDark ? "text-white/30" : "text-gray-400"}`}>
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
              accentColor={accent}
              isDark={isDark}
            />
            <p className={`text-[10px] mt-1.5 ${isDark ? "text-white/30" : "text-gray-400"}`}>
              Landscape 16:4 recommended · max 1 MB
            </p>
          </div>
        </div>
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
            <p className={`text-[10px] mt-1 text-right ${isDark ? "text-white/25" : "text-gray-400"}`}>
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
                    : "border-gray-200 text-gray-400 bg-gray-50 hover:bg-gray-100"
                }`}
                style={isPublic ? { background: accent, borderColor: accent } : {}}
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
                    : "border-gray-200 text-gray-400 bg-gray-50 hover:bg-gray-100"
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
            style={{ background: accent, color: "#fff" }}
          >
            <Save className="w-3.5 h-3.5" />
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
