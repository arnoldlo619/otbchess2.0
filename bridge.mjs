#!/usr/bin/env node
/**
 * OTB Chess — Chessnut Pro Bridge Script  (bridge.mjs)
 * =====================================================
 * Run this on the laptop/PC that is physically near the Chessnut Pro board.
 * It connects to the board via Bluetooth (BLE), reads the board position in
 * real time, detects legal moves, and posts them to the OTB Chess broadcast
 * server so spectators see the game live.
 *
 * Requirements
 * ────────────
 *   Node.js 18+  (ES modules, fetch built-in)
 *   @abandonware/noble   → BLE adapter (npm install @abandonware/noble)
 *   chess.js             → move validation  (npm install chess.js)
 *
 * Quick start
 * ───────────
 *   npm install @abandonware/noble chess.js
 *   node bridge.mjs --broadcast-id <ID> --token <TOKEN> --server https://chessotb.club
 *
 * Arguments
 * ─────────
 *   --broadcast-id   The broadcast ID shown in the BroadcastConsole (required)
 *   --token          The bridge token shown in the BroadcastConsole (required)
 *   --server         Base URL of the OTB Chess server (default: https://chessotb.club)
 *   --board-name     Partial BLE device name to match (default: "Chessnut")
 *   --poll-ms        FEN polling interval in ms (default: 300)
 *   --verbose        Print every FEN received (default: false)
 *   --help           Show this help text
 *
 * How it works
 * ────────────
 *   1. Scans for a BLE device whose name starts with "Chessnut".
 *   2. Connects and subscribes to the FEN notification characteristic.
 *   3. Sends the "start FEN stream" command [0x21, 0x01, 0x00].
 *   4. Decodes each 36-byte FEN packet using the official Chessnut API.
 *   5. Compares the new board position to the last known position using
 *      chess.js to identify which legal move was played.
 *   6. POSTs the move (SAN + UCI + FEN) to /api/broadcasts/:id/bridge-move.
 *   7. Sends a heartbeat every 20 seconds so the console shows "Connected".
 *   8. Reconnects automatically on BLE disconnect.
 */

import { createRequire } from "module";
import { parseArgs } from "util";

const require = createRequire(import.meta.url);

// ─── Argument parsing ─────────────────────────────────────────────────────────
const { values: args } = parseArgs({
  options: {
    "broadcast-id": { type: "string" },
    token:          { type: "string" },
    server:         { type: "string", default: "https://chessotb.club" },
    "board-name":   { type: "string", default: "Chessnut" },
    "poll-ms":      { type: "string", default: "300" },
    verbose:        { type: "boolean", default: false },
    help:           { type: "boolean", default: false },
  },
  strict: false,
});

if (args.help) {
  console.log(`
OTB Chess — Chessnut Pro Bridge

Usage:
  node bridge.mjs --broadcast-id <ID> --token <TOKEN> [options]

Options:
  --broadcast-id   Broadcast ID from BroadcastConsole (required)
  --token          Bridge token from BroadcastConsole (required)
  --server         OTB Chess server URL (default: https://chessotb.club)
  --board-name     BLE device name prefix to match (default: Chessnut)
  --poll-ms        FEN polling interval ms (default: 300)
  --verbose        Log every FEN packet received
  --help           Show this help
`);
  process.exit(0);
}

const BROADCAST_ID  = args["broadcast-id"];
const TOKEN         = args["token"];
const SERVER        = (args["server"] || "https://chessotb.club").replace(/\/$/, "");
const BOARD_NAME    = args["board-name"] || "Chessnut";
const POLL_MS       = parseInt(args["poll-ms"] || "300", 10);
const VERBOSE       = args["verbose"] === true;
const BRIDGE_VER    = "1.0.0";

if (!BROADCAST_ID || !TOKEN) {
  console.error("❌  --broadcast-id and --token are required.");
  console.error("    Find them in the BroadcastConsole under INPUT SOURCE → Chessnut Pro (Beta).");
  process.exit(1);
}

// ─── Chessnut BLE UUIDs (official API) ────────────────────────────────────────
const FEN_SERVICE_UUID        = "1b7e82612877-41c3b46ecf057c562023".replace(/-/g, "");
const FEN_CHAR_UUID           = "1b7e82622877-41c3b46ecf057c562023".replace(/-/g, "");
const OPS_SERVICE_UUID        = "1b7e82712877-41c3b46ecf057c562023".replace(/-/g, "");
const OPS_WRITE_CHAR_UUID     = "1b7e82722877-41c3b46ecf057c562023".replace(/-/g, "");
const OPS_RESPONSE_CHAR_UUID  = "1b7e82732877-41c3b46ecf057c562023".replace(/-/g, "");

// Command to enable real-time FEN streaming
const CMD_START_FEN = Buffer.from([0x21, 0x01, 0x00]);

// ─── Piece mapping (official Chessnut API) ────────────────────────────────────
const PIECE_MAP = ["", "q", "k", "b", "p", "n", "R", "P", "r", "B", "N", "Q", "K"];

/**
 * Decode a 36-byte Chessnut FEN packet into a FEN position string.
 * Only the piece placement part (no side-to-move, castling, etc.).
 */
function decodeFenBytes(data) {
  let fen = "";
  let empty = 0;
  for (let row = 0; row < 8; row++) {
    for (let col = 7; col >= 0; col--) {
      const index = Math.floor((row * 8 + col) / 2) + 2;
      const pieceVal = (col % 2 === 0) ? data[index] & 0x0f : data[index] >> 4;
      const piece = PIECE_MAP[pieceVal] ?? "";
      if (piece === "") {
        empty++;
      } else {
        if (empty > 0) { fen += empty; empty = 0; }
        fen += piece;
      }
    }
    if (empty > 0) { fen += empty; empty = 0; }
    if (row < 7) fen += "/";
  }
  return fen;
}

// ─── State ────────────────────────────────────────────────────────────────────
let chess;           // chess.js instance (tracks game state for move detection)
let lastFenParts;    // last board-only FEN (piece placement, no metadata)
let peripheral;      // noble peripheral handle
let fenChar;         // BLE FEN characteristic
let opsWriteChar;    // BLE ops write characteristic
let heartbeatTimer;  // setInterval handle
let reconnectTimer;  // setTimeout handle
let isConnected = false;
let moveCount = 0;

// ─── Logging helpers ──────────────────────────────────────────────────────────
const ts = () => new Date().toISOString().slice(11, 23);
const log  = (...a) => console.log(`[${ts()}]`, ...a);
const info = (...a) => console.log(`[${ts()}] ℹ️ `, ...a);
const ok   = (...a) => console.log(`[${ts()}] ✅`, ...a);
const warn = (...a) => console.warn(`[${ts()}] ⚠️ `, ...a);
const err  = (...a) => console.error(`[${ts()}] ❌`, ...a);

// ─── Server communication ─────────────────────────────────────────────────────
async function postMove({ san, uci, fenBefore, fenAfter }) {
  try {
    const res = await fetch(`${SERVER}/api/broadcasts/${BROADCAST_ID}/bridge-move`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: TOKEN,
        san,
        uci,
        fenBefore,
        fenAfter,
        deviceName: `Chessnut Pro (bridge v${BRIDGE_VER})`,
        bridgeVersion: BRIDGE_VER,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      warn(`Move POST failed (${res.status}): ${body}`);
      return false;
    }
    return true;
  } catch (e) {
    warn("Move POST error:", e.message);
    return false;
  }
}

async function sendHeartbeat(status = "connected", errorMsg = null) {
  try {
    await fetch(`${SERVER}/api/broadcasts/${BROADCAST_ID}/bridge-heartbeat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: TOKEN,
        status,
        deviceName: `Chessnut Pro (bridge v${BRIDGE_VER})`,
        connectionType: "ble",
        bridgeVersion: BRIDGE_VER,
        ...(errorMsg ? { error: errorMsg } : {}),
      }),
    });
  } catch (e) {
    warn("Heartbeat error:", e.message);
  }
}

// ─── Move detection ───────────────────────────────────────────────────────────
/**
 * Given a new board-only FEN, try to find which legal move was played
 * from the current chess.js position. Returns { san, uci } or null.
 */
function detectMove(newFenParts) {
  const moves = chess.moves({ verbose: true });
  for (const move of moves) {
    const testChess = chess.clone ? chess.clone() : null;
    if (!testChess) {
      // chess.js v1 doesn't have .clone(); use a workaround
      const { Chess } = require("chess.js");
      const tc = new Chess(chess.fen());
      tc.move(move);
      const resultFen = tc.fen().split(" ")[0];
      if (resultFen === newFenParts) {
        return { san: move.san, uci: move.from + move.to + (move.promotion || "") };
      }
    } else {
      testChess.move(move);
      const resultFen = testChess.fen().split(" ")[0];
      if (resultFen === newFenParts) {
        return { san: move.san, uci: move.from + move.to + (move.promotion || "") };
      }
    }
  }
  return null;
}

// ─── BLE FEN handler ──────────────────────────────────────────────────────────
async function onFenData(data) {
  if (data.length < 34) return; // malformed packet

  const newFenParts = decodeFenBytes(data);
  if (VERBOSE) log("FEN:", newFenParts);

  // Skip if position unchanged
  if (newFenParts === lastFenParts) return;

  const prevFen = chess.fen();
  const prevFenParts = prevFen.split(" ")[0];

  // Detect a move
  const detected = detectMove(newFenParts);
  if (detected) {
    const fenBefore = prevFen;
    chess.move(detected.san);
    const fenAfter = chess.fen();
    moveCount++;
    ok(`Move ${moveCount}: ${detected.san} (${detected.uci})`);
    const posted = await postMove({ ...detected, fenBefore, fenAfter });
    if (posted) {
      ok(`  → Posted to server`);
    }
  } else if (newFenParts !== prevFenParts) {
    // Position changed but no legal move matches — could be a piece lift/replace
    // or a position correction. Log it but don't post.
    if (VERBOSE) warn("Position changed but no legal move detected. Possible piece lift or desync.");
  }

  lastFenParts = newFenParts;
}

// ─── BLE connection ───────────────────────────────────────────────────────────
async function connectToBoard(noble) {
  return new Promise((resolve, reject) => {
    info(`Scanning for BLE device matching "${BOARD_NAME}"...`);

    noble.startScanning([], false, (scanErr) => {
      if (scanErr) return reject(new Error(`Scan error: ${scanErr}`));
    });

    noble.on("discover", async (p) => {
      const name = p.advertisement?.localName || "";
      if (!name.toLowerCase().includes(BOARD_NAME.toLowerCase())) return;

      ok(`Found board: "${name}" (${p.id})`);
      noble.stopScanning();
      peripheral = p;

      p.connect((connErr) => {
        if (connErr) return reject(new Error(`Connect error: ${connErr}`));
        ok("BLE connected!");

        p.discoverAllServicesAndCharacteristics(async (discErr, services, chars) => {
          if (discErr) return reject(new Error(`Discover error: ${discErr}`));

          // Find the characteristics we need
          fenChar = chars.find(c => c.uuid.replace(/-/g, "") === FEN_CHAR_UUID);
          opsWriteChar = chars.find(c => c.uuid.replace(/-/g, "") === OPS_WRITE_CHAR_UUID);

          if (!fenChar) return reject(new Error("FEN characteristic not found. Is this a Chessnut board?"));
          if (!opsWriteChar) return reject(new Error("Ops write characteristic not found."));

          // Subscribe to FEN notifications
          fenChar.subscribe((subErr) => {
            if (subErr) return reject(new Error(`Subscribe error: ${subErr}`));
            info("Subscribed to FEN notifications.");
          });

          fenChar.on("data", onFenData);

          // Send the "start FEN stream" command
          opsWriteChar.write(CMD_START_FEN, false, (writeErr) => {
            if (writeErr) warn("Failed to send start-FEN command:", writeErr);
            else info("FEN streaming enabled.");
          });

          isConnected = true;
          resolve();
        });
      });

      p.on("disconnect", () => {
        isConnected = false;
        warn("Board disconnected. Reconnecting in 5 seconds...");
        clearInterval(heartbeatTimer);
        sendHeartbeat("disconnected");
        reconnectTimer = setTimeout(() => startBridge(noble), 5000);
      });
    });
  });
}

// ─── Main bridge loop ─────────────────────────────────────────────────────────
async function startBridge(noble) {
  // Reset chess state
  const { Chess } = require("chess.js");
  chess = new Chess();
  lastFenParts = chess.fen().split(" ")[0];

  try {
    await connectToBoard(noble);
  } catch (e) {
    err("Connection failed:", e.message);
    info("Retrying in 10 seconds...");
    await sendHeartbeat("error", e.message);
    reconnectTimer = setTimeout(() => startBridge(noble), 10000);
    return;
  }

  // Send initial heartbeat
  await sendHeartbeat("connected");

  // Heartbeat every 20 seconds
  heartbeatTimer = setInterval(() => sendHeartbeat("connected"), 20_000);

  ok(`Bridge running. Watching broadcast ${BROADCAST_ID} on ${SERVER}`);
  info("Make moves on the board — they will appear on the live broadcast automatically.");
  info("Press Ctrl+C to stop.");
}

// ─── Entry point ─────────────────────────────────────────────────────────────
(async () => {
  log("OTB Chess — Chessnut Pro Bridge v" + BRIDGE_VER);
  log("Broadcast ID:", BROADCAST_ID);
  log("Server:", SERVER);
  log("");

  // Verify server connectivity
  try {
    const ping = await fetch(`${SERVER}/api/broadcasts/${BROADCAST_ID}`, {
      headers: { "Accept": "application/json" },
    });
    if (ping.status === 404) {
      err(`Broadcast "${BROADCAST_ID}" not found on server. Check the ID in BroadcastConsole.`);
      process.exit(1);
    }
    if (!ping.ok && ping.status !== 401) {
      warn(`Server returned ${ping.status} — proceeding anyway.`);
    } else {
      ok("Server reachable.");
    }
  } catch (e) {
    err("Cannot reach server:", e.message);
    err("Check --server URL and your internet connection.");
    process.exit(1);
  }

  // Load noble
  let noble;
  try {
    noble = require("@abandonware/noble");
  } catch (e) {
    err("@abandonware/noble not found.");
    err("Run:  npm install @abandonware/noble chess.js");
    process.exit(1);
  }

  noble.on("stateChange", async (state) => {
    if (state === "poweredOn") {
      await startBridge(noble);
    } else {
      warn("Bluetooth state:", state);
      if (state === "poweredOff") {
        err("Bluetooth is off. Please enable Bluetooth and restart the bridge.");
      }
    }
  });

  // Graceful shutdown
  process.on("SIGINT", async () => {
    log("\nShutting down...");
    clearInterval(heartbeatTimer);
    clearTimeout(reconnectTimer);
    await sendHeartbeat("disconnected");
    if (peripheral && isConnected) {
      peripheral.disconnect(() => process.exit(0));
    } else {
      process.exit(0);
    }
  });
})();
