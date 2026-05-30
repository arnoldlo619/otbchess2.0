/**
 * BoardBroadcastPlayer — Responsive video embed with LIVE badge and board metadata.
 * Used on the public tournament page when broadcast is enabled.
 *
 * Production-hardened:
 * - Graceful fallback when metadata is unavailable
 * - Mobile-first responsive design (no horizontal overflow)
 * - Proper iframe security attributes
 * - sandbox attribute intentionally omitted (breaks YouTube/Twitch playback)
 */
import { useMemo } from "react";
import { getEmbedUrl, isValidBroadcastUrl, type BroadcastStatus } from "@/lib/broadcastUtils";
import { Radio, MonitorOff } from "lucide-react";

interface BoardMetadata {
  boardNumber: number;
  roundNumber?: number;
  whiteName?: string;
  blackName?: string;
  whiteRating?: number;
  blackRating?: number;
  result?: string;
}

interface Props {
  url: string;
  title?: string | null;
  status: BroadcastStatus;
  tournamentName?: string;
  metadata?: BoardMetadata | null;
  isDark?: boolean;
}

export function BoardBroadcastPlayer({ url, title, status, tournamentName, metadata, isDark = true }: Props) {
  const embedUrl = useMemo(() => getEmbedUrl(url), [url]);

  // Don't render if URL is invalid or embed can't be generated
  if (!url || !isValidBroadcastUrl(url) || !embedUrl) return null;

  const boardLabel = title || `Board ${metadata?.boardNumber ?? 1} Live`;
  const hasPairing = !!(metadata?.whiteName && metadata?.blackName);

  return (
    <div className={`rounded-2xl border overflow-hidden ${isDark ? "bg-[oklch(0.20_0.06_145)] border-white/10" : "bg-white border-gray-200 shadow-sm"}`}>
      {/* Header row: LIVE badge + title + board/round info */}
      <div className={`px-4 py-2.5 flex items-center gap-2 flex-wrap ${isDark ? "border-b border-white/06" : "border-b border-gray-100"}`}>
        {status === "live" && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-600 shadow-sm">
            <Radio className="w-2.5 h-2.5 text-white animate-pulse" />
            <span className="text-[10px] font-bold text-white uppercase tracking-wider">Live</span>
          </span>
        )}
        {status === "ended" && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-600/80">
            <MonitorOff className="w-2.5 h-2.5 text-white/70" />
            <span className="text-[10px] font-bold text-white/70 uppercase tracking-wider">Ended</span>
          </span>
        )}
        <h3 className={`text-sm font-bold truncate flex-1 min-w-0 ${isDark ? "text-white" : "text-gray-900"}`} style={{ fontFamily: "'Clash Display', sans-serif" }}>
          {boardLabel}
        </h3>
        {metadata?.roundNumber && (
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${isDark ? "bg-white/08 text-white/50" : "bg-gray-100 text-gray-500"}`}>
            Rd {metadata.roundNumber}
          </span>
        )}
      </div>

      {/* Video embed — 16:9 responsive, no horizontal overflow */}
      <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
        {/* Note: sandbox attribute intentionally omitted — YouTube and Twitch
            embeds require unrestricted same-origin access for their player SDKs.
            Security is enforced at the URL validation/conversion layer instead. */}
        <iframe
          src={embedUrl}
          className="absolute inset-0 w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
          title={boardLabel}
        />
      </div>

      {/* Metadata bar */}
      <div className={`px-4 py-3 space-y-1.5 ${isDark ? "border-t border-white/06" : "border-t border-gray-100"}`}>
        {/* Tournament name */}
        {tournamentName && (
          <p className={`text-xs ${isDark ? "text-white/40" : "text-gray-400"}`}>{tournamentName}</p>
        )}

        {/* Board pairing — when available */}
        {hasPairing && (
          <div className={`flex items-center gap-2 pt-1.5 ${isDark ? "border-t border-white/06" : "border-t border-gray-50"}`}>
            {/* White */}
            <div className="flex items-center gap-1.5 flex-1 min-w-0">
              <span className="w-3 h-3 rounded-full bg-white border border-gray-300 flex-shrink-0" />
              <span className={`text-xs font-semibold truncate ${isDark ? "text-white/80" : "text-gray-800"}`}>
                {metadata!.whiteName}
              </span>
              {metadata!.whiteRating != null && (
                <span className={`text-[10px] flex-shrink-0 ${isDark ? "text-white/35" : "text-gray-400"}`}>
                  ({metadata!.whiteRating})
                </span>
              )}
            </div>
            {/* Result */}
            <span className={`text-xs font-bold flex-shrink-0 ${isDark ? "text-white/50" : "text-gray-500"}`}>
              {metadata!.result && metadata!.result !== "*" ? metadata!.result : "vs"}
            </span>
            {/* Black */}
            <div className="flex items-center gap-1.5 flex-1 min-w-0 justify-end">
              {metadata!.blackRating != null && (
                <span className={`text-[10px] flex-shrink-0 ${isDark ? "text-white/35" : "text-gray-400"}`}>
                  ({metadata!.blackRating})
                </span>
              )}
              <span className={`text-xs font-semibold truncate ${isDark ? "text-white/80" : "text-gray-800"}`}>
                {metadata!.blackName}
              </span>
              <span className="w-3 h-3 rounded-full bg-gray-800 border border-gray-600 flex-shrink-0" />
            </div>
          </div>
        )}

        {/* Fallback when no pairing data */}
        {!hasPairing && (
          <p className={`text-xs ${isDark ? "text-white/35" : "text-gray-400"}`}>
            {metadata?.boardNumber
              ? `Featured Board: Board ${metadata.boardNumber}`
              : "Player details will appear when pairings are available."}
          </p>
        )}
      </div>
    </div>
  );
}
