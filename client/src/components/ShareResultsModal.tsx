/**
 * OTB Chess — ShareResultsModal
 *
 * A modal that lets tournament directors broadcast player stats to all
 * participants via WhatsApp or email. Two modes:
 *
 *   1. Broadcast All — generates one WhatsApp / email link per player,
 *      displayed as a list the director can click through one by one.
 *
 *   2. Share Single — called from an individual card's action menu,
 *      opens the share options for just that player.
 *
 * Since browsers cannot auto-send WhatsApp messages or emails on behalf of
 * the user, we generate pre-filled deep-links (wa.me and mailto:) that open
 * in the system app. The director clicks each link to send.
 *
 * The message body includes:
 *   - Tournament name, player rank, score
 *   - A profile link on chess.com or Lichess
 *   - A call-to-action to view the full report
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { toast } from "sonner";
import {
  X,
  Mail,
  Copy,
  CheckCheck,
  ExternalLink,
  Send,
  ChevronRight,
  Users,
  Trophy,
  QrCode,
  Download,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import type { PlayerPerformance } from "@/lib/performanceStats";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ShareChannel = "email" | "qr";

const OTB_LOGO_URL =
  "https://d2xsxph8kpxj0f.cloudfront.net/117675823/J6FsDoRMH9x5xbUvpyzxyf/otb-logo_54fb3385.png";

interface ShareResultsModalProps {
  performances: PlayerPerformance[];
  tournamentName: string;
  reportUrl?: string;
  isDark: boolean;
  onClose: () => void;
  /** If provided, modal opens in single-player mode */
  singlePlayer?: PlayerPerformance;
}

// ─── Message generators ───────────────────────────────────────────────────────

function ordinal(n: number): string {
  if (n === 1) return "1st";
  if (n === 2) return "2nd";
  if (n === 3) return "3rd";
  return `${n}th`;
}

function platformProfileUrl(perf: PlayerPerformance): string {
  const { platform, username } = perf.player;
  if (platform === "lichess") return `https://lichess.org/@/${username}`;
  return `https://www.chess.com/member/${username}`;
}

function buildEmailBody(
  perf: PlayerPerformance,
  tournamentName: string,
  reportUrl: string
): string {
  const rank = ordinal(perf.rank);
  const record = `${perf.wins}W / ${perf.draws}D / ${perf.losses}L`;
  const profileUrl = platformProfileUrl(perf);
  // Direct anchor link to this player's card on the report page
  const cardUrl = reportUrl ? `${reportUrl}#player-${perf.player.id}` : "";

  return [
    `Hi ${perf.player.name},`,
    ``,
    `Here are your final results from ${tournamentName}:`,
    ``,
    `  Rank:                ${rank} place`,
    `  Score:               ${perf.points} pts (${record})`,
    `  Performance Rating:  ${perf.performanceRating}`,
    `  Buchholz:            ${perf.buchholz.toFixed(1)}`,
    ``,
    cardUrl ? `📊 Download your Player Card: ${cardUrl}` : "",
    reportUrl ? `📋 Full tournament results: ${reportUrl}` : "",
    profileUrl ? `♟️  Your chess.com profile: ${profileUrl}` : "",
    ``,
    `Thanks for playing — see you at the next tournament!`,
    ``,
    `— Sent via ChessOTB.club`,
  ]
    .filter((l) => l !== "")
    .join("\n");
}

function buildEmailSubject(perf: PlayerPerformance, tournamentName: string): string {
  return `Your results from ${tournamentName} — ${ordinal(perf.rank)} place`;
}

// ─── mailto link builder ──────────────────────────────────────────────────────

function mailtoLink(
  email: string | undefined,
  subject: string,
  body: string
): string {
  const to = email ?? "";
  return `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

// ─── Single player share row ──────────────────────────────────────────────────

function PlayerShareRow({
  perf,
  tournamentName,
  reportUrl,
  isDark,
  channel,
}: {
  perf: PlayerPerformance;
  tournamentName: string;
  reportUrl: string;
  isDark: boolean;
  channel: ShareChannel;
}) {
  const [copied, setCopied] = useState(false);

  const emailBody = buildEmailBody(perf, tournamentName, reportUrl);
  const emailSubject = buildEmailSubject(perf, tournamentName);
  const link = mailtoLink(perf.player.email, emailSubject, emailBody);
  const rawText = emailBody;

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(rawText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success(`Message copied for ${perf.player.name}`);
    } catch {
      toast.error("Clipboard not available");
    }
  }, [rawText, perf.player.name]);

  const rankEmoji = perf.rank === 1 ? "🏆" : perf.rank === 2 ? "🥈" : perf.rank === 3 ? "🥉" : `#${perf.rank}`;

  const rowBg = isDark ? "bg-white/04 hover:bg-white/08" : "bg-gray-50 hover:bg-gray-100";
  const textMain = isDark ? "text-white" : "text-gray-900";
  const textSub = isDark ? "text-white/40" : "text-gray-500";

  return (
    <div className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${rowBg}`}>
      {/* Rank + name */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm">{rankEmoji}</span>
          <span className={`text-sm font-semibold truncate ${textMain}`}>{perf.player.name}</span>
          {perf.player.email && (
            <span className={`text-[10px] truncate ${textSub} flex-shrink-0 max-w-[120px]`}>
              {perf.player.email}
            </span>
          )}
        </div>
        <span className={`text-[11px] ${textSub}`}>
          {perf.points}pts · {perf.wins}W {perf.draws}D {perf.losses}L · Perf {perf.performanceRating}
        </span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <button
          onClick={handleCopy}
          title="Copy message"
          className={`p-1.5 rounded-lg transition-colors ${
            isDark ? "hover:bg-white/10 text-white/50 hover:text-white" : "hover:bg-gray-200 text-gray-400 hover:text-gray-700"
          }`}
        >
          {copied ? (
            <CheckCheck className="w-3.5 h-3.5 text-emerald-500" />
          ) : (
            <Copy className="w-3.5 h-3.5" />
          )}
        </button>
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors bg-blue-500/15 text-blue-500 hover:bg-blue-500/25"
        >
          <Mail className="w-3 h-3" />
          Send
          <ExternalLink className="w-2.5 h-2.5 opacity-60" />
        </a>
      </div>
    </div>
  );
}

// ─── QR Code card panel ───────────────────────────────────────────────────────

function QRCodePanel({
  reportUrl,
  tournamentName,
  isDark,
}: {
  reportUrl: string;
  tournamentName: string;
  isDark: boolean;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [projecting, setProjecting] = useState(false);

  // Close projection overlay on Escape key
  useEffect(() => {
    if (!projecting) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setProjecting(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [projecting]);

  const hasUrl = Boolean(reportUrl);
  const qrValue = reportUrl || window.location.href;

  const handleDownload = useCallback(async () => {
    if (!cardRef.current) return;
    setDownloading(true);
    try {
      const { toPng } = await import("html-to-image");
      const url = await toPng(cardRef.current, {
        pixelRatio: 3,
        fetchRequestInit: { mode: "cors" },
      });
      const a = document.createElement("a");
      a.href = url;
      a.download = `${tournamentName.toLowerCase().replace(/\s+/g, "-")}-qr.png`;
      a.click();
      toast.success("QR card downloaded");
    } catch {
      toast.error("Download failed — try again");
    } finally {
      setDownloading(false);
    }
  }, [tournamentName]);

  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(qrValue);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("Results link copied");
    } catch {
      toast.error("Clipboard not available");
    }
  }, [qrValue]);

  const textSub = isDark ? "text-white/40" : "text-gray-500";

  return (
    <div className="flex flex-col items-center gap-5 px-5 py-5">
      {/* Branded QR card — this is what gets downloaded */}
      <div
        ref={cardRef}
        style={{
          background: "linear-gradient(145deg, #0f2d1a 0%, #1a3d25 60%, #0d2518 100%)",
          borderRadius: 20,
          padding: "28px 28px 22px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 14,
          width: 280,
          boxShadow: "0 8px 40px rgba(0,0,0,0.5)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Subtle checkerboard watermark */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "repeating-conic-gradient(rgba(255,255,255,0.025) 0% 25%, transparent 0% 50%)",
            backgroundSize: "24px 24px",
            borderRadius: 20,
          }}
        />
        {/* Logo + wordmark */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, position: "relative", zIndex: 1 }}>
          <img
            src={OTB_LOGO_URL}
            alt="OTB!!"
            crossOrigin="anonymous"
            style={{ width: 28, height: 28, objectFit: "contain" }}
          />
          <span
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: "rgba(255,255,255,0.7)",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              fontFamily: "'Clash Display', sans-serif",
            }}
          >
            OTBchess.club
          </span>
        </div>

        {/* Tournament name */}
        <div
          style={{
            fontSize: 15,
            fontWeight: 800,
            color: "#fff",
            textAlign: "center",
            lineHeight: 1.25,
            position: "relative",
            zIndex: 1,
            fontFamily: "'Clash Display', sans-serif",
            maxWidth: 200,
          }}
        >
          {tournamentName}
        </div>

        {/* QR code on white card */}
        <div
          style={{
            background: "#fff",
            borderRadius: 14,
            padding: 14,
            position: "relative",
            zIndex: 1,
            boxShadow: "0 2px 12px rgba(0,0,0,0.3)",
          }}
        >
          <QRCodeSVG
            value={qrValue}
            size={160}
            bgColor="#ffffff"
            fgColor="#0f2d1a"
            level="H"
            imageSettings={{
              src: OTB_LOGO_URL,
              height: 28,
              width: 28,
              excavate: true,
            }}
          />
        </div>

        {/* CTA label */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 2,
            position: "relative",
            zIndex: 1,
          }}
        >
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "#6ee7a0",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
            }}
          >
            Scan to view results
          </span>
          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.35)" }}>
            View standings · Download your player card
          </span>
        </div>

        {/* Divider row */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, position: "relative", zIndex: 1 }}>
          <div style={{ height: 1, width: 40, background: "rgba(255,255,255,0.1)" }} />
          <Trophy size={12} color="rgba(255,255,255,0.25)" />
          <div style={{ height: 1, width: 40, background: "rgba(255,255,255,0.1)" }} />
        </div>
      </div>

      {/* No URL warning */}
      {!hasUrl && (
        <p className={`text-[11px] text-center ${textSub} max-w-[240px]`}>
          The report page URL will be available once the tournament is published. The QR code currently links to this page.
        </p>
      )}

      {/* Project on screen button */}
      <button
        onClick={() => setProjecting(true)}
        className="flex items-center justify-center gap-2 w-full max-w-[280px] px-4 py-2.5 rounded-xl text-sm font-semibold border-2 border-[#3D6B47] text-[#3D6B47] hover:bg-[#3D6B47] hover:text-white transition-colors"
      >
        <Maximize2 className="w-4 h-4" />
        Project on Screen
      </button>

      {/* Action buttons */}
      <div className="flex items-center gap-2 w-full max-w-[280px]">
        <button
          onClick={handleCopyLink}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${
            isDark
              ? "bg-white/08 text-white/70 hover:bg-white/14"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          {copied ? (
            <CheckCheck className="w-3.5 h-3.5 text-emerald-500" />
          ) : (
            <Copy className="w-3.5 h-3.5" />
          )}
          {copied ? "Copied!" : "Copy Link"}
        </button>
        <button
          onClick={handleDownload}
          disabled={downloading}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-[#3D6B47] text-white hover:bg-[#2d5235] transition-colors disabled:opacity-60"
        >
          <Download className="w-3.5 h-3.5" />
          {downloading ? "Saving…" : "Download Card"}
        </button>
      </div>

      <p className={`text-[10px] text-center ${textSub} max-w-[260px] leading-relaxed`}>
        Print or display this card at your venue. Players scan the QR code to view the final standings and download their personal performance card.
      </p>

      {/* Fullscreen projection overlay */}
      {projecting && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "#0a1f10",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 40,
          }}
        >
          {/* Close button */}
          <button
            onClick={() => setProjecting(false)}
            style={{
              position: "absolute",
              top: 24,
              right: 24,
              background: "rgba(255,255,255,0.08)",
              border: "none",
              borderRadius: 12,
              padding: "10px 16px",
              color: "rgba(255,255,255,0.6)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            <Minimize2 size={16} />
            Exit Projection
          </button>

          {/* OTB!! logo */}
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <img
              src={OTB_LOGO_URL}
              alt="OTB!!"
              crossOrigin="anonymous"
              style={{ width: 52, height: 52, objectFit: "contain" }}
            />
            <span
              style={{
                fontSize: 22,
                fontWeight: 800,
                color: "rgba(255,255,255,0.65)",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                fontFamily: "'Clash Display', sans-serif",
              }}
            >
              OTBchess.club
            </span>
          </div>

          {/* Tournament name */}
          <div
            style={{
              fontSize: 42,
              fontWeight: 900,
              color: "#fff",
              textAlign: "center",
              lineHeight: 1.15,
              fontFamily: "'Clash Display', sans-serif",
              maxWidth: 700,
              padding: "0 32px",
            }}
          >
            {tournamentName}
          </div>

          {/* Large QR code */}
          <div
            style={{
              background: "#fff",
              borderRadius: 24,
              padding: 28,
              boxShadow: "0 16px 80px rgba(0,0,0,0.6)",
            }}
          >
            <QRCodeSVG
              value={qrValue}
              size={320}
              bgColor="#ffffff"
              fgColor="#0a1f10"
              level="H"
              imageSettings={{
                src: OTB_LOGO_URL,
                height: 52,
                width: 52,
                excavate: true,
              }}
            />
          </div>

          {/* CTA */}
          <div style={{ textAlign: "center" }}>
            <div
              style={{
                fontSize: 22,
                fontWeight: 700,
                color: "#6ee7a0",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                fontFamily: "'Clash Display', sans-serif",
              }}
            >
              Scan to view results
            </div>
            <div style={{ fontSize: 15, color: "rgba(255,255,255,0.35)", marginTop: 6 }}>
              View standings &middot; Download your player card
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────

export function ShareResultsModal({
  performances,
  tournamentName,
  reportUrl = "",
  isDark,
  onClose,
  singlePlayer,
}: ShareResultsModalProps) {
  const [channel, setChannel] = useState<ShareChannel>("email");
  const [copiedAll, setCopiedAll] = useState(false);

  const targets = singlePlayer ? [singlePlayer] : performances;

  // Copy all email messages to clipboard as a single block
  const handleCopyAll = useCallback(async () => {
    const allMessages = targets
      .map((perf) =>
        `--- ${perf.player.name} ---\nTo: ${perf.player.email ?? "(no email)"}\nSubject: ${buildEmailSubject(perf, tournamentName)}\n\n${buildEmailBody(perf, tournamentName, reportUrl)}`
      )
      .join("\n\n");
    try {
      await navigator.clipboard.writeText(allMessages);
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2500);
      toast.success("All email messages copied to clipboard");
    } catch {
      toast.error("Clipboard not available");
    }
  }, [targets, tournamentName, reportUrl]);

  const bg = isDark
    ? "bg-[oklch(0.20_0.06_145)] border-white/10"
    : "bg-white border-gray-200";
  const textMain = isDark ? "text-white" : "text-gray-900";
  const textSub = isDark ? "text-white/40" : "text-gray-500";
  const divider = isDark ? "border-white/08" : "border-gray-100";

  const isQR = channel === "qr";
  const playersWithEmail = performances.filter((p) => p.player.email).length;

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className={`relative w-full max-w-lg rounded-2xl border shadow-2xl overflow-hidden ${bg}`}
        style={{ maxHeight: "90vh", display: "flex", flexDirection: "column" }}
      >
        {/* Header */}
        <div className={`px-5 pt-5 pb-4 border-b ${divider} flex-shrink-0`}>
          <div className="flex items-start justify-between">
            <div>
              <h2
                className={`text-base font-black ${textMain}`}
                style={{ fontFamily: "'Clash Display', sans-serif" }}
              >
                {singlePlayer ? `Share ${singlePlayer.player.name}'s Results` : "Share Results"}
              </h2>
              <p className={`text-xs mt-0.5 ${textSub}`}>
                {isQR
                  ? "Generate a QR code for players to scan at the venue"
                  : singlePlayer
                  ? `Send ${singlePlayer.player.name}'s results and player card link via email`
                  : `Broadcast results to all ${performances.length} players`}
              </p>
            </div>
            <button
              onClick={onClose}
              className={`p-1.5 rounded-xl transition-colors ${
                isDark ? "hover:bg-white/10 text-white/50" : "hover:bg-gray-100 text-gray-400"
              }`}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Channel toggle — 2 tabs: Email + QR Code */}
          <div className={`flex gap-1 mt-4 p-1 rounded-xl ${isDark ? "bg-white/06" : "bg-gray-100"}`}>
            {(["email", "qr"] as ShareChannel[]).map((ch) => {
              const isActive = channel === ch;
              const activeClass =
                ch === "email"
                  ? "bg-blue-500 text-white shadow-sm"
                  : "bg-[#3D6B47] text-white shadow-sm";
              const inactiveClass = isDark
                ? "text-white/50 hover:text-white/80"
                : "text-gray-500 hover:text-gray-700";
              return (
                <button
                  key={ch}
                  onClick={() => setChannel(ch)}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                    isActive ? activeClass : inactiveClass
                  }`}
                >
                  {ch === "email" ? (
                    <Mail className="w-3.5 h-3.5" />
                  ) : (
                    <QrCode className="w-3.5 h-3.5" />
                  )}
                  {ch === "email" ? "Email" : "QR Code"}
                </button>
              );
            })}
          </div>

          {/* Contact info hint — only for Email */}
          {!singlePlayer && !isQR && (
            <div className={`mt-3 flex items-center gap-3 text-[11px] ${textSub}`}>
              <div className="flex items-center gap-1">
                <Users className="w-3 h-3" />
                <span>
                  {playersWithEmail > 0
                    ? `${playersWithEmail} of ${performances.length} players have email addresses saved`
                    : "No email addresses saved — links will open your email client without a recipient"}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Body — QR panel or player list */}
        {isQR ? (
          <div className="flex-1 overflow-y-auto">
            <QRCodePanel
              reportUrl={reportUrl}
              tournamentName={tournamentName}
              isDark={isDark}
            />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto px-5 py-3 space-y-1.5">
            {targets.map((perf) => (
              <PlayerShareRow
                key={perf.player.id}
                perf={perf}
                tournamentName={tournamentName}
                reportUrl={reportUrl}
                isDark={isDark}
                channel={channel}
              />
            ))}
          </div>
        )}

        {/* Footer — only for Email */}
        {!isQR && (
          <div className={`px-5 py-4 border-t ${divider} flex-shrink-0`}>
            {/* Email All BCC button — opens one mailto with all addresses in BCC */}
            {!singlePlayer && (
              <a
                href={`mailto:?bcc=${encodeURIComponent(
                  targets.map((p) => p.player.email).filter(Boolean).join(",")
                )}&subject=${encodeURIComponent(`Results: ${tournamentName}`)}&body=${encodeURIComponent(
                  `Hi everyone,\n\nHere are the final results from ${tournamentName}:\n\n${reportUrl}\n\nYou can also view and download your personal player card at the link above.\n\nThanks for playing — see you at the next tournament!\n\n— Sent via ChessOTB.club`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl text-sm font-semibold bg-blue-500 text-white hover:bg-blue-600 transition-colors mb-3"
              >
                <Mail className="w-4 h-4" />
                Email All Players
                <ExternalLink className="w-3.5 h-3.5 opacity-70" />
              </a>
            )}
            <div className="flex items-center justify-between gap-3">
              <p className={`text-[11px] ${textSub} flex items-center gap-1`}>
                <ChevronRight className="w-3 h-3" />
                {singlePlayer ? "Click Send to open your email client" : "Or click Send on each player to send individually"}
              </p>
              <div className="flex items-center gap-2">
                {!singlePlayer && (
                  <button
                    onClick={handleCopyAll}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                      isDark
                        ? "bg-white/08 text-white/70 hover:bg-white/14"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {copiedAll ? (
                      <CheckCheck className="w-3.5 h-3.5 text-emerald-500" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    Copy All
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#3D6B47] text-white hover:bg-[#2d5235] transition-colors"
                >
                  <Send className="w-3.5 h-3.5" />
                  Done
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Convenience hook for managing modal state ────────────────────────────────

export function useShareModal() {
  const [open, setOpen] = useState(false);
  const [singlePlayer, setSinglePlayer] = useState<PlayerPerformance | undefined>();

  const openBroadcast = useCallback(() => {
    setSinglePlayer(undefined);
    setOpen(true);
  }, []);

  const openSingle = useCallback((perf: PlayerPerformance) => {
    setSinglePlayer(perf);
    setOpen(true);
  }, []);

  const close = useCallback(() => setOpen(false), []);

  return { open, singlePlayer, openBroadcast, openSingle, close };
}
