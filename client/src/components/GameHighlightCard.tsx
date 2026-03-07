/**
 * GameHighlightCard
 *
 * Renders a 1080×1080 shareable highlight card for the game's most critical
 * moment (largest eval swing). Used as the hidden export target for html2canvas.
 *
 * Layout:
 *   ┌─────────────────────────────────┐
 *   │  ChessOTB.club branding (top)   │
 *   │  Player names + result          │
 *   │  Opening badge                  │
 *   │  ─────────────────────────────  │
 *   │  Chessboard (react-chessboard)  │
 *   │  ─────────────────────────────  │
 *   │  Classification badge           │
 *   │  Move annotation                │
 *   │  Eval bar                       │
 *   │  Accuracy row                   │
 *   └─────────────────────────────────┘
 */
import { forwardRef } from "react";
import { Chessboard } from "react-chessboard";

// ── Classification config ─────────────────────────────────────────────────────
const CLASSIFICATION_CONFIG: Record<
  string,
  { label: string; emoji: string; bg: string; text: string; border: string }
> = {
  blunder: {
    label: "Blunder",
    emoji: "??",
    bg: "#7f1d1d",
    text: "#fca5a5",
    border: "#ef4444",
  },
  mistake: {
    label: "Mistake",
    emoji: "?",
    bg: "#7c2d12",
    text: "#fdba74",
    border: "#f97316",
  },
  inaccuracy: {
    label: "Inaccuracy",
    emoji: "?!",
    bg: "#713f12",
    text: "#fde68a",
    border: "#eab308",
  },
  best: {
    label: "Best Move",
    emoji: "!!",
    bg: "#052e16",
    text: "#6ee7b7",
    border: "#10b981",
  },
  good: {
    label: "Good Move",
    emoji: "!",
    bg: "#14532d",
    text: "#86efac",
    border: "#22c55e",
  },
};

// ── Props ─────────────────────────────────────────────────────────────────────
export interface GameHighlightCardProps {
  fen: string;
  moveNumber: number;
  moveColor: string; // "w" | "b"
  san: string;
  classification: string;
  evalCp: number;
  evalSwing: number;
  whitePlayer: string;
  blackPlayer: string;
  result: string | null;
  openingName: string | null;
  openingEco: string | null;
  whiteAccuracy: number | null;
  blackAccuracy: number | null;
  boardOrientation?: "white" | "black";
}

// ── Eval bar (inline for canvas rendering) ────────────────────────────────────
function HighlightEvalBar({ evalCp }: { evalCp: number }) {
  const clampedEval = Math.max(-1000, Math.min(1000, evalCp));
  const whitePercent = 50 + (clampedEval / 1000) * 50;
  const evalDisplay =
    Math.abs(evalCp) >= 10000
      ? evalCp > 0
        ? "M" + Math.ceil((10000 - Math.abs(evalCp)) / 100)
        : "-M" + Math.ceil((10000 - Math.abs(evalCp)) / 100)
      : (evalCp / 100).toFixed(1);

  return (
    <div style={{ width: "100%", marginTop: 12 }}>
      <div
        style={{
          height: 12,
          borderRadius: 6,
          overflow: "hidden",
          display: "flex",
          background: "#374151",
        }}
      >
        <div
          style={{
            width: `${whitePercent}%`,
            background: "#f9fafb",
            borderRadius: "6px 0 0 6px",
            transition: "width 0.5s ease",
          }}
        />
        <div
          style={{
            flex: 1,
            background: "#111827",
            borderRadius: "0 6px 6px 0",
          }}
        />
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginTop: 4,
          fontSize: 11,
          fontFamily: "monospace",
          color: "rgba(255,255,255,0.4)",
        }}
      >
        <span>{evalCp >= 0 ? `+${evalDisplay}` : evalDisplay}</span>
        <span>{evalCp >= 0 ? "White better" : "Black better"}</span>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export const GameHighlightCard = forwardRef<
  HTMLDivElement,
  GameHighlightCardProps
>(function GameHighlightCard(props, ref) {
  const {
    fen,
    moveNumber,
    moveColor,
    san,
    classification,
    evalCp,
    evalSwing,
    whitePlayer,
    blackPlayer,
    result,
    openingName,
    openingEco,
    whiteAccuracy,
    blackAccuracy,
    boardOrientation = "white",
  } = props;

  const config = CLASSIFICATION_CONFIG[classification] ?? CLASSIFICATION_CONFIG.good;
  const moveLabel = `${moveNumber}${moveColor === "w" ? "." : "..."} ${san}`;
  const swingLabel = `${evalSwing > 0 ? "+" : ""}${(evalSwing / 100).toFixed(1)} cp swing`;

  return (
    <div
      ref={ref}
      style={{
        width: 540,
        height: 540,
        background: "linear-gradient(135deg, #0d1a0f 0%, #0f2415 50%, #0d1a0f 100%)",
        borderRadius: 16,
        padding: 24,
        display: "flex",
        flexDirection: "column",
        fontFamily:
          "'Inter', 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif",
        boxSizing: "border-box",
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/* Subtle grid pattern overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "radial-gradient(circle at 1px 1px, rgba(61,107,71,0.15) 1px, transparent 0)",
          backgroundSize: "24px 24px",
          borderRadius: 16,
          pointerEvents: "none",
        }}
      />

      {/* ── Header: branding + players ─────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 10,
          position: "relative",
          zIndex: 1,
        }}
      >
        {/* Logo / branding */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div
            style={{
              width: 22,
              height: 22,
              background: "#3D6B47",
              borderRadius: 6,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 12,
              fontWeight: 800,
              color: "#fff",
            }}
          >
            ♟
          </div>
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "#3D6B47",
              letterSpacing: "0.05em",
              textTransform: "uppercase",
            }}
          >
            ChessOTB.club
          </span>
        </div>

        {/* Result badge */}
        {result && result !== "*" && (
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "rgba(255,255,255,0.5)",
              background: "rgba(255,255,255,0.08)",
              padding: "2px 8px",
              borderRadius: 20,
              letterSpacing: "0.05em",
            }}
          >
            {result}
          </span>
        )}
      </div>

      {/* ── Player names ────────────────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 6,
          position: "relative",
          zIndex: 1,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: "#f9fafb",
              border: "1px solid rgba(255,255,255,0.3)",
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "rgba(255,255,255,0.9)",
              maxWidth: 160,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {whitePlayer}
          </span>
          {whiteAccuracy !== null && (
            <span
              style={{
                fontSize: 10,
                color: "#3D6B47",
                fontWeight: 600,
                marginLeft: 2,
              }}
            >
              {whiteAccuracy}%
            </span>
          )}
        </div>
        <span style={{ color: "rgba(255,255,255,0.2)", fontSize: 11 }}>vs</span>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: "#1f2937",
              border: "1px solid rgba(255,255,255,0.2)",
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "rgba(255,255,255,0.9)",
              maxWidth: 160,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {blackPlayer}
          </span>
          {blackAccuracy !== null && (
            <span
              style={{
                fontSize: 10,
                color: "#3D6B47",
                fontWeight: 600,
                marginLeft: 2,
              }}
            >
              {blackAccuracy}%
            </span>
          )}
        </div>
      </div>

      {/* ── Opening badge ───────────────────────────────────────────────────── */}
      {(openingName || openingEco) && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            marginBottom: 10,
            position: "relative",
            zIndex: 1,
          }}
        >
          {openingEco && (
            <span
              style={{
                fontSize: 9,
                fontWeight: 800,
                color: "#3D6B47",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                background: "rgba(61,107,71,0.15)",
                padding: "2px 6px",
                borderRadius: 4,
                border: "1px solid rgba(61,107,71,0.3)",
              }}
            >
              {openingEco}
            </span>
          )}
          {openingName && (
            <span
              style={{
                fontSize: 10,
                color: "rgba(255,255,255,0.4)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                maxWidth: 280,
              }}
            >
              {openingName}
            </span>
          )}
        </div>
      )}

      {/* ── Chessboard ─────────────────────────────────────────────────────── */}
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          zIndex: 1,
          minHeight: 0,
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: 320,
            borderRadius: 8,
            overflow: "hidden",
            boxShadow: `0 0 0 2px ${config.border}40, 0 8px 32px rgba(0,0,0,0.6)`,
          }}
        >
          <Chessboard
            options={{
              position: fen,
              boardOrientation,
              allowDragging: false,
              boardStyle: { borderRadius: 8 },
              lightSquareStyle: { backgroundColor: "#f0d9b5" },
              darkSquareStyle: { backgroundColor: "#b58863" },
              showAnimations: false,
            }}
          />
        </div>
      </div>

      {/* ── Classification badge + move annotation ─────────────────────────── */}
      <div
        style={{
          marginTop: 10,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          position: "relative",
          zIndex: 1,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              fontSize: 11,
              fontWeight: 800,
              color: config.text,
              background: config.bg,
              border: `1px solid ${config.border}60`,
              padding: "3px 10px",
              borderRadius: 20,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
            }}
          >
            {config.emoji} {config.label}
          </span>
          <span
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: "rgba(255,255,255,0.9)",
              fontFamily: "monospace",
            }}
          >
            {moveLabel}
          </span>
        </div>
        <span
          style={{
            fontSize: 10,
            color: "rgba(255,255,255,0.3)",
            fontFamily: "monospace",
          }}
        >
          {swingLabel}
        </span>
      </div>

      {/* ── Eval bar ────────────────────────────────────────────────────────── */}
      <div style={{ position: "relative", zIndex: 1 }}>
        <HighlightEvalBar evalCp={evalCp} />
      </div>
    </div>
  );
});

export default GameHighlightCard;
