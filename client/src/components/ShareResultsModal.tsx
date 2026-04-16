/**
 * OTB Chess — ShareResultsModal
 *
 * A modal that lets tournament directors broadcast player stats to all
 * participants via email (mailto: or server-side SMTP) or QR code.
 *
 * Email modes:
 *   1. mailto: links — opens the director's local email client per player
 *   2. Send via Server — uses the director's saved SMTP config to send
 *      emails directly from the platform; shows per-player sent/failed status
 *
 * The message body includes:
 *   - Tournament name, player rank, score
 *   - A direct link to the player's card on the report page
 *   - A call-to-action to view the full results
 */

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
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
  QrCode,
  Download,
  Maximize2,
  Minimize2,
  Server,
  Loader2,
  CheckCircle,
  AlertCircle,
  Settings,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import type { PlayerPerformance } from "@/lib/performanceStats";
import type { Round, Player } from "@/lib/tournamentData";
import { logger } from "@/lib/logger";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ShareChannel = "email" | "qr";

const OTB_LOGO_URL =
  "https://d2xsxph8kpxj0f.cloudfront.net/117675823/J6FsDoRMH9x5xbUvpyzxyf/otb-logo_54fb3385.png";

interface ShareResultsModalProps {
  performances: PlayerPerformance[];
  tournamentName: string;
  tournamentId?: string;
  reportUrl?: string;
  isDark: boolean;
  onClose: () => void;
  /** If provided, modal opens in single-player mode */
  singlePlayer?: PlayerPerformance;
  /** Optional: raw player list for PDF generation */
  pdfPlayers?: Player[];
  /** Optional: rounds data for PDF generation */
  pdfRounds?: Round[];
  /** Optional: club name for PDF branding */
  pdfClubName?: string;
  /** Optional: club logo URL for PDF branding */
  pdfClubLogoUrl?: string;
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

function mailtoLink(email: string | undefined, subject: string, body: string): string {
  const to = email ?? "";
  return `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

// ─── Per-player send status ───────────────────────────────────────────────────

type SendStatus = "idle" | "sending" | "sent" | "failed";

interface PlayerSendState {
  [playerId: string]: { status: SendStatus; error?: string };
}

// ─── Single player share row ──────────────────────────────────────────────────

function PlayerShareRow({
  perf,
  tournamentName,
  reportUrl,
  isDark,
  sendState,
}: {
  perf: PlayerPerformance;
  tournamentName: string;
  reportUrl: string;
  isDark: boolean;
  sendState?: { status: SendStatus; error?: string };
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

  // Server send status indicator
  const statusIcon =
    sendState?.status === "sending" ? (
      <Loader2 size={13} className="animate-spin text-blue-400" />
    ) : sendState?.status === "sent" ? (
      <CheckCircle size={13} className="text-green-500" />
    ) : sendState?.status === "failed" ? (
      <AlertCircle size={13} className="text-red-400" />
    ) : null;

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
          {statusIcon}
        </div>
        <span className={`text-[11px] ${textSub}`}>
          {perf.points}pts · {perf.wins}W {perf.draws}D {perf.losses}L · Perf {perf.performanceRating}
        </span>
        {sendState?.status === "failed" && sendState.error && (
          <span className="text-[10px] text-red-400 block truncate">{sendState.error}</span>
        )}
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
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              fontFamily: "'Clash Display', sans-serif",
            }}
          >
            ChessOTB.club
          </span>
        </div>

        {/* Tournament name */}
        <div
          style={{
            fontSize: 15,
            fontWeight: 800,
            color: "#fff",
            textAlign: "center",
            lineHeight: 1.3,
            fontFamily: "'Clash Display', sans-serif",
            maxWidth: 220,
            position: "relative",
            zIndex: 1,
          }}
        >
          {tournamentName}
        </div>

        {/* QR code */}
        <div
          style={{
            background: "#fff",
            borderRadius: 12,
            padding: 12,
            position: "relative",
            zIndex: 1,
          }}
        >
          <QRCodeSVG
            value={qrValue}
            size={180}
            bgColor="#ffffff"
            fgColor="#0a1f10"
            level="H"
            imageSettings={{
              src: OTB_LOGO_URL,
              height: 32,
              width: 32,
              excavate: true,
            }}
          />
        </div>

        {/* CTA */}
        <div style={{ textAlign: "center", position: "relative", zIndex: 1 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "#6ee7a0",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              fontFamily: "'Clash Display', sans-serif",
            }}
          >
            Scan to view results
          </div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", marginTop: 3 }}>
            View standings · Download your player card
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2 w-full max-w-xs">
        <button
          onClick={handleDownload}
          disabled={downloading}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${
            isDark ? "bg-white/10 text-white/70 hover:bg-white/15" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          {downloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
          {downloading ? "Generating…" : "Download PNG"}
        </button>
        <button
          onClick={handleCopyLink}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${
            isDark ? "bg-white/10 text-white/70 hover:bg-white/15" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          {copied ? <CheckCheck className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? "Copied!" : "Copy Link"}
        </button>
        <button
          onClick={() => setProjecting(true)}
          title="Project fullscreen"
          className={`p-2 rounded-xl transition-colors ${
            isDark ? "bg-white/10 text-white/70 hover:bg-white/15" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {!hasUrl && (
        <p className={`text-xs text-center ${textSub}`}>
          Finish the tournament to generate a permanent results link.
        </p>
      )}

      {/* Fullscreen projection overlay */}
      {projecting && (
        <div
          className="fixed inset-0 z-[99999] flex flex-col items-center justify-center"
          style={{ background: "linear-gradient(145deg, #0f2d1a 0%, #1a3d25 60%, #0d2518 100%)" }}
          onClick={() => setProjecting(false)}
        >
          <button
            onClick={() => setProjecting(false)}
            className="absolute top-6 right-6 p-2 rounded-xl bg-white/10 text-white/60 hover:bg-white/20 transition-colors"
          >
            <Minimize2 className="w-5 h-5" />
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 32 }}>
            <img src={OTB_LOGO_URL} alt="OTB!!" style={{ width: 48, height: 48, objectFit: "contain" }} />
            <span
              style={{
                fontSize: 20,
                fontWeight: 700,
                color: "rgba(255,255,255,0.7)",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                fontFamily: "'Clash Display', sans-serif",
              }}
            >
              OTBchess.club
            </span>
          </div>

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

          <div
            style={{
              background: "#fff",
              borderRadius: 24,
              padding: 28,
              boxShadow: "0 16px 80px rgba(0,0,0,0.6)",
              marginTop: 32,
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

          <div style={{ textAlign: "center", marginTop: 32 }}>
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
  tournamentId,
  reportUrl = "",
  isDark,
  onClose,
  singlePlayer,
  pdfPlayers,
  pdfRounds,
  pdfClubName,
  pdfClubLogoUrl,
}: ShareResultsModalProps) {
  const [channel, setChannel] = useState<ShareChannel>("email");
  const [copiedAll, setCopiedAll] = useState(false);

  // Server-send state
  const [smtpConfigured, setSmtpConfigured] = useState<boolean | null>(null); // null = loading
  const [sendStates, setSendStates] = useState<PlayerSendState>({});
  const [isSendingAll, setIsSendingAll] = useState(false);
  const [sendSummary, setSendSummary] = useState<{ sent: number; failed: number } | null>(null);

  const targets = useMemo(
    () => singlePlayer ? [singlePlayer] : performances,
    [singlePlayer, performances]
  );

  // Check if SMTP is configured on mount
  useEffect(() => {
    fetch("/api/email/smtp-config", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setSmtpConfigured(d.configured === true))
      .catch(() => setSmtpConfigured(false));
  }, []);

  // Copy all email messages to clipboard as a single block
  const handleCopyAll = useCallback(async () => {
    const allMessages = targets
      .map(
        (perf) =>
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

  // ── Server-side send ──────────────────────────────────────────────────────
  const handleSendViaServer = useCallback(async () => {
    if (!smtpConfigured) {
      toast.error("Configure SMTP in Director Settings → Email Settings first");
      return;
    }

    const playersWithEmail = targets.filter((p) => p.player.email);
    if (playersWithEmail.length === 0) {
      toast.error("No players have email addresses saved");
      return;
    }

    setIsSendingAll(true);
    setSendSummary(null);

    // Mark all as sending
    const initial: PlayerSendState = {};
    for (const p of playersWithEmail) {
      initial[p.player.id] = { status: "sending" };
    }
    setSendStates(initial);

    try {
      // Generate PDF buffer if player/round data is available
      let pdfBase64: string | undefined;
      if (pdfPlayers && pdfPlayers.length > 0 && pdfRounds) {
        try {
          const { generateResultsPdfBuffer } = await import("@/lib/generateResultsPdf");
          pdfBase64 = await generateResultsPdfBuffer({
            tournamentName,
            players: pdfPlayers,
            rounds: pdfRounds,
            clubName: pdfClubName,
            clubLogoUrl: pdfClubLogoUrl,
          });
        } catch (pdfErr) {
          logger.warn("[ShareResultsModal] PDF generation failed, sending without attachment:", pdfErr);
        }
      }

      const payload = {
        tournamentName,
        pdfBase64,
        players: playersWithEmail.map((perf) => ({
          name: perf.player.name,
          email: perf.player.email!,
          rank: perf.rank,
          points: perf.points,
          wdl: `${perf.wins}W / ${perf.draws}D / ${perf.losses}L`,
          reportUrl,
          cardUrl: reportUrl ? `${reportUrl}#player-${perf.player.id}` : undefined,
        })),
      };

      const tid = tournamentId ?? "unknown";
      const res = await fetch(`/api/tournament/${tid}/send-results-email`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? "Failed to send emails");
      }

      // Update per-player status
      const updated: PlayerSendState = {};
      for (const p of playersWithEmail) {
        const result = (data.results as Array<{ email: string; status: string; error?: string }>).find(
          (r) => r.email === p.player.email
        );
        updated[p.player.id] = {
          status: result?.status === "sent" ? "sent" : "failed",
          error: result?.error,
        };
      }
      setSendStates(updated);
      setSendSummary({ sent: data.sent, failed: data.failed });

      if (data.failed === 0) {
        toast.success(`✓ Sent to all ${data.sent} players`);
      } else {
        toast.warning(`Sent ${data.sent}, failed ${data.failed}`);
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Failed to send emails";
      toast.error(errMsg);
      // Mark all as failed
      const failed: PlayerSendState = {};
      for (const p of playersWithEmail) {
        failed[p.player.id] = { status: "failed", error: errMsg };
      }
      setSendStates(failed);
    } finally {
      setIsSendingAll(false);
    }
  }, [smtpConfigured, targets, tournamentName, tournamentId, reportUrl, pdfPlayers, pdfRounds, pdfClubName, pdfClubLogoUrl]);

  const bg = isDark ? "bg-[oklch(0.20_0.06_145)] border-white/10" : "bg-white border-gray-200";
  const textMain = isDark ? "text-white" : "text-gray-900";
  const textSub = isDark ? "text-white/40" : "text-gray-500";
  const divider = isDark ? "border-white/08" : "border-gray-100";

  const isQR = channel === "qr";
  const playersWithEmail = performances.filter((p) => p.player.email).length;
  const hasSendResults = Object.keys(sendStates).length > 0;

  return (
    /* Backdrop */
    <div
      className="modal-overlay z-[9999]"
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
                sendState={sendStates[perf.player.id]}
              />
            ))}
          </div>
        )}

        {/* Footer — only for Email */}
        {!isQR && (
          <div className={`px-5 py-4 border-t ${divider} flex-shrink-0 space-y-3`}>
            {/* Send summary */}
            {sendSummary && (
              <div
                className={`flex items-center gap-2 text-xs rounded-xl px-3 py-2 ${
                  sendSummary.failed === 0
                    ? isDark
                      ? "bg-green-500/10 text-green-400"
                      : "bg-green-50 text-green-700"
                    : isDark
                    ? "bg-amber-500/10 text-amber-400"
                    : "bg-amber-50 text-amber-700"
                }`}
              >
                {sendSummary.failed === 0 ? (
                  <CheckCircle size={13} />
                ) : (
                  <AlertCircle size={13} />
                )}
                {sendSummary.failed === 0
                  ? `All ${sendSummary.sent} emails sent successfully`
                  : `${sendSummary.sent} sent · ${sendSummary.failed} failed`}
              </div>
            )}

            {/* Server-side send button (primary, when SMTP configured) */}
            {!singlePlayer && smtpConfigured && (
              <button
                onClick={handleSendViaServer}
                disabled={isSendingAll || playersWithEmail === 0}
                className={`flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                  isSendingAll || playersWithEmail === 0
                    ? "opacity-50 cursor-not-allowed bg-green-600 text-white"
                    : "bg-green-600 text-white hover:bg-green-700"
                }`}
              >
                {isSendingAll ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : hasSendResults ? (
                  <CheckCircle className="w-4 h-4" />
                ) : (
                  <Server className="w-4 h-4" />
                )}
                {isSendingAll
                  ? "Sending…"
                  : hasSendResults
                  ? "Resend via Server"
                  : `Send via Server (${playersWithEmail} players)`}
              </button>
            )}

            {/* SMTP not configured hint */}
            {!singlePlayer && smtpConfigured === false && (
              <div
                className={`flex items-center gap-2 text-xs rounded-xl px-3 py-2 ${
                  isDark ? "bg-white/05 text-white/40" : "bg-gray-50 text-gray-500"
                }`}
              >
                <Settings size={12} />
                <span>
                  Configure SMTP in{" "}
                  <strong className={isDark ? "text-white/60" : "text-gray-700"}>
                    Settings → Email Settings
                  </strong>{" "}
                  to send emails directly from the platform
                </span>
              </div>
            )}

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
                className={`flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                  smtpConfigured
                    ? isDark
                      ? "bg-white/06 text-white/60 hover:bg-white/10"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    : "bg-blue-500 text-white hover:bg-blue-600"
                }`}
              >
                <Mail className="w-4 h-4" />
                {smtpConfigured ? "Email All (via your email client)" : "Email All Players"}
                <ExternalLink className="w-3.5 h-3.5 opacity-70" />
              </a>
            )}

            <div className="flex items-center justify-between gap-3">
              <p className={`text-[11px] ${textSub} flex items-center gap-1`}>
                <ChevronRight className="w-3 h-3" />
                {singlePlayer
                  ? "Click Send to open your email client"
                  : "Or click Send on each player to send individually"}
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
