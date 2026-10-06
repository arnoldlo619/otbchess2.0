import { createCanvas, type SKRSContext2D } from "@napi-rs/canvas";

export interface LeagueSeasonCardStanding {
  rank: number;
  displayName: string;
  points: number;
  wins: number;
  draws: number;
  losses: number;
}

export interface LeagueSeasonCardData {
  leagueName: string;
  clubName?: string | null;
  formatType: string;
  totalWeeks: number;
  totalMatches: number;
  champion: LeagueSeasonCardStanding;
  standings: LeagueSeasonCardStanding[];
}

export interface LeaguePlayerCardData {
  leagueName: string;
  clubName?: string | null;
  formatType: string;
  totalWeeks: number;
  player: LeagueSeasonCardStanding;
  bestResult: string;
}

const WIDTH = 1200;
const HEIGHT = 630;

function roundedRect(
  ctx: SKRSContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function drawText(ctx: SKRSContext2D, text: string, x: number, y: number, maxWidth: number) {
  const ellipsis = "…";
  if (ctx.measureText(text).width <= maxWidth) {
    ctx.fillText(text, x, y);
    return;
  }

  let shortened = text;
  while (shortened.length > 0 && ctx.measureText(`${shortened}${ellipsis}`).width > maxWidth) {
    shortened = shortened.slice(0, -1);
  }
  ctx.fillText(`${shortened}${ellipsis}`, x, y);
}

function formatTypeLabel(formatType: string) {
  return formatType.replace(/_/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

/**
 * Renders a 1200×630 social sharing image for a completed League season.
 * The card deliberately uses only first-party season data and vector geometry,
 * so image generation is deterministic and needs no remote asset fetches.
 */
export function renderLeagueSeasonCard(data: LeagueSeasonCardData): Buffer {
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext("2d");

  const background = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  background.addColorStop(0, "#07170e");
  background.addColorStop(0.5, "#0f3b24");
  background.addColorStop(1, "#07120c");
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  const glow = ctx.createRadialGradient(210, 560, 30, 210, 560, 610);
  glow.addColorStop(0, "rgba(124, 220, 118, 0.24)");
  glow.addColorStop(1, "rgba(124, 220, 118, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.strokeStyle = "rgba(160, 231, 154, 0.10)";
  ctx.lineWidth = 1;
  for (let offset = -220; offset < WIDTH + HEIGHT; offset += 88) {
    ctx.beginPath();
    ctx.moveTo(offset, 0);
    ctx.lineTo(offset + HEIGHT, HEIGHT);
    ctx.stroke();
  }

  roundedRect(ctx, 54, 46, 1092, 538, 30);
  ctx.fillStyle = "rgba(4, 15, 8, 0.66)";
  ctx.fill();
  ctx.strokeStyle = "rgba(174, 246, 168, 0.17)";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = "#a8f39e";
  ctx.font = "700 22px sans-serif";
  ctx.fillText("OTB!!", 94, 98);

  ctx.fillStyle = "rgba(240, 255, 239, 0.64)";
  ctx.font = "600 15px sans-serif";
  ctx.fillText((data.clubName || "ChessOTB Club").toUpperCase(), 94, 126);

  ctx.textAlign = "right";
  ctx.fillStyle = "rgba(240, 255, 239, 0.58)";
  ctx.font = "600 14px sans-serif";
  ctx.fillText("SEASON COMPLETE", 1106, 98);
  ctx.textAlign = "left";

  ctx.fillStyle = "#f4fff0";
  ctx.font = "700 46px sans-serif";
  drawText(ctx, data.leagueName, 94, 195, 790);

  ctx.fillStyle = "rgba(231, 255, 226, 0.62)";
  ctx.font = "500 18px sans-serif";
  ctx.fillText(`${formatTypeLabel(data.formatType)} · ${data.totalWeeks} weeks · ${data.totalMatches} completed matches`, 94, 229);

  roundedRect(ctx, 94, 272, 430, 232, 22);
  ctx.fillStyle = "rgba(196, 150, 49, 0.14)";
  ctx.fill();
  ctx.strokeStyle = "rgba(245, 199, 85, 0.52)";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = "#f6ca6b";
  ctx.font = "700 14px sans-serif";
  ctx.fillText("SEASON CHAMPION", 126, 314);

  ctx.beginPath();
  ctx.arc(155, 390, 38, 0, Math.PI * 2);
  ctx.fillStyle = "#e7b953";
  ctx.fill();
  ctx.fillStyle = "#1e311e";
  ctx.font = "800 28px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("1", 155, 400);
  ctx.textAlign = "left";

  ctx.fillStyle = "#fff7d9";
  ctx.font = "700 30px sans-serif";
  drawText(ctx, data.champion.displayName, 214, 384, 270);
  ctx.fillStyle = "rgba(255, 247, 217, 0.70)";
  ctx.font = "600 16px sans-serif";
  ctx.fillText(`${data.champion.points} pts · ${data.champion.wins}W ${data.champion.draws}D ${data.champion.losses}L`, 214, 416);

  ctx.fillStyle = "rgba(255, 247, 217, 0.48)";
  ctx.font = "500 13px sans-serif";
  ctx.fillText("Ranked by tournament points", 126, 472);

  const rows = data.standings.slice(0, 4);
  const startY = 274;
  const rowHeight = 58;
  const rankColors = ["#f6ca6b", "#c8d1d5", "#d4915c", "#8de589"];
  for (let index = 0; index < rows.length; index += 1) {
    const standing = rows[index];
    const rowY = startY + index * rowHeight;
    const isChampion = index === 0;
    roundedRect(ctx, 566, rowY, 540, 48, 14);
    ctx.fillStyle = isChampion ? "rgba(157, 237, 143, 0.16)" : "rgba(255, 255, 255, 0.045)";
    ctx.fill();

    ctx.fillStyle = rankColors[index] || "#d5ead4";
    ctx.font = "700 16px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`${index + 1}`, 601, rowY + 30);
    ctx.textAlign = "left";

    ctx.fillStyle = "#f4fff0";
    ctx.font = "600 17px sans-serif";
    drawText(ctx, standing.displayName, 632, rowY + 30, 290);

    ctx.fillStyle = "rgba(231, 255, 226, 0.62)";
    ctx.font = "500 13px sans-serif";
    ctx.fillText(`${standing.wins}W ${standing.draws}D ${standing.losses}L`, 890, rowY + 29);

    ctx.textAlign = "right";
    ctx.fillStyle = isChampion ? "#b8f6a9" : "#d8f1d3";
    ctx.font = "700 17px sans-serif";
    ctx.fillText(`${standing.points} pts`, 1071, rowY + 30);
    ctx.textAlign = "left";
  }

  ctx.fillStyle = "rgba(231, 255, 226, 0.46)";
  ctx.font = "500 14px sans-serif";
  ctx.fillText("chessotb.club", 94, 550);
  ctx.textAlign = "right";
  ctx.fillText("Over the board. Together.", 1106, 550);
  ctx.textAlign = "left";

  return canvas.toBuffer("image/png");
}

/** Renders a 1200×630 final-season player card without remote asset fetching. */
export function renderLeaguePlayerCard(data: LeaguePlayerCardData): Buffer {
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext("2d");
  const initials = data.player.displayName
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase() || "P";

  const background = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  background.addColorStop(0, "#0a2515");
  background.addColorStop(0.56, "#144e2d");
  background.addColorStop(1, "#07140c");
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.fillStyle = "rgba(158, 241, 146, 0.075)";
  for (let x = 0; x < WIDTH; x += 74) {
    for (let y = 0; y < HEIGHT; y += 74) {
      ctx.fillRect(x, y, 36, 36);
    }
  }

  roundedRect(ctx, 54, 46, 1092, 538, 30);
  ctx.fillStyle = "rgba(4, 15, 8, 0.72)";
  ctx.fill();
  ctx.strokeStyle = "rgba(174, 246, 168, 0.17)";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = "#a8f39e";
  ctx.font = "700 22px sans-serif";
  ctx.fillText("OTB!!", 94, 98);
  ctx.fillStyle = "rgba(240, 255, 239, 0.64)";
  ctx.font = "600 15px sans-serif";
  ctx.fillText((data.clubName || "ChessOTB Club").toUpperCase(), 94, 126);

  ctx.textAlign = "right";
  ctx.fillStyle = "rgba(240, 255, 239, 0.58)";
  ctx.font = "600 14px sans-serif";
  ctx.fillText("SEASON PLAYER CARD", 1106, 98);
  ctx.textAlign = "left";

  ctx.fillStyle = "rgba(231, 255, 226, 0.62)";
  ctx.font = "600 16px sans-serif";
  ctx.fillText(`${data.leagueName} · ${formatTypeLabel(data.formatType)} · ${data.totalWeeks} weeks`, 94, 177);

  ctx.beginPath();
  ctx.arc(210, 332, 94, 0, Math.PI * 2);
  ctx.fillStyle = "#2d8050";
  ctx.fill();
  ctx.strokeStyle = "#a8f39e";
  ctx.lineWidth = 5;
  ctx.stroke();
  ctx.fillStyle = "#edffea";
  ctx.font = "800 66px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(initials, 210, 355);
  ctx.textAlign = "left";

  ctx.beginPath();
  ctx.arc(278, 405, 33, 0, Math.PI * 2);
  ctx.fillStyle = data.player.rank === 1 ? "#f6ca6b" : "#d8f1d3";
  ctx.fill();
  ctx.fillStyle = "#173420";
  ctx.font = "800 21px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(`#${data.player.rank}`, 278, 413);
  ctx.textAlign = "left";

  ctx.fillStyle = "#f4fff0";
  ctx.font = "700 45px sans-serif";
  drawText(ctx, data.player.displayName, 354, 293, 650);
  ctx.fillStyle = "#b8f6a9";
  ctx.font = "700 28px sans-serif";
  ctx.fillText(`${data.player.points} pts`, 354, 338);
  ctx.fillStyle = "rgba(231, 255, 226, 0.64)";
  ctx.font = "600 18px sans-serif";
  ctx.fillText(`${data.player.wins} wins · ${data.player.draws} draws · ${data.player.losses} losses`, 354, 374);

  roundedRect(ctx, 354, 416, 656, 74, 16);
  ctx.fillStyle = "rgba(168, 243, 158, 0.10)";
  ctx.fill();
  ctx.fillStyle = "rgba(231, 255, 226, 0.52)";
  ctx.font = "600 13px sans-serif";
  ctx.fillText("BEST RESULT", 382, 446);
  ctx.fillStyle = "#e6ffe0";
  ctx.font = "700 19px sans-serif";
  drawText(ctx, data.bestResult, 382, 474, 590);

  ctx.fillStyle = "rgba(231, 255, 226, 0.46)";
  ctx.font = "500 14px sans-serif";
  ctx.fillText("chessotb.club", 94, 550);
  ctx.textAlign = "right";
  ctx.fillText("Over the board. Together.", 1106, 550);
  ctx.textAlign = "left";

  return canvas.toBuffer("image/png");
}
