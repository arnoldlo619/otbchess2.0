/**
 * nodeTreeIntegrity.test.ts — Validates the generated node trees for
 * Jobava London and Caro-Kann lines.
 *
 * Tests:
 *   - JSON structure and required fields
 *   - FEN validity (8 ranks, valid side-to-move)
 *   - Parent-child chain integrity (every node's parent exists)
 *   - Root node correctness (ply=0, no parent, starting FEN)
 *   - Ply sequence continuity (no gaps)
 *   - Annotation coverage (every node has an annotation)
 *   - Move format validation (SAN and UCI)
 *   - No duplicate node IDs
 *   - Per-line node counts match ply_count + 1
 */
import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

interface NodeData {
  id: string;
  lineId: string;
  parentNodeId: string | null;
  ply: number;
  moveSan: string | null;
  moveUci: string | null;
  fen: string;
  isMainLine: number;
  annotation: string | null;
  nag: number | null;
  eval: number | null;
  transpositionNodeId: string | null;
  sortOrder: number;
}

interface SeedData {
  meta: {
    generated_at: string;
    total_nodes: number;
    openings: string[];
    lines: number;
  };
  nodes: NodeData[];
}

let data: SeedData;
let nodeMap: Map<string, NodeData>;
let lineGroups: Map<string, NodeData[]>;

beforeAll(() => {
  const raw = readFileSync(resolve(__dirname, "../../../data/node-trees-seed.json"), "utf-8");
  data = JSON.parse(raw);
  nodeMap = new Map(data.nodes.map((n) => [n.id, n]));
  lineGroups = new Map<string, NodeData[]>();
  for (const node of data.nodes) {
    const group = lineGroups.get(node.lineId) || [];
    group.push(node);
    lineGroups.set(node.lineId, group);
  }
});

// ── Meta Validation ──────────────────────────────────────────────────────────

describe("Seed file meta", () => {
  it("should have correct total node count", () => {
    expect(data.meta.total_nodes).toBe(data.nodes.length);
  });

  it("should cover both openings", () => {
    expect(data.meta.openings).toContain("jobava-london");
    expect(data.meta.openings).toContain("caro-kann-defense");
  });

  it("should have 20 lines total", () => {
    expect(data.meta.lines).toBe(20);
    expect(lineGroups.size).toBe(20);
  });

  it("should have 266 total nodes", () => {
    expect(data.nodes.length).toBe(266);
  });
});

// ── Node Field Validation ────────────────────────────────────────────────────

describe("Node required fields", () => {
  it("every node should have an id", () => {
    for (const node of data.nodes) {
      expect(node.id).toBeTruthy();
      expect(typeof node.id).toBe("string");
    }
  });

  it("every node should have a lineId", () => {
    for (const node of data.nodes) {
      expect(node.lineId).toBeTruthy();
    }
  });

  it("every node should have a fen", () => {
    for (const node of data.nodes) {
      expect(node.fen).toBeTruthy();
      expect(typeof node.fen).toBe("string");
    }
  });

  it("every node should have ply >= 0", () => {
    for (const node of data.nodes) {
      expect(node.ply).toBeGreaterThanOrEqual(0);
    }
  });

  it("every node should have isMainLine = 1", () => {
    for (const node of data.nodes) {
      expect(node.isMainLine).toBe(1);
    }
  });
});

// ── No Duplicate IDs ─────────────────────────────────────────────────────────

describe("Unique node IDs", () => {
  it("should have no duplicate node IDs", () => {
    const ids = data.nodes.map((n) => n.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });
});

// ── FEN Validation ───────────────────────────────────────────────────────────

describe("FEN validity", () => {
  it("every FEN should have 8 ranks", () => {
    for (const node of data.nodes) {
      const ranks = node.fen.split(" ")[0].split("/");
      expect(ranks.length).toBe(8);
    }
  });

  it("every FEN should have valid side-to-move", () => {
    for (const node of data.nodes) {
      const parts = node.fen.split(" ");
      expect(["w", "b"]).toContain(parts[1]);
    }
  });

  it("root nodes should have the standard starting FEN", () => {
    const startFen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    for (const [_lineId, nodes] of lineGroups) {
      const root = nodes.find((n) => n.ply === 0);
      expect(root).toBeDefined();
      expect(root!.fen).toBe(startFen);
    }
  });
});

// ── Parent-Child Chain Integrity ─────────────────────────────────────────────

describe("Parent-child chain", () => {
  it("root nodes should have no parent", () => {
    for (const [_lineId, nodes] of lineGroups) {
      const root = nodes.find((n) => n.ply === 0);
      expect(root).toBeDefined();
      expect(root!.parentNodeId).toBeNull();
    }
  });

  it("non-root nodes should have a valid parent within the same line", () => {
    for (const node of data.nodes) {
      if (node.ply === 0) continue;
      expect(node.parentNodeId).toBeTruthy();
      const parent = nodeMap.get(node.parentNodeId!);
      expect(parent).toBeDefined();
      expect(parent!.lineId).toBe(node.lineId);
      expect(parent!.ply).toBe(node.ply - 1);
    }
  });
});

// ── Ply Sequence Continuity ──────────────────────────────────────────────────

describe("Ply sequence", () => {
  it("each line should have continuous plies from 0 to max", () => {
    for (const [_lineId, nodes] of lineGroups) {
      const plies = nodes.map((n) => n.ply).sort((a, b) => a - b);
      for (let i = 0; i < plies.length; i++) {
        expect(plies[i]).toBe(i);
      }
    }
  });
});

// ── Move Format Validation ───────────────────────────────────────────────────

describe("Move format", () => {
  it("root nodes should have null moveSan and moveUci", () => {
    for (const [_lineId, nodes] of lineGroups) {
      const root = nodes.find((n) => n.ply === 0);
      expect(root!.moveSan).toBeNull();
      expect(root!.moveUci).toBeNull();
    }
  });

  it("non-root nodes should have non-empty moveSan", () => {
    for (const node of data.nodes) {
      if (node.ply === 0) continue;
      expect(node.moveSan).toBeTruthy();
      expect(typeof node.moveSan).toBe("string");
    }
  });

  it("non-root nodes should have valid UCI format (4-5 chars)", () => {
    for (const node of data.nodes) {
      if (node.ply === 0) continue;
      expect(node.moveUci).toBeTruthy();
      expect(node.moveUci!.length).toBeGreaterThanOrEqual(4);
      expect(node.moveUci!.length).toBeLessThanOrEqual(5);
    }
  });

  it("UCI moves should match [a-h][1-8][a-h][1-8][qrbn]? pattern", () => {
    const uciPattern = /^[a-h][1-8][a-h][1-8][qrbn]?$/;
    for (const node of data.nodes) {
      if (node.ply === 0) continue;
      // Handle castling: O-O maps to e1g1, O-O-O maps to e1c1, etc.
      expect(node.moveUci).toMatch(uciPattern);
    }
  });
});

// ── Annotation Coverage ──────────────────────────────────────────────────────

describe("Annotation coverage", () => {
  it("every node should have an annotation", () => {
    for (const node of data.nodes) {
      expect(node.annotation).toBeTruthy();
      expect(typeof node.annotation).toBe("string");
      expect(node.annotation!.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("trap lines should have strong annotations on key moves", () => {
    // Jobava Bg4 trap: ply 6 (3...Bg4?) should have NAG 2 (?)
    const bg4TrapNodes = lineGroups.get("Z1d93TLsSsKB0moK");
    expect(bg4TrapNodes).toBeDefined();
    const blunderNode = bg4TrapNodes!.find((n) => n.ply === 6);
    expect(blunderNode).toBeDefined();
    expect(blunderNode!.nag).toBe(2); // ?

    // Ply 9 (5.Nxc7+!) should have NAG 3 (!!)
    const forkNode = bg4TrapNodes!.find((n) => n.ply === 9);
    expect(forkNode).toBeDefined();
    expect(forkNode!.nag).toBe(3); // !!
  });

  it("Scholar's Mate trap should mark White's Bc4 as dubious", () => {
    const scholarNodes = lineGroups.get("hx_paiQ2kA4l0gkx");
    expect(scholarNodes).toBeDefined();
    const bc4Node = scholarNodes!.find((n) => n.ply === 3); // 2.Bc4?!
    expect(bc4Node).toBeDefined();
    expect(bc4Node!.nag).toBe(6); // ?!
  });
});

// ── Per-Line Node Count ──────────────────────────────────────────────────────

describe("Per-line node counts", () => {
  const expectedCounts: Record<string, number> = {
    "K_39YiWIzWJ1hMil": 6,   // 5 ply + root
    "KWChZ_w24AKBqG1-": 12,  // 11 ply + root
    "MEia4XXdKWpxLN2W": 16,  // 15 ply + root
    "MV3XkvmTboN52BAz": 12,  // 11 ply + root
    "O_F4fvVSf35qK0M0": 14,  // 13 ply + root
    "Z1d93TLsSsKB0moK": 10,  // 9 ply + root
    "xU5F3VzgGJCK2ciS": 10,  // 9 ply + root
    "g5Mc2wxWdiNbZCcf": 14,  // 13 ply + root
    "jZkx4seHFN4hLGr4": 14,  // 13 ply + root
    "iJ7M9Jlt4l1gckTZ": 14,  // 13 ply + root
    "_-NQVwvlTiR2Oy4p": 15,  // 14 ply + root
    "HpiCy2jYqCmoKurL": 13,  // 12 ply + root
    "WFtvnP-Z1q4rRq1y": 14,  // 13 ply + root
    "fGpl0lFDKtE3_4Wx": 13,  // 12 ply + root
    "xP0-S5Hnrx7uGtiB": 17,  // 16 ply + root
    "XLsMMHh94YkG8QSo": 17,  // 16 ply + root
    "oh3_2NoO0NWT4h8T": 14,  // 13 ply + root
    "TT9pxyZZ-c_PHJSl": 15,  // 14 ply + root
    "hx_paiQ2kA4l0gkx": 11,  // 10 ply + root
    "BGtPyjoZTHP-XlBR": 15,  // 14 ply + root
  };

  for (const [lineId, expected] of Object.entries(expectedCounts)) {
    it(`line ${lineId} should have ${expected} nodes`, () => {
      const nodes = lineGroups.get(lineId);
      expect(nodes).toBeDefined();
      expect(nodes!.length).toBe(expected);
    });
  }
});

// ── Eval Consistency ─────────────────────────────────────────────────────────

describe("Eval consistency", () => {
  it("Jobava trap lines should have high eval after the blunder", () => {
    // Bg4 blunder trap: eval should spike after 3...Bg4?
    const bg4Nodes = lineGroups.get("Z1d93TLsSsKB0moK")!;
    const beforeBlunder = bg4Nodes.find((n) => n.ply === 5)!;
    const afterBlunder = bg4Nodes.find((n) => n.ply === 6)!;
    expect(afterBlunder.eval!).toBeGreaterThan(beforeBlunder.eval!);
  });

  it("Scholar's Mate trap should have negative eval (Black advantage)", () => {
    const scholarNodes = lineGroups.get("hx_paiQ2kA4l0gkx")!;
    const finalNode = scholarNodes.find((n) => n.ply === 10)!;
    expect(finalNode.eval!).toBeLessThan(0);
  });

  it("main lines should have moderate eval (not extreme)", () => {
    // Classical main line should be roughly balanced
    const classicalNodes = lineGroups.get("_-NQVwvlTiR2Oy4p")!;
    for (const node of classicalNodes) {
      if (node.eval !== null) {
        expect(Math.abs(node.eval)).toBeLessThan(100);
      }
    }
  });
});
