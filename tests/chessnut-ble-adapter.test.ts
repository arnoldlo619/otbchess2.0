/**
 * Tests for ChessnutWebBluetoothAdapter pure logic
 * (no browser/BLE required — tests parser, inference, and mock payloads)
 */
import { describe, it, expect } from "vitest";
import {
  ChessnutWebBluetoothAdapter,
  buildMockPayloadFromFen,
} from "../client/src/lib/ChessnutWebBluetoothAdapter";

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const AFTER_E4_FEN = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1";
const AFTER_E4_E5_FEN = "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2";

describe("ChessnutWebBluetoothAdapter — pure logic", () => {
  const adapter = new ChessnutWebBluetoothAdapter("test-broadcast-id");

  // ─── isSupported ─────────────────────────────────────────────────────────────
  it("isSupported returns false in Node.js (no navigator.bluetooth)", () => {
    expect(adapter.isSupported()).toBe(false);
  });

  // ─── getStatus ───────────────────────────────────────────────────────────────
  it("initial status is unsupported in Node.js environment", () => {
    const state = adapter.getStatus();
    expect(state.status).toBe("unsupported");
    expect(state.gattConnected).toBe(false);
    expect(state.deviceName).toBeNull();
  });

  // ─── buildMockPayloadFromFen ─────────────────────────────────────────────────
  it("buildMockPayloadFromFen produces a 36-byte DataView for start position", () => {
    const dv = buildMockPayloadFromFen(START_FEN);
    expect(dv.byteLength).toBe(36);
    expect(dv.getUint8(0)).toBe(0x21);
    expect(dv.getUint8(1)).toBe(0x01);
  });

  it("buildMockPayloadFromFen produces a 36-byte DataView for after-e4 position", () => {
    const dv = buildMockPayloadFromFen(AFTER_E4_FEN);
    expect(dv.byteLength).toBe(36);
  });

  // ─── parseBoardState ─────────────────────────────────────────────────────────
  it("parseBoardState returns null for packets shorter than 34 bytes", () => {
    const short = new DataView(new Uint8Array(10).buffer);
    expect(adapter.parseBoardState(short)).toBeNull();
  });

  it("parseBoardState returns 64 squares for a valid packet", () => {
    const dv = buildMockPayloadFromFen(START_FEN);
    const state = adapter.parseBoardState(dv);
    expect(state).not.toBeNull();
    expect(state!.length).toBe(64);
  });

  it("parseBoardState identifies correct number of pieces in start position", () => {
    const dv = buildMockPayloadFromFen(START_FEN);
    const state = adapter.parseBoardState(dv)!;
    const occupied = state.filter(s => s.piece !== "").length;
    expect(occupied).toBe(32);
  });

  it("parseBoardState identifies correct number of pieces after 1.e4", () => {
    const dv = buildMockPayloadFromFen(AFTER_E4_FEN);
    const state = adapter.parseBoardState(dv)!;
    const occupied = state.filter(s => s.piece !== "").length;
    expect(occupied).toBe(32); // same number of pieces, just moved
  });

  it("parseBoardState produces squares with valid square names", () => {
    const dv = buildMockPayloadFromFen(START_FEN);
    const state = adapter.parseBoardState(dv)!;
    for (const sq of state) {
      expect(sq.square).toMatch(/^[a-h][1-8]$/);
    }
  });

  // ─── inferMoveFromBoardState ──────────────────────────────────────────────────
  it("inferMoveFromBoardState detects 1.e4 exactly", () => {
    const prevDv = buildMockPayloadFromFen(START_FEN);
    const currDv = buildMockPayloadFromFen(AFTER_E4_FEN);
    const prevState = adapter.parseBoardState(prevDv)!;
    const currState = adapter.parseBoardState(currDv)!;

    const inferred = adapter.inferMoveFromBoardState(prevState, currState, START_FEN);
    expect(inferred).not.toBeNull();
    expect(inferred!.confidence).toBe("exact");
    expect(inferred!.san).toBe("e4");
    expect(inferred!.uci).toBe("e2e4");
  });

  it("inferMoveFromBoardState detects 1...e5 exactly", () => {
    const prevDv = buildMockPayloadFromFen(AFTER_E4_FEN);
    const currDv = buildMockPayloadFromFen(AFTER_E4_E5_FEN);
    const prevState = adapter.parseBoardState(prevDv)!;
    const currState = adapter.parseBoardState(currDv)!;

    const inferred = adapter.inferMoveFromBoardState(prevState, currState, AFTER_E4_FEN);
    expect(inferred).not.toBeNull();
    expect(inferred!.confidence).toBe("exact");
    expect(inferred!.san).toBe("e5");
    expect(inferred!.uci).toBe("e7e5");
  });

  it("inferMoveFromBoardState returns confidence=none for same board state (no move)", () => {
    const prevDv = buildMockPayloadFromFen(START_FEN);
    const prevState = adapter.parseBoardState(prevDv)!;
    const currState = adapter.parseBoardState(prevDv)!;

    const inferred = adapter.inferMoveFromBoardState(prevState, currState, START_FEN);
    expect(inferred!.confidence).toBe("none");
  });

  it("inferMoveFromBoardState returns fenBefore and fenAfter", () => {
    const prevDv = buildMockPayloadFromFen(START_FEN);
    const currDv = buildMockPayloadFromFen(AFTER_E4_FEN);
    const prevState = adapter.parseBoardState(prevDv)!;
    const currState = adapter.parseBoardState(currDv)!;

    const inferred = adapter.inferMoveFromBoardState(prevState, currState, START_FEN);
    expect(inferred!.fenBefore).toBe(START_FEN);
    expect(inferred!.fenAfter).toContain("rnbqkbnr/pppppppp/8/8/4P3");
  });

  // ─── resetBoardState ─────────────────────────────────────────────────────────
  it("resetBoardState clears last accepted move", () => {
    adapter.resetBoardState();
    const state = adapter.getStatus();
    expect(state.lastAcceptedMove).toBeNull();
    expect(state.lastFenMatchStatus).toBe("unknown");
  });

  // ─── getRawPayloads ───────────────────────────────────────────────────────────
  it("getRawPayloads returns empty array initially", () => {
    expect(adapter.getRawPayloads()).toEqual([]);
  });

  // ─── getDiagnosticServices ────────────────────────────────────────────────────
  it("getDiagnosticServices returns empty array initially", () => {
    expect(adapter.getDiagnosticServices()).toEqual([]);
  });
});
