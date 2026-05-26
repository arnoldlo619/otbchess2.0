/**
 * OTB Chess — ChessnutWebBluetoothAdapter
 * ========================================
 * Direct Chrome Web Bluetooth adapter for the Chessnut Pro / Air e-board.
 *
 * Architecture
 * ─────────────
 *  1. isSupported()        → check navigator.bluetooth
 *  2. requestDevice()      → open Chrome BLE device picker
 *  3. connect()            → GATT connect + discover services
 *  4. discoverServices()   → enumerate all services + characteristics
 *  5. subscribeToBoardState() → subscribe to FEN notifications
 *  6. readBoardState()     → one-shot read of current board state
 *  7. parseBoardState()    → 36-byte packet → 64-square piece array
 *  8. inferMoveFromBoardState() → chess.js legal-move matching
 *  9. submitMoveToBroadcast()   → POST to /api/broadcasts/:id/moves
 * 10. onMove / onBoardState / onError → callback registration
 * 11. disconnect()         → clean GATT disconnect
 * 12. getStatus()          → current adapter status
 *
 * BLE UUIDs (official Chessnut API)
 * ──────────────────────────────────
 * The Chessnut Pro uses two custom GATT services:
 *   FEN Service   1b7e8261-2877-41c3-b46e-cf057c562023
 *   FEN Char      1b7e8262-2877-41c3-b46e-cf057c562023  (notify)
 *   Ops Service   1b7e8271-2877-41c3-b46e-cf057c562023
 *   Ops Write     1b7e8272-2877-41c3-b46e-cf057c562023  (write)
 *   Ops Response  1b7e8273-2877-41c3-b46e-cf057c562023  (notify)
 *
 * Board-state packet format (36 bytes)
 * ──────────────────────────────────────
 * Bytes 0-1:  header (0x21 0x01 or similar)
 * Bytes 2-33: 32 bytes encoding 64 squares, 4 bits per square
 *             nibble value → piece using PIECE_MAP
 *
 * Transparency notice
 * ────────────────────
 * If the board connects but UUIDs don't match, the adapter enters
 * DIAGNOSTIC mode and enumerates all available services/characteristics
 * so the operator can identify the correct UUIDs from the real device.
 * Board-state parsing is marked "Connected — parsing not configured yet"
 * until a successful move is inferred from real hardware.
 */

import { Chess } from "chess.js";

// ─── BLE UUIDs ────────────────────────────────────────────────────────────────
export const CHESSNUT_UUIDS = {
  FEN_SERVICE:    "1b7e8261-2877-41c3-b46e-cf057c562023",
  FEN_CHAR:       "1b7e8262-2877-41c3-b46e-cf057c562023",
  OPS_SERVICE:    "1b7e8271-2877-41c3-b46e-cf057c562023",
  OPS_WRITE:      "1b7e8272-2877-41c3-b46e-cf057c562023",
  OPS_RESPONSE:   "1b7e8273-2877-41c3-b46e-cf057c562023",
  // Nordic UART (fallback — some older Chessnut firmware uses this)
  NORDIC_UART:    "6e400001-b5a3-f393-e0a9-e50e24dcca9e",
  NORDIC_TX:      "6e400003-b5a3-f393-e0a9-e50e24dcca9e",
  NORDIC_RX:      "6e400002-b5a3-f393-e0a9-e50e24dcca9e",
} as const;

// Command to enable real-time FEN streaming
const CMD_START_FEN = new Uint8Array([0x21, 0x01, 0x00]);

// ─── Piece mapping (official Chessnut API) ────────────────────────────────────
// Index → piece character (uppercase = white, lowercase = black, "" = empty)
const PIECE_MAP: string[] = ["", "q", "k", "b", "p", "n", "R", "P", "r", "B", "N", "Q", "K"];

// ─── Types ────────────────────────────────────────────────────────────────────
export type AdapterStatus =
  | "unsupported"
  | "ready"
  | "picker_opened"
  | "connecting"
  | "connected"
  | "discovering_services"
  | "listening"
  | "receiving"
  | "move_accepted"
  | "mismatch"
  | "needs_review"
  | "disconnected"
  | "reconnecting"
  | "error"
  | "diagnostic";

export interface BoardSquare {
  square: string;   // e.g. "e4"
  piece: string;    // e.g. "P", "p", "" for empty
}

export type BoardState = BoardSquare[];  // 64 squares, a1..h8

export interface InferredMove {
  san: string;
  uci: string;
  fenBefore: string;
  fenAfter: string;
  confidence: "exact" | "ambiguous" | "none";
  candidates?: string[];  // if ambiguous
  isPromotion?: boolean;
}

export interface DiagnosticService {
  uuid: string;
  characteristics: DiagnosticCharacteristic[];
}

export interface DiagnosticCharacteristic {
  uuid: string;
  properties: string[];
  lastValue?: string;  // hex string
  lastNotification?: string;
  lastNotificationAt?: number;
}

export interface RawPayloadRecord {
  ts: number;
  uuid: string;
  hex: string;
  length: number;
}

export interface AdapterState {
  status: AdapterStatus;
  deviceName: string | null;
  deviceId: string | null;
  gattConnected: boolean;
  parseConfigured: boolean;
  lastBoardUpdateAt: number | null;
  lastAcceptedMove: string | null;
  lastFenMatchStatus: "match" | "mismatch" | "unknown";
  errorMessage: string | null;
  diagnosticServices: DiagnosticService[];
  rawPayloads: RawPayloadRecord[];
  /** Auto-reconnect state */
  reconnectAttempt: number;
  reconnectMaxAttempts: number;
  reconnectNextRetryMs: number | null;
}

// ─── Adapter class ────────────────────────────────────────────────────────────
export class ChessnutWebBluetoothAdapter {
  private device: BluetoothDevice | null = null;
  private server: BluetoothRemoteGATTServer | null = null;
  private fenChar: BluetoothRemoteGATTCharacteristic | null = null;
  private opsWriteChar: BluetoothRemoteGATTCharacteristic | null = null;

  private _status: AdapterStatus = "ready";
  private _deviceName: string | null = null;
  private _deviceId: string | null = null;
  private _gattConnected = false;
  private _parseConfigured = false;
  private _lastBoardUpdateAt: number | null = null;
  private _lastAcceptedMove: string | null = null;
  private _lastFenMatchStatus: "match" | "mismatch" | "unknown" = "unknown";
  private _errorMessage: string | null = null;
  private _diagnosticServices: DiagnosticService[] = [];
  private _rawPayloads: RawPayloadRecord[] = [];

  private _previousBoardState: BoardState | null = null;
  private _currentBoardState: BoardState | null = null;

  private _moveCallback: ((move: InferredMove) => void) | null = null;
  private _boardStateCallback: ((state: BoardState) => void) | null = null;
  private _errorCallback: ((err: string) => void) | null = null;
  private _statusCallback: ((state: AdapterState) => void) | null = null;
  /** Fired with the raw DataView on every BLE notification, before any parsing. */
  private _rawBoardDataCallback: ((dv: DataView) => void) | null = null;

  private broadcastId: string;
  private serverUrl: string;
  private advancedDiscovery: boolean;

  // Auto-reconnect state
  private _reconnectAttempt = 0;
  private _reconnectMaxAttempts = 3;
  private _reconnectNextRetryMs: number | null = null;
  private _reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private _autoReconnectEnabled = true;
  private _intentionalDisconnect = false;

  constructor(broadcastId: string, serverUrl = "", advancedDiscovery = false) {
    this.broadcastId = broadcastId;
    this.serverUrl = serverUrl;
    this.advancedDiscovery = advancedDiscovery;

    if (!this.isSupported()) {
      this._status = "unsupported";
    }
  }

  // ─── 1. isSupported ─────────────────────────────────────────────────────────
  isSupported(): boolean {
    return typeof navigator !== "undefined" && "bluetooth" in navigator;
  }

  // ─── 2. requestDevice ───────────────────────────────────────────────────────
  async requestDevice(): Promise<BluetoothDevice | null> {
    if (!this.isSupported()) {
      this._emitError("Chrome Web Bluetooth is not available in this browser. Use Manual Mode or the Local Bridge.");
      return null;
    }

    this._setStatus("picker_opened");

    try {
      const requestOptions: RequestDeviceOptions = this.advancedDiscovery
        ? {
            acceptAllDevices: true,
            optionalServices: [
              CHESSNUT_UUIDS.FEN_SERVICE,
              CHESSNUT_UUIDS.OPS_SERVICE,
              CHESSNUT_UUIDS.NORDIC_UART,
            ],
          }
        : {
            filters: [
              { namePrefix: "Chessnut" },
              { namePrefix: "CHESSNUT" },
              { namePrefix: "Chessnut Pro" },
              { namePrefix: "Chessnut Air" },
              { namePrefix: "ChessnutGo" },
            ],
            optionalServices: [
              CHESSNUT_UUIDS.FEN_SERVICE,
              CHESSNUT_UUIDS.OPS_SERVICE,
              CHESSNUT_UUIDS.NORDIC_UART,
            ],
          };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const device = await (navigator as any).bluetooth.requestDevice(requestOptions);
      this.device = device;
      this._deviceName = device.name ?? "Chessnut Board";
      this._deviceId = device.id ?? null;
      return device;
    } catch (err) {
      if (err instanceof Error && err.name === "NotFoundError") {
        // User cancelled the picker — not an error
        this._setStatus("ready");
        return null;
      }
      this._emitError(`Device picker error: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    }
  }

  // ─── 3. connect ─────────────────────────────────────────────────────────────
  async connect(): Promise<boolean> {
    if (!this.device) {
      const d = await this.requestDevice();
      if (!d) return false;
    }

    this._setStatus("connecting");

    try {
      this.server = await this.device!.gatt!.connect();
      this._gattConnected = true;
      this._intentionalDisconnect = false;
      this._reconnectAttempt = 0;
      this._reconnectNextRetryMs = null;

      // Listen for unexpected disconnect → auto-reconnect
      this.device!.addEventListener("gattserverdisconnected", () => {
        this._gattConnected = false;
        if (this._intentionalDisconnect) {
          this._setStatus("disconnected");
          return;
        }
        this._attemptReconnect();
      });

      this._setStatus("connected");

      // Attempt to discover and subscribe
      await this.discoverServices();
      await this.subscribeToBoardState();

      return true;
    } catch (err) {
      this._emitError(`Connection failed: ${err instanceof Error ? err.message : String(err)}`);
      return false;
    }
  }

  // ─── 4. disconnect ──────────────────────────────────────────────────────────
  disconnect(): void {
    this._intentionalDisconnect = true;
    this._cancelReconnect();
    if (this.fenChar) {
      try { this.fenChar.stopNotifications(); } catch { /* ignore */ }
      this.fenChar = null;
    }
    if (this.server?.connected) {
      this.server.disconnect();
    }
    this.server = null;
    this._gattConnected = false;
    this._setStatus("disconnected");
  }

  // ─── 5. getStatus ───────────────────────────────────────────────────────────
  getStatus(): AdapterState {
    return {
      status: this._status,
      deviceName: this._deviceName,
      deviceId: this._deviceId,
      gattConnected: this._gattConnected,
      parseConfigured: this._parseConfigured,
      lastBoardUpdateAt: this._lastBoardUpdateAt,
      lastAcceptedMove: this._lastAcceptedMove,
      lastFenMatchStatus: this._lastFenMatchStatus,
      errorMessage: this._errorMessage,
      diagnosticServices: this._diagnosticServices,
      rawPayloads: this._rawPayloads,
      reconnectAttempt: this._reconnectAttempt,
      reconnectMaxAttempts: this._reconnectMaxAttempts,
      reconnectNextRetryMs: this._reconnectNextRetryMs,
    };
  }

  // ─── 6. discoverServices ────────────────────────────────────────────────────
  async discoverServices(): Promise<DiagnosticService[]> {
    if (!this.server?.connected) return [];

    this._setStatus("discovering_services");
    this._diagnosticServices = [];

    try {
      const services = await this.server.getPrimaryServices();

      for (const svc of services) {
        const diagSvc: DiagnosticService = { uuid: svc.uuid, characteristics: [] };

        try {
          const chars = await svc.getCharacteristics();
          for (const ch of chars) {
            const props: string[] = [];
            if (ch.properties.read)     props.push("read");
            if (ch.properties.write)    props.push("write");
            if (ch.properties.writeWithoutResponse) props.push("writeWithoutResponse");
            if (ch.properties.notify)   props.push("notify");
            if (ch.properties.indicate) props.push("indicate");

            diagSvc.characteristics.push({ uuid: ch.uuid, properties: props });

            // Try to read if readable
            if (ch.properties.read) {
              try {
                const val = await ch.readValue();
                diagSvc.characteristics[diagSvc.characteristics.length - 1].lastValue =
                  bufToHex(val);
              } catch { /* not readable right now */ }
            }
          }
        } catch { /* characteristic discovery failed for this service */ }

        this._diagnosticServices.push(diagSvc);
      }

      // Check if we found the known Chessnut UUIDs
      const foundFenService = services.some((s: BluetoothRemoteGATTService) =>
        s.uuid.toLowerCase() === CHESSNUT_UUIDS.FEN_SERVICE.toLowerCase()
      );
      const foundNordic = services.some((s: BluetoothRemoteGATTService) =>
        s.uuid.toLowerCase() === CHESSNUT_UUIDS.NORDIC_UART.toLowerCase()
      );

      if (!foundFenService && !foundNordic) {
        // Enter diagnostic mode — UUIDs unknown for this firmware version
        this._setStatus("diagnostic");
        this._emitError(
          "Known Chessnut UUIDs not found. Entering diagnostic mode — " +
          "use the BLE Diagnostics panel to identify services and characteristics."
        );
      }

      this._emitStatusUpdate();
      return this._diagnosticServices;
    } catch (err) {
      this._emitError(`Service discovery failed: ${err instanceof Error ? err.message : String(err)}`);
      return [];
    }
  }

  // ─── 7. subscribeToBoardState ────────────────────────────────────────────────
  async subscribeToBoardState(): Promise<boolean> {
    if (!this.server?.connected) return false;

    try {
      // Try primary Chessnut FEN service first
      let fenSvc: BluetoothRemoteGATTService | null = null;
      try {
        fenSvc = await this.server.getPrimaryService(CHESSNUT_UUIDS.FEN_SERVICE);
      } catch { /* service not found */ }

      if (fenSvc) {
        this.fenChar = await fenSvc.getCharacteristic(CHESSNUT_UUIDS.FEN_CHAR);

        // Get ops service to send start command
        try {
          const opsSvc = await this.server.getPrimaryService(CHESSNUT_UUIDS.OPS_SERVICE);
          this.opsWriteChar = await opsSvc.getCharacteristic(CHESSNUT_UUIDS.OPS_WRITE);
        } catch { /* ops service not available */ }

        await this.fenChar.startNotifications();
        this.fenChar.addEventListener("characteristicvaluechanged", this._onFenNotification.bind(this));

        // Send start-FEN command
        if (this.opsWriteChar) {
          try {
            await this.opsWriteChar.writeValue(CMD_START_FEN);
          } catch { /* write failed — board may still send notifications */ }
        }

        this._parseConfigured = true;
        this._setStatus("listening");
        return true;
      }

      // Fallback: try Nordic UART
      let nordicSvc: BluetoothRemoteGATTService | null = null;
      try {
        nordicSvc = await this.server.getPrimaryService(CHESSNUT_UUIDS.NORDIC_UART);
      } catch { /* not found */ }

      if (nordicSvc) {
        const txChar = await nordicSvc.getCharacteristic(CHESSNUT_UUIDS.NORDIC_TX);
        await txChar.startNotifications();
        txChar.addEventListener("characteristicvaluechanged", this._onFenNotification.bind(this));
        this._parseConfigured = false;  // Nordic UART format may differ
        this._setStatus("listening");
        return true;
      }

      // No known service found — stay in diagnostic mode
      this._setStatus("diagnostic");
      return false;
    } catch (err) {
      this._emitError(`Subscribe failed: ${err instanceof Error ? err.message : String(err)}`);
      return false;
    }
  }

  // ─── 8. readBoardState ──────────────────────────────────────────────────────
  async readBoardState(): Promise<BoardState | null> {
    if (!this.fenChar) return null;
    try {
      const value = await this.fenChar.readValue();
      return this.parseBoardState(value);
    } catch {
      return null;
    }
  }

  // ─── 9. parseBoardState ─────────────────────────────────────────────────────
  parseBoardState(rawData: DataView): BoardState | null {
    if (rawData.byteLength < 34) return null;

    const squares: BoardState = [];
    const files = ["a", "b", "c", "d", "e", "f", "g", "h"];

    // Decode 64 squares from bytes 2-33 (32 bytes, 4 bits per square)
    // Board is encoded rank 8 → rank 1, file h → file a (mirrored)
    for (let row = 0; row < 8; row++) {
      for (let col = 7; col >= 0; col--) {
        const squareIndex = row * 8 + (7 - col);
        const byteIndex = Math.floor(squareIndex / 2) + 2;
        const pieceVal = (squareIndex % 2 === 0)
          ? rawData.getUint8(byteIndex) & 0x0f
          : rawData.getUint8(byteIndex) >> 4;

        const piece = PIECE_MAP[pieceVal] ?? "";
        const rank = 8 - row;
        const file = files[col];
        squares.push({ square: `${file}${rank}`, piece });
      }
    }

    return squares;
  }

  // ─── 10. inferMoveFromBoardState ─────────────────────────────────────────────
  inferMoveFromBoardState(
    previousState: BoardState,
    currentState: BoardState,
    currentFen: string
  ): InferredMove | null {
    try {
      const chess = new Chess(currentFen);
      const legalMoves = chess.moves({ verbose: true });

      const currentMap = boardStateToMap(currentState);
      const candidates: typeof legalMoves = [];

      for (const move of legalMoves) {
        const testChess = new Chess(currentFen);
        testChess.move(move);
        const resultFen = testChess.fen().split(" ")[0];
        const resultMap = fenPartsToMap(resultFen);

        if (mapsMatch(resultMap, currentMap)) {
          candidates.push(move);
        }
      }

      if (candidates.length === 0) {
        return {
          san: "",
          uci: "",
          fenBefore: currentFen,
          fenAfter: currentFen,
          confidence: "none",
        };
      }

      if (candidates.length === 1) {
        const move = candidates[0];
        const testChess = new Chess(currentFen);
        testChess.move(move);
        const isPromotion = move.flags.includes("p");

        return {
          san: move.san,
          uci: move.from + move.to + (move.promotion || ""),
          fenBefore: currentFen,
          fenAfter: testChess.fen(),
          confidence: "exact",
          isPromotion,
        };
      }

      // Multiple candidates — ambiguous (e.g., two identical pieces can promote)
      return {
        san: candidates[0].san,
        uci: candidates[0].from + candidates[0].to + (candidates[0].promotion || ""),
        fenBefore: currentFen,
        fenAfter: currentFen,
        confidence: "ambiguous",
        candidates: candidates.map(m => m.san),
        isPromotion: candidates.some(m => m.flags.includes("p")),
      };
    } catch {
      return null;
    }
  }

  // ─── 11. submitMoveToBroadcast ───────────────────────────────────────────────
  async submitMoveToBroadcast(move: InferredMove): Promise<boolean> {
    if (!move.san || move.confidence === "none") return false;

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
          source: "chessnut_chrome_bluetooth",
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "Unknown error" }));
        this._emitError(`Move submission failed (${res.status}): ${body.error ?? "Unknown"}`);
        return false;
      }

      this._lastAcceptedMove = move.san;
      this._setStatus("move_accepted");
      return true;
    } catch (err) {
      this._emitError(`Move submission error: ${err instanceof Error ? err.message : String(err)}`);
      return false;
    }
  }

  // ─── 12. onMove / onBoardState / onError ─────────────────────────────────────
  onMove(cb: (move: InferredMove) => void): void {
    this._moveCallback = cb;
  }

  onBoardState(cb: (state: BoardState) => void): void {
    this._boardStateCallback = cb;
  }

  onError(cb: (err: string) => void): void {
    this._errorCallback = cb;
  }

  onStatusChange(cb: (state: AdapterState) => void): void {
    this._statusCallback = cb;
  }

  /**
   * Register a callback that receives the raw BLE DataView on every board
   * notification.  Use this to pipe data into ChessnutBoardEngine for
   * nibble-level piece recognition without going through the legacy PIECE_MAP.
   */
  onRawBoardData(cb: (dv: DataView) => void): void {
    this._rawBoardDataCallback = cb;
  }

  // ─── BLE notification handler ────────────────────────────────────────────────
  private _onFenNotification(event: Event): void {
    const char = event.target as BluetoothRemoteGATTCharacteristic;
    const value = char.value;
    if (!value) return;

    this._lastBoardUpdateAt = Date.now();
    this._setStatus("receiving");

    // Record raw payload (keep last 20)
    const hex = bufToHex(value);
    this._rawPayloads.unshift({ ts: Date.now(), uuid: char.uuid, hex, length: value.byteLength });
    if (this._rawPayloads.length > 20) this._rawPayloads.pop();

    // Update diagnostic characteristic record
    const diagSvc = this._diagnosticServices.find(s =>
      s.characteristics.some(c => c.uuid === char.uuid)
    );
    if (diagSvc) {
      const diagChar = diagSvc.characteristics.find(c => c.uuid === char.uuid);
      if (diagChar) {
        diagChar.lastNotification = hex;
        diagChar.lastNotificationAt = Date.now();
      }
    }

    // Emit raw DataView to any engine listener (must happen before parsing)
    if (this._rawBoardDataCallback) {
      this._rawBoardDataCallback(value);
    }

    // Parse board state
    const newState = this.parseBoardState(value);
    if (!newState) {
      this._emitStatusUpdate();
      return;
    }

    const prevState = this._currentBoardState;
    this._currentBoardState = newState;

    if (this._boardStateCallback) {
      this._boardStateCallback(newState);
    }

    // Infer move if we have a previous state
    if (prevState) {
      this._previousBoardState = prevState;
    }

    this._emitStatusUpdate();
  }

  // ─── Auto-reconnect logic ──────────────────────────────────────────────────────
  private _attemptReconnect(): void {
    if (!this._autoReconnectEnabled || !this.device) {
      this._setStatus("disconnected");
      this._emitError("Board disconnected. Auto-reconnect disabled.");
      return;
    }

    if (this._reconnectAttempt >= this._reconnectMaxAttempts) {
      this._setStatus("disconnected");
      this._emitError(
        `Board disconnected. Auto-reconnect failed after ${this._reconnectMaxAttempts} attempts. Please reconnect manually.`
      );
      this._reconnectAttempt = 0;
      this._reconnectNextRetryMs = null;
      return;
    }

    // Exponential backoff: 1s, 2s, 4s
    const delayMs = 1000 * Math.pow(2, this._reconnectAttempt);
    this._reconnectAttempt++;
    this._reconnectNextRetryMs = delayMs;
    this._setStatus("reconnecting");

    this._reconnectTimer = setTimeout(() => {
      this._reconnectNextRetryMs = null;
      this._reconnectGatt();
    }, delayMs);
  }

  private async _reconnectGatt(): Promise<void> {
    if (!this.device?.gatt) {
      this._setStatus("disconnected");
      this._emitError("Board device lost. Please reconnect manually.");
      return;
    }

    this._setStatus("connecting");

    try {
      this.server = await this.device.gatt.connect();
      this._gattConnected = true;
      this._reconnectAttempt = 0;
      this._reconnectNextRetryMs = null;
      this._setStatus("connected");

      // Re-subscribe to board state notifications
      await this.discoverServices();
      await this.subscribeToBoardState();
    } catch {
      // Retry again
      this._attemptReconnect();
    }
  }

  private _cancelReconnect(): void {
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }
    this._reconnectAttempt = 0;
    this._reconnectNextRetryMs = null;
  }

  /** Allow external code to disable auto-reconnect (e.g., when switching to manual mode). */
  setAutoReconnect(enabled: boolean): void {
    this._autoReconnectEnabled = enabled;
    if (!enabled) this._cancelReconnect();
  }

  // ─── Internal helpers ─────────────────────────────────────────────────────────
  private _setStatus(status: AdapterStatus): void {
    this._status = status;
    this._errorMessage = status === "error" ? this._errorMessage : null;
    this._emitStatusUpdate();
  }

  private _emitError(msg: string): void {
    this._status = "error";
    this._errorMessage = msg;
    if (this._errorCallback) this._errorCallback(msg);
    this._emitStatusUpdate();
  }

  private _emitStatusUpdate(): void {
    if (this._statusCallback) {
      this._statusCallback(this.getStatus());
    }
  }

  // ─── Public: process a board state update with current FEN ───────────────────
  async processBoardUpdate(currentFen: string): Promise<void> {
    if (!this._previousBoardState || !this._currentBoardState) return;

    const inferred = this.inferMoveFromBoardState(
      this._previousBoardState,
      this._currentBoardState,
      currentFen
    );

    if (!inferred) return;

    if (inferred.confidence === "none") {
      this._lastFenMatchStatus = "mismatch";
      this._setStatus("mismatch");
      if (this._errorCallback) {
        this._errorCallback("Board state mismatch — no legal move matches the current board position.");
      }
      return;
    }

    if (inferred.confidence === "ambiguous") {
      this._setStatus("needs_review");
      if (this._moveCallback) this._moveCallback(inferred);
      return;
    }

    // Exact match — submit
    this._lastFenMatchStatus = "match";
    if (this._moveCallback) this._moveCallback(inferred);
    await this.submitMoveToBroadcast(inferred);

    // Update previous state for next comparison
    this._previousBoardState = this._currentBoardState;
  }

  // ─── Public: reset board state tracking (new game) ───────────────────────────
  resetBoardState(): void {
    this._previousBoardState = null;
    this._currentBoardState = null;
    this._lastAcceptedMove = null;
    this._lastFenMatchStatus = "unknown";
  }

  // ─── Public: get raw payloads for export ─────────────────────────────────────
  getRawPayloads(): RawPayloadRecord[] {
    return [...this._rawPayloads];
  }

  // ─── Public: get diagnostic services ─────────────────────────────────────────
  getDiagnosticServices(): DiagnosticService[] {
    return this._diagnosticServices;
  }
}

// ─── Utility functions ────────────────────────────────────────────────────────

function bufToHex(value: DataView): string {
  return Array.from({ length: value.byteLength }, (_, i) =>
    value.getUint8(i).toString(16).padStart(2, "0")
  ).join(" ");
}

function boardStateToMap(state: BoardState): Map<string, string> {
  const map = new Map<string, string>();
  for (const sq of state) {
    if (sq.piece) map.set(sq.square, sq.piece);
  }
  return map;
}

function fenPartsToMap(fenParts: string): Map<string, string> {
  const map = new Map<string, string>();
  const ranks = fenParts.split("/");
  const files = ["a", "b", "c", "d", "e", "f", "g", "h"];

  for (let rankIdx = 0; rankIdx < 8; rankIdx++) {
    const rank = 8 - rankIdx;
    let fileIdx = 0;
    for (const ch of ranks[rankIdx]) {
      if (ch >= "1" && ch <= "8") {
        fileIdx += parseInt(ch, 10);
      } else {
        const square = `${files[fileIdx]}${rank}`;
        map.set(square, ch);
        fileIdx++;
      }
    }
  }
  return map;
}

function mapsMatch(a: Map<string, string>, b: Map<string, string>): boolean {
  if (a.size !== b.size) return false;
  for (const entry of Array.from(a.entries())) {
    if (b.get(entry[0]) !== entry[1]) return false;
  }
  return true;
}

// ─── Mock payloads for "Test Without Board" mode ──────────────────────────────
export const MOCK_BOARD_PAYLOADS: { label: string; fen: string; hex: string }[] = [
  {
    label: "Starting position",
    fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    hex: "21 01 00 ab cd ef 12 34 56 78 9a bc de f0 12 34 56 78 9a bc de f0 12 34 56 78 9a bc de f0 12 34 56",
  },
  {
    label: "After 1.e4",
    fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1",
    hex: "21 01 00 ab cd ef 12 34 56 78 9a bc de f0 12 34 56 78 9a bc de f0 12 34 00 78 9a bc de f0 12 34 56",
  },
];

/**
 * Build a mock DataView from a FEN string for testing purposes.
 * This creates a synthetic 36-byte packet that parseBoardState() can decode.
 */
export function buildMockPayloadFromFen(fen: string): DataView {
  const fenParts = fen.split(" ")[0];
  const ranks = fenParts.split("/");
  const files = ["a", "b", "c", "d", "e", "f", "g", "h"];

  // Build square → piece map
  const pieceMap = new Map<string, string>();
  for (let rankIdx = 0; rankIdx < 8; rankIdx++) {
    const rank = 8 - rankIdx;
    let fileIdx = 0;
    for (const ch of ranks[rankIdx]) {
      if (ch >= "1" && ch <= "8") {
        fileIdx += parseInt(ch, 10);
      } else {
        pieceMap.set(`${files[fileIdx]}${rank}`, ch);
        fileIdx++;
      }
    }
  }

  // Reverse PIECE_MAP for encoding
  const pieceToVal: Record<string, number> = {};
  PIECE_MAP.forEach((p, i) => { if (p) pieceToVal[p] = i; });

  const bytes = new Uint8Array(36);
  bytes[0] = 0x21;
  bytes[1] = 0x01;

  for (let row = 0; row < 8; row++) {
    for (let col = 7; col >= 0; col--) {
      const squareIndex = row * 8 + (7 - col);
      const rank = 8 - row;
      const file = files[col];
      const piece = pieceMap.get(`${file}${rank}`) ?? "";
      const val = pieceToVal[piece] ?? 0;

      const byteIndex = Math.floor(squareIndex / 2) + 2;
      if (squareIndex % 2 === 0) {
        bytes[byteIndex] = (bytes[byteIndex] & 0xf0) | (val & 0x0f);
      } else {
        bytes[byteIndex] = (bytes[byteIndex] & 0x0f) | ((val & 0x0f) << 4);
      }
    }
  }

  return new DataView(bytes.buffer);
}
