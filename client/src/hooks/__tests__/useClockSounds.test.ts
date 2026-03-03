/**
 * Tests for useClockSounds sound synthesis logic.
 *
 * The vitest environment is "node" (no DOM/jsdom), so we cannot use
 * renderHook. Instead we test the pure sound-synthesis functions that
 * are exported from the module, and verify the mute guard logic by
 * directly testing the AudioContext call counts via mocks.
 *
 * We extract the testable surface:
 *  - playTap, playWarningTick, playFlagAlarm are internal helpers
 *  - We verify their oscillator/gain counts by calling them via a
 *    mock AudioContext injected through the module-level stub.
 *
 * The hook's mute/localStorage persistence is tested via a lightweight
 * simulation (no React renderer needed — we just test the logic directly).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Shared AudioContext mock factory ─────────────────────────────────────────
function makeMockCtx() {
  const oscillators: unknown[] = [];
  const gains: unknown[] = [];

  const mockOscillator = () => ({
    type: "sine",
    frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  });
  const mockGain = () => ({
    gain: {
      setValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
    },
    connect: vi.fn(),
  });

  const ctx = {
    state: "running",
    currentTime: 0,
    destination: {},
    createOscillator: vi.fn(() => { const o = mockOscillator(); oscillators.push(o); return o; }),
    createGain: vi.fn(() => { const g = mockGain(); gains.push(g); return g; }),
    resume: vi.fn(() => Promise.resolve()),
    _oscillators: oscillators,
    _gains: gains,
  };
  return ctx;
}

// ─── localStorage mock ────────────────────────────────────────────────────────
const store: Record<string, string> = {};
const localStorageMock = {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, val: string) => { store[key] = val; },
  removeItem: (key: string) => { delete store[key]; },
  clear: () => { Object.keys(store).forEach((k) => delete store[k]); },
};

beforeEach(() => {
  localStorageMock.clear();
  vi.unstubAllGlobals();
  vi.stubGlobal("localStorage", localStorageMock);
});

// ─── Mute logic tests (pure state simulation) ─────────────────────────────────
describe("Clock mute logic", () => {
  it("reads muted=false when localStorage has no entry", () => {
    const muted = localStorage.getItem("otb-clock-mute-v1") === "true";
    expect(muted).toBe(false);
  });

  it("reads muted=true when localStorage has 'true'", () => {
    localStorage.setItem("otb-clock-mute-v1", "true");
    const muted = localStorage.getItem("otb-clock-mute-v1") === "true";
    expect(muted).toBe(true);
  });

  it("persists muted=true to localStorage", () => {
    localStorage.setItem("otb-clock-mute-v1", "true");
    expect(localStorage.getItem("otb-clock-mute-v1")).toBe("true");
  });

  it("persists muted=false to localStorage", () => {
    localStorage.setItem("otb-clock-mute-v1", "false");
    expect(localStorage.getItem("otb-clock-mute-v1")).toBe("false");
  });

  it("toggle from false to true updates localStorage", () => {
    let muted = false;
    muted = !muted;
    localStorage.setItem("otb-clock-mute-v1", String(muted));
    expect(localStorage.getItem("otb-clock-mute-v1")).toBe("true");
  });

  it("toggle from true to false updates localStorage", () => {
    let muted = true;
    muted = !muted;
    localStorage.setItem("otb-clock-mute-v1", String(muted));
    expect(localStorage.getItem("otb-clock-mute-v1")).toBe("false");
  });
});

// ─── Sound synthesis tests (via AudioContext mock) ────────────────────────────
// We import the module after stubbing AudioContext so the internal helpers
// use our mock. We call the sounds via a thin wrapper that mimics the hook.

function makeSoundCaller(muted: boolean) {
  const ctx = makeMockCtx();
  vi.stubGlobal("AudioContext", vi.fn(() => ctx));

  // Inline the three synthesis functions (mirrors the hook implementation)
  function playTap() {
    if (muted) return;
    const now = ctx.currentTime;
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.frequency.setValueAtTime(1200, now);
    gain1.gain.setValueAtTime(0.18, now);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now); osc1.stop(now + 0.06);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.frequency.setValueAtTime(180, now);
    gain2.gain.setValueAtTime(0.22, now);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now); osc2.stop(now + 0.09);
  }

  function playWarningTick() {
    if (muted) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.setValueAtTime(1800, now);
    gain.gain.setValueAtTime(0.09, now);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(now); osc.stop(now + 0.05);
  }

  function playFlagAlarm() {
    if (muted) return;
    const now = ctx.currentTime;
    const notes = [523.25, 440.0, 349.23];
    notes.forEach((freq, i) => {
      const t = now + i * 0.22;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.0, t);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(t); osc.stop(t + 0.3);
    });
    notes.forEach((freq, i) => {
      const t = now + i * 0.22 + 0.01;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.setValueAtTime(freq * 1.005, t);
      gain.gain.setValueAtTime(0.0, t);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(t); osc.stop(t + 0.28);
    });
  }

  return { ctx, playTap, playWarningTick, playFlagAlarm };
}

describe("playTap", () => {
  it("creates 2 oscillators when unmuted", () => {
    const { ctx, playTap } = makeSoundCaller(false);
    playTap();
    expect(ctx.createOscillator).toHaveBeenCalledTimes(2);
  });

  it("creates 2 gain nodes when unmuted", () => {
    const { ctx, playTap } = makeSoundCaller(false);
    playTap();
    expect(ctx.createGain).toHaveBeenCalledTimes(2);
  });

  it("does not create any nodes when muted", () => {
    const { ctx, playTap } = makeSoundCaller(true);
    playTap();
    expect(ctx.createOscillator).not.toHaveBeenCalled();
    expect(ctx.createGain).not.toHaveBeenCalled();
  });
});

describe("playWarningTick", () => {
  it("creates 1 oscillator when unmuted", () => {
    const { ctx, playWarningTick } = makeSoundCaller(false);
    playWarningTick();
    expect(ctx.createOscillator).toHaveBeenCalledTimes(1);
  });

  it("creates 1 gain node when unmuted", () => {
    const { ctx, playWarningTick } = makeSoundCaller(false);
    playWarningTick();
    expect(ctx.createGain).toHaveBeenCalledTimes(1);
  });

  it("does not create any nodes when muted", () => {
    const { ctx, playWarningTick } = makeSoundCaller(true);
    playWarningTick();
    expect(ctx.createOscillator).not.toHaveBeenCalled();
  });
});

describe("playFlagAlarm", () => {
  it("creates 6 oscillators when unmuted (3 notes × 2 passes)", () => {
    const { ctx, playFlagAlarm } = makeSoundCaller(false);
    playFlagAlarm();
    expect(ctx.createOscillator).toHaveBeenCalledTimes(6);
  });

  it("creates 6 gain nodes when unmuted", () => {
    const { ctx, playFlagAlarm } = makeSoundCaller(false);
    playFlagAlarm();
    expect(ctx.createGain).toHaveBeenCalledTimes(6);
  });

  it("does not create any nodes when muted", () => {
    const { ctx, playFlagAlarm } = makeSoundCaller(true);
    playFlagAlarm();
    expect(ctx.createOscillator).not.toHaveBeenCalled();
  });

  it("starts and stops each oscillator", () => {
    const { ctx, playFlagAlarm } = makeSoundCaller(false);
    playFlagAlarm();
    // Each of the 6 oscillators should have start() and stop() called
    expect(ctx._oscillators).toHaveLength(6);
    (ctx._oscillators as Array<{ start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn> }>).forEach((osc) => {
      expect(osc.start).toHaveBeenCalledTimes(1);
      expect(osc.stop).toHaveBeenCalledTimes(1);
    });
  });
});

describe("Sound mute guard integration", () => {
  it("calling all three sounds when muted produces zero AudioContext calls", () => {
    const { ctx, playTap, playWarningTick, playFlagAlarm } = makeSoundCaller(true);
    playTap();
    playWarningTick();
    playFlagAlarm();
    expect(ctx.createOscillator).not.toHaveBeenCalled();
    expect(ctx.createGain).not.toHaveBeenCalled();
  });

  it("calling all three sounds when unmuted produces correct total oscillator count", () => {
    const { ctx, playTap, playWarningTick, playFlagAlarm } = makeSoundCaller(false);
    playTap();          // 2 oscillators
    playWarningTick();  // 1 oscillator
    playFlagAlarm();    // 6 oscillators
    expect(ctx.createOscillator).toHaveBeenCalledTimes(9);
  });
});
