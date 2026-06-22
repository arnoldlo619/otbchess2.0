/**
 * BroadcastSettingsPanel — Director dashboard panel for Board Broadcast.
 * Allows host to enable/disable broadcast, paste URL, select board, set status.
 * Production-hardened: validation messages, clear button, live-without-URL guard.
 */
import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Radio, MonitorPlay, Save, Trash2, ExternalLink } from "lucide-react";
import { isValidBroadcastUrl, detectProvider, getEmbedUrl, type BroadcastProvider, type BroadcastStatus } from "@/lib/broadcastUtils";
import { authFetch } from "@/lib/apiFetch";

interface Props {
  tournamentId: string;
  totalBoards: number;
  isDark: boolean;
}

interface BroadcastData {
  broadcastEnabled: boolean;
  broadcastUrl: string;
  broadcastProvider: BroadcastProvider;
  featuredBoardNumber: number;
  broadcastTitle: string;
  broadcastStatus: BroadcastStatus;
}

const DEFAULT_DATA: BroadcastData = {
  broadcastEnabled: false,
  broadcastUrl: "",
  broadcastProvider: null,
  featuredBoardNumber: 1,
  broadcastTitle: "",
  broadcastStatus: "inactive",
};

export function BroadcastSettingsPanel({ tournamentId, totalBoards, isDark }: Props) {
  const [data, setData] = useState<BroadcastData>(DEFAULT_DATA);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  // Load existing settings
  useEffect(() => {
    authFetch(`/api/tournament/${encodeURIComponent(tournamentId)}/broadcast`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (d) {
          setData({
            broadcastEnabled: d.broadcastEnabled ?? false,
            broadcastUrl: d.broadcastUrl ?? "",
            broadcastProvider: d.broadcastProvider ?? null,
            featuredBoardNumber: d.featuredBoardNumber ?? 1,
            broadcastTitle: d.broadcastTitle ?? "",
            broadcastStatus: d.broadcastStatus ?? "inactive",
          });
        }
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, [tournamentId]);

  const handleUrlChange = useCallback((url: string) => {
    setData((prev) => ({
      ...prev,
      broadcastUrl: url,
      broadcastProvider: url.trim() ? detectProvider(url) : null,
    }));
    if (!url.trim()) {
      setUrlError(null);
    } else if (!isValidBroadcastUrl(url)) {
      const lower = url.trim().toLowerCase();
      if (lower.startsWith("javascript:") || lower.startsWith("data:") || lower.startsWith("blob:")) {
        setUrlError("Unsafe URL blocked.");
      } else {
        setUrlError("Paste a valid YouTube Live, YouTube video, Twitch channel, or Twitch video URL.");
      }
    } else {
      const provider = detectProvider(url);
      if (provider === "custom") {
        setUrlError(null); // valid https URL, just not YouTube/Twitch
      } else {
        setUrlError(null);
      }
    }
    setShowPreview(false);
  }, []);

  const handleSave = async () => {
    // Guard: live status requires valid URL
    if (data.broadcastStatus === "live" && (!data.broadcastUrl.trim() || !isValidBroadcastUrl(data.broadcastUrl))) {
      setUrlError("Add a valid stream URL before setting the broadcast live.");
      toast.error("Add a valid stream URL before setting the broadcast live.");
      return;
    }
    // Guard: enabled with invalid URL
    if (data.broadcastEnabled && data.broadcastUrl.trim() && !isValidBroadcastUrl(data.broadcastUrl)) {
      setUrlError("Paste a valid YouTube Live, YouTube video, Twitch channel, or Twitch video URL.");
      return;
    }
    setSaving(true);
    try {
      const res = await authFetch(`/api/tournament/${encodeURIComponent(tournamentId)}/broadcast`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        toast.success("Broadcast settings saved.");
      } else {
        toast.error("Failed to save broadcast settings.");
      }
    } catch {
      toast.error("Network error saving broadcast settings.");
    }
    setSaving(false);
  };

  const handleClear = async () => {
    const cleared: BroadcastData = {
      broadcastEnabled: false,
      broadcastUrl: "",
      broadcastProvider: null,
      featuredBoardNumber: 1,
      broadcastTitle: "",
      broadcastStatus: "inactive",
    };
    setSaving(true);
    try {
      const res = await authFetch(`/api/tournament/${encodeURIComponent(tournamentId)}/broadcast`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cleared),
      });
      if (res.ok) {
        setData(cleared);
        setUrlError(null);
        setShowPreview(false);
        toast.success("Broadcast cleared.");
      } else {
        toast.error("Failed to clear broadcast.");
      }
    } catch {
      toast.error("Network error clearing broadcast.");
    }
    setSaving(false);
  };

  if (!loaded) return null;

  const embedUrl = data.broadcastUrl ? getEmbedUrl(data.broadcastUrl) : null;
  const providerLabel = data.broadcastProvider === "youtube" ? "YouTube" : data.broadcastProvider === "twitch" ? "Twitch" : data.broadcastProvider === "custom" ? "Custom HTTPS" : null;

  const cardBg = isDark ? "bg-[oklch(0.22_0.06_145)]" : "bg-white";
  const cardBorder = isDark ? "border-white/08" : "border-[#ADBC9F]/70";
  const labelColor = isDark ? "text-white/70" : "text-[#436850]";
  const inputBg = isDark ? "bg-[oklch(0.18_0.05_145)]" : "bg-[#FBFADA]/70";
  const inputBorder = isDark ? "border-white/10" : "border-[#ADBC9F]";
  const inputText = isDark ? "text-white" : "text-[#12372A]";

  return (
    <div className={`rounded-2xl border overflow-hidden ${cardBg} ${cardBorder}`}>
      <div className={`px-5 py-3 border-b flex items-center gap-2 ${isDark ? "border-white/06" : "border-[#ADBC9F]/70"}`}>
        <MonitorPlay className={`w-4 h-4 ${isDark ? "text-[#4CAF50]" : "text-[#436850]"}`} />
        <h2 className={`text-xs font-bold uppercase tracking-widest ${isDark ? "text-white/35" : "text-[#436850]"}`}>
          Board Broadcast
        </h2>
      </div>

      <div className="px-5 py-4 space-y-4">
        <p className={`text-xs ${isDark ? "text-white/40" : "text-[#436850]"}`}>
          Feature a live YouTube or Twitch stream for a selected board on the public tournament page.
        </p>

        {/* Toggle */}
        <label className="flex items-center justify-between cursor-pointer">
          <span className={`text-sm font-medium ${labelColor}`}>Enable broadcast</span>
          <button
            type="button"
            role="switch"
            aria-checked={data.broadcastEnabled}
            onClick={() => setData((p) => ({ ...p, broadcastEnabled: !p.broadcastEnabled }))}
            className={`relative w-11 h-6 rounded-full transition-colors ${data.broadcastEnabled ? "bg-[#4CAF50]" : isDark ? "bg-white/15" : "bg-[#ADBC9F]"}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${data.broadcastEnabled ? "translate-x-5" : ""}`} />
          </button>
        </label>

        {data.broadcastEnabled && (
          <>
            {/* URL input */}
            <div>
              <label className={`text-xs font-medium block mb-1.5 ${labelColor}`}>Livestream URL</label>
              <input
                type="url"
                value={data.broadcastUrl}
                onChange={(e) => handleUrlChange(e.target.value)}
                placeholder="https://youtube.com/watch?v=... or https://twitch.tv/..."
                className={`w-full px-3 py-2.5 rounded-xl text-sm border outline-none transition-colors ${inputBg} ${inputBorder} ${inputText} focus:border-[#4CAF50]/50 placeholder:text-sm`}
              />
              {urlError && <p className="text-xs text-red-400 mt-1.5">{urlError}</p>}
              {providerLabel && !urlError && data.broadcastUrl.trim() && (
                <p className={`text-xs mt-1.5 ${isDark ? "text-[#4CAF50]/60" : "text-green-600"}`}>
                  Detected: {providerLabel}
                </p>
              )}
            </div>

            {/* Featured board */}
            <div>
              <label className={`text-xs font-medium block mb-1.5 ${labelColor}`}>Featured board</label>
              <select
                value={data.featuredBoardNumber}
                onChange={(e) => setData((p) => ({ ...p, featuredBoardNumber: Number(e.target.value) }))}
                className={`w-full px-3 py-2.5 rounded-xl text-sm border outline-none ${inputBg} ${inputBorder} ${inputText}`}
              >
                {Array.from({ length: Math.max(totalBoards, 1) }, (_, i) => (
                  <option key={i + 1} value={i + 1}>Board {i + 1}</option>
                ))}
              </select>
            </div>

            {/* Title */}
            <div>
              <label className={`text-xs font-medium block mb-1.5 ${labelColor}`}>Broadcast title (optional)</label>
              <input
                type="text"
                value={data.broadcastTitle}
                onChange={(e) => setData((p) => ({ ...p, broadcastTitle: e.target.value }))}
                placeholder={`Board ${data.featuredBoardNumber} Live`}
                maxLength={200}
                className={`w-full px-3 py-2.5 rounded-xl text-sm border outline-none transition-colors ${inputBg} ${inputBorder} ${inputText} focus:border-[#4CAF50]/50`}
              />
            </div>

            {/* Status */}
            <div>
              <label className={`text-xs font-medium block mb-1.5 ${labelColor}`}>Broadcast status</label>
              <div className="flex gap-2">
                {(["inactive", "live", "ended"] as BroadcastStatus[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => setData((p) => ({ ...p, broadcastStatus: s }))}
                    className={`flex-1 px-3 py-2.5 rounded-xl text-xs font-semibold capitalize transition-all border ${
                      data.broadcastStatus === s
                        ? s === "live"
                          ? "bg-red-600/15 border-red-500/30 text-red-400"
                          : s === "ended"
                          ? isDark ? "bg-white/10 border-white/20 text-white/60" : "bg-[#ADBC9F]/40 border-[#ADBC9F] text-[#436850]"
                          : isDark ? "bg-[#4CAF50]/15 border-[#4CAF50]/30 text-[#4CAF50]" : "bg-green-50 border-green-300 text-green-700"
                        : isDark ? "bg-transparent border-white/08 text-white/30 hover:border-white/15" : "bg-transparent border-[#ADBC9F] text-[#436850] hover:border-[#ADBC9F]"
                    }`}
                  >
                    {s === "live" && <Radio className="w-3 h-3 inline mr-1" />}
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Preview */}
            {embedUrl && (
              <div>
                <button
                  onClick={() => setShowPreview(!showPreview)}
                  className={`text-xs font-medium flex items-center gap-1.5 ${isDark ? "text-[#4CAF50]" : "text-[#436850]"} hover:underline`}
                >
                  <ExternalLink className="w-3 h-3" />
                  {showPreview ? "Hide preview" : "Preview embed"}
                </button>
                {showPreview && (
                  <div className="mt-2 rounded-xl overflow-hidden border" style={{ borderColor: isDark ? "rgba(255,255,255,0.08)" : "#e5e7eb" }}>
                    <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
                      {/* Note: sandbox attribute intentionally omitted — YouTube/Twitch
                          embeds require unrestricted same-origin access for playback.
                          Security is enforced at the URL validation layer instead. */}
                      <iframe
                        src={embedUrl}
                        className="absolute inset-0 w-full h-full"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        allowFullScreen
                        loading="lazy"
                        referrerPolicy="strict-origin-when-cross-origin"
                        title="Broadcast Preview"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Warning: enabled but no URL */}
            {!data.broadcastUrl.trim() && (
              <p className={`text-xs px-3 py-2 rounded-lg ${isDark ? "bg-amber-500/10 text-amber-400" : "bg-amber-50 text-amber-600"}`}>
                Add a valid stream URL to publish this broadcast.
              </p>
            )}
          </>
        )}

        {/* Action buttons */}
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-[0.98] ${
              isDark
                ? "bg-[#4CAF50]/15 hover:bg-[#4CAF50]/25 text-[#4CAF50] border border-[#4CAF50]/20"
                : "bg-[#436850] hover:bg-[#2A4A32] text-white"
            } disabled:opacity-50`}
          >
            <Save className="w-4 h-4" />
            {saving ? "Saving\u2026" : "Save"}
          </button>
          {(data.broadcastEnabled || data.broadcastUrl.trim()) && (
            <button
              onClick={handleClear}
              disabled={saving}
              className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-[0.98] border ${
                isDark
                  ? "border-red-500/20 text-red-400 hover:bg-red-500/10"
                  : "border-red-200 text-red-500 hover:bg-red-50"
              } disabled:opacity-50`}
            >
              <Trash2 className="w-4 h-4" />
              Clear
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
