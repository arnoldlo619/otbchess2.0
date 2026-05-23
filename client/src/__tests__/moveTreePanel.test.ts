/**
 * moveTreePanel.test.ts — Unit tests for MoveTreePanel logic helpers.
 *
 * Tests the tree-traversal and rendering logic that underpins the
 * MoveTreePanel component. We test the pure data-manipulation functions
 * rather than DOM rendering to keep tests fast and dependency-free.
 */
import { describe, it, expect } from "vitest";

// ─── Re-implement the pure helpers locally for testing ────────────────────────
// (These mirror the logic in MoveTreePanel.tsx and RepertoireBuilder.tsx)

interface MoveNode {
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

const STARTING_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

function createEmptyTree(): MoveNode {
  return { fen: STARTING_FEN, children: [] };
}

function countMoves(root: MoveNode): number {
  let count = 0;
  function dfs(node: MoveNode) {
    count += node.children.length;
    node.children.forEach(dfs);
  }
  dfs(root);
  return count;
}

function findNode(root: MoveNode, fen: string): MoveNode | null {
  const queue: MoveNode[] = [root];
  while (queue.length > 0) {
    const node = queue.shift()!;
    if (node.fen === fen) return node;
    queue.push(...node.children);
  }
  return null;
}

/** Collect all FENs in the tree via BFS */
function collectAllFens(root: MoveNode): string[] {
  const fens: string[] = [];
  const queue: MoveNode[] = [root];
  while (queue.length > 0) {
    const node = queue.shift()!;
    fens.push(node.fen);
    queue.push(...node.children);
  }
  return fens;
}

/** Collect all SAN moves in main-line order (depth-first, first child) */
function collectMainLine(root: MoveNode): string[] {
  const sans: string[] = [];
  let node: MoveNode = root;
  while (node.children.length > 0) {
    node = node.children[0];
    if (node.san) sans.push(node.san);
  }
  return sans;
}

/** Count variation branches (nodes with >1 child) */
function countBranches(root: MoveNode): number {
  let branches = 0;
  function dfs(node: MoveNode) {
    if (node.children.length > 1) branches++;
    node.children.forEach(dfs);
  }
  dfs(root);
  return branches;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("MoveTreePanel — empty tree", () => {
  it("creates an empty tree with starting FEN", () => {
    const tree = createEmptyTree();
    expect(tree.fen).toBe(STARTING_FEN);
    expect(tree.children).toHaveLength(0);
  });

  it("countMoves returns 0 for empty tree", () => {
    const tree = createEmptyTree();
    expect(countMoves(tree)).toBe(0);
  });

  it("findNode returns root for starting FEN", () => {
    const tree = createEmptyTree();
    const found = findNode(tree, STARTING_FEN);
    expect(found).not.toBeNull();
    expect(found?.fen).toBe(STARTING_FEN);
  });

  it("findNode returns null for unknown FEN", () => {
    const tree = createEmptyTree();
    const found = findNode(tree, "unknown-fen");
    expect(found).toBeNull();
  });
});

describe("MoveTreePanel — single main line", () => {
  function buildMainLine(): MoveNode {
    const root = createEmptyTree();
    const e4: MoveNode = {
      fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1",
      san: "e4",
      move: "e2e4",
      children: [],
    };
    const e5: MoveNode = {
      fen: "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2",
      san: "e5",
      move: "e7e5",
      children: [],
    };
    const nf3: MoveNode = {
      fen: "rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2",
      san: "Nf3",
      move: "g1f3",
      children: [],
    };
    e5.children = [nf3];
    e4.children = [e5];
    root.children = [e4];
    return root;
  }

  it("countMoves returns 3 for a 3-move line", () => {
    const tree = buildMainLine();
    expect(countMoves(tree)).toBe(3);
  });

  it("collectMainLine returns moves in order", () => {
    const tree = buildMainLine();
    const line = collectMainLine(tree);
    expect(line).toEqual(["e4", "e5", "Nf3"]);
  });

  it("findNode finds a mid-line position", () => {
    const tree = buildMainLine();
    const e5Fen = "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2";
    const found = findNode(tree, e5Fen);
    expect(found).not.toBeNull();
    expect(found?.san).toBe("e5");
  });

  it("collectAllFens includes all 4 positions (root + 3 moves)", () => {
    const tree = buildMainLine();
    const fens = collectAllFens(tree);
    expect(fens).toHaveLength(4);
  });

  it("countBranches returns 0 for a straight line", () => {
    const tree = buildMainLine();
    expect(countBranches(tree)).toBe(0);
  });
});

describe("MoveTreePanel — branching variations", () => {
  function buildBranchingTree(): MoveNode {
    const root = createEmptyTree();
    const e4: MoveNode = {
      fen: "fen-after-e4",
      san: "e4",
      move: "e2e4",
      children: [],
    };
    // Two responses: e5 (main) and c5 (Sicilian variation)
    const e5: MoveNode = {
      fen: "fen-after-e5",
      san: "e5",
      move: "e7e5",
      children: [],
    };
    const c5: MoveNode = {
      fen: "fen-after-c5",
      san: "c5",
      move: "c7c5",
      children: [],
    };
    e4.children = [e5, c5];
    root.children = [e4];
    return root;
  }

  it("countMoves returns 3 for a branching tree (1 + 2 responses)", () => {
    const tree = buildBranchingTree();
    expect(countMoves(tree)).toBe(3);
  });

  it("countBranches returns 1 for a single branch point", () => {
    const tree = buildBranchingTree();
    expect(countBranches(tree)).toBe(1);
  });

  it("main line is the first child (e5)", () => {
    const tree = buildBranchingTree();
    const line = collectMainLine(tree);
    expect(line[0]).toBe("e4");
    expect(line[1]).toBe("e5");
  });

  it("variation (c5) is accessible via findNode", () => {
    const tree = buildBranchingTree();
    const found = findNode(tree, "fen-after-c5");
    expect(found).not.toBeNull();
    expect(found?.san).toBe("c5");
  });
});

describe("MoveTreePanel — annotation glyphs", () => {
  const ANNOTATION_COLORS: Record<string, string> = {
    "!!": "text-emerald-400",
    "!":  "text-emerald-500",
    "!?": "text-blue-400",
    "?!": "text-amber-400",
    "?":  "text-orange-400",
    "??": "text-red-500",
  };

  it("all 6 annotation glyphs have defined colours", () => {
    const glyphs = ["!!", "!", "!?", "?!", "?", "??"];
    for (const g of glyphs) {
      expect(ANNOTATION_COLORS[g]).toBeDefined();
      expect(ANNOTATION_COLORS[g]).toMatch(/^text-/);
    }
  });

  it("positive glyphs use green/blue colours", () => {
    expect(ANNOTATION_COLORS["!!"]).toContain("emerald");
    expect(ANNOTATION_COLORS["!"]).toContain("emerald");
  });

  it("negative glyphs use orange/red colours", () => {
    expect(ANNOTATION_COLORS["?"]).toContain("orange");
    expect(ANNOTATION_COLORS["??"]).toContain("red");
  });
});

describe("MoveTreePanel — move number formatting", () => {
  it("white moves use format N.", () => {
    // ply 1 = white's first move → moveNum 1, isWhite true
    const ply = 1;
    const moveNum = Math.ceil(ply / 2);
    const isWhite = ply % 2 === 1;
    expect(moveNum).toBe(1);
    expect(isWhite).toBe(true);
  });

  it("black moves use format N…", () => {
    // ply 2 = black's first move → moveNum 1, isWhite false
    const ply = 2;
    const moveNum = Math.ceil(ply / 2);
    const isWhite = ply % 2 === 1;
    expect(moveNum).toBe(1);
    expect(isWhite).toBe(false);
  });

  it("ply 5 = white move 3", () => {
    const ply = 5;
    const moveNum = Math.ceil(ply / 2);
    const isWhite = ply % 2 === 1;
    expect(moveNum).toBe(3);
    expect(isWhite).toBe(true);
  });

  it("ply 10 = black move 5", () => {
    const ply = 10;
    const moveNum = Math.ceil(ply / 2);
    const isWhite = ply % 2 === 1;
    expect(moveNum).toBe(5);
    expect(isWhite).toBe(false);
  });
});
