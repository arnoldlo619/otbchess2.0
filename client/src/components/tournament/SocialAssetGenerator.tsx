/**
 * SocialAssetGenerator
 *
 * Canvas-based social media asset generator for tournament recaps.
 * Generates shareable images (1080x1080 for Instagram, 1200x630 for Twitter/OG)
 * with champion cards, section standings, and tournament highlights.
 */

import { useRef, useState, useCallback } from "react";
import { Download, Share2, Instagram, Twitter, Copy, Check } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ChampionData {
  playerName: string;
  rating: number;
  sectionName: string;
  finalScore: string;
  badges: string[];
  prizeWon?: string;
}

export interface AssetConfig {
  tournamentName: string;
  clubName?: string;
  eventDate?: string;
  venue?: string;
  champions: ChampionData[];
  playerCount?: number;
  format?: string;
  timeControl?: string;
  sponsorNote?: string;
}

type AssetFormat = "instagram" | "twitter" | "story";

const FORMAT_SIZES: Record<AssetFormat, { width: number; height: number; label: string }> = {
  instagram: { width: 1080, height: 1080, label: "Instagram Post (1:1)" },
  twitter: { width: 1200, height: 630, label: "Twitter/OG (1.91:1)" },
  story: { width: 1080, height: 1920, label: "Story (9:16)" },
};

// ─── Canvas Drawing ──────────────────────────────────────────────────────────

function drawChampionCard(
  ctx: CanvasRenderingContext2D,
  config: AssetConfig,
  format: AssetFormat
) {
  const { width, height } = FORMAT_SIZES[format];
  const scale = window.devicePixelRatio || 1;

  // Background gradient (dark green theme)
  const gradient = ctx.createLinearGradient(0, 0, 0, height * scale);
  gradient.addColorStop(0, "#0d1f12");
  gradient.addColorStop(0.5, "#142a18");
  gradient.addColorStop(1, "#0a1a0e");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width * scale, height * scale);

  // Subtle chess pattern overlay
  ctx.globalAlpha = 0.03;
  const patternSize = 40 * scale;
  for (let y = 0; y < height * scale; y += patternSize) {
    for (let x = 0; x < width * scale; x += patternSize) {
      if ((Math.floor(x / patternSize) + Math.floor(y / patternSize)) % 2 === 0) {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(x, y, patternSize, patternSize);
      }
    }
  }
  ctx.globalAlpha = 1;

  // Decorative top accent bar
  const accentGrad = ctx.createLinearGradient(0, 0, width * scale, 0);
  accentGrad.addColorStop(0, "#4CAF50");
  accentGrad.addColorStop(1, "#2E7D32");
  ctx.fillStyle = accentGrad;
  ctx.fillRect(0, 0, width * scale, 6 * scale);

  // Title area
  const padding = 60 * scale;
  const titleY = format === "story" ? 180 * scale : 100 * scale;

  // Tournament name
  ctx.font = `bold ${(format === "story" ? 48 : 40) * scale}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.fillText(config.tournamentName, (width * scale) / 2, titleY);

  // Subtitle (date + venue)
  const subtitleParts: string[] = [];
  if (config.eventDate) subtitleParts.push(config.eventDate);
  if (config.venue) subtitleParts.push(config.venue);
  if (subtitleParts.length > 0) {
    ctx.font = `${18 * scale}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.fillText(subtitleParts.join(" • "), (width * scale) / 2, titleY + 40 * scale);
  }

  // Champions section
  const champStartY = titleY + (format === "story" ? 120 : 100) * scale;
  const champSpacing = format === "story" ? 200 : format === "instagram" ? 180 : 120;
  const maxChamps = format === "twitter" ? 3 : format === "instagram" ? 4 : 6;
  const visibleChamps = config.champions.slice(0, maxChamps);

  ctx.font = `bold ${14 * scale}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.textAlign = "center";
  ctx.fillText("CHAMPIONS", (width * scale) / 2, champStartY - 20 * scale);

  visibleChamps.forEach((champ, i) => {
    const cardY = champStartY + i * champSpacing * scale;
    const cardX = padding;
    const cardW = (width - 120) * scale;
    const cardH = (champSpacing - 20) * scale;

    // Card background
    ctx.fillStyle = "rgba(255,255,255,0.04)";
    roundRect(ctx, cardX, cardY, cardW, cardH, 16 * scale);
    ctx.fill();

    // Card border
    ctx.strokeStyle = "rgba(76, 175, 80, 0.2)";
    ctx.lineWidth = 1 * scale;
    roundRect(ctx, cardX, cardY, cardW, cardH, 16 * scale);
    ctx.stroke();

    // Trophy icon placeholder (gold circle)
    const iconX = cardX + 30 * scale;
    const iconY = cardY + cardH / 2;
    ctx.beginPath();
    ctx.arc(iconX, iconY, 20 * scale, 0, Math.PI * 2);
    ctx.fillStyle = i === 0 ? "rgba(255, 193, 7, 0.15)" : "rgba(76, 175, 80, 0.1)";
    ctx.fill();
    ctx.font = `${18 * scale}px -apple-system`;
    ctx.fillStyle = i === 0 ? "#FFC107" : "#4CAF50";
    ctx.textAlign = "center";
    ctx.fillText("🏆", iconX, iconY + 6 * scale);

    // Player name
    ctx.textAlign = "left";
    ctx.font = `bold ${22 * scale}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
    ctx.fillStyle = "#ffffff";
    ctx.fillText(champ.playerName, iconX + 40 * scale, cardY + 35 * scale);

    // Section + score
    ctx.font = `${15 * scale}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.fillText(
      `${champ.sectionName} • ${champ.finalScore} • ${champ.rating}`,
      iconX + 40 * scale,
      cardY + 60 * scale
    );

    // Prize (if any)
    if (champ.prizeWon) {
      ctx.textAlign = "right";
      ctx.font = `bold ${16 * scale}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
      ctx.fillStyle = "#4CAF50";
      ctx.fillText(champ.prizeWon, cardX + cardW - 20 * scale, cardY + 45 * scale);
    }

    // Badges
    if (champ.badges.length > 0) {
      ctx.textAlign = "right";
      ctx.font = `${12 * scale}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      const badgeText = champ.badges.slice(0, 3).map(b => b.replace(/_/g, " ")).join(" • ");
      ctx.fillText(badgeText, cardX + cardW - 20 * scale, cardY + cardH - 20 * scale);
    }
  });

  // Footer
  const footerY = (height - 60) * scale;
  ctx.textAlign = "center";
  ctx.font = `${13 * scale}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
  ctx.fillStyle = "rgba(255,255,255,0.3)";

  const footerParts: string[] = [];
  if (config.clubName) footerParts.push(config.clubName);
  if (config.playerCount) footerParts.push(`${config.playerCount} players`);
  if (config.format) footerParts.push(config.format);
  if (config.timeControl) footerParts.push(config.timeControl);
  ctx.fillText(footerParts.join(" • "), (width * scale) / 2, footerY);

  // ChessOTB.club branding
  ctx.font = `bold ${14 * scale}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
  ctx.fillStyle = "#4CAF50";
  ctx.fillText("ChessOTB.club", (width * scale) / 2, footerY + 25 * scale);

  // Sponsor note
  if (config.sponsorNote) {
    ctx.font = `${11 * scale}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
    ctx.fillStyle = "rgba(255,255,255,0.25)";
    ctx.fillText(config.sponsorNote, (width * scale) / 2, footerY - 25 * scale);
  }
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// ─── Caption Generator ───────────────────────────────────────────────────────

export function generateCaption(config: AssetConfig): string {
  const lines: string[] = [];
  lines.push(`🏆 ${config.tournamentName} — Results`);
  lines.push("");

  if (config.eventDate || config.venue) {
    const parts = [config.eventDate, config.venue].filter(Boolean);
    lines.push(`📍 ${parts.join(" • ")}`);
    lines.push("");
  }

  lines.push("🥇 Champions:");
  config.champions.forEach((c) => {
    const prizeStr = c.prizeWon ? ` (${c.prizeWon})` : "";
    lines.push(`  ${c.sectionName}: ${c.playerName} — ${c.finalScore}${prizeStr}`);
  });
  lines.push("");

  const stats: string[] = [];
  if (config.playerCount) stats.push(`${config.playerCount} players`);
  if (config.format) stats.push(config.format);
  if (config.timeControl) stats.push(config.timeControl);
  if (stats.length > 0) lines.push(`📊 ${stats.join(" • ")}`);

  lines.push("");
  lines.push("#OTBChess #ChessOTB #ChessTournament #OverTheBoard");
  if (config.clubName) lines.push(`#${config.clubName.replace(/\s+/g, "")}`);

  return lines.join("\n");
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function SocialAssetGenerator({ config }: { config: AssetConfig }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [format, setFormat] = useState<AssetFormat>("instagram");
  const [generating, setGenerating] = useState(false);
  const [captionCopied, setCaptionCopied] = useState(false);

  const generateImage = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    setGenerating(true);
    const { width, height } = FORMAT_SIZES[format];
    const scale = window.devicePixelRatio || 1;

    canvas.width = width * scale;
    canvas.height = height * scale;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    drawChampionCard(ctx, config, format);
    setGenerating(false);
  }, [config, format]);

  const downloadImage = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const link = document.createElement("a");
    link.download = `${config.tournamentName.replace(/\s+/g, "-").toLowerCase()}-${format}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }, [config.tournamentName, format]);

  const shareImage = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/png")
      );
      if (!blob) return;

      if (navigator.share && navigator.canShare?.({ files: [] })) {
        const file = new File([blob], `${config.tournamentName}-recap.png`, { type: "image/png" });
        await navigator.share({
          title: `${config.tournamentName} Results`,
          text: generateCaption(config),
          files: [file],
        });
      } else {
        // Fallback: download
        downloadImage();
      }
    } catch {
      // User cancelled or share failed
    }
  }, [config, downloadImage]);

  const copyCaption = useCallback(() => {
    const caption = generateCaption(config);
    navigator.clipboard.writeText(caption).then(() => {
      setCaptionCopied(true);
      setTimeout(() => setCaptionCopied(false), 2000);
    });
  }, [config]);

  const caption = generateCaption(config);

  return (
    <div className="space-y-5">
      {/* Format selector */}
      <div className="flex gap-2 flex-wrap">
        {(Object.keys(FORMAT_SIZES) as AssetFormat[]).map((f) => (
          <button
            key={f}
            onClick={() => setFormat(f)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              format === f
                ? "bg-[#4CAF50]/15 text-[#4CAF50] border border-[#4CAF50]/30"
                : "bg-white/6 text-white/50 hover:text-white border border-transparent"
            }`}
          >
            {f === "instagram" && <Instagram className="w-3 h-3" />}
            {f === "twitter" && <Twitter className="w-3 h-3" />}
            {f === "story" && <span className="text-[10px]">📱</span>}
            {FORMAT_SIZES[f].label}
          </button>
        ))}
      </div>

      {/* Generate button */}
      <button
        onClick={generateImage}
        disabled={generating}
        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#4CAF50]/15 text-[#4CAF50] text-sm font-semibold border border-[#4CAF50]/30 hover:bg-[#4CAF50]/25 transition-colors disabled:opacity-50"
      >
        {generating ? "Generating..." : "Generate Image"}
      </button>

      {/* Canvas preview */}
      <div className="rounded-2xl overflow-hidden border border-white/10 bg-black/20">
        <canvas
          ref={canvasRef}
          className="w-full h-auto"
          style={{ maxWidth: FORMAT_SIZES[format].width, display: "block" }}
        />
      </div>

      {/* Action buttons */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={downloadImage}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/6 text-white/80 text-sm font-medium border border-white/10 hover:bg-white/10 transition-colors"
        >
          <Download className="w-4 h-4" />
          Download PNG
        </button>
        <button
          onClick={shareImage}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/6 text-white/80 text-sm font-medium border border-white/10 hover:bg-white/10 transition-colors"
        >
          <Share2 className="w-4 h-4" />
          Share
        </button>
      </div>

      {/* Caption section */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider">Caption</h3>
          <button
            onClick={copyCaption}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-white/50 hover:text-white/80 bg-white/5 hover:bg-white/10 transition-colors"
          >
            {captionCopied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
            {captionCopied ? "Copied!" : "Copy"}
          </button>
        </div>
        <pre className="text-xs text-white/60 whitespace-pre-wrap bg-white/3 rounded-xl p-4 border border-white/5 font-mono leading-relaxed max-h-48 overflow-y-auto">
          {caption}
        </pre>
      </div>
    </div>
  );
}
