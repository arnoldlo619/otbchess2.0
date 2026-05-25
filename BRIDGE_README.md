# OTB Chess — Chessnut Pro Bridge

The **bridge script** (`bridge.mjs`) runs on the laptop or PC that is physically near the Chessnut Pro board. It connects to the board via Bluetooth (BLE), reads the board position in real time, detects legal moves, and posts them to the OTB Chess broadcast server so spectators see the game live.

---

## Requirements

| Requirement | Version |
|-------------|---------|
| Node.js | 18 or later |
| @abandonware/noble | latest |
| chess.js | latest |
| Bluetooth | Enabled on the laptop |
| OS | macOS 12+, Windows 10+, Ubuntu 20.04+ |

---

## One-Time Setup

```bash
# 1. Install dependencies (run once in the project root)
npm install @abandonware/noble chess.js

# On Linux you may also need:
sudo apt-get install bluetooth bluez libbluetooth-dev libudev-dev
```

> **macOS note:** You may be prompted to grant Bluetooth permission to Terminal / your terminal app the first time you run the bridge.

> **Windows note:** Install [WinUSB drivers](https://zadig.akeo.ie/) if noble cannot find the Bluetooth adapter.

---

## Running the Bridge

### Step 1 — Start the Broadcast

1. Open the **Director Dashboard** and click **Connect Board** on the board you want to broadcast.
2. In the BroadcastConsole, click **Start Broadcast**.
3. Under **INPUT SOURCE**, click **Chessnut Pro (Beta)** — the bridge token will appear automatically.
4. Copy the **Broadcast ID** (shown in the URL and the status bar) and the **Bridge Token**.

### Step 2 — Run the Bridge Script

```bash
node bridge.mjs \
  --broadcast-id YOUR_BROADCAST_ID \
  --token        YOUR_BRIDGE_TOKEN \
  --server       https://chessotb.club
```

The bridge will:
1. Scan for a nearby Chessnut board via Bluetooth.
2. Connect and start streaming the board position.
3. Detect each move and post it to the server.
4. Show a heartbeat in the BroadcastConsole every 20 seconds.

### Step 3 — Play

Make moves on the physical board. Each move appears on the broadcast within ~300 ms.

---

## Command-Line Options

| Option | Default | Description |
|--------|---------|-------------|
| `--broadcast-id` | *(required)* | Broadcast ID from BroadcastConsole |
| `--token` | *(required)* | Bridge token from BroadcastConsole |
| `--server` | `https://chessotb.club` | OTB Chess server base URL |
| `--board-name` | `Chessnut` | BLE device name prefix to match |
| `--poll-ms` | `300` | FEN polling interval in milliseconds |
| `--verbose` | `false` | Log every FEN packet received |
| `--help` | — | Show help text |

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| "Broadcast not found" | Check the `--broadcast-id` matches the ID in BroadcastConsole |
| "Token invalid" | Regenerate the token in BroadcastConsole and re-run |
| Board not found via BLE | Ensure Bluetooth is on; board must be powered on and not connected to another device |
| Move not detected | The position may be ambiguous (e.g., two identical pieces can make the same move) — enter the move manually in BroadcastConsole |
| "No legal move detected" warning | A piece was lifted and replaced; the bridge ignores this and waits for the next stable position |
| Bridge crashes on Linux | Run `sudo setcap cap_net_raw+eip $(eval readlink -f $(which node))` to grant BLE permissions without sudo |

---

## How Move Detection Works

The Chessnut Pro streams a **36-byte FEN packet** every ~300 ms via BLE. The bridge:

1. Decodes the packet into a board position (piece placement only) using the [official Chessnut API](https://github.com/chessnutech/Chessnut_eBoards).
2. Compares the new position to the current game state tracked by **chess.js**.
3. Iterates over all legal moves and finds the one whose resulting position matches the new board state.
4. Posts the move (SAN + UCI + FEN before/after) to the server.

This approach handles **all legal moves** including castling, en passant, and promotion — without needing to track which piece moved.

---

## Security

The bridge token is a 32-character random hex string. It is:
- Generated automatically when you switch to Chessnut Pro mode.
- Stored in the database and never exposed to spectators.
- Invalidated when you click **Revoke Token** in BroadcastConsole.
- Scoped to a single broadcast — it cannot be used to post moves to other broadcasts.

---

## Local Development / Testing

To test the bridge without a physical board, you can simulate moves by posting directly to the bridge-move endpoint:

```bash
curl -X POST https://chessotb.club/api/broadcasts/YOUR_ID/bridge-move \
  -H "Content-Type: application/json" \
  -d '{
    "token": "YOUR_TOKEN",
    "san": "e4",
    "uci": "e2e4",
    "fenBefore": "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    "fenAfter": "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1",
    "deviceName": "Test Bridge"
  }'
```
