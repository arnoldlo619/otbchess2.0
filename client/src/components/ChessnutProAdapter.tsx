/**
 * OTB Chess — Chessnut Pro Beta Adapter
 *
 * Scaffold for the Chessnut Air / Pro e-board Web Bluetooth adapter.
 * When the real Chessnut SDK is available, replace the stub functions
 * with actual BLE characteristic reads.
 *
 * Architecture:
 *  1. User clicks "Connect Chessnut" → Web Bluetooth device picker
 *  2. On connect, we poll the board FEN every ~500 ms
 *  3. When a new legal move is detected, we call onMove(san)
 *  4. Director can toggle the input source between Manual and Chessnut
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { Cpu, Bluetooth, BluetoothOff, BluetoothSearching, AlertCircle, CheckCircle2 } from "lucide-react";

export type InputSource = "manual" | "chessnut";

export interface ChessnutAdapterProps {
  /** Called when the e-board detects a new move (SAN string) */
  onMove: (san: string) => void;
  /** Current FEN from the app — used to detect divergence */
  currentFen: string;
  /** Whether the board is currently accepting moves */
  active: boolean;
  isDark?: boolean;
}

type ConnectionState = "disconnected" | "connecting" | "connected" | "error";

// ─── Stub: replace with real Chessnut BLE SDK calls ──────────────────────────
async function requestChessnutDevice(): Promise<unknown | null> {
  if (!("bluetooth" in navigator)) return null;
  try {
    // Chessnut Air/Pro advertise under the "Chessnut" name prefix
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const device = await (navigator as any).bluetooth.requestDevice({
      filters: [{ namePrefix: "Chessnut" }, { namePrefix: "CHESSNUT" }],
      optionalServices: [
        "6e400001-b5a3-f393-e0a9-e50e24dcca9e", // Nordic UART service (Chessnut uses this)
      ],
    });
    return device as unknown;
  } catch {
    return null;
  }
}

// Stub: in production, parse the BLE characteristic data into a FEN string
function parseChessnutFen(_rawData: DataView): string {
  // TODO: implement Chessnut BLE protocol parsing
  // The Chessnut Air/Pro sends board state as a 32-byte piece map
  // For now, return starting position as a safe stub
  return "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
}

// ─── Component ────────────────────────────────────────────────────────────────
export function ChessnutProAdapter({ onMove: _onMove, currentFen: _currentFen, active, isDark = true }: ChessnutAdapterProps) {
  const [connectionState, setConnectionState] = useState<ConnectionState>("disconnected");
  const [deviceName, setDeviceName] = useState<string | null>(null);
  const [lastFen, setLastFen] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const deviceRef = useRef<any>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isSupported = "bluetooth" in navigator;

  const stopPolling = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }, []);

  const disconnect = useCallback(() => {
    stopPolling();
    if (deviceRef.current?.gatt?.connected) {
      deviceRef.current.gatt.disconnect();
    }
    deviceRef.current = null;
    setConnectionState("disconnected");
    setDeviceName(null);
    setLastFen(null);
    setError(null);
  }, [stopPolling]);

  const connect = useCallback(async () => {
    if (!isSupported) {
      setError("Web Bluetooth is not supported in this browser. Use Chrome or Edge.");
      return;
    }
    setConnectionState("connecting");
    setError(null);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const device: any = await requestChessnutDevice();
    if (!device) {
      setConnectionState("error");
      setError("No Chessnut device selected or connection cancelled.");
      return;
    }

    try {
      const server = await device.gatt!.connect();
      deviceRef.current = device;
      setDeviceName(device.name ?? "Chessnut Board");
      setConnectionState("connected");

      // Listen for disconnect
      device.addEventListener("gattserverdisconnected", () => {
        stopPolling();
        setConnectionState("disconnected");
        setDeviceName(null);
      });

      // Poll board state every 500 ms
      // TODO: replace with characteristic notifications once Chessnut SDK is available
      pollRef.current = setInterval(async () => {
        if (!server.connected) { stopPolling(); return; }
        try {
          const service = await server.getPrimaryService("6e400001-b5a3-f393-e0a9-e50e24dcca9e");
          const char = await service.getCharacteristic("6e400003-b5a3-f393-e0a9-e50e24dcca9e");
          const value = await char.readValue();
          const fen = parseChessnutFen(value);
          setLastFen(fen);
          // TODO: diff fen vs currentFen to detect new moves and call onMove(san)
        } catch {
          // Characteristic not readable yet — skip this tick
        }
      }, 500);
    } catch (err) {
      setConnectionState("error");
      setError(`Connection failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  }, [isSupported, stopPolling]);

  // Cleanup on unmount
  useEffect(() => () => { stopPolling(); deviceRef.current?.gatt?.disconnect(); }, [stopPolling]);

  if (!active) return null;

  return (
    <div className={`rounded-xl border p-4 space-y-3 ${
      isDark ? "bg-[oklch(0.18_0.05_145)] border-white/10" : "bg-[#FFF3D5]/70 border-[#E8D9B0]"
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Cpu className={`w-4 h-4 ${isDark ? "text-[#4CAF50]" : "text-[#4D6940]"}`} />
          <span className={`text-sm font-bold ${isDark ? "text-white" : "text-[#1A1A1A]"}`}>
            Chessnut Pro (Beta)
          </span>
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${
            isDark ? "bg-amber-500/10 text-amber-400 border-amber-500/20" : "bg-amber-50 text-amber-600 border-amber-200"
          }`}>BETA</span>
        </div>
        <ConnectionBadge state={connectionState} isDark={isDark} />
      </div>

      {/* Status / controls */}
      {connectionState === "disconnected" && (
        <div className="space-y-2">
          <p className={`text-xs ${isDark ? "text-white/50" : "text-[#6B6B50]"}`}>
            Connect your Chessnut Air or Pro e-board via Bluetooth to automatically input moves.
          </p>
          {!isSupported && (
            <div className={`flex items-center gap-2 text-xs rounded-lg px-3 py-2 ${
              isDark ? "bg-amber-500/10 text-amber-400" : "bg-amber-50 text-amber-700"
            }`}>
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
              Web Bluetooth requires Chrome or Edge on desktop.
            </div>
          )}
          <button
            onClick={connect}
            disabled={!isSupported}
            className={`w-full flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-all ${
              isSupported
                ? isDark
                  ? "bg-blue-500/15 border border-blue-500/30 text-blue-400 hover:bg-blue-500/25"
                  : "bg-blue-50 border border-blue-200 text-blue-600 hover:bg-blue-100"
                : "opacity-40 cursor-not-allowed bg-gray-500/10 border border-gray-500/20 text-[#6B6B50]"
            }`}
          >
            <BluetoothSearching className="w-4 h-4" />
            Connect Chessnut Board
          </button>
        </div>
      )}

      {connectionState === "connecting" && (
        <div className={`flex items-center gap-2 text-sm ${isDark ? "text-white/60" : "text-[#6B6B50]"}`}>
          <BluetoothSearching className="w-4 h-4 animate-pulse text-blue-400" />
          Searching for Chessnut device...
        </div>
      )}

      {connectionState === "connected" && (
        <div className="space-y-2">
          <div className={`flex items-center gap-2 text-sm ${isDark ? "text-emerald-400" : "text-emerald-600"}`}>
            <CheckCircle2 className="w-4 h-4" />
            <span className="font-medium">{deviceName}</span>
          </div>
          {lastFen && (
            <div className={`text-[10px] font-mono px-2 py-1 rounded ${isDark ? "bg-white/05 text-white/30" : "bg-[#E8D9B0]/40 text-[#6B6B50]"}`}>
              {lastFen.split(" ")[0]}
            </div>
          )}
          <div className={`flex items-center gap-2 text-xs rounded-lg px-3 py-2 ${
            isDark ? "bg-amber-500/10 text-amber-400" : "bg-amber-50 text-amber-700"
          }`}>
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
            Move detection is a beta stub — auto-input not yet active.
          </div>
          <button
            onClick={disconnect}
            className={`w-full flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-all ${
              isDark
                ? "bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20"
                : "bg-red-50 border border-red-200 text-red-600 hover:bg-red-100"
            }`}
          >
            <BluetoothOff className="w-4 h-4" />
            Disconnect
          </button>
        </div>
      )}

      {connectionState === "error" && (
        <div className="space-y-2">
          <div className={`flex items-start gap-2 text-xs rounded-lg px-3 py-2 ${
            isDark ? "bg-red-500/10 text-red-400" : "bg-red-50 text-red-600"
          }`}>
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            {error}
          </div>
          <button
            onClick={() => { setConnectionState("disconnected"); setError(null); }}
            className={`w-full py-2 rounded-lg text-sm font-semibold transition-all ${
              isDark
                ? "bg-white/06 border border-white/10 text-white/60 hover:bg-white/10"
                : "bg-[#E8D9B0]/40 border border-[#E8D9B0] text-[#6B6B50] hover:bg-[#E8D9B0]"
            }`}
          >
            Try Again
          </button>
        </div>
      )}
    </div>
  );
}

function ConnectionBadge({ state, isDark }: { state: ConnectionState; isDark: boolean }) {
  const map: Record<ConnectionState, { icon: React.ReactNode; label: string; cls: string }> = {
    disconnected: {
      icon: <BluetoothOff className="w-3 h-3" />,
      label: "Disconnected",
      cls: isDark ? "bg-white/06 text-white/30 border-white/10" : "bg-[#E8D9B0]/40 text-[#6B6B50] border-[#E8D9B0]",
    },
    connecting: {
      icon: <BluetoothSearching className="w-3 h-3 animate-pulse" />,
      label: "Connecting...",
      cls: isDark ? "bg-blue-500/15 text-blue-400 border-blue-500/25" : "bg-blue-50 text-blue-500 border-blue-200",
    },
    connected: {
      icon: <Bluetooth className="w-3 h-3" />,
      label: "Connected",
      cls: isDark ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/25" : "bg-emerald-50 text-emerald-600 border-emerald-200",
    },
    error: {
      icon: <AlertCircle className="w-3 h-3" />,
      label: "Error",
      cls: isDark ? "bg-red-500/15 text-red-400 border-red-500/25" : "bg-red-50 text-red-600 border-red-200",
    },
  };
  const { icon, label, cls } = map[state];
  return (
    <span className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${cls}`}>
      {icon}
      {label}
    </span>
  );
}

// ─── Input Source Selector ────────────────────────────────────────────────────
export function InputSourceSelector({
  source,
  onChange,
  isDark = true,
}: {
  source: InputSource;
  onChange: (s: InputSource) => void;
  isDark?: boolean;
}) {
  return (
    <div className={`flex rounded-lg border overflow-hidden text-xs font-bold ${
      isDark ? "border-white/10 bg-white/04" : "border-[#E8D9B0] bg-[#FFF3D5]/70"
    }`}>
      {(["manual", "chessnut"] as InputSource[]).map((s) => (
        <button
          key={s}
          onClick={() => onChange(s)}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 transition-all ${
            source === s
              ? isDark
                ? "bg-[#4CAF50]/20 text-[#4CAF50]"
                : "bg-[#4D6940]/10 text-[#4D6940]"
              : isDark
              ? "text-white/40 hover:text-white/60"
              : "text-[#6B6B50] hover:text-[#6B6B50]"
          }`}
        >
          {s === "manual" ? <Cpu className="w-3 h-3" /> : <Bluetooth className="w-3 h-3" />}
          {s === "manual" ? "Manual" : "Chessnut"}
        </button>
      ))}
    </div>
  );
}
