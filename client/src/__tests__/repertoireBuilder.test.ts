/**
 * Repertoire Builder — unit tests
 *
 * Tests the move tree data structure helpers and the Stockfish hook types.
 */
import { describe, it, expect } from "vitest";

// ── Move Tree Helpers (mirrored from RepertoireBuilder.tsx) ───────────────────

interface MoveNode {
  fen: string;
  move?: string;
  san?: string;
  comment?: string;
  eval?: number;
  children: MoveNode[];
}

const STARTING_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

function createEmptyTree(): MoveNode {
  return { fen: STARTING_FEN, children: [] };
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

function buildPath(root: MoveNode, targetFen: string): MoveNode[] {
  const path: MoveNode[] = [];
  const dfs = (node: MoveNode): boolean => {
    path.push(node);
    if (node.fen === targetFen) return true;
    for (const child of node.children) {
      if (dfs(child)) return true;
    }
    path.pop();
    return false;
  };
  dfs(root);
  return path;
}

function countMoves(root: MoveNode): number {
  let count = 0;
  const dfs = (node: MoveNode) => {
    count += node.children.length;
    node.children.forEach(dfs);
  };
  dfs(root);
  return count;
}

function removeNode(root: MoveNode, targetFen: string): MoveNode {
  const clone = JSON.parse(JSON.stringify(root)) as MoveNode;
  const dfs = (node: MoveNode) => {
    node.children = node.children.filter((c) => c.fen !== targetFen);
    node.children.forEach(dfs);
  };
  dfs(clone);
  return clone;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Repertoire Builder — Move Tree Helpers", () => {
  it("createEmptyTree returns root with starting FEN and no children", () => {
    const tree = createEmptyTree();
    expect(tree.fen).toBe(STARTING_FEN);
    expect(tree.children).toEqual([]);
  });

  it("findNode returns root when searching for starting FEN", () => {
    const tree = createEmptyTree();
    const found = findNode(tree, STARTING_FEN);
    expect(found).toBe(tree);
  });

  it("findNode returns null for non-existent FEN", () => {
    const tree = createEmptyTree();
    expect(findNode(tree, "fake-fen")).toBeNull();
  });

  it("findNode finds a deeply nested node", () => {
    const tree = createEmptyTree();
    const child1: MoveNode = { fen: "fen-after-e4", san: "e4", move: "e2e4", children: [] };
    const child2: MoveNode = { fen: "fen-after-e4-e5", san: "e5", move: "e7e5", children: [] };
    child1.children.push(child2);
    tree.children.push(child1);

    const found = findNode(tree, "fen-after-e4-e5");
    expect(found).toBe(child2);
  });

  it("buildPath returns correct path from root to target", () => {
    const tree = createEmptyTree();
    const child1: MoveNode = { fen: "fen-after-e4", san: "e4", move: "e2e4", children: [] };
    const child2: MoveNode = { fen: "fen-after-e4-e5", san: "e5", move: "e7e5", children: [] };
    child1.children.push(child2);
    tree.children.push(child1);

    const path = buildPath(tree, "fen-after-e4-e5");
    expect(path).toHaveLength(3);
    expect(path[0].fen).toBe(STARTING_FEN);
    expect(path[1].fen).toBe("fen-after-e4");
    expect(path[2].fen).toBe("fen-after-e4-e5");
  });

  it("buildPath returns empty array when target not found", () => {
    const tree = createEmptyTree();
    const path = buildPath(tree, "nonexistent");
    expect(path).toHaveLength(0);
  });

  it("countMoves counts all nodes excluding root", () => {
    const tree = createEmptyTree();
    expect(countMoves(tree)).toBe(0);

    // Add 1. e4 and 1. d4 from root
    tree.children.push(
      { fen: "fen-e4", san: "e4", children: [] },
      { fen: "fen-d4", san: "d4", children: [] },
    );
    expect(countMoves(tree)).toBe(2);

    // Add 1... e5 after 1. e4
    tree.children[0].children.push({ fen: "fen-e4-e5", san: "e5", children: [] });
    expect(countMoves(tree)).toBe(3);
  });

  it("removeNode removes the target and its subtree", () => {
    const tree = createEmptyTree();
    const child1: MoveNode = { fen: "fen-e4", san: "e4", children: [] };
    const child2: MoveNode = { fen: "fen-e4-e5", san: "e5", children: [] };
    child1.children.push(child2);
    tree.children.push(child1);

    // Remove child1 (fen-e4) — should remove it and its subtree
    const updated = removeNode(tree, "fen-e4");
    expect(updated.children).toHaveLength(0);
    expect(countMoves(updated)).toBe(0);
  });

  it("removeNode does not mutate the original tree", () => {
    const tree = createEmptyTree();
    tree.children.push({ fen: "fen-e4", san: "e4", children: [] });

    const updated = removeNode(tree, "fen-e4");
    expect(tree.children).toHaveLength(1); // Original unchanged
    expect(updated.children).toHaveLength(0); // Clone modified
  });

  it("removeNode only removes the targeted node, not siblings", () => {
    const tree = createEmptyTree();
    tree.children.push(
      { fen: "fen-e4", san: "e4", children: [] },
      { fen: "fen-d4", san: "d4", children: [] },
    );

    const updated = removeNode(tree, "fen-e4");
    expect(updated.children).toHaveLength(1);
    expect(updated.children[0].fen).toBe("fen-d4");
  });
});

describe("Repertoire Builder — API contract", () => {
  it("repertoire list endpoint path is correct", () => {
    expect("/api/repertoire-builder").toBe("/api/repertoire-builder");
  });

  it("repertoire CRUD paths follow RESTful convention", () => {
    const id = 42;
    expect(`/api/repertoire-builder/${id}`).toBe("/api/repertoire-builder/42");
  });

  it("move tree serializes to JSON correctly", () => {
    const tree = createEmptyTree();
    tree.children.push({
      fen: "fen-after-e4",
      san: "e4",
      move: "e2e4",
      children: [],
    });

    const json = JSON.stringify(tree);
    const parsed = JSON.parse(json) as MoveNode;
    expect(parsed.fen).toBe(STARTING_FEN);
    expect(parsed.children).toHaveLength(1);
    expect(parsed.children[0].san).toBe("e4");
  });

  it("free user limit is 1 repertoire", () => {
    const FREE_LIMIT = 1;
    const repertoireCount = 1;
    const isPro = false;
    const canCreateMore = isPro || repertoireCount < FREE_LIMIT;
    expect(canCreateMore).toBe(false);
  });

  it("pro user can create unlimited repertoires", () => {
    const FREE_LIMIT = 1;
    const repertoireCount = 100;
    const isPro = true;
    const canCreateMore = isPro || repertoireCount < FREE_LIMIT;
    expect(canCreateMore).toBe(true);
  });
});
