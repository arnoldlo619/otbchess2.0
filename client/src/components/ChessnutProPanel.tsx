/**
 * ChessnutProPanel — Bridge dashboard panel for the Broadcast Control page.
 *
 * Shows:
 *  - Connection status badge (not_configured / waiting / connected / desync / error)
 *  - Setup steps with copy-able CLI command
 *  - Token display with copy, revoke, and regenerate controls
 *  - Live bridge log feed (last 20 entries, auto-scrolled)
 *  - Desync alert with "Sync Board" action
 *  - Manual fallback reminder when bridge is disconnected
 */

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Cpu,
  Copy,
  Check,
  RefreshCw,
  ShieldOff,
  ShieldCheck,
  Wifi,
  WifiOff,
  AlertTriangle,
  Terminal,
  ChevronDown,
  ChevronUp,
  Circle,
} from "lucide-react";

interface BridgeLog {
  ts: number;
  level: "info" | "warn" | "error";
  msg: string;
}

interface ChessnutProPanelProps {
  broadcastId: string;
  bridgeToken: string | null | undefined;
  bridgeStatus: string;
  bridgeDeviceName?: string | null;
  bridgeLastSeenAt?: string | null;
  bridgeErrorMessage?: string | null;
  serverUrl?: string;
  onTokenRegenerated?: (newToken: string) => void;
  onDesyncDetected?: (serverFen: string) => void;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode; pulse: boolean }> = {
  not_configured: {
    label: "Not Configured",
    color: "text-white/40 border-white/10 bg-white/5",
    icon: <WifiOff className="w-3.5 h-3.5" />,
    pulse: false,
  },
  waiting: {
    label: "Waiting for Bridge",
    color: "text-amber-400 border-amber-400/30 bg-amber-400/10",
    icon: <Circle className="w-3.5 h-3.5 animate-pulse" />,
    pulse: true,
  },
  connected: {
    label: "Bridge Connected",
    color: "text-[#4CAF50] border-[#4CAF50]/30 bg-[#4CAF50]/10",
    icon: <Wifi className="w-3.5 h-3.5" />,
    pulse: false,
  },
  desync: {
    label: "Position Desync",
    color: "text-red-400 border-red-400/30 bg-red-400/10",
    icon: <AlertTriangle className="w-3.5 h-3.5" />,
    pulse: true,
  },
  error: {
    label: "Bridge Error",
    color: "text-red-400 border-red-400/30 bg-red-400/10",
    icon: <AlertTriangle className="w-3.5 h-3.5" />,
    pulse: false,
  },
};

export function ChessnutProPanel({
  broadcastId,
  bridgeToken,
  bridgeStatus,
  bridgeDeviceName,
  bridgeLastSeenAt,
  bridgeErrorMessage,
  serverUrl = window.location.origin,
  onTokenRegenerated,
  onDesyncDetected,
}: ChessnutProPanelProps) {
  const [logs, setLogs] = useState<BridgeLog[]>([]);
  const [logsExpanded, setLogsExpanded] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [revoking, setRevoking] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [showConfirmRevoke, setShowConfirmRevoke] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchLogs = useCallback(async () => {
    try {
      const res = await fetch(`/api/broadcasts/${broadcastId}/bridge-logs`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.slice(-20));
      }
    } catch { /* ignore */ }
  }, [broadcastId]);

  useEffect(() => {
    fetchLogs();
    pollRef.current = setInterval(fetchLogs, 5000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [fetchLogs]);

  // Auto-scroll logs
  useEffect(() => {
    if (logsExpanded) logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs, logsExpanded]);

  const copyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  const handleRevoke = async () => {
    setRevoking(true);
    try {
      await fetch(`/api/broadcasts/${broadcastId}/token-revoke`, { method: "POST" });
      setShowConfirmRevoke(false);
    } catch { /* ignore */ } finally {
      setRevoking(false);
    }
  };

  const handleRegenerate = async () => {
    setRegenerating(true);
    try {
      const res = await fetch(`/api/broadcasts/${broadcastId}/token-regenerate`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        onTokenRegenerated?.(data.token);
      }
    } catch { /* ignore */ } finally {
      setRegenerating(false);
    }
  };

  const statusCfg = STATUS_CONFIG[bridgeStatus] ?? STATUS_CONFIG.not_configured;

  const cliCommand = bridgeToken
    ? `node bridge.mjs --broadcast-id ${broadcastId} --token ${bridgeToken} --server ${serverUrl}`
    : "";

  const lastSeenText = bridgeLastSeenAt
    ? (() => {
        const diff = Math.floor((Date.now() - new Date(bridgeLastSeenAt).getTime()) / 1000);
        if (diff < 60) return `${diff}s ago`;
        if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
        return `${Math.floor(diff / 3600)}h ago`;
      })()
    : null;

  return (
    <div className="rounded-xl border border-white/10 bg-[#0a1a0a] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Cpu className="w-4 h-4 text-[#4CAF50]" />
          <span className="text-sm font-semibold text-white">Chessnut Pro Bridge</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#4CAF50]/10 text-[#4CAF50] border border-[#4CAF50]/20 font-mono">BETA</span>
        </div>
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium ${statusCfg.color}`}>
          {statusCfg.icon}
          {statusCfg.label}
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Device info when connected */}
        {bridgeStatus === "connected" && (
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-white/60">
              <ShieldCheck className="w-3.5 h-3.5 text-[#4CAF50]" />
              <span>{bridgeDeviceName ?? "Chessnut Pro"}</span>
            </div>
            {lastSeenText && (
              <span className="text-white/40">Last seen {lastSeenText}</span>
            )}
          </div>
        )}

        {/* Desync alert */}
        {bridgeStatus === "desync" && (
          <div className="rounded-lg border border-red-400/30 bg-red-400/5 p-3 space-y-2">
            <div className="flex items-center gap-2 text-red-400 text-xs font-semibold">
              <AlertTriangle className="w-3.5 h-3.5" />
              Position Desync Detected
            </div>
            <p className="text-xs text-white/50">
              The bridge board position differs from the server. Use FEN Correction in the operator panel to resync, or physically reset the board to match the server position.
            </p>
          </div>
        )}

        {/* Error message */}
        {bridgeErrorMessage && bridgeStatus === "error" && (
          <div className="rounded-lg border border-red-400/20 bg-red-400/5 p-3">
            <p className="text-xs text-red-300 font-mono">{bridgeErrorMessage}</p>
          </div>
        )}

        {/* Token section */}
        {bridgeToken ? (
          <div className="space-y-2">
            <div className="text-xs text-white/40 font-medium uppercase tracking-wider">Bridge Token</div>
            <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/30 px-3 py-2">
              <code className="text-[11px] text-[#4CAF50] font-mono flex-1 truncate">{bridgeToken}</code>
              <button
                onClick={() => copyText(bridgeToken, "token")}
                className="p-1 rounded hover:bg-white/10 text-white/40 hover:text-white transition-colors"
                title="Copy token"
              >
                {copied === "token" ? <Check className="w-3.5 h-3.5 text-[#4CAF50]" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>

            {/* Token actions */}
            <div className="flex gap-2">
              <button
                onClick={handleRegenerate}
                disabled={regenerating}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border border-white/10 text-white/50 hover:text-white hover:border-white/20 hover:bg-white/5 transition-all disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${regenerating ? "animate-spin" : ""}`} />
                Regenerate
              </button>
              {!showConfirmRevoke ? (
                <button
                  onClick={() => setShowConfirmRevoke(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border border-red-400/20 text-red-400/60 hover:text-red-400 hover:border-red-400/40 hover:bg-red-400/5 transition-all"
                >
                  <ShieldOff className="w-3 h-3" />
                  Revoke
                </button>
              ) : (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-red-400">Confirm revoke?</span>
                  <button
                    onClick={handleRevoke}
                    disabled={revoking}
                    className="px-2 py-1 rounded text-xs bg-red-500/20 border border-red-400/30 text-red-400 hover:bg-red-500/30 transition-all disabled:opacity-50"
                  >
                    {revoking ? "..." : "Yes"}
                  </button>
                  <button
                    onClick={() => setShowConfirmRevoke(false)}
                    className="px-2 py-1 rounded text-xs border border-white/10 text-white/40 hover:bg-white/5 transition-all"
                  >
                    No
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="text-xs text-white/40 text-center py-2">
            No bridge token — create a broadcast to generate one.
          </div>
        )}

        {/* CLI command */}
        {cliCommand && (
          <div className="space-y-2">
            <div className="text-xs text-white/40 font-medium uppercase tracking-wider">CLI Command</div>
            <div className="relative rounded-lg border border-white/10 bg-black/40 p-3">
              <pre className="text-[10px] text-white/60 font-mono whitespace-pre-wrap break-all pr-6">{cliCommand}</pre>
              <button
                onClick={() => copyText(cliCommand, "cmd")}
                className="absolute top-2 right-2 p-1 rounded hover:bg-white/10 text-white/30 hover:text-white transition-colors"
                title="Copy command"
              >
                {copied === "cmd" ? <Check className="w-3 h-3 text-[#4CAF50]" /> : <Copy className="w-3 h-3" />}
              </button>
            </div>
            <p className="text-[10px] text-white/30">
              Run from the <code className="text-white/50">chessnut-bridge/</code> directory after{" "}
              <code className="text-white/50">npm install</code>
            </p>
          </div>
        )}

        {/* Setup steps (collapsed when connected) */}
        {bridgeStatus === "not_configured" && (
          <div className="space-y-2">
            <div className="text-xs text-white/40 font-medium uppercase tracking-wider">Setup Steps</div>
            <ol className="space-y-1.5">
              {[
                "Download chessnut-bridge/ from the project",
                "Run npm install in that directory",
                "Copy the CLI command above",
                "Run it on the machine with Bluetooth",
                "Place pieces in starting position on the board",
              ].map((step, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-white/50">
                  <span className="flex-shrink-0 w-4 h-4 rounded-full bg-[#4CAF50]/10 border border-[#4CAF50]/20 text-[#4CAF50] text-[10px] flex items-center justify-center font-mono">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* Manual fallback reminder when disconnected mid-game */}
        {(bridgeStatus === "error" || (bridgeStatus === "waiting" && bridgeLastSeenAt)) && (
          <div className="rounded-lg border border-amber-400/20 bg-amber-400/5 p-3 text-xs text-amber-300/70">
            <span className="font-semibold text-amber-300">Manual fallback active.</span> Use the board panel to enter moves manually until the bridge reconnects.
          </div>
        )}

        {/* Bridge logs */}
        <div className="space-y-1">
          <button
            onClick={() => setLogsExpanded(v => !v)}
            className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/60 transition-colors w-full"
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Bridge Logs ({logs.length})</span>
            {logsExpanded ? <ChevronUp className="w-3 h-3 ml-auto" /> : <ChevronDown className="w-3 h-3 ml-auto" />}
          </button>

          {logsExpanded && (
            <div className="rounded-lg border border-white/10 bg-black/50 p-2 max-h-40 overflow-y-auto font-mono text-[10px] space-y-0.5">
              {logs.length === 0 ? (
                <div className="text-white/20 text-center py-2">No logs yet</div>
              ) : (
                logs.map((log, i) => (
                  <div
                    key={i}
                    className={`flex gap-2 ${
                      log.level === "error" ? "text-red-400" :
                      log.level === "warn" ? "text-amber-400" :
                      "text-white/50"
                    }`}
                  >
                    <span className="text-white/20 flex-shrink-0">
                      {new Date(log.ts).toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                    </span>
                    <span className={`flex-shrink-0 uppercase w-8 ${
                      log.level === "error" ? "text-red-400" :
                      log.level === "warn" ? "text-amber-400" :
                      "text-[#4CAF50]/60"
                    }`}>{log.level}</span>
                    <span className="flex-1">{log.msg}</span>
                  </div>
                ))
              )}
              <div ref={logsEndRef} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
