/**
 * OTB Chess — Chessnut Board Engine
 * ====================================
 * High-level engine that sits on top of ChessnutWebBluetoothAdapter and the
 * new decoder modules to provide:
 *
 *  - Calibration profile management (load/save/infer)
 *  - Starting position recognition
 *  - Board state stabilization (debounce)
 *  - Duplicate move protection
 *  - Legal move inference via chess.js
 *  - Automatic move submission into live broadcast
 *  - Desync / operator review flow
 *  - Comprehensive logging
 *
 * Architecture
 * ─────────────
 *  BLE notification → decodeBoardState() → stabilization timer
 *    → compareSquareMaps() → inferLegalMove() → submitMove()
 *
 * Usage
 * ──────
 *  const engine = new ChessnutBoardEngine({ broadcastId, onMove, onLog, ... });
 *  engine.setCalibrationProfile(profile);
 *  engine.setCurrentFen(fen);
 *  engine.processBlePayload(dataView);  // called from BLE notification handler
 */

import { Chess } from "chess.js";
import {
  decodeBoardState,
  autoDetectOrientation,
  buildNibbleMapFromStartingPosition,
  fenPlacementToSquareMap,
  squareMapToFen,
  type ChessnutBoardState,
  type ChessnutSquareMap,
  type ChangedSquare,
} from "./chessnutBoardDecoder";
import {
  buildDefaultProfile,
  saveCalibrationProfile,
  loadCalibrationProfile,
  checkProfileComplete,
  type CalibrationProfile,
  type ChessnutPieceCode,
} from "./chessnutPieceMap";

// ─── Types ────────────────────────────────────────────────────────────────────

export type EngineStatus =
  | "idle"
  | "waiting_for_board_state"
  | "starting_position_recognized"
  | "calibrated"
  | "tracking_moves"
  | "piece_movement_detected"
  | "position_stable"
  | "move_detected"
  | "move_accepted"
  | "board_mismatch"
  | "needs_operator_review"
  | "disconnected"
  | "manual_mode_active";

export interface InferredLegalMove {
  san: string;
  uci: string;
  fenBefore: string;
  fenAfter: string;
  confidence: "exact" | "ambiguous" | "none";
  candidates?: string[];
  isPromotion?: boolean;
  promotionPiece?: string;
}

export interface EngineLog {
  ts: number;
  category: "bluetooth" | "decoder" | "calibration" | "moves" | "errors" | "system";
  level: "info" | "warn" | "error";
  message: string;
}

export interface MismatchInfo {
  changedSquares: ChangedSquare[];
  physicalFen: string;
  digitalFen: string;
  candidates: string[];
}

export interface EngineState {
  status: EngineStatus;
  calibrationProfile: CalibrationProfile | null;
  startingPositionRecognized: boolean;
  isCalibrated: boolean;
  trackingEnabled: boolean;
  lastBoardState: ChessnutBoardState | null;
  lastAcceptedMove: string | null;
  lastInferredMove: InferredLegalMove | null;
  digitalFenMatch: boolean;
  mismatchInfo: MismatchInfo | null;
  debounceMs: number;
  logs: EngineLog[];
  readinessChecklist: ReadinessChecklist;
}

export interface ReadinessChecklist {
  bluetoothConnected: boolean;
  boardStateReadable: boolean;
  piecesRecognized: boolean;
  boardCalibrated: boolean;
  digitalPhysicalMatch: boolean;
  moveTrackingTested: boolean;
  manualFallbackReady: boolean;
}

export interface ChessnutBoardEngineOptions {
  broadcastId: string;
  serverUrl?: string;
  debounceMs?: number;
  onMove?: (move: InferredLegalMove) => void;
  onMismatch?: (info: MismatchInfo) => void;
  onStatusChange?: (state: EngineState) => void;
  onLog?: (log: EngineLog) => void;
  onStartingPositionRecognized?: () => void;
  onCalibrationComplete?: (profile: CalibrationProfile) => void;
}

// ─── Engine class ─────────────────────────────────────────────────────────────

export class ChessnutBoardEngine {
  private broadcastId: string;
  private serverUrl: string;

  private _status: EngineStatus = "idle";
  private _calibrationProfile: CalibrationProfile | null = null;
  private _startingPositionRecognized = false;
  private _isCalibrated = false;
  private _trackingEnabled = false;
  private _lastBoardState: ChessnutBoardState | null = null;
  private _stableBoardState: ChessnutBoardState | null = null;
  private _lastAcceptedMove: string | null = null;
  private _lastInferredMove: InferredLegalMove | null = null;
  private _lastAcceptedFen: string | null = null;
  private _currentFen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
  private _digitalFenMatch = false;
  private _mismatchInfo: MismatchInfo | null = null;
  private _debounceMs: number;
  private _logs: EngineLog[] = [];
  private _debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private _pendingBoardState: ChessnutBoardState | null = null;
  private _moveTrackingTested = false;
  private _bluetoothConnected = false;

  private _onMove?: (move: InferredLegalMove) => void;
  private _onMismatch?: (info: MismatchInfo) => void;
  private _onStatusChange?: (state: EngineState) => void;
  private _onLog?: (log: EngineLog) => void;
  private _onStartingPositionRecognized?: () => void;
  private _onCalibrationComplete?: (profile: CalibrationProfile) => void;

  constructor(options: ChessnutBoardEngineOptions) {
    this.broadcastId = options.broadcastId;
    this.serverUrl = options.serverUrl ?? "";
    this._debounceMs = options.debounceMs ?? 500;
    this._onMove = options.onMove;
    this._onMismatch = options.onMismatch;
    this._onStatusChange = options.onStatusChange;
    this._onLog = options.onLog;
    this._onStartingPositionRecognized = options.onStartingPositionRecognized;
    this._onCalibrationComplete = options.onCalibrationComplete;

    // Try to load saved calibration profile
    const saved = loadCalibrationProfile();
    if (saved) {
      this._calibrationProfile = saved;
      this._isCalibrated = true;
      // Auto-enable tracking — if we already have a calibration profile from a
      // previous session, tracking can start as soon as the board connects.
      this._trackingEnabled = true;
      this._log("calibration", "info", `Loaded calibration profile for ${saved.deviceName} — tracking auto-enabled`);
    }
  }

  // ─── Public API ─────────────────────────────────────────────────────────────

  setCurrentFen(fen: string): void {
    this._currentFen = fen;
    this._checkDigitalPhysicalMatch();
  }

  setBluetoothConnected(connected: boolean): void {
    this._bluetoothConnected = connected;
    if (!connected) {
      this._setStatus("disconnected");
      this._clearDebounce();
    }
    this._emitStatusUpdate();
  }

  setDebounceMs(ms: number): void {
    this._debounceMs = Math.max(100, Math.min(2000, ms));
  }

  setCalibrationProfile(profile: CalibrationProfile): void {
    this._calibrationProfile = profile;
    this._isCalibrated = true;
    saveCalibrationProfile(profile);
    this._log("calibration", "info", `Calibration profile saved for ${profile.deviceName}`);
    this._onCalibrationComplete?.(profile);
    // Auto-enable tracking immediately after calibration completes so the
    // director never has to click a separate "Enable Tracking" button.
    if (!this._trackingEnabled) {
      this._trackingEnabled = true;
      this._log("moves", "info", "Move tracking auto-enabled after calibration");
    }
    this._emitStatusUpdate();
  }

  enableTracking(): void {
    this._trackingEnabled = true;
    this._setStatus("tracking_moves");
    this._log("moves", "info", "Move tracking enabled");
  }

  disableTracking(): void {
    this._trackingEnabled = false;
    this._clearDebounce();
    this._log("moves", "info", "Move tracking paused");
    this._emitStatusUpdate();
  }

  resetBoardState(): void {
    this._lastBoardState = null;
    this._stableBoardState = null;
    this._lastAcceptedMove = null;
    this._lastInferredMove = null;
    this._lastAcceptedFen = null;
    this._mismatchInfo = null;
    this._startingPositionRecognized = false;
    this._clearDebounce();
    this._setStatus("waiting_for_board_state");
    this._log("system", "info", "Board state reset");
  }

  markMoveTrackingTested(): void {
    this._moveTrackingTested = true;
    this._emitStatusUpdate();
  }

  getState(): EngineState {
    return {
      status: this._status,
      calibrationProfile: this._calibrationProfile,
      startingPositionRecognized: this._startingPositionRecognized,
      isCalibrated: this._isCalibrated,
      trackingEnabled: this._trackingEnabled,
      lastBoardState: this._lastBoardState,
      lastAcceptedMove: this._lastAcceptedMove,
      lastInferredMove: this._lastInferredMove,
      digitalFenMatch: this._digitalFenMatch,
      mismatchInfo: this._mismatchInfo,
      debounceMs: this._debounceMs,
      logs: [...this._logs],
      readinessChecklist: this._buildReadinessChecklist(),
    };
  }

  getLogs(category?: EngineLog["category"]): EngineLog[] {
    if (!category) return [...this._logs];
    return this._logs.filter(l => l.category === category);
  }

  clearLogs(): void {
    this._logs = [];
  }

  // ─── Main entry point: process a raw BLE payload ────────────────────────────

  processBlePayload(rawData: DataView): void {
    this._log("bluetooth", "info", `Payload received: ${rawData.byteLength} bytes`);

    const previousMap = this._lastBoardState?.squareMap ?? null;
    const boardState = decodeBoardState(rawData, previousMap, this._calibrationProfile);

    if (!boardState) {
      this._log("decoder", "warn", `Failed to decode payload (${rawData.byteLength} bytes)`);
      return;
    }

    this._log("decoder", "info", `Decoded: ${boardState.detectedPieces} pieces, ${boardState.unknownSquares.length} unknown squares`);

    this._lastBoardState = boardState;

    // Check starting position on every decode
    if (boardState.isStartingPosition && !this._startingPositionRecognized) {
      this._startingPositionRecognized = true;
      this._log("calibration", "info", "Starting position recognized");
      this._onStartingPositionRecognized?.();

      // Auto-calibrate if not already calibrated
      if (!this._isCalibrated) {
        const { nibbleMap, entries } = buildNibbleMapFromStartingPosition(boardState);
        const deviceName = this._calibrationProfile?.deviceName ?? "Chessnut Pro";
        const deviceId = this._calibrationProfile?.deviceId ?? null;
        const profile: CalibrationProfile = {
          deviceName,
          deviceId,
          squareOrder: "normal",
          orientation: "normal",
          nibbleMap,
          nibbleEntries: entries,
          createdAt: this._calibrationProfile?.createdAt ?? new Date().toISOString(),
          lastUsedAt: new Date().toISOString(),
          isComplete: checkProfileComplete(nibbleMap),
        };
        this.setCalibrationProfile(profile);
      }

      this._setStatus("starting_position_recognized");
    }

    // Update digital/physical match status
    this._checkDigitalPhysicalMatch();

    // If tracking is enabled, start stabilization debounce
    if (this._trackingEnabled && this._isCalibrated) {
      this._startStabilizationDebounce(boardState);
    }

    this._emitStatusUpdate();
  }

  // ─── Starting position calibration ──────────────────────────────────────────

  runStartingPositionCalibration(rawData: DataView): {
    success: boolean;
    orientation: "normal" | "flipped" | null;
    profile: CalibrationProfile | null;
    mismatches: number;
  } {
    this._log("calibration", "info", "Running starting position calibration...");

    const result = autoDetectOrientation(rawData, this._calibrationProfile?.nibbleMap);
    if (!result) {
      this._log("calibration", "error", "Could not extract position bytes from payload");
      return { success: false, orientation: null, profile: null, mismatches: 0 };
    }

    const { orientation, boardState } = result;
    const validation = boardState.startingPositionValidation;

    if (validation.valid) {
      // Build calibrated nibble map from the starting position
      const { nibbleMap, entries } = buildNibbleMapFromStartingPosition(boardState);
      const deviceName = this._calibrationProfile?.deviceName ?? "Chessnut Pro";
      const deviceId = this._calibrationProfile?.deviceId ?? null;

      const profile: CalibrationProfile = {
        deviceName,
        deviceId,
        squareOrder: orientation,
        orientation,
        nibbleMap,
        nibbleEntries: entries,
        createdAt: this._calibrationProfile?.createdAt ?? new Date().toISOString(),
        lastUsedAt: new Date().toISOString(),
        isComplete: true,
      };

      this.setCalibrationProfile(profile);
      this._startingPositionRecognized = true;
      this._setStatus("calibrated");
      this._log("calibration", "info", `Calibration complete — orientation: ${orientation}`);

      return { success: true, orientation, profile, mismatches: 0 };
    }

    this._log("calibration", "warn", `Calibration failed — ${validation.mismatches.length} mismatches`);
    return {
      success: false,
      orientation,
      profile: null,
      mismatches: validation.mismatches.length,
    };
  }

  // ─── Operator review actions ─────────────────────────────────────────────────

  async acceptPhysicalPosition(): Promise<boolean> {
    if (!this._lastBoardState) return false;
    const physicalFen = squareMapToFen(
      this._lastBoardState.squareMap,
      this._currentFen.split(" ")[1] as "w" | "b" ?? "w"
    );
    this._log("moves", "info", "Operator accepted physical position as digital position");
    return this._submitFenCorrection(physicalFen);
  }

  async undoLastDigitalMove(): Promise<boolean> {
    try {
      const res = await fetch(`${this.serverUrl}/api/broadcasts/${this.broadcastId}/moves/last`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.ok) {
        this._log("moves", "info", "Undo last move via operator action");
        this._mismatchInfo = null;
        this._setStatus("tracking_moves");
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  switchToManualMode(): void {
    this._trackingEnabled = false;
    this._clearDebounce();
    this._mismatchInfo = null;
    this._setStatus("manual_mode_active");
    this._log("system", "info", "Switched to Manual Mode");
    this._emitStatusUpdate();
  }

  resumeTracking(): void {
    if (!this._isCalibrated) {
      this._log("system", "warn", "Cannot resume tracking — board not calibrated");
      return;
    }
    this._mismatchInfo = null;
    this._trackingEnabled = true;
    this._setStatus("tracking_moves");
    this._log("system", "info", "Tracking resumed");
    this._emitStatusUpdate();
  }

  // ─── Private: stabilization debounce ────────────────────────────────────────

  private _startStabilizationDebounce(boardState: ChessnutBoardState): void {
    this._pendingBoardState = boardState;

    if (boardState.changedSquares.length > 0) {
      this._setStatus("piece_movement_detected");
      this._log("moves", "info", `Piece movement detected on ${boardState.changedSquares.map(c => c.square).join(", ")}`);
    }

    this._clearDebounce();
    this._debounceTimer = setTimeout(() => {
      this._onBoardStateStabilized();
    }, this._debounceMs);
  }

  private _clearDebounce(): void {
    if (this._debounceTimer) {
      clearTimeout(this._debounceTimer);
      this._debounceTimer = null;
    }
  }

  private _onBoardStateStabilized(): void {
    const boardState = this._pendingBoardState;
    if (!boardState) return;

    this._log("moves", "info", "Position stable — inferring move...");
    this._setStatus("position_stable");

    // Check for duplicate (same state as last accepted)
    if (this._lastAcceptedFen) {
      const physicalFen = boardState.fenPlacement;
      const acceptedFenPlacement = this._lastAcceptedFen.split(" ")[0];
      if (physicalFen === acceptedFenPlacement) {
        this._log("moves", "info", "Duplicate board state — ignoring");
        return;
      }
    }

    // No changes from previous stable state
    if (this._stableBoardState) {
      const changes = boardState.changedSquares;
      if (changes.length === 0) {
        this._log("moves", "info", "No changes from previous stable state — ignoring");
        return;
      }
    }

    this._stableBoardState = boardState;
    this._inferAndSubmitMove(boardState);
  }

  // ─── Private: legal move inference ──────────────────────────────────────────

  private _inferAndSubmitMove(boardState: ChessnutBoardState): void {
    try {
      const chess = new Chess(this._currentFen);
      const legalMoves = chess.moves({ verbose: true });
      const physicalMap = boardState.squareMap;
      const candidates: typeof legalMoves = [];

      for (const move of legalMoves) {
        const testChess = new Chess(this._currentFen);
        testChess.move(move);
        const resultFen = testChess.fen().split(" ")[0];
        const resultMap = fenPlacementToSquareMap(resultFen);

        if (this._squareMapsMatch(resultMap, physicalMap)) {
          candidates.push(move);
        }
      }

      if (candidates.length === 0) {
        this._handleMismatch(boardState);
        return;
      }

      if (candidates.length === 1) {
        const move = candidates[0];
        const testChess = new Chess(this._currentFen);
        testChess.move(move);
        const inferred: InferredLegalMove = {
          san: move.san,
          uci: move.from + move.to + (move.promotion ?? ""),
          fenBefore: this._currentFen,
          fenAfter: testChess.fen(),
          confidence: "exact",
          isPromotion: move.flags.includes("p"),
          promotionPiece: move.promotion,
        };

        this._log("moves", "info", `Legal move inferred: ${move.san} (${inferred.uci})`);
        this._setStatus("move_detected");
        this._lastInferredMove = inferred;
        this._onMove?.(inferred);

        // Auto-submit exact moves
        this._submitMove(inferred);
        return;
      }

      // Multiple candidates — ambiguous (e.g., promotion)
      const firstMove = candidates[0];
      const testChess = new Chess(this._currentFen);
      testChess.move(firstMove);
      const inferred: InferredLegalMove = {
        san: firstMove.san,
        uci: firstMove.from + firstMove.to + (firstMove.promotion ?? ""),
        fenBefore: this._currentFen,
        fenAfter: testChess.fen(),
        confidence: "ambiguous",
        candidates: candidates.map(m => m.san),
        isPromotion: candidates.some(m => m.flags.includes("p")),
      };

      this._log("moves", "warn", `Ambiguous move — ${candidates.length} candidates: ${candidates.map(m => m.san).join(", ")}`);
      this._setStatus("needs_operator_review");
      this._lastInferredMove = inferred;
      this._onMove?.(inferred);
    } catch (err) {
      this._log("errors", "error", `Move inference error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  private _squareMapsMatch(a: ChessnutSquareMap, b: ChessnutSquareMap): boolean {
    // Compare only non-unknown squares
    for (const [square, piece] of Object.entries(a)) {
      if (piece === "unknown") continue;
      const bPiece = b[square] ?? "empty";
      if (bPiece === "unknown") continue;
      if (piece !== bPiece) return false;
    }
    return true;
  }

  private _handleMismatch(boardState: ChessnutBoardState): void {
    const physicalFen = squareMapToFen(
      boardState.squareMap,
      this._currentFen.split(" ")[1] as "w" | "b" ?? "w"
    );

    const mismatchInfo: MismatchInfo = {
      changedSquares: boardState.changedSquares,
      physicalFen,
      digitalFen: this._currentFen,
      candidates: [],
    };

    this._mismatchInfo = mismatchInfo;
    this._setStatus("board_mismatch");
    this._log("errors", "warn", `Board mismatch — no legal move matches physical position`);
    this._onMismatch?.(mismatchInfo);
  }

  // ─── Private: move submission ────────────────────────────────────────────────

  private async _submitMove(move: InferredLegalMove): Promise<void> {
    if (!move.san || move.confidence === "none") return;

    try {
      const res = await fetch(`${this.serverUrl}/api/broadcasts/${this.broadcastId}/moves`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          san: move.san,
          uci: move.uci,
          fenBefore: move.fenBefore,
          fenAfter: move.fenAfter,
          pgn: undefined, // server will compute
          moveNumber: undefined,
          sideToMove: move.fenAfter.split(" ")[1] ?? "w",
          source: "chessnut_chrome_bluetooth",
        }),
      });

      if (res.ok) {
        this._lastAcceptedMove = move.san;
        this._lastAcceptedFen = move.fenAfter;
        this._mismatchInfo = null;
        this._setStatus("move_accepted");
        this._log("moves", "info", `Move accepted: ${move.san}`);
        if (!this._moveTrackingTested) {
          this._moveTrackingTested = true;
        }
      } else {
        const body = await res.json().catch(() => ({ error: "Unknown" }));
        this._log("errors", "error", `Move submission failed (${res.status}): ${body.error ?? "Unknown"}`);
      }
    } catch (err) {
      this._log("errors", "error", `Move submission error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  private async _submitFenCorrection(fen: string): Promise<boolean> {
    try {
      const res = await fetch(`${this.serverUrl}/api/broadcasts/${this.broadcastId}/fen`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ fen }),
      });
      if (res.ok) {
        this._mismatchInfo = null;
        this._setStatus("tracking_moves");
        this._log("moves", "info", "Position corrected to physical board state");
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  // ─── Private: digital/physical match check ───────────────────────────────────

  private _checkDigitalPhysicalMatch(): void {
    if (!this._lastBoardState) {
      this._digitalFenMatch = false;
      return;
    }
    const digitalFenPlacement = this._currentFen.split(" ")[0];
    const physicalFenPlacement = this._lastBoardState.fenPlacement;
    this._digitalFenMatch = digitalFenPlacement === physicalFenPlacement;
  }

  // ─── Private: readiness checklist ────────────────────────────────────────────

  private _buildReadinessChecklist(): ReadinessChecklist {
    return {
      bluetoothConnected: this._bluetoothConnected,
      boardStateReadable: this._lastBoardState !== null,
      piecesRecognized: (this._lastBoardState?.unknownSquares.length ?? 99) === 0,
      boardCalibrated: this._isCalibrated,
      digitalPhysicalMatch: this._digitalFenMatch,
      moveTrackingTested: this._moveTrackingTested,
      manualFallbackReady: true, // always available
    };
  }

  // ─── Private: status / logging ───────────────────────────────────────────────

  private _setStatus(status: EngineStatus): void {
    this._status = status;
    this._emitStatusUpdate();
  }

  private _emitStatusUpdate(): void {
    this._onStatusChange?.(this.getState());
  }

  private _log(category: EngineLog["category"], level: EngineLog["level"], message: string): void {
    const entry: EngineLog = { ts: Date.now(), category, level, message };
    this._logs.unshift(entry);
    if (this._logs.length > 200) this._logs.pop();
    this._onLog?.(entry);
  }
}

// ─── Singleton factory (per broadcast) ───────────────────────────────────────

const engines = new Map<string, ChessnutBoardEngine>();

export function getOrCreateEngine(
  broadcastId: string,
  options: Omit<ChessnutBoardEngineOptions, "broadcastId">
): ChessnutBoardEngine {
  if (!engines.has(broadcastId)) {
    engines.set(broadcastId, new ChessnutBoardEngine({ broadcastId, ...options }));
  }
  return engines.get(broadcastId)!;
}

export function destroyEngine(broadcastId: string): void {
  engines.delete(broadcastId);
}
