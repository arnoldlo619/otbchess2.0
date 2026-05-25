#!/usr/bin/env node
/**
 * ChessOTB.club — Chessnut Pro Bridge CLI  v2.0
 * ─────────────────────────────────────────────
 * Connects a Chessnut Pro e-board via BLE and streams moves to the
 * ChessOTB broadcast server using the secure bridge-move endpoint.
 *
 * Usage:
 *   node bridge.mjs --broadcast-id <id> --token <tok>
 *   node bridge.mjs --config bridge.config.json
 *   node bridge.mjs --broadcast-id <id> --token <tok> --simulate
 *   node bridge.mjs --broadcast-id <id> --token <tok> --dry-run
 *
 * Requirements:
 *   npm install   (installs @abandonware/noble, chess.js, node-fetch, minimist)
 *
 * Platform notes:
 *   macOS  — requires Bluetooth permission for Terminal / iTerm
 *   Linux  — sudo setcap cap_net_raw+eip $(which node)
 *   Windows — use WSL2 with usbipd-win for BLE passthrough
 */

import noble from "@abandonware/noble";
import { Chess } from "chess.js";
import fetch from "node-fetch";
import minimist from "minimist";
import { createInterface } from "readline";
import { createWriteStream, existsSync, readFileSync } from "fs";
import { resolve } from "path";

// ─── Config ───────────────────────────────────────────────────────────────────
const argv = minimist(process.argv.slice(2), {
  string: ["broadcast-id", "token", "server", "color", "config", "log-file", "device-name"],
  boolean: ["verbose", "dry-run", "simulate", "flip", "help"],
  alias: { h: "help", v: "verbose", d: "dry-run", s: "simulate" },
  default: {
    server: process.env.SERVER_URL ?? "https://chessotb.club",
    "broadcast-id": process.env.BROADCAST_ID ?? "",
    token: process.env.BRIDGE_TOKEN ?? "",
    color: process.env.BOARD_COLOR ?? "auto",
    "device-name": "Chessnut",
    verbose: false,
    "dry-run": false,
    simulate: false,
    flip: false,
  },
});

if (argv.help) {
  console.log(`
ChessOTB Bridge CLI v2.0

Usage:
  node bridge.mjs [options]

Options:
  --broadcast-id <id>   Broadcast session ID (required)
  --token <token>       Bridge token from Broadcast Control page (required)
  --server <url>        Server URL (default: https://chessotb.club)
  --config <file>       Load options from JSON config file
  --simulate, -s        Simulation mode — type SAN moves, no BLE required
  --dry-run, -d         Same as --simulate (alias)
  --flip                Flip board orientation (playing as Black)
  --device-name <name>  BLE device name to scan for (default: Chessnut)
  --log-file <path>     Write structured JSON logs to file
  --color <w|b|auto>    Side you are playing (default: auto-detect)
  --verbose, -v         Show detailed BLE and move logs
  --help, -h            Show this help

Config file format (bridge.config.json):
  {
    "broadcastId": "...",
    "token": "...",
    "server": "https://chessotb.club",
    "simulate": false,
    "flip": false,
    "deviceName": "Chessnut",
    "logFile": "bridge.log"
  }

Environment variables:
  BROADCAST_ID, BRIDGE_TOKEN, SERVER_URL, BOARD_COLOR

Examples:
  node bridge.mjs --broadcast-id abc123 --token tok_xyz
  node bridge.mjs --config bridge.config.json
  node bridge.mjs --broadcast-id abc123 --token tok_xyz --simulate
`);
  process.exit(0);
}

// Load JSON config file if specified
let fileConfig = {};
if (argv.config) {
  const absPath = resolve(argv.config);
  if (!existsSync(absPath)) {
    console.error(`[bridge] Config file not found: ${absPath}`);
    process.exit(1);
  }
  try {
    fileConfig = JSON.parse(readFileSync(absPath, "utf8"));
  } catch (e) {
    console.error(`[bridge] Failed to parse config file: ${e.message}`);
    process.exit(1);
  }
}

const BROADCAST_ID  = argv["broadcast-id"] || fileConfig.broadcastId || "";
const BRIDGE_TOKEN  = argv["token"]        || fileConfig.token        || "";
const SERVER_URL    = (argv["server"]      || fileConfig.server       || "https://chessotb.club").replace(/\/$/, "");
const DRY_RUN       = argv["dry-run"]      || argv["simulate"]        || fileConfig.simulate || false;
const VERBOSE       = argv["verbose"]      || fileConfig.verbose      || false;
const FLIP_BOARD    = argv["flip"]         || fileConfig.flip         || false;
const DEVICE_NAME   = argv["device-name"] || fileConfig.deviceName   || "Chessnut";
const LOG_FILE      = argv["log-file"]     || fileConfig.logFile      || null;
const BRIDGE_VERSION = "2.0.0";

if (!BROADCAST_ID || !BRIDGE_TOKEN) {
  console.error("❌  --broadcast-id and --token are required. Run with --help for usage.");
  process.exit(1);
}

// ─── Logger ───────────────────────────────────────────────────────────────────
let logFileStream = null;
if (LOG_FILE) {
  logFileStream = createWriteStream(resolve(LOG_FILE), { flags: "a" });
}

function writeLog(level, color, msg, data) {
  const ts = new Date().toISOString();
  const prefix = `\x1b[2m${ts}\x1b[0m ${color}[${level}]\x1b[0m`;
  console.log(`${prefix} ${msg}`);
  if (data && VERBOSE) console.log("\x1b[2m", JSON.stringify(data, null, 2), "\x1b[0m");
  if (logFileStream) {
    logFileStream.write(JSON.stringify({ ts, level, msg, ...(data || {}) }) + "\n");
  }
}

const log   = (msg, d) => writeLog("INFO ", "\x1b[36m", msg, d);
const ok    = (msg, d) => writeLog("OK   ", "\x1b[32m", msg, d);
const warn  = (msg, d) => writeLog("WARN ", "\x1b[33m", msg, d);
const error = (msg, d) => writeLog("ERROR", "\x1b[31m", msg, d);
const dbg   = (msg, d) => { if (VERBOSE) writeLog("DEBUG", "\x1b[2m", msg, d); };

// ─── Chessnut BLE Protocol Constants ─────────────────────────────────────────
const NORDIC_UART_SERVICE_UUID = "6e400001b5a3f393e0a9e50e24dcca9e";
const NORDIC_UART_TX_UUID      = "6e400002b5a3f393e0a9e50e24dcca9e";
const NORDIC_UART_RX_UUID      = "6e400003b5a3f393e0a9e50e24dcca9e";

const CMD_GET_BOARD_STATE = Buffer.from([0x21, 0x01, 0x00]);
const CMD_REAL_TIME_ON    = Buffer.from([0x21, 0x10, 0x00]);

const CHESSNUT_PIECE_MAP = {
  0x00: null,
  0x01: "wP", 0x02: "wR", 0x03: "wN", 0x04: "wB", 0x05: "wQ", 0x06: "wK",
  0x07: "bP", 0x08: "bR", 0x09: "bN", 0x0A: "bB", 0x0B: "bQ", 0x0C: "bK",
};

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];
const RANKS = ["1", "2", "3", "4", "5", "6", "7", "8"];

// ─── State ────────────────────────────────────────────────────────────────────
const chess = new Chess();
let peripheral = null;
let rxCharacteristic = null;
let txCharacteristic = null;
let lastBoardMap = null;
let moveBuffer = [];
let connected = false;
let moveCount = 0;
let lastMoveSan = null;
let heartbeatTimer = null;
let heartbeatFailures = 0;

// ─── Heartbeat ────────────────────────────────────────────────────────────────
async function sendHeartbeat(status = "connected", errorMsg = null) {
  if (DRY_RUN) return;
  const url = `${SERVER_URL}/api/broadcasts/${BROADCAST_ID}/bridge-heartbeat`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: BRIDGE_TOKEN,
        status,
        deviceName: DEVICE_NAME,
        connectionType: "ble",
        bridgeVersion: BRIDGE_VERSION,
        ...(errorMsg ? { error: errorMsg } : {}),
      }),
    });
    if (res.ok) {
      heartbeatFailures = 0;
      dbg("Heartbeat OK");
    } else {
      heartbeatFailures++;
      warn(`Heartbeat HTTP ${res.status} (failure #${heartbeatFailures})`);
    }
  } catch (err) {
    heartbeatFailures++;
    warn(`Heartbeat network error: ${err.message} (failure #${heartbeatFailures})`);
    if (heartbeatFailures >= 3) {
      error("3 consecutive heartbeat failures — check server connectivity");
    }
  }
}

function startHeartbeat() {
  sendHeartbeat("connected");
  heartbeatTimer = setInterval(() => sendHeartbeat("connected"), 10000);
  log(`Heartbeat started (every 10s)`);
}

function stopHeartbeat() {
  if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null; }
}

// ─── Board Parsing ────────────────────────────────────────────────────────────
function parseBoardState(data) {
  if (data.length < 32) return null;
  const board = new Map();
  for (let i = 0; i < 64; i++) {
    const byteIndex = Math.floor(i / 2);
    const nibble = i % 2 === 0
      ? (data[byteIndex] >> 4) & 0x0F
      : data[byteIndex] & 0x0F;
    const piece = CHESSNUT_PIECE_MAP[nibble] ?? null;
    let file = i % 8;
    let rank = Math.floor(i / 8);
    if (FLIP_BOARD) { file = 7 - file; rank = 7 - rank; }
    const square = `${FILES[file]}${RANKS[rank]}`;
    board.set(square, piece);
  }
  return board;
}

function boardMapToFenRanks(board) {
  const ranks = [];
  for (let r = 7; r >= 0; r--) {
    let rankStr = "";
    let empty = 0;
    for (let f = 0; f < 8; f++) {
      const sq = `${FILES[f]}${RANKS[r]}`;
      const piece = board.get(sq);
      if (!piece) {
        empty++;
      } else {
        if (empty > 0) { rankStr += empty; empty = 0; }
        const [color, type] = [piece[0], piece[1].toLowerCase()];
        rankStr += color === "w" ? type.toUpperCase() : type;
      }
    }
    if (empty > 0) rankStr += empty;
    ranks.push(rankStr);
  }
  return ranks.join("/");
}

function detectMove(prevBoard, nextBoard) {
  const fenBefore = chess.fen();
  const legalMoves = chess.moves({ verbose: true });

  const removed = [];
  const added   = [];
  for (const sq of prevBoard.keys()) {
    const prev = prevBoard.get(sq);
    const next = nextBoard.get(sq);
    if (prev !== next) {
      if (prev && !next) removed.push({ sq, piece: prev });
      if (!prev && next) added.push({ sq, piece: next });
      if (prev && next && prev !== next) {
        removed.push({ sq, piece: prev });
        added.push({ sq, piece: next });
      }
    }
  }

  dbg(`Board diff — removed: ${JSON.stringify(removed)}, added: ${JSON.stringify(added)}`);

  for (const move of legalMoves) {
    const fromMatch = removed.some(r => r.sq === move.from);
    const toMatch   = added.some(a => a.sq === move.to);
    if (fromMatch && toMatch) {
      const result = chess.move({ from: move.from, to: move.to, promotion: move.promotion ?? "q" });
      if (result) {
        const fenAfter = chess.fen();
        const uci = `${move.from}${move.to}${move.promotion ?? ""}`;
        return { san: result.san, uci, fenBefore, fenAfter };
      }
    }
  }

  // Castling fallback
  for (const move of legalMoves) {
    if (move.flags?.includes("k") || move.flags?.includes("q")) {
      const result = chess.move({ from: move.from, to: move.to });
      if (result) {
        const fenAfter = chess.fen();
        return { san: result.san, uci: `${move.from}${move.to}`, fenBefore, fenAfter };
      }
    }
  }

  return null;
}

// ─── HTTP Bridge ──────────────────────────────────────────────────────────────
async function postMove({ san, uci, fenBefore, fenAfter }) {
  // Dedup guard
  if (san === lastMoveSan) {
    dbg(`Dedup: skipping repeated move ${san}`);
    return true;
  }

  if (DRY_RUN) {
    ok(`[SIMULATE] Move: ${san} (${uci})`);
    dbg(`  FEN before: ${fenBefore}`);
    dbg(`  FEN after:  ${fenAfter}`);
    lastMoveSan = san;
    return true;
  }

  const url = `${SERVER_URL}/api/broadcasts/${BROADCAST_ID}/bridge-move`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: BRIDGE_TOKEN,
        san, uci, fenBefore, fenAfter,
        deviceName: DEVICE_NAME,
        bridgeVersion: BRIDGE_VERSION,
      }),
    });

    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      moveCount++;
      ok(`Move #${moveCount}: ${san} (${uci})`, { moveNumber: data.broadcast?.moveNumber });
      lastMoveSan = san;
      // Sync to server-validated FEN if provided
      if (data.fenAfter && data.fenAfter !== fenAfter) {
        chess.load(data.fenAfter);
        warn(`FEN corrected by server`);
      }
      return true;
    }

    const errBody = await res.json().catch(() => ({}));
    if (res.status === 409) {
      // Desync — resync to server FEN
      if (errBody.serverFen) {
        warn(`Desync detected — resyncing to server FEN`);
        chess.load(errBody.serverFen);
        if (lastBoardMap) lastBoardMap = null; // force re-sync on next packet
      }
    } else if (res.status === 401) {
      error("Invalid bridge token — regenerate it in Broadcast Control");
      process.exit(1);
    } else {
      error(`Server rejected move ${san}: ${res.status} ${errBody.error ?? ""}`);
    }
    return false;
  } catch (err) {
    error(`Network error posting move: ${err.message}`);
    return false;
  }
}

// ─── BLE Data Handler ─────────────────────────────────────────────────────────
function handleBleData(data) {
  dbg(`BLE RX (${data.length} bytes): ${data.toString("hex")}`);
  moveBuffer.push(...data);

  while (moveBuffer.length >= 4) {
    const header = moveBuffer[0];
    if (header !== 0xB1) { moveBuffer.shift(); continue; }
    const cmd = moveBuffer[1];
    const len = moveBuffer[2];
    if (moveBuffer.length < 3 + len) break;

    const payload = moveBuffer.splice(0, 3 + len).slice(3);

    if (cmd === 0x01 || cmd === 0x10) {
      if (payload.length >= 32) {
        const newBoard = parseBoardState(Buffer.from(payload));
        if (!newBoard) continue;

        if (!lastBoardMap) {
          lastBoardMap = newBoard;
          const fenRanks = boardMapToFenRanks(newBoard);
          log(`Board synced. Position: ${fenRanks}`);
          const startingFen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR";
          if (fenRanks !== startingFen) {
            warn("Board does not match starting position — ensure pieces are set up correctly.");
          }
          return;
        }

        const move = detectMove(lastBoardMap, newBoard);
        if (move) {
          lastBoardMap = newBoard;
          postMove(move).catch(err => error(`postMove error: ${err.message}`));
        } else {
          dbg("No legal move detected — waiting for board to settle.");
        }
      }
    }
  }
}

// ─── BLE Connection ───────────────────────────────────────────────────────────
async function connectToBoard(p) {
  peripheral = p;
  log(`Connecting to ${p.advertisement.localName ?? p.id}…`);

  await p.connectAsync();
  ok(`Connected to ${p.advertisement.localName ?? p.id}`);

  const { characteristics } = await p.discoverSomeServicesAndCharacteristicsAsync(
    [NORDIC_UART_SERVICE_UUID],
    [NORDIC_UART_TX_UUID, NORDIC_UART_RX_UUID]
  );

  for (const c of characteristics) {
    if (c.uuid === NORDIC_UART_RX_UUID.replace(/-/g, "")) rxCharacteristic = c;
    if (c.uuid === NORDIC_UART_TX_UUID.replace(/-/g, "")) txCharacteristic = c;
  }

  if (!rxCharacteristic || !txCharacteristic) {
    error("Could not find Nordic UART characteristics. Is this a Chessnut board?");
    process.exit(1);
  }

  rxCharacteristic.on("data", handleBleData);
  await rxCharacteristic.subscribeAsync();
  ok("Subscribed to board notifications.");

  await txCharacteristic.writeAsync(CMD_REAL_TIME_ON, false);
  dbg("Sent CMD_REAL_TIME_ON");
  await txCharacteristic.writeAsync(CMD_GET_BOARD_STATE, false);
  dbg("Sent CMD_GET_BOARD_STATE");

  connected = true;
  startHeartbeat();

  log(`Bridge active — Broadcast: ${BROADCAST_ID}`);
  log(`Server: ${SERVER_URL}`);
  log("Waiting for moves…\n");

  p.once("disconnect", () => {
    connected = false;
    stopHeartbeat();
    sendHeartbeat("disconnected").catch(() => {});
    warn("Board disconnected. Reconnecting in 5s…");
    setTimeout(startScanning, 5000);
  });
}

function startScanning() {
  log(`Scanning for "${DEVICE_NAME}" board…`);
  noble.startScanning([NORDIC_UART_SERVICE_UUID], false);
}

noble.on("stateChange", (state) => {
  if (state === "poweredOn") {
    log("Bluetooth powered on.");
    startScanning();
  } else {
    warn(`Bluetooth state: ${state}`);
    noble.stopScanning();
  }
});

noble.on("discover", async (p) => {
  const name = p.advertisement.localName ?? "";
  dbg(`Discovered: ${name} (${p.id})`);
  if (name.toLowerCase().includes(DEVICE_NAME.toLowerCase())) {
    noble.stopScanning();
    try {
      await connectToBoard(p);
    } catch (err) {
      error(`Connection failed: ${err.message}`);
      await sendHeartbeat("error", err.message);
      setTimeout(startScanning, 5000);
    }
  }
});

// ─── Graceful Shutdown ────────────────────────────────────────────────────────
async function shutdown() {
  log("Shutting down…");
  stopHeartbeat();
  noble.stopScanning();
  if (!DRY_RUN) await sendHeartbeat("disconnected").catch(() => {});
  if (peripheral?.state === "connected") {
    await peripheral.disconnectAsync().catch(() => {});
  }
  log(`Session ended. ${moveCount} move(s) posted.`);
  process.exit(0);
}

process.on("SIGINT",  shutdown);
process.on("SIGTERM", shutdown);

// ─── Simulation / Dry-run REPL ────────────────────────────────────────────────
if (DRY_RUN) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });

  console.log(`
\x1b[36m\x1b[1m╔══════════════════════════════════════════════════════╗
║   ChessOTB Bridge v${BRIDGE_VERSION} — Simulation Mode          ║
║   Type SAN moves (e4, Nf3, O-O) and press Enter      ║
║   Commands: undo | fen | pgn | quit                  ║
╚══════════════════════════════════════════════════════╝\x1b[0m
`);

  log(`Broadcast ID: ${BROADCAST_ID}`);
  log(`Server: ${SERVER_URL}`);
  if (!DRY_RUN) startHeartbeat();

  const prompt = () => {
    const turn = chess.turn() === "w" ? "\x1b[1mWhite\x1b[0m" : "\x1b[2mBlack\x1b[0m";
    rl.question(`[${turn}] Move: `, async (input) => {
      const cmd = input.trim();
      if (!cmd) { prompt(); return; }

      if (cmd === "quit" || cmd === "exit") { await shutdown(); return; }
      if (cmd === "undo") {
        chess.undo();
        log(`Undone. FEN: ${chess.fen()}`);
        prompt(); return;
      }
      if (cmd === "fen") { log(chess.fen()); prompt(); return; }
      if (cmd === "pgn") { log(chess.pgn()); prompt(); return; }

      try {
        const fenBefore = chess.fen();
        const result = chess.move(cmd);
        if (!result) { warn(`Illegal move: ${cmd}`); prompt(); return; }
        const fenAfter = chess.fen();
        const uci = `${result.from}${result.to}${result.promotion ?? ""}`;
        await postMove({ san: result.san, uci, fenBefore, fenAfter });
      } catch (err) {
        warn(`Error: ${err.message}`);
      }
      prompt();
    });
  };
  prompt();
}
