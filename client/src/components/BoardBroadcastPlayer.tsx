/**
 * BoardBroadcastPlayer — Responsive video embed with LIVE badge and board metadata.
 * Used on the public tournament page when broadcast is enabled.
 */
import { useMemo } from "react";
import { getEmbedUrl, type BroadcastStatus } from "@/lib/broadcastUtils";
import { Radio } from "lucide-react";

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

  if (!embedUrl) return null;

  return (
    <div className={`rounded-2xl border overflow-hidden ${isDark ? "bg-[oklch(0.20_0.06_145)] border-white/10" : "bg-white border-gray-200"}`}>
      {/* Video embed — 16:9 responsive */}
      <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
        <iframe
          src={embedUrl}
          className="absolute inset-0 w-full h-full"
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
          sandbox="allow-scripts allow-same-origin allow-popups allow-presentation"
          title={title || "Board Broadcast"}
        />
        {/* LIVE badge */}
        {status === "live" && (
          <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-600 shadow-lg">
            <Radio className="w-3 h-3 text-white animate-pulse" />
            <span className="text-[11px] font-bold text-white uppercase tracking-wider">Live</span>
          </div>
        )}
        {status === "ended" && (
          <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-700/80 backdrop-blur-sm">
            <span className="text-[11px] font-bold text-white/80 uppercase tracking-wider">Broadcast Ended</span>
          </div>
        )}
      </div>

      {/* Metadata bar */}
      <div className={`px-4 py-3 space-y-1 ${isDark ? "border-t border-white/06" : "border-t border-gray-100"}`}>
        {/* Title row */}
        <div className="flex items-center justify-between gap-2">
          <h3 className={`text-sm font-bold truncate ${isDark ? "text-white" : "text-gray-900"}`} style={{ fontFamily: "'Clash Display', sans-serif" }}>
            {title || `Board ${metadata?.boardNumber ?? 1} Live`}
          </h3>
          {metadata?.roundNumber && (
            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${isDark ? "bg-white/08 text-white/50" : "bg-gray-100 text-gray-500"}`}>
              Round {metadata.roundNumber}
            </span>
          )}
        </div>

        {/* Tournament name */}
        {tournamentName && (
          <p className={`text-xs ${isDark ? "text-white/40" : "text-gray-400"}`}>{tournamentName}</p>
        )}

        {/* Board pairing */}
        {metadata?.whiteName && metadata?.blackName && (
          <div className={`flex items-center gap-2 mt-2 pt-2 ${isDark ? "border-t border-white/06" : "border-t border-gray-100"}`}>
            <div className="flex items-center gap-1.5 flex-1 min-w-0">
              <span className="w-3 h-3 rounded-full bg-white border border-gray-300 flex-shrink-0" />
              <span className={`text-xs font-semibold truncate ${isDark ? "text-white/80" : "text-gray-800"}`}>
                {metadata.whiteName}
              </span>
              {metadata.whiteRating && (
                <span className={`text-[10px] flex-shrink-0 ${isDark ? "text-white/35" : "text-gray-400"}`}>
                  ({metadata.whiteRating})
                </span>
              )}
            </div>
            <span className={`text-xs font-bold flex-shrink-0 ${isDark ? "text-white/50" : "text-gray-500"}`}>
              {metadata.result && metadata.result !== "*" ? metadata.result : "vs"}
            </span>
            <div className="flex items-center gap-1.5 flex-1 min-w-0 justify-end">
              {metadata.blackRating && (
                <span className={`text-[10px] flex-shrink-0 ${isDark ? "text-white/35" : "text-gray-400"}`}>
                  ({metadata.blackRating})
                </span>
              )}
              <span className={`text-xs font-semibold truncate ${isDark ? "text-white/80" : "text-gray-800"}`}>
                {metadata.blackName}
              </span>
              <span className="w-3 h-3 rounded-full bg-gray-800 border border-gray-600 flex-shrink-0" />
            </div>
          </div>
        )}

        {/* Fallback when no pairing data */}
        {(!metadata?.whiteName || !metadata?.blackName) && metadata?.boardNumber && (
          <p className={`text-xs ${isDark ? "text-white/35" : "text-gray-400"}`}>
            Featured Board: Board {metadata.boardNumber}
          </p>
        )}
      </div>
    </div>
  );
}
