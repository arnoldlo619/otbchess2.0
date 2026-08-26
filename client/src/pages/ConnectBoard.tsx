/**
 * ConnectBoard — Guided Chessnut Pro Connection Wizard
 * =====================================================
 * A clean, 3-step wizard that walks tournament directors through
 * connecting their Chessnut Pro board to a live broadcast.
 *
 * Step 1: Power On  — visual guide to power on the board
 * Step 2: Pair      — prompt to enable BLE / make discoverable
 * Step 3: Connect   — one-click Chrome Web Bluetooth connect
 * Done:   Sync      — confirm board is synced and redirect to console
 */
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useParams, useLocation } from "wouter";
import {
  Bluetooth, CheckCircle2, ChevronRight, ArrowLeft,
  Wifi, Zap, Monitor, AlertTriangle, RefreshCw, ExternalLink
} from "lucide-react";
import { ChessnutWebBluetoothAdapter } from "@/lib/ChessnutWebBluetoothAdapter";

// ─── Types ────────────────────────────────────────────────────────────────────
type WizardStep = "power-on" | "pair" | "connect" | "done" | "error";

interface BoardInfo {
  boardNumber: number;
  broadcastId: string;
  whitePlayer: string;
  blackPlayer: string;
  tournamentName: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function isBleSupported(): boolean {
  return typeof navigator !== "undefined" && "bluetooth" in navigator;
}

// ─── Step Indicator ───────────────────────────────────────────────────────────
function StepDot({ n, current, done }: { n: number; current: number; done: boolean }) {
  const active = n === current;
  const completed = done || n < current;
  return (
    <div className="flex items-center gap-2">
      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
        completed ? "bg-[#4CAF50] text-white" :
        active    ? "bg-[#4CAF50]/20 border-2 border-[#4CAF50] text-[#4CAF50]" :
                    "bg-white/5 border border-white/15 text-white/30"
      }`}>
        {completed ? <CheckCircle2 className="w-4 h-4" /> : n}
      </div>
      {n < 3 && <div className={`h-px w-8 ${n < current ? "bg-[#4CAF50]" : "bg-white/10"}`} />}
    </div>
  );
}

// ─── Board Illustration ───────────────────────────────────────────────────────
function BoardIllustration({ glowing }: { glowing?: boolean }) {
  return (
    <div className={`relative mx-auto w-48 h-48 rounded-2xl border-2 transition-all duration-700 ${
      glowing ? "border-[#4CAF50] shadow-[0_0_40px_rgba(76,175,80,0.4)]" : "border-white/15"
    } bg-gradient-to-br from-[oklch(0.18_0.05_145)] to-[oklch(0.12_0.03_145)] flex items-center justify-center`}>
      {/* Mini chess board grid */}
      <div className="grid grid-cols-4 grid-rows-4 gap-0.5 w-28 h-28">
        {Array.from({ length: 16 }).map((_, i) => (
          <div key={i} className={`rounded-sm ${
            (Math.floor(i / 4) + (i % 4)) % 2 === 0
              ? "bg-[oklch(0.85_0.02_80)]"
              : "bg-[oklch(0.55_0.04_80)]"
          }`} />
        ))}
      </div>
      {/* Bluetooth badge */}
      {glowing && (
        <div className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-[#4CAF50] flex items-center justify-center shadow-lg animate-bounce">
          <Bluetooth className="w-4 h-4 text-white" />
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ConnectBoard() {
  const { id: tournamentId } = useParams<{ id: string }>();
  const [, navigate] = useLocation();

  // Parse query params for board context
  const params = new URLSearchParams(window.location.search);
  const boardNumber = parseInt(params.get("board") ?? "1", 10);
  const broadcastId = params.get("broadcastId") ?? "";
  const whitePlayer = params.get("white") ?? "White";
  const blackPlayer = params.get("black") ?? "Black";
  const tournamentName = params.get("name") ?? "Tournament";

  const boardInfo = useMemo<BoardInfo>(
    () => ({ boardNumber, broadcastId, whitePlayer, blackPlayer, tournamentName }),
    [boardNumber, broadcastId, whitePlayer, blackPlayer, tournamentName],
  );

  const [step, setStep] = useState<WizardStep>("power-on");
  const [connecting, setConnecting] = useState(false);
  const [deviceName, setDeviceName] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const adapterRef = useRef<ChessnutWebBluetoothAdapter | null>(null);

  // ── On mount: check if board is already connected → skip wizard ──────────────
  useEffect(() => {
    if (!tournamentId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/broadcasts/tournament/${tournamentId}`, { credentials: "include" });
        if (!res.ok || cancelled) return;
        const broadcasts: Array<{ id: string; boardNumber: number; bridgeStatus: string; bridgeLastSeenAt: string | null }> = await res.json();
        const bc = broadcasts.find((b) => b.boardNumber === boardNumber);
        if (!bc || cancelled) return;
        const recentlySeen = bc.bridgeLastSeenAt
          ? Date.now() - new Date(bc.bridgeLastSeenAt).getTime() < 2 * 60 * 1000
          : false;
        if (bc.bridgeStatus === "connected" && recentlySeen) {
          // Already connected — skip wizard and go straight to console
          const qs = new URLSearchParams();
          if (whitePlayer !== "White") qs.set("white", whitePlayer);
          if (blackPlayer !== "Black") qs.set("black", blackPlayer);
          if (tournamentName !== "Tournament") qs.set("name", tournamentName);
          qs.set("broadcastId", bc.id);
          if (boardNumber === 1) {
            navigate(`/tournament/${tournamentId}/broadcast-console?${qs.toString()}`);
          } else {
            navigate(`/tournament/${tournamentId}/broadcast/${boardNumber}?${qs.toString()}`);
          }
        }
      } catch { /* ignore — proceed with wizard */ }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => { adapterRef.current?.disconnect(); };
  }, []);

  // ── Connect handler ──────────────────────────────────────────────────────────
  const handleConnect = useCallback(async () => {
    if (!isBleSupported()) {
      setErrorMsg("Chrome Web Bluetooth is not supported in this browser. Please use Chrome or Edge on desktop.");
      setStep("error");
      return;
    }
    setConnecting(true);
    setErrorMsg(null);
    try {
      // Create adapter
      const adapter = new ChessnutWebBluetoothAdapter(broadcastId, "", false);
      adapterRef.current = adapter;

      // Subscribe to status changes
      adapter.onStatusChange((state) => {
        if (state.status === "connected") {
          setDeviceName(state.deviceName ?? "Chessnut Pro");
          setConnecting(false);
          setStep("done");
          // Persist the source selection server-side
          if (broadcastId) {
            fetch(`/api/broadcasts/${broadcastId}/input-source`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ inputSource: "chessnut_chrome_bluetooth" }),
            }).catch(() => {});
          }
        } else if (state.status === "disconnected" && connecting) {
          setConnecting(false);
          setErrorMsg("Connection lost. Please try again.");
        }
      });

      // Trigger BLE device picker → GATT connect
      const ok = await adapter.connect();
      if (!ok) {
        setConnecting(false);
        setErrorMsg("Could not connect to the board. Make sure it is powered on and in pairing mode.");
      }
    } catch (err: unknown) {
      setConnecting(false);
      const msg = err instanceof Error ? err.message : "Unknown error";
      if (msg.includes("cancelled") || msg.includes("user cancelled")) {
        setErrorMsg("Device picker was cancelled. Click 'Connect Board' to try again.");
      } else {
        setErrorMsg(msg);
      }
    }
  }, [broadcastId, connecting]);

  // ── Navigate to console after done ──────────────────────────────────────────
  const goToConsole = useCallback(() => {
    const qs = new URLSearchParams();
    if (boardInfo.whitePlayer) qs.set("white", boardInfo.whitePlayer);
    if (boardInfo.blackPlayer) qs.set("black", boardInfo.blackPlayer);
    if (boardInfo.tournamentName) qs.set("name", boardInfo.tournamentName);
    if (broadcastId) qs.set("broadcastId", broadcastId);
    navigate(`/tournament/${tournamentId}/broadcast-console?${qs.toString()}`);
  }, [tournamentId, boardInfo, broadcastId, navigate]);

  // ─── Render ──────────────────────────────────────────────────────────────────
  const stepNum = step === "power-on" ? 1 : step === "pair" ? 2 : step === "connect" || step === "error" ? 3 : 3;

  return (
    <div className="min-h-screen bg-[oklch(0.10_0.03_145)] flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/8">
        <button
          onClick={() => navigate(`/tournament/${tournamentId}/manage`)}
          className="flex items-center gap-2 text-white/50 hover:text-white/80 text-sm transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Director
        </button>
        <div className="text-xs text-white/30 font-medium uppercase tracking-wider">
          Board {boardNumber} — Connect Chessnut Pro
        </div>
        <div className="w-24" /> {/* spacer */}
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-md space-y-8">

          {/* Header */}
          <div className="text-center space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#4CAF50]/10 border border-[#4CAF50]/20 text-[#4CAF50] text-xs font-medium mb-3">
              <Bluetooth className="w-3.5 h-3.5" />
              Chessnut Pro Setup
            </div>
            <h1 className="text-2xl font-bold text-white">Connect Your Board</h1>
            <p className="text-white/50 text-sm">
              {boardInfo.whitePlayer} vs {boardInfo.blackPlayer} · Board {boardNumber}
            </p>
          </div>

          {/* Step indicator */}
          <div className="flex items-center justify-center gap-0">
            <StepDot n={1} current={stepNum} done={stepNum > 1} />
            <StepDot n={2} current={stepNum} done={stepNum > 2} />
            <StepDot n={3} current={stepNum} done={step === "done"} />
          </div>

          {/* ── STEP 1: Power On ──────────────────────────────────────────────── */}
          {step === "power-on" && (
            <div className="rounded-2xl border border-white/8 bg-[oklch(0.14_0.04_145)] p-8 space-y-6">
              <div className="text-center space-y-2">
                <div className="w-12 h-12 rounded-full bg-[#4CAF50]/15 border border-[#4CAF50]/30 flex items-center justify-center mx-auto">
                  <Zap className="w-6 h-6 text-[#4CAF50]" />
                </div>
                <h2 className="text-lg font-bold text-white">Step 1: Power On the Board</h2>
                <p className="text-white/50 text-sm">Press and hold the power button on your Chessnut Pro until the LED lights up.</p>
              </div>
              <BoardIllustration />
              <div className="bg-[#4CAF50]/8 border border-[#4CAF50]/20 rounded-xl p-4 space-y-2">
                <p className="text-[#4CAF50] text-xs font-semibold uppercase tracking-wider">What to look for</p>
                <ul className="text-white/60 text-sm space-y-1.5">
                  <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-[#4CAF50] shrink-0 mt-0.5" /> LED ring on the board glows green or white</li>
                  <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-[#4CAF50] shrink-0 mt-0.5" /> Board pieces are recognized (LEDs may flash briefly)</li>
                  <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-[#4CAF50] shrink-0 mt-0.5" /> Board is within 3 feet of this computer</li>
                </ul>
              </div>
              <button
                onClick={() => setStep("pair")}
                className="w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-[#4CAF50] hover:bg-[#45a049] text-white font-semibold text-sm transition-colors"
              >
                Board is on — Next <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* ── STEP 2: Make Discoverable ─────────────────────────────────────── */}
          {step === "pair" && (
            <div className="rounded-2xl border border-white/8 bg-[oklch(0.14_0.04_145)] p-8 space-y-6">
              <div className="text-center space-y-2">
                <div className="w-12 h-12 rounded-full bg-blue-500/15 border border-blue-500/30 flex items-center justify-center mx-auto">
                  <Wifi className="w-6 h-6 text-blue-400" />
                </div>
                <h2 className="text-lg font-bold text-white">Step 2: Enable Bluetooth Pairing</h2>
                <p className="text-white/50 text-sm">Put the board into pairing mode so your computer can discover it.</p>
              </div>
              <BoardIllustration glowing />
              <div className="bg-blue-500/8 border border-blue-500/20 rounded-xl p-4 space-y-3">
                <p className="text-blue-400 text-xs font-semibold uppercase tracking-wider">How to enable pairing mode</p>
                <ol className="text-white/60 text-sm space-y-2 list-none">
                  <li className="flex items-start gap-3">
                    <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">1</span>
                    On the board, press the <span className="text-white font-medium">Bluetooth button</span> (or hold the power button for 3 seconds)
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">2</span>
                    The LED should blink blue rapidly — this means it is discoverable
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">3</span>
                    Make sure Bluetooth is enabled on this computer
                  </li>
                </ol>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setStep("power-on")}
                  className="flex-1 px-4 py-3 rounded-xl border border-white/10 text-white/50 text-sm hover:bg-white/5 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={() => setStep("connect")}
                  className="flex-[2] flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition-colors"
                >
                  LED is blinking — Next <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 3: Connect ───────────────────────────────────────────────── */}
          {(step === "connect" || step === "error") && (
            <div className="rounded-2xl border border-white/8 bg-[oklch(0.14_0.04_145)] p-8 space-y-6">
              <div className="text-center space-y-2">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto transition-all ${
                  step === "error" ? "bg-red-500/15 border border-red-500/30" : "bg-purple-500/15 border border-purple-500/30"
                }`}>
                  <Bluetooth className={`w-6 h-6 ${step === "error" ? "text-red-400" : "text-purple-400"}`} />
                </div>
                <h2 className="text-lg font-bold text-white">Step 3: Connect the Board</h2>
                <p className="text-white/50 text-sm">
                  Click the button below. A device picker will appear — select your Chessnut Pro from the list.
                </p>
              </div>

              {/* Browser support warning */}
              {!isBleSupported() && (
                <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
                  <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-amber-300 text-sm font-medium">Chrome or Edge required</p>
                    <p className="text-amber-400/70 text-xs mt-1">Web Bluetooth is only supported in Chrome and Edge on desktop. Please switch browsers to use this feature.</p>
                  </div>
                </div>
              )}

              {/* Error message */}
              {step === "error" && errorMsg && (
                <div className="flex items-start gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20">
                  <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-red-300 text-sm font-medium">Connection failed</p>
                    <p className="text-red-400/70 text-xs mt-1">{errorMsg}</p>
                  </div>
                </div>
              )}

              <div className="bg-white/4 border border-white/8 rounded-xl p-4 space-y-2">
                <p className="text-white/40 text-xs font-semibold uppercase tracking-wider">What will happen</p>
                <ol className="text-white/55 text-sm space-y-1.5 list-none">
                  <li className="flex items-start gap-2"><span className="text-[#4CAF50] font-bold shrink-0">1.</span> Chrome will open a device picker popup</li>
                  <li className="flex items-start gap-2"><span className="text-[#4CAF50] font-bold shrink-0">2.</span> Select <span className="text-white font-medium">"Chessnut Pro"</span> (or similar) from the list</li>
                  <li className="flex items-start gap-2"><span className="text-[#4CAF50] font-bold shrink-0">3.</span> Click <span className="text-white font-medium">Pair</span> — the board will connect automatically</li>
                </ol>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => { setStep("pair"); setErrorMsg(null); }}
                  className="flex-1 px-4 py-3 rounded-xl border border-white/10 text-white/50 text-sm hover:bg-white/5 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleConnect}
                  disabled={connecting || !isBleSupported()}
                  className={`flex-[2] flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-semibold text-sm transition-all ${
                    connecting
                      ? "bg-purple-600/50 text-purple-300 cursor-not-allowed"
                      : step === "error"
                      ? "bg-amber-600 hover:bg-amber-500 text-white"
                      : "bg-purple-600 hover:bg-purple-500 text-white"
                  }`}
                >
                  {connecting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Connecting…
                    </>
                  ) : step === "error" ? (
                    <>
                      <RefreshCw className="w-4 h-4" />
                      Try Again
                    </>
                  ) : (
                    <>
                      <Bluetooth className="w-4 h-4" />
                      Connect Board
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* ── DONE: Connected ───────────────────────────────────────────────── */}
          {step === "done" && (
            <div className="rounded-2xl border border-[#4CAF50]/30 bg-[oklch(0.14_0.04_145)] p-8 space-y-6 shadow-[0_0_40px_rgba(76,175,80,0.12)]">
              <div className="text-center space-y-3">
                <div className="w-16 h-16 rounded-full bg-[#4CAF50]/20 border-2 border-[#4CAF50] flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-8 h-8 text-[#4CAF50]" />
                </div>
                <h2 className="text-xl font-bold text-white">Board Connected!</h2>
                <p className="text-white/50 text-sm">
                  <span className="text-[#4CAF50] font-medium">{deviceName ?? "Chessnut Pro"}</span> is now synced and ready to broadcast.
                </p>
              </div>

              <div className="bg-[#4CAF50]/8 border border-[#4CAF50]/20 rounded-xl p-4 space-y-2">
                <p className="text-[#4CAF50] text-xs font-semibold uppercase tracking-wider">Ready to broadcast</p>
                <ul className="text-white/60 text-sm space-y-1.5">
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-[#4CAF50]" /> Board connected via Bluetooth</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-[#4CAF50]" /> Moves will be captured automatically</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-[#4CAF50]" /> Spectators can follow live at the public link</li>
                </ul>
              </div>

              <div className="space-y-3">
                <button
                  onClick={goToConsole}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-[#4CAF50] hover:bg-[#45a049] text-white font-semibold text-sm transition-colors"
                >
                  <Monitor className="w-4 h-4" />
                  Open Broadcast Console
                </button>
                <button
                  onClick={() => navigate(`/tournament/${tournamentId}/manage`)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-white/10 text-white/50 text-sm hover:bg-white/5 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to Director Dashboard
                </button>
              </div>
            </div>
          )}

          {/* Browser compatibility note */}
          {step !== "done" && (
            <div className="flex items-center justify-center gap-2 text-white/25 text-xs">
              <Bluetooth className="w-3 h-3" />
              Requires Chrome or Edge on desktop ·
              <a
                href="https://developer.mozilla.org/en-US/docs/Web/API/Web_Bluetooth_API#browser_compatibility"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-white/50 flex items-center gap-0.5"
              >
                Learn more <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
