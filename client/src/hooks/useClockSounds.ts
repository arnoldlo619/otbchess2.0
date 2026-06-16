/**
 * useClockSounds — Web Audio API sound engine + Vibration API haptics
 * for the chess clock.
 *
 * All sounds are synthesised programmatically — no audio files needed.
 *
 * Sounds:
 *  - tap:     Short, crisp percussive click when a player presses their half.
 *  - warning: Subtle high-pitched tick played each second when < 10s remain.
 *  - flag:    Distinct descending three-tone alarm when time runs out.
 *
 * Haptics (Vibration API — Android Chrome; silently ignored on iOS/desktop):
 *  - tap:     30 ms pulse — crisp, DGT-clock-like confirmation.
 *  - warning: 15 ms pulse — lighter than tap, just a nudge.
 *  - flag:    [80, 40, 80, 40, 120] ms pattern — urgent, unmistakable.
 *
 * The AudioContext is created lazily on first use (required by browsers to
 * avoid the "AudioContext was not allowed to start" policy).
 *
 * Mute state controls BOTH sound and haptics and is persisted in
 * localStorage so it survives page reloads.
 */
import { useCallback, useRef, useState, useEffect } from "react";

const MUTE_KEY = "otb-clock-mute-v1";

// ─── Haptic helper ────────────────────────────────────────────────────────────

/**
 * Fire the Vibration API if available and not muted.
 * Silently no-ops on browsers/devices that don't support it (iOS, desktop).
 */
function vibrate(pattern: number | number[]): void {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(pattern);
    }
  } catch { /* ignore */ }
}

// ─── Audio helpers ────────────────────────────────────────────────────────────

function getOrCreateContext(ref: React.MutableRefObject<AudioContext | null>): AudioContext {
  if (!ref.current || ref.current.state === "closed") {
    ref.current = new AudioContext();
  }
  // Resume if suspended (browser autoplay policy)
  if (ref.current.state === "suspended") {
    ref.current.resume().catch(() => {});
  }
  return ref.current;
}

/**
 * Play a short percussive click — two overlapping oscillators:
 * a high sine burst + a low noise-like triangle thud.
 */
function playTap(ctx: AudioContext): void {
  const now = ctx.currentTime;

  // High click — sine wave, very short
  const osc1 = ctx.createOscillator();
  const gain1 = ctx.createGain();
  osc1.type = "sine";
  osc1.frequency.setValueAtTime(1200, now);
  osc1.frequency.exponentialRampToValueAtTime(600, now + 0.04);
  gain1.gain.setValueAtTime(0.18, now);
  gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
  osc1.connect(gain1);
  gain1.connect(ctx.destination);
  osc1.start(now);
  osc1.stop(now + 0.06);

  // Low thud — triangle wave
  const osc2 = ctx.createOscillator();
  const gain2 = ctx.createGain();
  osc2.type = "triangle";
  osc2.frequency.setValueAtTime(180, now);
  osc2.frequency.exponentialRampToValueAtTime(80, now + 0.06);
  gain2.gain.setValueAtTime(0.22, now);
  gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
  osc2.connect(gain2);
  gain2.connect(ctx.destination);
  osc2.start(now);
  osc2.stop(now + 0.09);
}

/**
 * Play a sharp mechanical clock tick for the final-10s warning.
 * Modelled after a DGT clock: a crisp high transient ("tick") followed by
 * a very short noise burst ("tock") to give it physical weight.
 * Noticeably louder and more urgent than the tap sound.
 */
function playWarningTick(ctx: AudioContext): void {
  const now = ctx.currentTime;

  // ── Tick: sharp high transient ──────────────────────────────────────────
  // A very short sine burst with an instant attack and fast exponential decay.
  const tickOsc = ctx.createOscillator();
  const tickGain = ctx.createGain();
  tickOsc.type = "sine";
  tickOsc.frequency.setValueAtTime(2200, now);
  tickOsc.frequency.exponentialRampToValueAtTime(900, now + 0.025);
  tickGain.gain.setValueAtTime(0.55, now);              // loud — unmistakable
  tickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);
  tickOsc.connect(tickGain);
  tickGain.connect(ctx.destination);
  tickOsc.start(now);
  tickOsc.stop(now + 0.04);

  // ── Tock: low-frequency body thud ───────────────────────────────────────
  // Adds physical weight — the mechanical resonance of the clock body.
  const tockOsc = ctx.createOscillator();
  const tockGain = ctx.createGain();
  tockOsc.type = "triangle";
  tockOsc.frequency.setValueAtTime(220, now + 0.005);
  tockOsc.frequency.exponentialRampToValueAtTime(90, now + 0.05);
  tockGain.gain.setValueAtTime(0.30, now + 0.005);
  tockGain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
  tockOsc.connect(tockGain);
  tockGain.connect(ctx.destination);
  tockOsc.start(now + 0.005);
  tockOsc.stop(now + 0.08);

  // ── Noise burst: adds the "snap" of a physical button ───────────────────
  // White noise shaped with a very fast envelope.
  try {
    const bufferSize = Math.floor(ctx.sampleRate * 0.02); // 20ms
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    const noiseGain = ctx.createGain();
    noise.buffer = buffer;
    noiseGain.gain.setValueAtTime(0.12, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.018);
    noise.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noise.start(now);
    noise.stop(now + 0.02);
  } catch { /* ignore — buffer creation may fail in some environments */ }
}

/**
 * Play a distinct three-tone descending alarm when a player flags.
 * Three notes: C5 → A4 → F4, each 0.22s apart, with a slight reverb tail.
 */
function playFlagAlarm(ctx: AudioContext): void {
  const now = ctx.currentTime;
  const notes = [523.25, 440.0, 349.23]; // C5, A4, F4
  const spacing = 0.22;

  notes.forEach((freq, i) => {
    const t = now + i * spacing;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(0.0, t);
    gain.gain.linearRampToValueAtTime(0.35, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.3);
  });

  // A second pass — slightly detuned for richness
  notes.forEach((freq, i) => {
    const t = now + i * spacing + 0.01;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq * 1.005, t);
    gain.gain.setValueAtTime(0.0, t);
    gain.gain.linearRampToValueAtTime(0.12, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.28);
  });
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export interface ClockSounds {
  /** Play the tap/click sound + 30ms haptic when a player presses their half */
  tap: () => void;
  /** Play the subtle warning tick + 15ms haptic (call once per second when < 10s) */
  warningTick: () => void;
  /** Play the flag alarm + urgent haptic pattern when a player's time reaches zero */
  flagAlarm: () => void;
  /** Whether sound AND haptics are currently muted */
  muted: boolean;
  /** Toggle mute on/off (controls both sound and haptics) */
  toggleMute: () => void;
}

export function useClockSounds(): ClockSounds {
  const ctxRef = useRef<AudioContext | null>(null);
  const [muted, setMuted] = useState<boolean>(() => {
    try {
      return localStorage.getItem(MUTE_KEY) === "true";
    } catch {
      return false;
    }
  });

  // Persist mute preference
  useEffect(() => {
    try {
      localStorage.setItem(MUTE_KEY, String(muted));
    } catch { /* ignore */ }
  }, [muted]);

  const tap = useCallback(() => {
    if (muted) return;
    // Haptic: 30ms — crisp, DGT-clock-like confirmation
    vibrate(30);
    try {
      const ctx = getOrCreateContext(ctxRef);
      playTap(ctx);
    } catch { /* ignore — AudioContext may not be available */ }
  }, [muted]);

  const warningTick = useCallback(() => {
    if (muted) return;
    // Haptic: 25ms — firm enough to feel during final 10s urgency
    vibrate(25);
    try {
      const ctx = getOrCreateContext(ctxRef);
      playWarningTick(ctx);
    } catch { /* ignore */ }
  }, [muted]);

  const flagAlarm = useCallback(() => {
    if (muted) return;
    // Haptic: urgent triple-burst pattern — unmistakable
    vibrate([80, 40, 80, 40, 120]);
    try {
      const ctx = getOrCreateContext(ctxRef);
      playFlagAlarm(ctx);
    } catch { /* ignore */ }
  }, [muted]);

  const toggleMute = useCallback(() => {
    setMuted((m) => !m);
  }, []);

  return { tap, warningTick, flagAlarm, muted, toggleMute };
}
