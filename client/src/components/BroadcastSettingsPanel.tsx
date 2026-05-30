/**
 * BroadcastSettingsPanel — Director dashboard panel for Board Broadcast MVP.
 * Allows host to enable/disable broadcast, paste URL, select board, set status.
 */
import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Radio, MonitorPlay, Save, ExternalLink } from "lucide-react";
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

export function BroadcastSettingsPanel({ tournamentId, totalBoards, isDark }: Props) {
  const [data, setData] = useState<BroadcastData>({
    broadcastEnabled: false,
    broadcastUrl: "",
    broadcastProvider: null,
    featuredBoardNumber: 1,
    broadcastTitle: "",
    broadcastStatus: "inactive",
  });
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
    if (url.trim() && !isValidBroadcastUrl(url)) {
      setUrlError("Enter a valid YouTube, Twitch, or HTTPS URL");
    } else {
      setUrlError(null);
    }
    setShowPreview(false);
  }, []);

  const handleSave = async () => {
    if (data.broadcastEnabled && data.broadcastUrl.trim() && !isValidBroadcastUrl(data.broadcastUrl)) {
      setUrlError("Enter a valid YouTube, Twitch, or HTTPS URL");
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
        toast.success("Broadcast settings saved");
      } else {
        toast.error("Failed to save broadcast settings");
      }
    } catch {
      toast.error("Network error saving broadcast settings");
    }
    setSaving(false);
  };

  if (!loaded) return null;

  const embedUrl = data.broadcastUrl ? getEmbedUrl(data.broadcastUrl) : null;
  const providerLabel = data.broadcastProvider === "youtube" ? "YouTube" : data.broadcastProvider === "twitch" ? "Twitch" : data.broadcastProvider === "custom" ? "Custom" : null;

  const cardBg = isDark ? "bg-[oklch(0.22_0.06_145)]" : "bg-white";
  const cardBorder = isDark ? "border-white/08" : "border-gray-100";
  const labelColor = isDark ? "text-white/70" : "text-gray-600";
  const inputBg = isDark ? "bg-[oklch(0.18_0.05_145)]" : "bg-gray-50";
  const inputBorder = isDark ? "border-white/10" : "border-gray-200";
  const inputText = isDark ? "text-white" : "text-gray-900";

  return (
    <div className={`rounded-2xl border overflow-hidden ${cardBg} ${cardBorder}`}>
      <div className={`px-5 py-3 border-b flex items-center gap-2 ${isDark ? "border-white/06" : "border-gray-100"}`}>
        <MonitorPlay className={`w-4 h-4 ${isDark ? "text-[#4CAF50]" : "text-[#3D6B47]"}`} />
        <h2 className={`text-xs font-bold uppercase tracking-widest ${isDark ? "text-white/35" : "text-gray-400"}`}>
          Board Broadcast
        </h2>
      </div>

      <div className="px-5 py-4 space-y-4">
        <p className={`text-xs ${isDark ? "text-white/40" : "text-gray-400"}`}>
          Feature a live video stream for Board 1 or another selected board.
        </p>

        {/* Toggle */}
        <label className="flex items-center justify-between cursor-pointer">
          <span className={`text-sm font-medium ${labelColor}`}>Enable broadcast</span>
          <button
            type="button"
            role="switch"
            aria-checked={data.broadcastEnabled}
            onClick={() => setData((p) => ({ ...p, broadcastEnabled: !p.broadcastEnabled }))}
            className={`relative w-11 h-6 rounded-full transition-colors ${data.broadcastEnabled ? "bg-[#4CAF50]" : isDark ? "bg-white/15" : "bg-gray-300"}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${data.broadcastEnabled ? "translate-x-5" : ""}`} />
          </button>
        </label>

        {data.broadcastEnabled && (
          <>
            {/* URL input */}
            <div>
              <label className={`text-xs font-medium block mb-1 ${labelColor}`}>Livestream URL</label>
              <input
                type="url"
                value={data.broadcastUrl}
                onChange={(e) => handleUrlChange(e.target.value)}
                placeholder="Paste YouTube Live or Twitch URL"
                className={`w-full px-3 py-2 rounded-xl text-sm border outline-none transition-colors ${inputBg} ${inputBorder} ${inputText} focus:border-[#4CAF50]/50`}
              />
              {urlError && <p className="text-xs text-red-400 mt-1">{urlError}</p>}
              {providerLabel && !urlError && (
                <p className={`text-xs mt-1 ${isDark ? "text-white/30" : "text-gray-400"}`}>
                  Detected: {providerLabel}
                </p>
              )}
            </div>

            {/* Featured board */}
            <div>
              <label className={`text-xs font-medium block mb-1 ${labelColor}`}>Featured board</label>
              <select
                value={data.featuredBoardNumber}
                onChange={(e) => setData((p) => ({ ...p, featuredBoardNumber: Number(e.target.value) }))}
                className={`w-full px-3 py-2 rounded-xl text-sm border outline-none ${inputBg} ${inputBorder} ${inputText}`}
              >
                {Array.from({ length: Math.max(totalBoards, 1) }, (_, i) => (
                  <option key={i + 1} value={i + 1}>Board {i + 1}</option>
                ))}
              </select>
            </div>

            {/* Title */}
            <div>
              <label className={`text-xs font-medium block mb-1 ${labelColor}`}>Broadcast title</label>
              <input
                type="text"
                value={data.broadcastTitle}
                onChange={(e) => setData((p) => ({ ...p, broadcastTitle: e.target.value }))}
                placeholder="Board 1 Live"
                className={`w-full px-3 py-2 rounded-xl text-sm border outline-none transition-colors ${inputBg} ${inputBorder} ${inputText} focus:border-[#4CAF50]/50`}
              />
            </div>

            {/* Status */}
            <div>
              <label className={`text-xs font-medium block mb-1 ${labelColor}`}>Broadcast status</label>
              <div className="flex gap-2">
                {(["inactive", "live", "ended"] as BroadcastStatus[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => setData((p) => ({ ...p, broadcastStatus: s }))}
                    className={`flex-1 px-3 py-2 rounded-xl text-xs font-semibold capitalize transition-all border ${
                      data.broadcastStatus === s
                        ? s === "live"
                          ? "bg-red-600/15 border-red-500/30 text-red-400"
                          : s === "ended"
                          ? isDark ? "bg-white/10 border-white/20 text-white/60" : "bg-gray-100 border-gray-300 text-gray-600"
                          : isDark ? "bg-[#4CAF50]/15 border-[#4CAF50]/30 text-[#4CAF50]" : "bg-green-50 border-green-300 text-green-700"
                        : isDark ? "bg-transparent border-white/08 text-white/30" : "bg-transparent border-gray-200 text-gray-400"
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
                  className={`text-xs font-medium flex items-center gap-1 ${isDark ? "text-[#4CAF50]" : "text-[#3D6B47]"} hover:underline`}
                >
                  <ExternalLink className="w-3 h-3" />
                  {showPreview ? "Hide preview" : "Preview embed"}
                </button>
                {showPreview && (
                  <div className="mt-2 rounded-xl overflow-hidden border" style={{ borderColor: isDark ? "rgba(255,255,255,0.08)" : "#e5e7eb" }}>
                    <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
                      <iframe
                        src={embedUrl}
                        className="absolute inset-0 w-full h-full"
                        allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                        allowFullScreen
                        loading="lazy"
                        referrerPolicy="strict-origin-when-cross-origin"
                        sandbox="allow-scripts allow-same-origin allow-popups allow-presentation"
                        title="Broadcast Preview"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Warning if enabled but no URL */}
            {data.broadcastEnabled && !data.broadcastUrl.trim() && (
              <p className={`text-xs px-3 py-2 rounded-lg ${isDark ? "bg-amber-500/10 text-amber-400" : "bg-amber-50 text-amber-600"}`}>
                Add a valid stream URL to publish this broadcast.
              </p>
            )}
          </>
        )}

        {/* Save button */}
        <button
          onClick={handleSave}
          disabled={saving}
          className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-[0.98] ${
            isDark
              ? "bg-[#4CAF50]/15 hover:bg-[#4CAF50]/25 text-[#4CAF50] border border-[#4CAF50]/20"
              : "bg-[#3D6B47] hover:bg-[#2A4A32] text-white"
          } disabled:opacity-50`}
        >
          <Save className="w-4 h-4" />
          {saving ? "Saving…" : "Save Broadcast Settings"}
        </button>
      </div>
    </div>
  );
}
