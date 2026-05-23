/**
 * MoveTreePanel — Full variation tree display for the Repertoire Builder.
 *
 * Renders the complete move tree in PGN-notation style:
 *   - Main line moves shown inline (1. e4 e5 2. Nf3 Nc6 …)
 *   - Variations indented in a visually distinct block
 *   - Current position highlighted in green
 *   - Clicking any move navigates to that position
 *   - Auto-scrolls to keep the active move visible
 *   - Annotation glyphs (!, ?, !!, ??, !?, ?!) shown inline
 *   - ECO badge shown on the first node that has one
 */
import React, { useRef, useEffect, useCallback } from "react";
import { GitBranch } from "lucide-react";

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface MoveNode {
  fen: string;
  move?: string;
  san?: string;
  openingEco?: string;
  openingName?: string;
  comment?: string;
  annotation?: "!" | "?" | "!!" | "??" | "!?" | "?!";
  eval?: number;
  children: MoveNode[];
}

interface MoveTreePanelProps {
  root: MoveNode;
  currentFen: string;
  onNavigate: (fen: string) => void;
  isDark: boolean;
}

// ─── Annotation colours ────────────────────────────────────────────────────────

const ANNOTATION_COLORS: Record<string, string> = {
  "!!": "text-emerald-400",
  "!":  "text-emerald-500",
  "!?": "text-blue-400",
  "?!": "text-amber-400",
  "?":  "text-orange-400",
  "??": "text-red-500",
};

// ─── Recursive tree renderer ───────────────────────────────────────────────────

interface RenderNodeProps {
  node: MoveNode;
  /** 1-based ply index of this node (root = 0, first move = 1) */
  ply: number;
  /** Whether this node is on the main line (vs. a variation) */
  isMainLine: boolean;
  /** Depth of variation nesting (0 = main, 1 = first variation, etc.) */
  variationDepth: number;
  currentFen: string;
  onNavigate: (fen: string) => void;
  isDark: boolean;
  activeRef: React.MutableRefObject<HTMLButtonElement | null>;
}

function RenderNode({
  node,
  ply,
  isMainLine,
  variationDepth,
  currentFen,
  onNavigate,
  isDark,
  activeRef,
}: RenderNodeProps) {
  if (!node.san) {
    // Root node — render children directly
    if (node.children.length === 0) return null;
    return (
      <>
        {node.children.map((child, i) => (
          <RenderNode
            key={child.fen}
            node={child}
            ply={1}
            isMainLine={i === 0}
            variationDepth={variationDepth}
            currentFen={currentFen}
            onNavigate={onNavigate}
            isDark={isDark}
            activeRef={activeRef}
          />
        ))}
      </>
    );
  }

  const isActive = node.fen === currentFen;
  const moveNum = Math.ceil(ply / 2);
  const isWhite = ply % 2 === 1;
  const showMoveNum = isWhite || !isMainLine;

  // Variation container colours
  const varBg = isDark
    ? variationDepth % 2 === 1
      ? "bg-white/[0.03] border-l-2 border-white/10"
      : "bg-white/[0.06] border-l-2 border-white/15"
    : variationDepth % 2 === 1
    ? "bg-gray-50 border-l-2 border-gray-200"
    : "bg-gray-100 border-l-2 border-gray-300";

  const moveButton = (
    <button
      ref={isActive ? (el) => { activeRef.current = el; } : undefined}
      onClick={() => onNavigate(node.fen)}
      className={[
        "inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[13px] font-mono font-semibold transition-all duration-100",
        isActive
          ? isDark
            ? "bg-emerald-500/25 text-emerald-300 ring-1 ring-emerald-500/50"
            : "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-400"
          : isDark
          ? "text-white/80 hover:bg-white/10 hover:text-white"
          : "text-gray-700 hover:bg-gray-200 hover:text-gray-900",
      ].join(" ")}
    >
      {showMoveNum && (
        <span className={`mr-0.5 text-[11px] font-normal ${isDark ? "text-white/35" : "text-gray-400"}`}>
          {isWhite ? `${moveNum}.` : `${moveNum}…`}
        </span>
      )}
      {node.san}
      {node.annotation && (
        <span className={`text-[11px] font-bold ${ANNOTATION_COLORS[node.annotation] ?? ""}`}>
          {node.annotation}
        </span>
      )}
    </button>
  );

  // ECO badge — show once per opening name change
  const ecoBadge = node.openingEco ? (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold font-mono ml-1 ${
        isDark ? "bg-emerald-500/15 text-emerald-400" : "bg-emerald-100 text-emerald-700"
      }`}
    >
      {node.openingEco}
    </span>
  ) : null;

  // Comment shown below the move
  const comment = node.comment ? (
    <span
      className={`block text-[11px] italic mt-0.5 ml-1 ${
        isDark ? "text-white/40" : "text-gray-400"
      }`}
    >
      {node.comment}
    </span>
  ) : null;

  // Separate children into main continuation and variations
  const [mainChild, ...variations] = node.children;

  if (!isMainLine) {
    // Variation block — rendered in an indented container
    return (
      <div className={`mt-1 ml-2 pl-2 py-1 rounded-r ${varBg}`}>
        <span className="inline-flex flex-wrap items-baseline gap-x-0.5 gap-y-1">
          {moveButton}
          {ecoBadge}
          {comment}
          {/* Continue the variation inline */}
          {mainChild && (
            <RenderNode
              node={mainChild}
              ply={ply + 1}
              isMainLine={true}
              variationDepth={variationDepth}
              currentFen={currentFen}
              onNavigate={onNavigate}
              isDark={isDark}
              activeRef={activeRef}
            />
          )}
        </span>
        {/* Sub-variations within this variation */}
        {variations.map((v) => (
          <RenderNode
            key={v.fen}
            node={v}
            ply={ply + 1}
            isMainLine={false}
            variationDepth={variationDepth + 1}
            currentFen={currentFen}
            onNavigate={onNavigate}
            isDark={isDark}
            activeRef={activeRef}
          />
        ))}
      </div>
    );
  }

  // Main line — inline rendering
  return (
    <>
      {moveButton}
      {ecoBadge}
      {comment}
      {/* Variations (siblings 1..n) rendered as indented blocks */}
      {variations.map((v) => (
        <RenderNode
          key={v.fen}
          node={v}
          ply={ply + 1}
          isMainLine={false}
          variationDepth={variationDepth + 1}
          currentFen={currentFen}
          onNavigate={onNavigate}
          isDark={isDark}
          activeRef={activeRef}
        />
      ))}
      {/* Main continuation */}
      {mainChild && (
        <RenderNode
          node={mainChild}
          ply={ply + 1}
          isMainLine={true}
          variationDepth={variationDepth}
          currentFen={currentFen}
          onNavigate={onNavigate}
          isDark={isDark}
          activeRef={activeRef}
        />
      )}
    </>
  );
}

// ─── MoveTreePanel ─────────────────────────────────────────────────────────────

export function MoveTreePanel({ root, currentFen, onNavigate, isDark }: MoveTreePanelProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const activeNodeRef = useRef<HTMLButtonElement | null>(null);

  // Auto-scroll to keep the active move visible
  useEffect(() => {
    const el = activeNodeRef.current;
    const container = scrollContainerRef.current;
    if (!el || !container) return;
    const elRect = el.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const isVisible =
      elRect.top >= containerRect.top && elRect.bottom <= containerRect.bottom;
    if (!isVisible) {
      el.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [currentFen]);

  const hasAnyMoves = root.children.length > 0;

  return (
    <div
      ref={scrollContainerRef}
      className="px-3 py-3 overflow-y-auto max-h-[60vh] select-none"
    >
      {!hasAnyMoves ? (
        <div className={`flex flex-col items-center justify-center py-10 gap-2 ${isDark ? "text-white/30" : "text-gray-400"}`}>
          <GitBranch size={28} className="opacity-40" />
          <p className="text-sm text-center">
            No moves yet.
            <br />
            <span className="text-xs">Make a move on the board to start building your repertoire.</span>
          </p>
        </div>
      ) : (
        <div className="flex flex-wrap items-baseline gap-x-0.5 gap-y-1 leading-relaxed">
          <RenderNode
            node={root}
            ply={0}
            isMainLine={true}
            variationDepth={0}
            currentFen={currentFen}
            onNavigate={onNavigate}
            isDark={isDark}
            activeRef={activeNodeRef}
          />
        </div>
      )}
    </div>
  );
}
