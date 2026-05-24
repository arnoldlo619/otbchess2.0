#!/usr/bin/env node
/**
 * OTB Chess — Chessnut Pro Local Bridge CLI
 *
 * Connects to a Chessnut Air / Pro e-board via BLE (Bluetooth Low Energy),
 * detects moves by diffing the board state, and POSTs each move to the
 * ChessOTB /api/broadcasts/:id/bridge-move endpoint using a secure token.
 *
 * Usage:
 *   node bridge.mjs \
 *     --broadcast-id <id> \
 *     --token <bridge_token> \
 *     --server https://chessotb.club
 *
 * Or via environment variables:
 *   BROADCAST_ID=xxx BRIDGE_TOKEN=yyy SERVER_URL=https://chessotb.club node bridge.mjs
 *
 * Requirements:
 *   npm install  (installs @abandonware/noble, chess.js, node-fetch, minimist)
 *
 * Platform notes:
 *   macOS  — requires Bluetooth permission for Terminal / iTerm
 *   Linux  — requires: sudo setcap cap_net_raw+eip $(which node)
 *   Windows — use WSL2 with usbipd-win for BLE passthrough
 */

import noble from "@abandonware/noble";
import { Chess } from "chess.js";
import fetch from "node-fetch";
import minimist from "minimist";
import { createInterface } from "readline";

// ─── Config ───────────────────────────────────────────────────────────────────
const argv = minimist(process.argv.slice(2), {
  string: ["broadcast-id", "token", "server", "color"],
  boolean: ["verbose", "dry-run", "help"],
  alias: { h: "help", v: "verbose", d: "dry-run" },
  default: {
    server: process.env.SERVER_URL ?? "https://chessotb.club",
    "broadcast-id": process.env.BROADCAST_ID ?? "",
    token: process.env.BRIDGE_TOKEN ?? "",
    color: process.env.BOARD_COLOR ?? "auto",
    verbose: false,
    "dry-run": false,
  },
});

if (argv.help) {
  console.log(`
OTB Chess — Chessnut Pro Bridge CLI

Usage:
  node bridge.mjs [options]

Options:
  --broadcast-id <id>   Broadcast session ID (required)
  --token <token>       Bridge token from Broadcast Control page (required)
  --server <url>        Server URL (default: https://chessotb.club)
  --color <w|b|auto>    Which side you are playing (default: auto-detect)
  --dry-run, -d         Parse moves but do NOT post to server
  --verbose, -v         Show detailed BLE and move logs
  --help, -h            Show this help

Environment variables:
  BROADCAST_ID          Same as --broadcast-id
  BRIDGE_TOKEN          Same as --token
  SERVER_URL            Same as --server
  BOARD_COLOR           Same as --color

Examples:
  node bridge.mjs --broadcast-id abc123 --token tok_xyz --server https://chessotb.club
  BROADCAST_ID=abc123 BRIDGE_TOKEN=tok_xyz node bridge.mjs --dry-run
`);
  process.exit(0);
}

const BROADCAST_ID = argv["broadcast-id"];
const BRIDGE_TOKEN = argv["token"];
const SERVER_URL = argv["server"].replace(/\/$/, "");
const DRY_RUN = argv["dry-run"];
const VERBOSE = argv["verbose"];

if (!BROADCAST_ID || !BRIDGE_TOKEN) {
  console.error("❌  --broadcast-id and --token are required.");
  console.error("    Run with --help for usage.");
  process.exit(1);
}

// ─── Chessnut BLE Protocol Constants ─────────────────────────────────────────
// Chessnut Air / Pro use the Nordic UART Service (NUS) for communication.
const NORDIC_UART_SERVICE_UUID = "6e400001b5a3f393e0a9e50e24dcca9e";
const NORDIC_UART_TX_UUID      = "6e400002b5a3f393e0a9e50e24dcca9e"; // Write (host → board)
const NORDIC_UART_RX_UUID      = "6e400003b5a3f393e0a9e50e24dcca9e"; // Notify (board → host)

// Command bytes for Chessnut protocol
const CMD_GET_BOARD_STATE = Buffer.from([0x21, 0x01, 0x00]); // Request full board state
const CMD_REAL_TIME_ON    = Buffer.from([0x21, 0x10, 0x00]); // Enable real-time piece updates

// Piece encoding used by Chessnut (4-bit nibble per square, a1=index 0, h8=index 63)
const CHESSNUT_PIECE_MAP = {
  0x00: null,   // empty
  0x01: "wP",   0x02: "wR",   0x03: "wN",   0x04: "wB",   0x05: "wQ",   0x06: "wK",
  0x07: "bP",   0x08: "bR",   0x09: "bN",   0x0A: "bB",   0x0B: "bQ",   0x0C: "bK",
};

// chess.js piece notation
const PIECE_TO_CHESS_JS = {
  wP: { type: "p", color: "w" }, wR: { type: "r", color: "w" },
  wN: { type: "n", color: "w" }, wB: { type: "b", color: "w" },
  wQ: { type: "q", color: "w" }, wK: { type: "k", color: "w" },
  bP: { type: "p", color: "b" }, bR: { type: "r", color: "b" },
  bN: { type: "n", color: "b" }, bB: { type: "b", color: "b" },
  bQ: { type: "q", color: "b" }, bK: { type: "k", color: "b" },
};

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];
const RANKS = ["1", "2", "3", "4", "5", "6", "7", "8"];

// ─── State ────────────────────────────────────────────────────────────────────
const chess = new Chess();
let peripheral = null;
let rxCharacteristic = null;
let txCharacteristic = null;
let lastBoardMap = null;       // Map<square, pieceCode> — last known board state
let moveBuffer = [];           // Accumulated partial data from BLE notifications
let connected = false;
let moveCount = 0;

// ─── Logging ──────────────────────────────────────────────────────────────────
function log(msg)    { console.log(`[bridge] ${msg}`); }
function info(msg)   { console.log(`\x1b[36m[info]\x1b[0m  ${msg}`); }
function ok(msg)     { console.log(`\x1b[32m[ok]\x1b[0m    ${msg}`); }
function warn(msg)   { console.log(`\x1b[33m[warn]\x1b[0m  ${msg}`); }
function error(msg)  { console.error(`\x1b[31m[error]\x1b[0m ${msg}`); }
function verbose(msg){ if (VERBOSE) console.log(`\x1b[90m[debug]\x1b[0m ${msg}`); }

// ─── Chessnut BLE Protocol Parsing ───────────────────────────────────────────
/**
 * Parse a raw 32-byte Chessnut board state packet into a Map<square, pieceCode>.
 * The board is encoded as 64 nibbles (4 bits each), packed into 32 bytes.
 * Square index 0 = a1, 1 = b1, ..., 63 = h8.
 */
function parseBoardState(data) {
  if (data.length < 32) return null;
  const board = new Map();
  for (let i = 0; i < 64; i++) {
    const byteIndex = Math.floor(i / 2);
    const nibble = i % 2 === 0
      ? (data[byteIndex] >> 4) & 0x0F   // high nibble
      : data[byteIndex] & 0x0F;          // low nibble
    const piece = CHESSNUT_PIECE_MAP[nibble] ?? null;
    const file = FILES[i % 8];
    const rank = RANKS[Math.floor(i / 8)];
    const square = `${file}${rank}`;
    board.set(square, piece);
  }
  return board;
}

/**
 * Convert a board Map to a FEN piece placement string (first field only).
 */
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

/**
 * Diff two board maps and attempt to find the legal chess move that
 * transitions from prevBoard to nextBoard using chess.js.
 * Returns { san, uci, fenBefore, fenAfter } or null if no legal move matches.
 */
function detectMove(prevBoard, nextBoard) {
  const fenBefore = chess.fen();
  const legalMoves = chess.moves({ verbose: true });

  // Find squares that changed
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

  verbose(`Board diff — removed: ${JSON.stringify(removed)}, added: ${JSON.stringify(added)}`);

  // Try to match a legal move
  for (const move of legalMoves) {
    // Standard move: piece leaves 'from', arrives at 'to'
    const fromMatch = removed.some(r => r.sq === move.from);
    const toMatch   = added.some(a => a.sq === move.to);
    if (fromMatch && toMatch) {
      // Attempt the move in chess.js
      const result = chess.move({ from: move.from, to: move.to, promotion: move.promotion ?? "q" });
      if (result) {
        const fenAfter = chess.fen();
        const uci = `${move.from}${move.to}${move.promotion ?? ""}`;
        return { san: result.san, uci, fenBefore, fenAfter };
      }
    }
  }

  // Handle castling (king moves 2 squares, rook teleports)
  for (const move of legalMoves) {
    if (move.flags.includes("k") || move.flags.includes("q")) {
      const result = chess.move({ from: move.from, to: move.to });
      if (result) {
        const fenAfter = chess.fen();
        const uci = `${move.from}${move.to}`;
        return { san: result.san, uci, fenBefore, fenAfter };
      }
    }
  }

  return null;
}

// ─── HTTP Bridge ──────────────────────────────────────────────────────────────
async function postMove({ san, uci, fenBefore, fenAfter }) {
  const url = `${SERVER_URL}/api/broadcasts/${BROADCAST_ID}/bridge-move`;
  const body = { token: BRIDGE_TOKEN, san, uci, fenBefore, fenAfter };

  if (DRY_RUN) {
    ok(`[DRY RUN] Would POST move: ${san} (${uci})`);
    verbose(`  FEN before: ${fenBefore}`);
    verbose(`  FEN after:  ${fenAfter}`);
    return true;
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      moveCount++;
      ok(`Move #${moveCount} posted: ${san} (${uci})`);
      return true;
    } else {
      const errBody = await res.text();
      error(`Server rejected move ${san}: ${res.status} ${errBody}`);
      return false;
    }
  } catch (err) {
    error(`Network error posting move: ${err.message}`);
    return false;
  }
}

// ─── BLE Data Handler ─────────────────────────────────────────────────────────
function handleBleData(data) {
  verbose(`BLE RX (${data.length} bytes): ${data.toString("hex")}`);

  // Chessnut sends board state as a response to CMD_GET_BOARD_STATE.
  // The response header is 0xB1 0x1E (board state response, 30 data bytes).
  // Real-time updates use 0xB1 0x10 (piece event).
  // We accumulate bytes until we have a full 32-byte board payload.
  moveBuffer.push(...data);

  // Look for board state packet: header 0x21 followed by 32 bytes of piece data
  // Chessnut response format: [0xB1, cmd, len, ...data]
  while (moveBuffer.length >= 4) {
    const header = moveBuffer[0];
    if (header !== 0xB1) {
      moveBuffer.shift(); // skip unknown byte
      continue;
    }
    const cmd = moveBuffer[1];
    const len = moveBuffer[2];
    if (moveBuffer.length < 3 + len) break; // wait for more data

    const payload = moveBuffer.splice(0, 3 + len).slice(3);

    if (cmd === 0x01 || cmd === 0x10) {
      // Board state response (0x01) or real-time update (0x10)
      if (payload.length >= 32) {
        const newBoard = parseBoardState(Buffer.from(payload));
        if (!newBoard) continue;

        if (!lastBoardMap) {
          // First board state — sync chess.js to the physical board
          lastBoardMap = newBoard;
          const fenRanks = boardMapToFenRanks(newBoard);
          info(`Board synced. Pieces: ${fenRanks}`);
          // If board matches starting position, chess.js is already correct
          // Otherwise warn the director
          const startingFen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR";
          if (fenRanks !== startingFen) {
            warn("Board does not match starting position — make sure pieces are set up correctly before starting.");
          }
          return;
        }

        // Detect move
        const move = detectMove(lastBoardMap, newBoard);
        if (move) {
          lastBoardMap = newBoard;
          postMove(move).catch(err => error(`postMove error: ${err.message}`));
        } else {
          verbose("No legal move detected in board diff — waiting for more changes.");
        }
      }
    }
  }
}

// ─── BLE Connection ───────────────────────────────────────────────────────────
async function connectToBoard(p) {
  peripheral = p;
  info(`Connecting to ${p.advertisement.localName ?? p.id}...`);

  await p.connectAsync();
  ok(`Connected to ${p.advertisement.localName ?? p.id}`);

  const { characteristics } = await p.discoverSomeServicesAndCharacteristicsAsync(
    [NORDIC_UART_SERVICE_UUID],
    [NORDIC_UART_TX_UUID, NORDIC_UART_RX_UUID]
  );

  for (const c of characteristics) {
    if (c.uuid === NORDIC_UART_RX_UUID.replace(/-/g, "")) {
      rxCharacteristic = c;
    }
    if (c.uuid === NORDIC_UART_TX_UUID.replace(/-/g, "")) {
      txCharacteristic = c;
    }
  }

  if (!rxCharacteristic || !txCharacteristic) {
    error("Could not find Nordic UART characteristics. Is this a Chessnut board?");
    process.exit(1);
  }

  // Subscribe to board notifications
  rxCharacteristic.on("data", handleBleData);
  await rxCharacteristic.subscribeAsync();
  ok("Subscribed to board notifications.");

  // Enable real-time updates
  await txCharacteristic.writeAsync(CMD_REAL_TIME_ON, false);
  verbose("Sent CMD_REAL_TIME_ON");

  // Request initial board state
  await txCharacteristic.writeAsync(CMD_GET_BOARD_STATE, false);
  verbose("Sent CMD_GET_BOARD_STATE");

  connected = true;
  info(`Bridge active. Broadcast: ${BROADCAST_ID}`);
  info(`Server: ${SERVER_URL}`);
  if (DRY_RUN) warn("DRY RUN mode — moves will NOT be posted to server.");
  log("Waiting for moves...\n");

  p.once("disconnect", () => {
    connected = false;
    warn("Board disconnected. Attempting to reconnect in 5s...");
    setTimeout(startScanning, 5000);
  });
}

function startScanning() {
  info("Scanning for Chessnut board...");
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
  verbose(`Discovered: ${name} (${p.id})`);
  if (name.toLowerCase().includes("chessnut") || name.toLowerCase().includes("chess")) {
    noble.stopScanning();
    try {
      await connectToBoard(p);
    } catch (err) {
      error(`Connection failed: ${err.message}`);
      setTimeout(startScanning, 5000);
    }
  }
});

// ─── Graceful Shutdown ────────────────────────────────────────────────────────
async function shutdown() {
  log("Shutting down...");
  noble.stopScanning();
  if (peripheral?.state === "connected") {
    await peripheral.disconnectAsync().catch(() => {});
  }
  log(`Session ended. ${moveCount} move(s) posted.`);
  process.exit(0);
}

process.on("SIGINT",  shutdown);
process.on("SIGTERM", shutdown);

// ─── Interactive REPL (for testing without a physical board) ──────────────────
if (DRY_RUN) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  info("DRY RUN interactive mode. Type a SAN move (e.g. e4) and press Enter to simulate.");
  info("Type 'quit' to exit.\n");

  const prompt = () => rl.question("Move> ", async (input) => {
    const san = input.trim();
    if (san === "quit") { await shutdown(); return; }
    if (!san) { prompt(); return; }
    try {
      const fenBefore = chess.fen();
      const result = chess.move(san);
      if (!result) { warn(`Illegal move: ${san}`); prompt(); return; }
      const fenAfter = chess.fen();
      const uci = `${result.from}${result.to}${result.promotion ?? ""}`;
      await postMove({ san: result.san, uci, fenBefore, fenAfter });
    } catch (err) {
      warn(`Error: ${err.message}`);
    }
    prompt();
  });
  prompt();
}
