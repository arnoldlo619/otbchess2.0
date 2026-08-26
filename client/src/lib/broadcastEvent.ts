export interface Broadcast {
  id: string;
  tournamentId: string;
  roundNumber: number;
  boardNumber: number;
  whitePlayerName: string;
  blackPlayerName: string;
  whitePlayerElo?: number | null;
  blackPlayerElo?: number | null;
  status: "ready" | "live" | "paused" | "finished" | "error";
  inputSource: "manual" | "chessnut_pro_beta" | "chessnut_chrome_bluetooth" | "pgn_import";
  displayMode: "standard" | "minimal" | "overlay";
  displaySettings?: Record<string, unknown> | null;
  tournamentName?: string | null;
  bridgeToken?: string | null;
  bridgeStatus?: string | null;
  bridgeDeviceName?: string | null;
  bridgeLastSeenAt?: string | null;
  bridgeErrorMessage?: string | null;
  currentFen: string;
  pgn: string;
  lastMoveSan?: string | null;
  lastMoveUci?: string | null;
  moveNumber: number;
  sideToMove: "w" | "b";
  result?: string | null;
  publicSlug: string;
}

const BROADCAST_STATUSES = new Set<Broadcast["status"]>(["ready", "live", "paused", "finished", "error"]);
const BROADCAST_INPUT_SOURCES = new Set<Broadcast["inputSource"]>(["manual", "chessnut_pro_beta", "chessnut_chrome_bluetooth", "pgn_import"]);
const BROADCAST_DISPLAY_MODES = new Set<Broadcast["displayMode"]>(["standard", "minimal", "overlay"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function parseBroadcastEvent(raw: unknown): Broadcast | null {
  if (typeof raw !== "string") return null;

  try {
    const payload: unknown = JSON.parse(raw);
    if (!isRecord(payload) || !isRecord(payload.broadcast)) return null;

    const broadcast = payload.broadcast;
    const isValid =
      typeof broadcast.id === "string" &&
      typeof broadcast.tournamentId === "string" &&
      typeof broadcast.roundNumber === "number" &&
      typeof broadcast.boardNumber === "number" &&
      typeof broadcast.whitePlayerName === "string" &&
      typeof broadcast.blackPlayerName === "string" &&
      typeof broadcast.status === "string" && BROADCAST_STATUSES.has(broadcast.status as Broadcast["status"]) &&
      typeof broadcast.inputSource === "string" && BROADCAST_INPUT_SOURCES.has(broadcast.inputSource as Broadcast["inputSource"]) &&
      typeof broadcast.displayMode === "string" && BROADCAST_DISPLAY_MODES.has(broadcast.displayMode as Broadcast["displayMode"]) &&
      typeof broadcast.currentFen === "string" &&
      typeof broadcast.pgn === "string" &&
      typeof broadcast.moveNumber === "number" &&
      (broadcast.sideToMove === "w" || broadcast.sideToMove === "b") &&
      typeof broadcast.publicSlug === "string";

    return isValid ? broadcast as unknown as Broadcast : null;
  } catch {
    return null;
  }
}
