# Chessnut Pro → ChessOTB Bridge CLI

A standalone Node.js CLI that connects to a **Chessnut Air / Pro** e-board via Bluetooth Low Energy (BLE), detects moves in real time by diffing the physical board state, and automatically POSTs each move to the ChessOTB live broadcast system.

---

## Quick Start

```bash
# 1. Install dependencies
cd chessnut-bridge
npm install

# 2. Get your Broadcast ID and Bridge Token
#    → Open the Director Dashboard
#    → Click "Broadcast" on the board you want to stream
#    → Copy the Broadcast ID and Bridge Token from the control panel

# 3. Run the bridge
node bridge.mjs \
  --broadcast-id <BROADCAST_ID> \
  --token <BRIDGE_TOKEN> \
  --server https://chessotb.club
```

---

## Options

| Flag | Env Var | Description | Default |
|---|---|---|---|
| `--broadcast-id` | `BROADCAST_ID` | Broadcast session ID (required) | — |
| `--token` | `BRIDGE_TOKEN` | Bridge token from Broadcast Control (required) | — |
| `--server` | `SERVER_URL` | ChessOTB server URL | `https://chessotb.club` |
| `--color` | `BOARD_COLOR` | Side you are playing (`w`, `b`, `auto`) | `auto` |
| `--dry-run`, `-d` | — | Parse moves but do NOT post to server | `false` |
| `--verbose`, `-v` | — | Show detailed BLE and move logs | `false` |
| `--help`, `-h` | — | Show help | — |

---

## Testing Without a Physical Board

Use `--dry-run` to enter interactive mode and type SAN moves manually:

```bash
node bridge.mjs \
  --broadcast-id <BROADCAST_ID> \
  --token <BRIDGE_TOKEN> \
  --dry-run --verbose

# Then type moves at the prompt:
Move> e4
Move> e5
Move> Nf3
```

This lets you verify the server integration before connecting the physical board.

---

## Platform Setup

### macOS

1. Open **System Settings → Privacy & Security → Bluetooth**
2. Grant Bluetooth access to **Terminal** (or iTerm2)
3. Run `node bridge.mjs ...` — no sudo required

### Linux (Ubuntu / Raspberry Pi)

```bash
# Grant Node.js raw Bluetooth access (one-time setup)
sudo setcap cap_net_raw+eip $(which node)

# Or run with sudo (less preferred)
sudo node bridge.mjs ...
```

**Raspberry Pi** is the recommended always-on hardware for tournament use. A Pi Zero 2W or Pi 4 works perfectly.

### Windows

Use **WSL2** with [usbipd-win](https://github.com/dorssel/usbipd-win) to pass the Bluetooth adapter through to WSL:

```powershell
# In PowerShell (admin)
usbipd list
usbipd bind --busid <BUS_ID>
usbipd attach --wsl --busid <BUS_ID>
```

Then run the bridge inside WSL2 as you would on Linux.

---

## How It Works

```
Chessnut Pro (BLE)
      │
      │  Nordic UART Service (NUS)
      │  RX: 6e400003... (board → host, notifications)
      │  TX: 6e400002... (host → board, commands)
      │
      ▼
bridge.mjs
  1. Sends CMD_REAL_TIME_ON  → enables piece-change notifications
  2. Sends CMD_GET_BOARD_STATE → gets initial 32-byte piece map
  3. On each notification:
     a. Parses 32-byte payload → Map<square, piece>
     b. Diffs against previous board state
     c. Matches diff against chess.js legal moves
     d. If match found → POST /api/broadcasts/:id/bridge-move
  4. Server validates token, records move, fans out via SSE
      │
      ▼
ChessOTB Live Broadcast
  - Broadcast Control page updates in real time
  - Public Live Board (/live/board/:slug) updates for spectators
  - Venue Display (/live/board/:slug/display) updates on projector
```

---

## BLE Protocol Details

The Chessnut Air / Pro uses the **Nordic UART Service (NUS)**:

| UUID | Direction | Purpose |
|---|---|---|
| `6e400001-...` | Service | Nordic UART Service |
| `6e400002-...` | Write (host→board) | Send commands |
| `6e400003-...` | Notify (board→host) | Receive board state |

**Board state encoding:** 64 squares encoded as 4-bit nibbles, packed into 32 bytes. Square index 0 = a1, index 63 = h8.

| Nibble | Piece |
|---|---|
| `0x00` | Empty |
| `0x01` | White Pawn |
| `0x02` | White Rook |
| `0x03` | White Knight |
| `0x04` | White Bishop |
| `0x05` | White Queen |
| `0x06` | White King |
| `0x07` | Black Pawn |
| `0x08` | Black Rook |
| `0x09` | Black Knight |
| `0x0A` | Black Bishop |
| `0x0B` | Black Queen |
| `0x0C` | Black King |

---

## Troubleshooting

**"No Chessnut board found"**
- Make sure the board is powered on and in pairing mode (LED blinking)
- On macOS, check Bluetooth permissions for Terminal
- On Linux, check `sudo setcap cap_net_raw+eip $(which node)`

**"Invalid bridge token"**
- The token is generated per broadcast session — get a fresh one from the Broadcast Control page
- Tokens are stored in the `live_broadcasts.bridgeToken` column

**"Broadcast is not live"**
- The director must click **Start Broadcast** on the control page before the bridge can post moves

**"No legal move detected"**
- The board diff did not match any legal chess move — this can happen if pieces were adjusted or the board was disturbed
- The bridge will wait for the next change and retry automatically

**Move detection lag**
- The bridge polls on BLE notifications (real-time mode) — typical latency is < 200ms
- If moves are being missed, try `--verbose` to see the raw BLE data

---

## Running as a Background Service (Raspberry Pi)

Create `/etc/systemd/system/chessnut-bridge.service`:

```ini
[Unit]
Description=Chessnut Pro Bridge
After=bluetooth.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/otb-chess/chessnut-bridge
ExecStart=/usr/bin/node bridge.mjs
Environment=BROADCAST_ID=your_broadcast_id
Environment=BRIDGE_TOKEN=your_bridge_token
Environment=SERVER_URL=https://chessotb.club
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable chessnut-bridge
sudo systemctl start chessnut-bridge
sudo journalctl -u chessnut-bridge -f
```

---

## License

MIT — part of the ChessOTB.club platform.
