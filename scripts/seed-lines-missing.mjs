/**
 * seed-lines-missing.mjs
 *
 * Seeds opening lines AND their move nodes for the 8 openings that currently
 * have 0 lines: French Defense, London System, Nimzo-Indian Defense,
 * Queen's Gambit, Queen's Gambit Declined, Scandinavian Defense,
 * Slav Defense, Vienna Game.
 *
 * Uses INSERT IGNORE — safe to re-run.
 * Usage: node scripts/seed-lines-missing.mjs
 */
import mysql from "mysql2/promise";
import { randomUUID } from "crypto";

const nanoid = () => randomUUID().replace(/-/g, "").slice(0, 20);
const conn = await mysql.createConnection(process.env.DATABASE_URL);

let linesInserted = 0;
let nodesInserted = 0;

async function insertLine(openingId, { title, slug, eco, pgn, finalFen, plyCnt, color, difficulty, summary, sortOrder }) {
  const id = nanoid();
  await conn.execute(
    `INSERT IGNORE INTO opening_lines
     (id, opening_id, title, slug, eco, pgn, final_fen, ply_count, color,
      difficulty, description, is_published, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, NOW(), NOW())`,
    [id, openingId, title, slug, eco, pgn, finalFen, plyCnt, color, difficulty, summary, sortOrder]
  );
  linesInserted++;
  return id;
}

async function insertNodes(lineId, nodes) {
  let prevNodeId = null;
  for (const n of nodes) {
    const nodeId = nanoid();
    const parentNodeId = n.ply > 0 ? prevNodeId : null;
    await conn.execute(
      `INSERT IGNORE INTO line_nodes
       (id, line_id, parent_node_id, ply, move_san, move_uci, fen,
        is_main_line, annotation, nag, eval, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        nodeId, lineId, parentNodeId, n.ply,
        n.san ?? null, n.uci ?? null, n.fen,
        1, n.ann ?? null, n.nag ?? null, n.eval ?? null, n.ply,
      ]
    );
    nodesInserted++;
    prevNodeId = nodeId;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// FRENCH DEFENSE  id=3MRZQ2MnCy8OE8YX
// ─────────────────────────────────────────────────────────────────────────────
const frenchId = "3MRZQ2MnCy8OE8YX";

// 1. Advance Variation
{
  const lid = await insertLine(frenchId, {
    title: "Advance: 3.e5 Main Line",
    slug: "french-advance-main",
    eco: "C02",
    pgn: "1. e4 e6 2. d4 d5 3. e5 c5 4. c3 Nc6 5. Nf3 Qb6 6. Be2 cxd4 7. cxd4",
    finalFen: "r1b1kbnr/pp3ppp/1qn1p3/3pP3/3P4/5N2/PP2BPPP/RNBQK2R b KQkq - 0 7",
    plyCnt: 13, color: "black", difficulty: "intermediate",
    summary: "The Advance Variation. White gains space with e5 but Black attacks the pawn chain with ...c5.",
    sortOrder: 1,
  });
  await insertNodes(lid, [
    { ply:0, fen:"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", ann:"Starting position." },
    { ply:1, san:"e4", uci:"e2e4", fen:"rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1", ann:"1.e4", eval:25 },
    { ply:2, san:"e6", uci:"e7e6", fen:"rnbqkbnr/pppp1ppp/4p3/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2", ann:"1...e6 — The French Defense! Solid and strategic.", eval:20, nag:1 },
    { ply:3, san:"d4", uci:"d2d4", fen:"rnbqkbnr/pppp1ppp/4p3/8/3PP3/8/PPP2PPP/RNBQKBNR b KQkq - 0 2", ann:"2.d4 — White builds a strong pawn center.", eval:25 },
    { ply:4, san:"d5", uci:"d7d5", fen:"rnbqkbnr/ppp2ppp/4p3/3p4/3PP3/8/PPP2PPP/RNBQKBNR w KQkq - 0 3", ann:"2...d5 — Challenging the center.", eval:20 },
    { ply:5, san:"e5", uci:"e4e5", fen:"rnbqkbnr/ppp2ppp/4p3/3pP3/3P4/8/PPP2PPP/RNBQKBNR b KQkq - 0 3", ann:"3.e5 — The Advance Variation! White gains space.", eval:25, nag:1 },
    { ply:6, san:"c5", uci:"c7c5", fen:"rnbqkbnr/pp3ppp/4p3/2ppP3/3P4/8/PPP2PPP/RNBQKBNR w KQkq - 0 4", ann:"3...c5 — The key counter-attack! Black attacks d4.", eval:20, nag:1 },
    { ply:7, san:"c3", uci:"c2c3", fen:"rnbqkbnr/pp3ppp/4p3/2ppP3/3P4/2P5/PP3PPP/RNBQKBNR b KQkq - 0 4", ann:"4.c3 — Defending d4.", eval:25 },
    { ply:8, san:"Nc6", uci:"b8c6", fen:"r1bqkbnr/pp3ppp/2n1p3/2ppP3/3P4/2P5/PP3PPP/RNBQKBNR w KQkq - 1 5", ann:"4...Nc6 — Development with pressure on d4.", eval:20 },
    { ply:9, san:"Nf3", uci:"g1f3", fen:"r1bqkbnr/pp3ppp/2n1p3/2ppP3/3P4/2P2N2/PP3PPP/RNBQKB1R b KQkq - 2 5", ann:"5.Nf3 — Development.", eval:25 },
    { ply:10, san:"Qb6", uci:"d8b6", fen:"r1b1kbnr/pp3ppp/1qn1p3/2ppP3/3P4/2P2N2/PP3PPP/RNBQKB1R w KQkq - 3 6", ann:"5...Qb6 — Attacking b2 and d4 simultaneously.", eval:20, nag:1 },
    { ply:11, san:"Be2", uci:"f1e2", fen:"r1b1kbnr/pp3ppp/1qn1p3/2ppP3/3P4/2P2N2/PP2BPPP/RNBQK2R b KQkq - 4 6", ann:"6.Be2 — Solid development.", eval:25 },
    { ply:12, san:"cxd4", uci:"c5d4", fen:"r1b1kbnr/pp3ppp/1qn1p3/3pP3/3p4/2P2N2/PP2BPPP/RNBQK2R w KQkq - 0 7", ann:"6...cxd4 — Black opens the center.", eval:20 },
    { ply:13, san:"cxd4", uci:"c3d4", fen:"r1b1kbnr/pp3ppp/1qn1p3/3pP3/3P4/5N2/PP2BPPP/RNBQK2R b KQkq - 0 7", ann:"7.cxd4 — White recaptures. The position is dynamically balanced.", eval:25 },
  ]);
}

// 2. Winawer Variation
{
  const lid = await insertLine(frenchId, {
    title: "Winawer: 3.Nc3 Bb4",
    slug: "french-winawer",
    eco: "C15",
    pgn: "1. e4 e6 2. d4 d5 3. Nc3 Bb4 4. e5 c5 5. a3 Bxc3+ 6. bxc3 Ne7",
    finalFen: "rnbqk2r/pp2nppp/4p3/2ppP3/3P4/P1P5/2P2PPP/R1BQKBNR w KQkq - 1 7",
    plyCnt: 13, color: "black", difficulty: "advanced",
    summary: "The Winawer Variation. Black pins the knight with Bb4, leading to sharp asymmetrical play.",
    sortOrder: 2,
  });
  await insertNodes(lid, [
    { ply:0, fen:"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", ann:"Starting position." },
    { ply:1, san:"e4", uci:"e2e4", fen:"rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1", ann:"1.e4", eval:25 },
    { ply:2, san:"e6", uci:"e7e6", fen:"rnbqkbnr/pppp1ppp/4p3/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2", ann:"1...e6 — French Defense.", eval:20 },
    { ply:3, san:"d4", uci:"d2d4", fen:"rnbqkbnr/pppp1ppp/4p3/8/3PP3/8/PPP2PPP/RNBQKBNR b KQkq - 0 2", ann:"2.d4", eval:25 },
    { ply:4, san:"d5", uci:"d7d5", fen:"rnbqkbnr/ppp2ppp/4p3/3p4/3PP3/8/PPP2PPP/RNBQKBNR w KQkq - 0 3", ann:"2...d5", eval:20 },
    { ply:5, san:"Nc3", uci:"b1c3", fen:"rnbqkbnr/ppp2ppp/4p3/3p4/3PP3/2N5/PPP2PPP/R1BQKBNR b KQkq - 1 3", ann:"3.Nc3 — Classical variation.", eval:25 },
    { ply:6, san:"Bb4", uci:"f8b4", fen:"rnbqk1nr/ppp2ppp/4p3/3p4/1b1PP3/2N5/PPP2PPP/R1BQKBNR w KQkq - 2 4", ann:"3...Bb4 — The Winawer! Pinning the knight.", eval:20, nag:1 },
    { ply:7, san:"e5", uci:"e4e5", fen:"rnbqk1nr/ppp2ppp/4p3/3pP3/1b1P4/2N5/PPP2PPP/R1BQKBNR b KQkq - 0 4", ann:"4.e5 — White advances, gaining space.", eval:25 },
    { ply:8, san:"c5", uci:"c7c5", fen:"rnbqk1nr/pp3ppp/4p3/2ppP3/1b1P4/2N5/PPP2PPP/R1BQKBNR w KQkq - 0 5", ann:"4...c5 — Attacking d4.", eval:20, nag:1 },
    { ply:9, san:"a3", uci:"a2a3", fen:"rnbqk1nr/pp3ppp/4p3/2ppP3/1b1P4/P1N5/1PP2PPP/R1BQKBNR b KQkq - 0 5", ann:"5.a3 — Forcing the bishop to decide.", eval:25 },
    { ply:10, san:"Bxc3+", uci:"b4c3", fen:"rnbqk1nr/pp3ppp/4p3/2ppP3/3P4/P1b5/1PP2PPP/R1BQKBNR w KQkq - 0 6", ann:"5...Bxc3+ — Black trades the bishop for the knight.", eval:20 },
    { ply:11, san:"bxc3", uci:"b2c3", fen:"rnbqk1nr/pp3ppp/4p3/2ppP3/3P4/P1P5/2P2PPP/R1BQKBNR b KQkq - 0 6", ann:"6.bxc3 — White recaptures, doubling the c-pawns.", eval:25 },
    { ply:12, san:"Ne7", uci:"g8e7", fen:"rnbqk2r/pp2nppp/4p3/2ppP3/3P4/P1P5/2P2PPP/R1BQKBNR w KQkq - 1 7", ann:"6...Ne7 — Flexible development, avoiding the pin.", eval:20 },
    { ply:13, san:"Qg4", uci:"d1g4", fen:"rnbqk2r/pp2nppp/4p3/2ppP3/3P2Q1/P1P5/2P2PPP/R1B1KBNR b KQkq - 2 7", ann:"7.Qg4 — Attacking g7. The position becomes very sharp.", eval:25, nag:1 },
  ]);
}

// 3. Classical: 3.Nc3 Nf6
{
  const lid = await insertLine(frenchId, {
    title: "Classical: 3.Nc3 Nf6",
    slug: "french-classical-nf6",
    eco: "C11",
    pgn: "1. e4 e6 2. d4 d5 3. Nc3 Nf6 4. Bg5 Be7 5. e5 Nfd7 6. Bxe7 Qxe7",
    finalFen: "rnb1k2r/pppnqppp/4p3/3pP3/3P4/2N5/PPP2PPP/R2QKBNR w KQkq - 0 7",
    plyCnt: 12, color: "black", difficulty: "intermediate",
    summary: "Classical French. White pins the knight with Bg5, Black develops solidly.",
    sortOrder: 3,
  });
  await insertNodes(lid, [
    { ply:0, fen:"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", ann:"Starting position." },
    { ply:1, san:"e4", uci:"e2e4", fen:"rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1", ann:"1.e4", eval:25 },
    { ply:2, san:"e6", uci:"e7e6", fen:"rnbqkbnr/pppp1ppp/4p3/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2", ann:"1...e6 — French Defense.", eval:20 },
    { ply:3, san:"d4", uci:"d2d4", fen:"rnbqkbnr/pppp1ppp/4p3/8/3PP3/8/PPP2PPP/RNBQKBNR b KQkq - 0 2", ann:"2.d4", eval:25 },
    { ply:4, san:"d5", uci:"d7d5", fen:"rnbqkbnr/ppp2ppp/4p3/3p4/3PP3/8/PPP2PPP/RNBQKBNR w KQkq - 0 3", ann:"2...d5", eval:20 },
    { ply:5, san:"Nc3", uci:"b1c3", fen:"rnbqkbnr/ppp2ppp/4p3/3p4/3PP3/2N5/PPP2PPP/R1BQKBNR b KQkq - 1 3", ann:"3.Nc3 — Classical.", eval:25 },
    { ply:6, san:"Nf6", uci:"g8f6", fen:"rnbqkb1r/ppp2ppp/4pn2/3p4/3PP3/2N5/PPP2PPP/R1BQKBNR w KQkq - 2 4", ann:"3...Nf6 — Development.", eval:20 },
    { ply:7, san:"Bg5", uci:"c1g5", fen:"rnbqkb1r/ppp2ppp/4pn2/3p2B1/3PP3/2N5/PPP2PPP/R2QKBNR b KQkq - 3 4", ann:"4.Bg5 — Pinning the knight.", eval:25 },
    { ply:8, san:"Be7", uci:"f8e7", fen:"rnbqk2r/ppp1bppp/4pn2/3p2B1/3PP3/2N5/PPP2PPP/R2QKBNR w KQkq - 4 5", ann:"4...Be7 — Breaking the pin.", eval:20 },
    { ply:9, san:"e5", uci:"e4e5", fen:"rnbqk2r/ppp1bppp/4pn2/3pPB2/3P4/2N5/PPP2PPP/R2QKBNR b KQkq - 0 5", ann:"5.e5 — White advances.", eval:25 },
    { ply:10, san:"Nfd7", uci:"f6d7", fen:"rnbqk2r/pppnbppp/4p3/3pPB2/3P4/2N5/PPP2PPP/R2QKBNR w KQkq - 1 6", ann:"5...Nfd7 — The knight retreats.", eval:20 },
    { ply:11, san:"Bxe7", uci:"g5e7", fen:"rnbqk2r/pppnBppp/4p3/3pP3/3P4/2N5/PPP2PPP/R2QKBNR b KQkq - 0 6", ann:"6.Bxe7 — White trades the bishop.", eval:25 },
    { ply:12, san:"Qxe7", uci:"d8e7", fen:"rnb1k2r/pppnqppp/4p3/3pP3/3P4/2N5/PPP2PPP/R2QKBNR w KQkq - 0 7", ann:"6...Qxe7 — Black recaptures with the queen. The position is solid for Black.", eval:20 },
  ]);
}

// 4. Exchange Variation
{
  const lid = await insertLine(frenchId, {
    title: "Exchange: 3.exd5 exd5",
    slug: "french-exchange",
    eco: "C01",
    pgn: "1. e4 e6 2. d4 d5 3. exd5 exd5 4. Nf3 Nf6 5. Bd3 Bd6 6. O-O O-O",
    finalFen: "rnbq1rk1/ppp2ppp/3b1n2/3p4/3P4/3B1N2/PPP2PPP/RNBQ1RK1 w - - 4 7",
    plyCnt: 12, color: "black", difficulty: "beginner",
    summary: "Exchange Variation. White trades pawns early, leading to a symmetrical position.",
    sortOrder: 4,
  });
  await insertNodes(lid, [
    { ply:0, fen:"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", ann:"Starting position." },
    { ply:1, san:"e4", uci:"e2e4", fen:"rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1", ann:"1.e4", eval:25 },
    { ply:2, san:"e6", uci:"e7e6", fen:"rnbqkbnr/pppp1ppp/4p3/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2", ann:"1...e6 — French Defense.", eval:20 },
    { ply:3, san:"d4", uci:"d2d4", fen:"rnbqkbnr/pppp1ppp/4p3/8/3PP3/8/PPP2PPP/RNBQKBNR b KQkq - 0 2", ann:"2.d4", eval:25 },
    { ply:4, san:"d5", uci:"d7d5", fen:"rnbqkbnr/ppp2ppp/4p3/3p4/3PP3/8/PPP2PPP/RNBQKBNR w KQkq - 0 3", ann:"2...d5", eval:20 },
    { ply:5, san:"exd5", uci:"e4d5", fen:"rnbqkbnr/ppp2ppp/4p3/3P4/3P4/8/PPP2PPP/RNBQKBNR b KQkq - 0 3", ann:"3.exd5 — Exchange Variation. White trades pawns.", eval:20 },
    { ply:6, san:"exd5", uci:"e6d5", fen:"rnbqkbnr/ppp2ppp/8/3p4/3P4/8/PPP2PPP/RNBQKBNR w KQkq - 0 4", ann:"3...exd5 — Black recaptures.", eval:20 },
    { ply:7, san:"Nf3", uci:"g1f3", fen:"rnbqkbnr/ppp2ppp/8/3p4/3P4/5N2/PPP2PPP/RNBQKB1R b KQkq - 1 4", ann:"4.Nf3 — Development.", eval:20 },
    { ply:8, san:"Nf6", uci:"g8f6", fen:"rnbqkb1r/ppp2ppp/5n2/3p4/3P4/5N2/PPP2PPP/RNBQKB1R w KQkq - 2 5", ann:"4...Nf6 — Development.", eval:20 },
    { ply:9, san:"Bd3", uci:"f1d3", fen:"rnbqkb1r/ppp2ppp/5n2/3p4/3P4/3B1N2/PPP2PPP/RNBQK2R b KQkq - 3 5", ann:"5.Bd3 — Development.", eval:20 },
    { ply:10, san:"Bd6", uci:"f8d6", fen:"rnbqk2r/ppp2ppp/3b1n2/3p4/3P4/3B1N2/PPP2PPP/RNBQK2R w KQkq - 4 6", ann:"5...Bd6 — Development.", eval:20 },
    { ply:11, san:"O-O", uci:"e1g1", fen:"rnbqk2r/ppp2ppp/3b1n2/3p4/3P4/3B1N2/PPP2PPP/RNBQ1RK1 b kq - 5 6", ann:"6.O-O — White castles.", eval:20 },
    { ply:12, san:"O-O", uci:"e8g8", fen:"rnbq1rk1/ppp2ppp/3b1n2/3p4/3P4/3B1N2/PPP2PPP/RNBQ1RK1 w - - 6 7", ann:"6...O-O — Both sides have castled. The position is symmetrical.", eval:20 },
  ]);
}

// ─────────────────────────────────────────────────────────────────────────────
// LONDON SYSTEM  id=WlUqnLXLR-HfKKDo
// ─────────────────────────────────────────────────────────────────────────────
const londonId = "WlUqnLXLR-HfKKDo";

{
  const lid = await insertLine(londonId, {
    title: "Main Line: d5, Nf6, e6",
    slug: "london-main-d5-nf6-e6",
    eco: "D02",
    pgn: "1. d4 d5 2. Bf4 Nf6 3. e3 e6 4. Nf3 Bd6 5. Bxd6 Qxd6 6. Nbd2 O-O 7. Bd3",
    finalFen: "rnb2rk1/ppp2ppp/3qpn2/3p4/3P4/3BPN2/PPPN1PPP/R2QK2R b KQ - 3 7",
    plyCnt: 13, color: "white", difficulty: "beginner",
    summary: "The London System main line. Solid and reliable for White.",
    sortOrder: 1,
  });
  await insertNodes(lid, [
    { ply:0, fen:"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", ann:"Starting position." },
    { ply:1, san:"d4", uci:"d2d4", fen:"rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq - 0 1", ann:"1.d4 — The London System begins.", eval:25 },
    { ply:2, san:"d5", uci:"d7d5", fen:"rnbqkbnr/ppp1pppp/8/3p4/3P4/8/PPP1PPPP/RNBQKBNR w KQkq - 0 2", ann:"1...d5 — Black stakes a claim in the center.", eval:20 },
    { ply:3, san:"Bf4", uci:"c1f4", fen:"rnbqkbnr/ppp1pppp/8/3p4/3P1B2/8/PPP1PPPP/RN1QKBNR b KQkq - 1 2", ann:"2.Bf4 — The London bishop! Developed early outside the pawn chain.", eval:25, nag:1 },
    { ply:4, san:"Nf6", uci:"g8f6", fen:"rnbqkb1r/ppp1pppp/5n2/3p4/3P1B2/8/PPP1PPPP/RN1QKBNR w KQkq - 2 3", ann:"2...Nf6 — Development.", eval:20 },
    { ply:5, san:"e3", uci:"e2e3", fen:"rnbqkb1r/ppp1pppp/5n2/3p4/3P1B2/4P3/PPP2PPP/RN1QKBNR b KQkq - 0 3", ann:"3.e3 — Solid. Supporting d4.", eval:25 },
    { ply:6, san:"e6", uci:"e7e6", fen:"rnbqkb1r/ppp2ppp/4pn2/3p4/3P1B2/4P3/PPP2PPP/RN1QKBNR w KQkq - 0 4", ann:"3...e6 — Solid structure.", eval:20 },
    { ply:7, san:"Nf3", uci:"g1f3", fen:"rnbqkb1r/ppp2ppp/4pn2/3p4/3P1B2/4PN2/PPP2PPP/RN1QKB1R b KQkq - 1 4", ann:"4.Nf3 — Development.", eval:25 },
    { ply:8, san:"Bd6", uci:"f8d6", fen:"rnbqk2r/ppp2ppp/3bpn2/3p4/3P1B2/4PN2/PPP2PPP/RN1QKB1R w KQkq - 2 5", ann:"4...Bd6 — Challenging the bishop.", eval:20 },
    { ply:9, san:"Bxd6", uci:"f4d6", fen:"rnbqk2r/ppp2ppp/3Bpn2/3p4/3P4/4PN2/PPP2PPP/RN1QKB1R b KQkq - 0 5", ann:"5.Bxd6 — White trades the bishop.", eval:25 },
    { ply:10, san:"Qxd6", uci:"d8d6", fen:"rnb1k2r/ppp2ppp/3qpn2/3p4/3P4/4PN2/PPP2PPP/RN1QKB1R w KQkq - 0 6", ann:"5...Qxd6 — Black recaptures, centralizing the queen.", eval:20 },
    { ply:11, san:"Nbd2", uci:"b1d2", fen:"rnb1k2r/ppp2ppp/3qpn2/3p4/3P4/4PN2/PPPN1PPP/R2QKB1R b KQkq - 1 6", ann:"6.Nbd2 — Flexible development.", eval:25 },
    { ply:12, san:"O-O", uci:"e8g8", fen:"rnb2rk1/ppp2ppp/3qpn2/3p4/3P4/4PN2/PPPN1PPP/R2QKB1R w KQ - 2 7", ann:"6...O-O — Black castles.", eval:20 },
    { ply:13, san:"Bd3", uci:"f1d3", fen:"rnb2rk1/ppp2ppp/3qpn2/3p4/3P4/3BPN2/PPPN1PPP/R2QK2R b KQ - 3 7", ann:"7.Bd3 — Developing the bishop. White has a solid London setup.", eval:25 },
  ]);
}

{
  const lid = await insertLine(londonId, {
    title: "vs King's Indian Setup: ...g6",
    slug: "london-vs-kings-indian",
    eco: "A48",
    pgn: "1. d4 Nf6 2. Bf4 g6 3. e3 Bg7 4. Nf3 O-O 5. Be2 d6 6. O-O c5 7. c3",
    finalFen: "rnbq1rk1/pp2ppbp/3p1np1/2p5/3P1B2/2P1PN2/PP2BPPP/RN1Q1RK1 b - - 0 7",
    plyCnt: 13, color: "white", difficulty: "intermediate",
    summary: "London vs King's Indian setup. White plays solidly while Black fianchettoes.",
    sortOrder: 2,
  });
  await insertNodes(lid, [
    { ply:0, fen:"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", ann:"Starting position." },
    { ply:1, san:"d4", uci:"d2d4", fen:"rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq - 0 1", ann:"1.d4 — London System.", eval:25 },
    { ply:2, san:"Nf6", uci:"g8f6", fen:"rnbqkb1r/pppppppp/5n2/8/3P4/8/PPP1PPPP/RNBQKBNR w KQkq - 1 2", ann:"1...Nf6 — Flexible.", eval:20 },
    { ply:3, san:"Bf4", uci:"c1f4", fen:"rnbqkb1r/pppppppp/5n2/8/3P1B2/8/PPP1PPPP/RN1QKBNR b KQkq - 2 2", ann:"2.Bf4 — London bishop.", eval:25 },
    { ply:4, san:"g6", uci:"g7g6", fen:"rnbqkb1r/pppppp1p/5np1/8/3P1B2/8/PPP1PPPP/RN1QKBNR w KQkq - 0 3", ann:"2...g6 — King's Indian setup.", eval:20 },
    { ply:5, san:"e3", uci:"e2e3", fen:"rnbqkb1r/pppppp1p/5np1/8/3P1B2/4P3/PPP2PPP/RN1QKBNR b KQkq - 0 3", ann:"3.e3 — Solid.", eval:25 },
    { ply:6, san:"Bg7", uci:"f8g7", fen:"rnbqk2r/ppppppbp/5np1/8/3P1B2/4P3/PPP2PPP/RN1QKBNR w KQkq - 1 4", ann:"3...Bg7 — Fianchetto.", eval:20 },
    { ply:7, san:"Nf3", uci:"g1f3", fen:"rnbqk2r/ppppppbp/5np1/8/3P1B2/4PN2/PPP2PPP/RN1QKB1R b KQkq - 2 4", ann:"4.Nf3 — Development.", eval:25 },
    { ply:8, san:"O-O", uci:"e8g8", fen:"rnbq1rk1/ppppppbp/5np1/8/3P1B2/4PN2/PPP2PPP/RN1QKB1R w KQ - 3 5", ann:"4...O-O — Black castles.", eval:20 },
    { ply:9, san:"Be2", uci:"f1e2", fen:"rnbq1rk1/ppppppbp/5np1/8/3P1B2/4PN2/PPP1BPPP/RN1QK2R b KQ - 4 5", ann:"5.Be2 — Solid development.", eval:25 },
    { ply:10, san:"d6", uci:"d7d6", fen:"rnbq1rk1/ppp1ppbp/3p1np1/8/3P1B2/4PN2/PPP1BPPP/RN1QK2R w KQ - 0 6", ann:"5...d6 — Preparing ...e5.", eval:20 },
    { ply:11, san:"O-O", uci:"e1g1", fen:"rnbq1rk1/ppp1ppbp/3p1np1/8/3P1B2/4PN2/PPP1BPPP/RN1Q1RK1 b - - 1 6", ann:"6.O-O — White castles.", eval:25 },
    { ply:12, san:"c5", uci:"c7c5", fen:"rnbq1rk1/pp2ppbp/3p1np1/2p5/3P1B2/4PN2/PPP1BPPP/RN1Q1RK1 w - - 0 7", ann:"6...c5 — Black challenges the center.", eval:20 },
    { ply:13, san:"c3", uci:"c2c3", fen:"rnbq1rk1/pp2ppbp/3p1np1/2p5/3P1B2/2P1PN2/PP2BPPP/RN1Q1RK1 b - - 0 7", ann:"7.c3 — Solid. White has a classic London setup.", eval:25 },
  ]);
}

// ─────────────────────────────────────────────────────────────────────────────
// NIMZO-INDIAN DEFENSE  id=pfHic956vS-TYBVl
// ─────────────────────────────────────────────────────────────────────────────
const nimzoId = "pfHic956vS-TYBVl";

{
  const lid = await insertLine(nimzoId, {
    title: "Classical: 4.Qc2 Main Line",
    slug: "nimzo-classical-qc2",
    eco: "E32",
    pgn: "1. d4 Nf6 2. c4 e6 3. Nc3 Bb4 4. Qc2 O-O 5. a3 Bxc3+ 6. Qxc3 b6 7. Bg5",
    finalFen: "rnbq1rk1/p1pp1ppp/1p2pn2/6B1/2PP4/2Q5/PP3PPP/R3KBNR b KQ - 1 7",
    plyCnt: 13, color: "black", difficulty: "advanced",
    summary: "Nimzo-Indian Classical. White avoids doubled pawns with Qc2.",
    sortOrder: 1,
  });
  await insertNodes(lid, [
    { ply:0, fen:"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", ann:"Starting position." },
    { ply:1, san:"d4", uci:"d2d4", fen:"rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq - 0 1", ann:"1.d4", eval:25 },
    { ply:2, san:"Nf6", uci:"g8f6", fen:"rnbqkb1r/pppppppp/5n2/8/3P4/8/PPP1PPPP/RNBQKBNR w KQkq - 1 2", ann:"1...Nf6", eval:20 },
    { ply:3, san:"c4", uci:"c2c4", fen:"rnbqkb1r/pppppppp/5n2/8/2PP4/8/PP2PPPP/RNBQKBNR b KQkq - 0 2", ann:"2.c4", eval:25 },
    { ply:4, san:"e6", uci:"e7e6", fen:"rnbqkb1r/pppp1ppp/4pn2/8/2PP4/8/PP2PPPP/RNBQKBNR w KQkq - 0 3", ann:"2...e6 — Nimzo-Indian setup.", eval:20 },
    { ply:5, san:"Nc3", uci:"b1c3", fen:"rnbqkb1r/pppp1ppp/4pn2/8/2PP4/2N5/PP2PPPP/R1BQKBNR b KQkq - 1 3", ann:"3.Nc3 — Inviting the Nimzo-Indian.", eval:25 },
    { ply:6, san:"Bb4", uci:"f8b4", fen:"rnbqk2r/pppp1ppp/4pn2/8/1bPP4/2N5/PP2PPPP/R1BQKBNR w KQkq - 2 4", ann:"3...Bb4 — The Nimzo-Indian! Pinning the knight.", eval:20, nag:1 },
    { ply:7, san:"Qc2", uci:"d1c2", fen:"rnbqk2r/pppp1ppp/4pn2/8/1bPP4/2N5/PPQ1PPPP/R1B1KBNR b KQkq - 3 4", ann:"4.Qc2 — Classical variation. White avoids doubled pawns.", eval:25, nag:1 },
    { ply:8, san:"O-O", uci:"e8g8", fen:"rnbq1rk1/pppp1ppp/4pn2/8/1bPP4/2N5/PPQ1PPPP/R1B1KBNR w KQ - 4 5", ann:"4...O-O — Black castles.", eval:20 },
    { ply:9, san:"a3", uci:"a2a3", fen:"rnbq1rk1/pppp1ppp/4pn2/8/1bPP4/P1N5/1PQ1PPPP/R1B1KBNR b KQ - 0 5", ann:"5.a3 — Forcing the bishop to decide.", eval:25 },
    { ply:10, san:"Bxc3+", uci:"b4c3", fen:"rnbq1rk1/pppp1ppp/4pn2/8/2PP4/P1b5/1PQ1PPPP/R1B1KBNR w KQ - 0 6", ann:"5...Bxc3+ — Black trades the bishop.", eval:20 },
    { ply:11, san:"Qxc3", uci:"c2c3", fen:"rnbq1rk1/pppp1ppp/4pn2/8/2PP4/P1Q5/1P3PPP/R1B1KBNR b KQ - 0 6", ann:"6.Qxc3 — White recaptures with the queen.", eval:25 },
    { ply:12, san:"b6", uci:"b7b6", fen:"rnbq1rk1/p1pp1ppp/1p2pn2/8/2PP4/P1Q5/1P3PPP/R1B1KBNR w KQ - 0 7", ann:"6...b6 — Preparing ...Bb7.", eval:20 },
    { ply:13, san:"Bg5", uci:"c1g5", fen:"rnbq1rk1/p1pp1ppp/1p2pn2/6B1/2PP4/P1Q5/1P3PPP/R3KBNR b KQ - 1 7", ann:"7.Bg5 — Developing, pinning the knight. White has the bishop pair.", eval:25 },
  ]);
}

{
  const lid = await insertLine(nimzoId, {
    title: "Rubinstein: 4.e3 b6",
    slug: "nimzo-rubinstein-e3",
    eco: "E46",
    pgn: "1. d4 Nf6 2. c4 e6 3. Nc3 Bb4 4. e3 b6 5. Nge2 Ba6 6. a3 Bxc3+ 7. Nxc3",
    finalFen: "rn1qk2r/p1pp1ppp/bp2pn2/8/2PP4/P1N5/1P3PPP/R1BQKB1R b KQkq - 0 7",
    plyCnt: 13, color: "black", difficulty: "advanced",
    summary: "Rubinstein Nimzo-Indian. Solid and strategic.",
    sortOrder: 2,
  });
  await insertNodes(lid, [
    { ply:0, fen:"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", ann:"Starting position." },
    { ply:1, san:"d4", uci:"d2d4", fen:"rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq - 0 1", ann:"1.d4", eval:25 },
    { ply:2, san:"Nf6", uci:"g8f6", fen:"rnbqkb1r/pppppppp/5n2/8/3P4/8/PPP1PPPP/RNBQKBNR w KQkq - 1 2", ann:"1...Nf6", eval:20 },
    { ply:3, san:"c4", uci:"c2c4", fen:"rnbqkb1r/pppppppp/5n2/8/2PP4/8/PP2PPPP/RNBQKBNR b KQkq - 0 2", ann:"2.c4", eval:25 },
    { ply:4, san:"e6", uci:"e7e6", fen:"rnbqkb1r/pppp1ppp/4pn2/8/2PP4/8/PP2PPPP/RNBQKBNR w KQkq - 0 3", ann:"2...e6", eval:20 },
    { ply:5, san:"Nc3", uci:"b1c3", fen:"rnbqkb1r/pppp1ppp/4pn2/8/2PP4/2N5/PP2PPPP/R1BQKBNR b KQkq - 1 3", ann:"3.Nc3", eval:25 },
    { ply:6, san:"Bb4", uci:"f8b4", fen:"rnbqk2r/pppp1ppp/4pn2/8/1bPP4/2N5/PP2PPPP/R1BQKBNR w KQkq - 2 4", ann:"3...Bb4 — Nimzo-Indian.", eval:20 },
    { ply:7, san:"e3", uci:"e2e3", fen:"rnbqk2r/pppp1ppp/4pn2/8/1bPP4/2N1P3/PP3PPP/R1BQKBNR b KQkq - 0 4", ann:"4.e3 — Rubinstein variation. Solid.", eval:25 },
    { ply:8, san:"b6", uci:"b7b6", fen:"rnbqk2r/p1pp1ppp/1p2pn2/8/1bPP4/2N1P3/PP3PPP/R1BQKBNR w KQkq - 0 5", ann:"4...b6 — Preparing ...Ba6 or ...Bb7.", eval:20 },
    { ply:9, san:"Nge2", uci:"g1e2", fen:"rnbqk2r/p1pp1ppp/1p2pn2/8/1bPP4/2N1P3/PP2NPPP/R1BQKB1R b KQkq - 1 5", ann:"5.Nge2 — Flexible development.", eval:25 },
    { ply:10, san:"Ba6", uci:"c8a6", fen:"rn1qk2r/p1pp1ppp/bp2pn2/8/1bPP4/2N1P3/PP2NPPP/R1BQKB1R w KQkq - 2 6", ann:"5...Ba6 — Attacking c4.", eval:20, nag:1 },
    { ply:11, san:"a3", uci:"a2a3", fen:"rn1qk2r/p1pp1ppp/bp2pn2/8/1bPP4/P1N1P3/1P2NPPP/R1BQKB1R b KQkq - 0 6", ann:"6.a3 — Forcing the bishop.", eval:25 },
    { ply:12, san:"Bxc3+", uci:"b4c3", fen:"rn1qk2r/p1pp1ppp/bp2pn2/8/2PP4/P1b1P3/1P2NPPP/R1BQKB1R w KQkq - 0 7", ann:"6...Bxc3+ — Black trades.", eval:20 },
    { ply:13, san:"Nxc3", uci:"e2c3", fen:"rn1qk2r/p1pp1ppp/bp2pn2/8/2PP4/P1N1P3/1P3PPP/R1BQKB1R b KQkq - 0 7", ann:"7.Nxc3 — White recaptures. The position is strategically rich.", eval:25 },
  ]);
}

// ─────────────────────────────────────────────────────────────────────────────
// QUEEN'S GAMBIT  id=pPZkkBU968mr5_Pe
// ─────────────────────────────────────────────────────────────────────────────
const qgId = "pPZkkBU968mr5_Pe";

{
  const lid = await insertLine(qgId, {
    title: "QGA: 2...dxc4 Accepted",
    slug: "qga-accepted",
    eco: "D20",
    pgn: "1. d4 d5 2. c4 dxc4 3. Nf3 Nf6 4. e3 e6 5. Bxc4 c5 6. O-O a6 7. Qe2",
    finalFen: "rnbqkb1r/1p3ppp/p3pn2/2p5/2BP4/4PN2/PP2QPPP/RNB2RK1 b kq - 1 7",
    plyCnt: 13, color: "white", difficulty: "intermediate",
    summary: "Queen's Gambit Accepted. Black takes the pawn, White regains it with development.",
    sortOrder: 1,
  });
  await insertNodes(lid, [
    { ply:0, fen:"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", ann:"Starting position." },
    { ply:1, san:"d4", uci:"d2d4", fen:"rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq - 0 1", ann:"1.d4 — Queen's Gambit begins.", eval:25 },
    { ply:2, san:"d5", uci:"d7d5", fen:"rnbqkbnr/ppp1pppp/8/3p4/3P4/8/PPP1PPPP/RNBQKBNR w KQkq - 0 2", ann:"1...d5 — Black stakes a claim.", eval:20 },
    { ply:3, san:"c4", uci:"c2c4", fen:"rnbqkbnr/ppp1pppp/8/3p4/2PP4/8/PP2PPPP/RNBQKBNR b KQkq - 0 2", ann:"2.c4 — The Queen's Gambit!", eval:25, nag:1 },
    { ply:4, san:"dxc4", uci:"d5c4", fen:"rnbqkbnr/ppp1pppp/8/8/2pP4/8/PP2PPPP/RNBQKBNR w KQkq - 0 3", ann:"2...dxc4 — Accepted! Black takes the pawn.", eval:20, nag:1 },
    { ply:5, san:"Nf3", uci:"g1f3", fen:"rnbqkbnr/ppp1pppp/8/8/2pP4/5N2/PP2PPPP/RNBQKB1R b KQkq - 1 3", ann:"3.Nf3 — Development.", eval:25 },
    { ply:6, san:"Nf6", uci:"g8f6", fen:"rnbqkb1r/ppp1pppp/5n2/8/2pP4/5N2/PP2PPPP/RNBQKB1R w KQkq - 2 4", ann:"3...Nf6 — Development.", eval:20 },
    { ply:7, san:"e3", uci:"e2e3", fen:"rnbqkb1r/ppp1pppp/5n2/8/2pP4/4PN2/PP3PPP/RNBQKB1R b KQkq - 0 4", ann:"4.e3 — Preparing to recapture the pawn.", eval:25 },
    { ply:8, san:"e6", uci:"e7e6", fen:"rnbqkb1r/ppp2ppp/4pn2/8/2pP4/4PN2/PP3PPP/RNBQKB1R w KQkq - 0 5", ann:"4...e6 — Solid.", eval:20 },
    { ply:9, san:"Bxc4", uci:"f1c4", fen:"rnbqkb1r/ppp2ppp/4pn2/8/2BP4/4PN2/PP3PPP/RNBQK2R b KQkq - 0 5", ann:"5.Bxc4 — White recaptures the pawn.", eval:25 },
    { ply:10, san:"c5", uci:"c7c5", fen:"rnbqkb1r/pp3ppp/4pn2/2p5/2BP4/4PN2/PP3PPP/RNBQK2R w KQkq - 0 6", ann:"5...c5 — Black challenges the center.", eval:20, nag:1 },
    { ply:11, san:"O-O", uci:"e1g1", fen:"rnbqkb1r/pp3ppp/4pn2/2p5/2BP4/4PN2/PP3PPP/RNBQ1RK1 b kq - 1 6", ann:"6.O-O — White castles.", eval:25 },
    { ply:12, san:"a6", uci:"a7a6", fen:"rnbqkb1r/1p3ppp/p3pn2/2p5/2BP4/4PN2/PP3PPP/RNBQ1RK1 w kq - 0 7", ann:"6...a6 — Preparing ...b5.", eval:20 },
    { ply:13, san:"Qe2", uci:"d1e2", fen:"rnbqkb1r/1p3ppp/p3pn2/2p5/2BP4/4PN2/PP2QPPP/RNB2RK1 b kq - 1 7", ann:"7.Qe2 — Flexible. White prepares to recapture on d4.", eval:25 },
  ]);
}

{
  const lid = await insertLine(qgId, {
    title: "QGD: 2...e6 Declined",
    slug: "qgd-e6",
    eco: "D30",
    pgn: "1. d4 d5 2. c4 e6 3. Nc3 Nf6 4. Bg5 Be7 5. e3 O-O 6. Nf3 Nbd7 7. Rc1",
    finalFen: "r1bq1rk1/pppnbppp/4pn2/3p2B1/2PP4/2N1PN2/PP3PPP/2RQKB1R b K - 1 7",
    plyCnt: 13, color: "white", difficulty: "intermediate",
    summary: "Queen's Gambit Declined with ...e6. Classical and solid.",
    sortOrder: 2,
  });
  await insertNodes(lid, [
    { ply:0, fen:"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", ann:"Starting position." },
    { ply:1, san:"d4", uci:"d2d4", fen:"rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq - 0 1", ann:"1.d4", eval:25 },
    { ply:2, san:"d5", uci:"d7d5", fen:"rnbqkbnr/ppp1pppp/8/3p4/3P4/8/PPP1PPPP/RNBQKBNR w KQkq - 0 2", ann:"1...d5", eval:20 },
    { ply:3, san:"c4", uci:"c2c4", fen:"rnbqkbnr/ppp1pppp/8/3p4/2PP4/8/PP2PPPP/RNBQKBNR b KQkq - 0 2", ann:"2.c4 — Queen's Gambit.", eval:25 },
    { ply:4, san:"e6", uci:"e7e6", fen:"rnbqkbnr/ppp2ppp/4p3/3p4/2PP4/8/PP2PPPP/RNBQKBNR w KQkq - 0 3", ann:"2...e6 — Declined! Solid.", eval:20, nag:1 },
    { ply:5, san:"Nc3", uci:"b1c3", fen:"rnbqkbnr/ppp2ppp/4p3/3p4/2PP4/2N5/PP2PPPP/R1BQKBNR b KQkq - 1 3", ann:"3.Nc3 — Development.", eval:25 },
    { ply:6, san:"Nf6", uci:"g8f6", fen:"rnbqkb1r/ppp2ppp/4pn2/3p4/2PP4/2N5/PP2PPPP/R1BQKBNR w KQkq - 2 4", ann:"3...Nf6 — Development.", eval:20 },
    { ply:7, san:"Bg5", uci:"c1g5", fen:"rnbqkb1r/ppp2ppp/4pn2/3p2B1/2PP4/2N5/PP2PPPP/R2QKBNR b KQkq - 3 4", ann:"4.Bg5 — Pinning the knight.", eval:25 },
    { ply:8, san:"Be7", uci:"f8e7", fen:"rnbqk2r/ppp1bppp/4pn2/3p2B1/2PP4/2N5/PP2PPPP/R2QKBNR w KQkq - 4 5", ann:"4...Be7 — Breaking the pin.", eval:20 },
    { ply:9, san:"e3", uci:"e2e3", fen:"rnbqk2r/ppp1bppp/4pn2/3p2B1/2PP4/2N1P3/PP3PPP/R2QKBNR b KQkq - 0 5", ann:"5.e3 — Solid.", eval:25 },
    { ply:10, san:"O-O", uci:"e8g8", fen:"rnbq1rk1/ppp1bppp/4pn2/3p2B1/2PP4/2N1P3/PP3PPP/R2QKBNR w KQ - 1 6", ann:"5...O-O — Black castles.", eval:20 },
    { ply:11, san:"Nf3", uci:"g1f3", fen:"rnbq1rk1/ppp1bppp/4pn2/3p2B1/2PP4/2N1PN2/PP3PPP/R2QKB1R b KQ - 2 6", ann:"6.Nf3 — Development.", eval:25 },
    { ply:12, san:"Nbd7", uci:"b8d7", fen:"r1bq1rk1/pppnbppp/4pn2/3p2B1/2PP4/2N1PN2/PP3PPP/R2QKB1R w KQ - 3 7", ann:"6...Nbd7 — Flexible development.", eval:20 },
    { ply:13, san:"Rc1", uci:"a1c1", fen:"r1bq1rk1/pppnbppp/4pn2/3p2B1/2PP4/2N1PN2/PP3PPP/2RQKB1R b K - 4 7", ann:"7.Rc1 — Preparing c5. White has a classic QGD setup.", eval:25 },
  ]);
}

// ─────────────────────────────────────────────────────────────────────────────
// QUEEN'S GAMBIT DECLINED  id=6-iMs3Qw6OfzwbDE
// ─────────────────────────────────────────────────────────────────────────────
const qgdId = "6-iMs3Qw6OfzwbDE";

{
  const lid = await insertLine(qgdId, {
    title: "Orthodox: 7.Rc1 Main Line",
    slug: "qgd-orthodox-rc1",
    eco: "D55",
    pgn: "1. d4 d5 2. c4 e6 3. Nc3 Nf6 4. Bg5 Be7 5. e3 O-O 6. Nf3 h6 7. Bh4 b6",
    finalFen: "rnbq1rk1/p1p1bppp/1p2pn1p/3p4/2PP3B/2N1PN2/PP3PPP/R2QKB1R w KQ - 0 8",
    plyCnt: 14, color: "black", difficulty: "intermediate",
    summary: "QGD Orthodox. Black plays ...h6 to challenge the bishop.",
    sortOrder: 1,
  });
  await insertNodes(lid, [
    { ply:0, fen:"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", ann:"Starting position." },
    { ply:1, san:"d4", uci:"d2d4", fen:"rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq - 0 1", ann:"1.d4", eval:25 },
    { ply:2, san:"d5", uci:"d7d5", fen:"rnbqkbnr/ppp1pppp/8/3p4/3P4/8/PPP1PPPP/RNBQKBNR w KQkq - 0 2", ann:"1...d5", eval:20 },
    { ply:3, san:"c4", uci:"c2c4", fen:"rnbqkbnr/ppp1pppp/8/3p4/2PP4/8/PP2PPPP/RNBQKBNR b KQkq - 0 2", ann:"2.c4 — Queen's Gambit.", eval:25 },
    { ply:4, san:"e6", uci:"e7e6", fen:"rnbqkbnr/ppp2ppp/4p3/3p4/2PP4/8/PP2PPPP/RNBQKBNR w KQkq - 0 3", ann:"2...e6 — QGD.", eval:20 },
    { ply:5, san:"Nc3", uci:"b1c3", fen:"rnbqkbnr/ppp2ppp/4p3/3p4/2PP4/2N5/PP2PPPP/R1BQKBNR b KQkq - 1 3", ann:"3.Nc3", eval:25 },
    { ply:6, san:"Nf6", uci:"g8f6", fen:"rnbqkb1r/ppp2ppp/4pn2/3p4/2PP4/2N5/PP2PPPP/R1BQKBNR w KQkq - 2 4", ann:"3...Nf6", eval:20 },
    { ply:7, san:"Bg5", uci:"c1g5", fen:"rnbqkb1r/ppp2ppp/4pn2/3p2B1/2PP4/2N5/PP2PPPP/R2QKBNR b KQkq - 3 4", ann:"4.Bg5 — Pinning the knight.", eval:25 },
    { ply:8, san:"Be7", uci:"f8e7", fen:"rnbqk2r/ppp1bppp/4pn2/3p2B1/2PP4/2N5/PP2PPPP/R2QKBNR w KQkq - 4 5", ann:"4...Be7", eval:20 },
    { ply:9, san:"e3", uci:"e2e3", fen:"rnbqk2r/ppp1bppp/4pn2/3p2B1/2PP4/2N1P3/PP3PPP/R2QKBNR b KQkq - 0 5", ann:"5.e3", eval:25 },
    { ply:10, san:"O-O", uci:"e8g8", fen:"rnbq1rk1/ppp1bppp/4pn2/3p2B1/2PP4/2N1P3/PP3PPP/R2QKBNR w KQ - 1 6", ann:"5...O-O", eval:20 },
    { ply:11, san:"Nf3", uci:"g1f3", fen:"rnbq1rk1/ppp1bppp/4pn2/3p2B1/2PP4/2N1PN2/PP3PPP/R2QKB1R b KQ - 2 6", ann:"6.Nf3", eval:25 },
    { ply:12, san:"h6", uci:"h7h6", fen:"rnbq1rk1/ppp1bpp1/4pn1p/3p2B1/2PP4/2N1PN2/PP3PPP/R2QKB1R w KQ - 0 7", ann:"6...h6 — Challenging the bishop.", eval:20, nag:1 },
    { ply:13, san:"Bh4", uci:"g5h4", fen:"rnbq1rk1/ppp1bpp1/4pn1p/3p4/2PP3B/2N1PN2/PP3PPP/R2QKB1R b KQ - 1 7", ann:"7.Bh4 — The bishop retreats.", eval:25 },
    { ply:14, san:"b6", uci:"b7b6", fen:"rnbq1rk1/p1p1bppp/1p2pn1p/3p4/2PP3B/2N1PN2/PP3PPP/R2QKB1R w KQ - 0 8", ann:"7...b6 — Preparing ...Ba6 or ...Bb7. Black has a solid position.", eval:20 },
  ]);
}

// ─────────────────────────────────────────────────────────────────────────────
// SCANDINAVIAN DEFENSE  id=kUhYse5NYwZquS9h
// ─────────────────────────────────────────────────────────────────────────────
const scandId = "kUhYse5NYwZquS9h";

{
  const lid = await insertLine(scandId, {
    title: "Main Line: 2...Qxd5 3.Nc3 Qa5",
    slug: "scandinavian-main-qa5",
    eco: "B01",
    pgn: "1. e4 d5 2. exd5 Qxd5 3. Nc3 Qa5 4. d4 Nf6 5. Nf3 Bf5 6. Bc4 e6 7. Bd2",
    finalFen: "rn2kb1r/ppp2ppp/4pn2/q4b2/2BPP3/2N2N2/PPP2PPP/R2QK2R b KQkq - 1 7",
    plyCnt: 13, color: "black", difficulty: "intermediate",
    summary: "Scandinavian main line. Black develops actively with ...Qa5.",
    sortOrder: 1,
  });
  await insertNodes(lid, [
    { ply:0, fen:"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", ann:"Starting position." },
    { ply:1, san:"e4", uci:"e2e4", fen:"rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1", ann:"1.e4", eval:25 },
    { ply:2, san:"d5", uci:"d7d5", fen:"rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2", ann:"1...d5 — The Scandinavian! Immediate central challenge.", eval:20, nag:1 },
    { ply:3, san:"exd5", uci:"e4d5", fen:"rnbqkbnr/ppp1pppp/8/3P4/8/8/PPPP1PPP/RNBQKBNR b KQkq - 0 2", ann:"2.exd5 — White captures.", eval:25 },
    { ply:4, san:"Qxd5", uci:"d8d5", fen:"rnb1kbnr/ppp1pppp/8/3q4/8/8/PPPP1PPP/RNBQKBNR w KQkq - 0 3", ann:"2...Qxd5 — Black recaptures with the queen.", eval:20 },
    { ply:5, san:"Nc3", uci:"b1c3", fen:"rnb1kbnr/ppp1pppp/8/3q4/8/2N5/PPPP1PPP/R1BQKBNR b KQkq - 1 3", ann:"3.Nc3 — Developing with tempo, attacking the queen.", eval:25 },
    { ply:6, san:"Qa5", uci:"d5a5", fen:"rnb1kbnr/ppp1pppp/8/q7/8/2N5/PPPP1PPP/R1BQKBNR w KQkq - 2 4", ann:"3...Qa5 — The main line! The queen retreats to a5.", eval:20, nag:1 },
    { ply:7, san:"d4", uci:"d2d4", fen:"rnb1kbnr/ppp1pppp/8/q7/3P4/2N5/PPP2PPP/R1BQKBNR b KQkq - 0 4", ann:"4.d4 — Building the center.", eval:25 },
    { ply:8, san:"Nf6", uci:"g8f6", fen:"rnb1kb1r/ppp1pppp/5n2/q7/3P4/2N5/PPP2PPP/R1BQKBNR w KQkq - 1 5", ann:"4...Nf6 — Development.", eval:20 },
    { ply:9, san:"Nf3", uci:"g1f3", fen:"rnb1kb1r/ppp1pppp/5n2/q7/3P4/2N2N2/PPP2PPP/R1BQKB1R b KQkq - 2 5", ann:"5.Nf3 — Development.", eval:25 },
    { ply:10, san:"Bf5", uci:"c8f5", fen:"rn2kb1r/ppp1pppp/5n2/q4b2/3P4/2N2N2/PPP2PPP/R1BQKB1R w KQkq - 3 6", ann:"5...Bf5 — Active bishop development.", eval:20, nag:1 },
    { ply:11, san:"Bc4", uci:"f1c4", fen:"rn2kb1r/ppp1pppp/5n2/q4b2/2BP4/2N2N2/PPP2PPP/R1BQK2R b KQkq - 4 6", ann:"6.Bc4 — Developing, targeting f7.", eval:25 },
    { ply:12, san:"e6", uci:"e7e6", fen:"rn2kb1r/ppp2ppp/4pn2/q4b2/2BP4/2N2N2/PPP2PPP/R1BQK2R w KQkq - 0 7", ann:"6...e6 — Solid.", eval:20 },
    { ply:13, san:"Bd2", uci:"c1d2", fen:"rn2kb1r/ppp2ppp/4pn2/q4b2/2BPP3/2N2N2/PPP2PPP/R2QK2R b KQkq - 1 7", ann:"7.Bd2 — Preparing to challenge the queen. White has a slight edge.", eval:25 },
  ]);
}

{
  const lid = await insertLine(scandId, {
    title: "Modern: 2...Nf6 Icelandic",
    slug: "scandinavian-icelandic",
    eco: "B01",
    pgn: "1. e4 d5 2. exd5 Nf6 3. c4 c6 4. dxc6 Nxc6 5. Nf3 e5 6. Nc3 Bc5",
    finalFen: "r1bqk2r/pp3ppp/2n2n2/2b1p3/2P5/2N2N2/PP1P1PPP/R1BQKB1R w KQkq - 2 7",
    plyCnt: 11, color: "black", difficulty: "advanced",
    summary: "Icelandic Gambit. Black sacrifices a pawn for rapid development.",
    sortOrder: 2,
  });
  await insertNodes(lid, [
    { ply:0, fen:"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", ann:"Starting position." },
    { ply:1, san:"e4", uci:"e2e4", fen:"rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1", ann:"1.e4", eval:25 },
    { ply:2, san:"d5", uci:"d7d5", fen:"rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2", ann:"1...d5 — Scandinavian.", eval:20 },
    { ply:3, san:"exd5", uci:"e4d5", fen:"rnbqkbnr/ppp1pppp/8/3P4/8/8/PPPP1PPP/RNBQKBNR b KQkq - 0 2", ann:"2.exd5", eval:25 },
    { ply:4, san:"Nf6", uci:"g8f6", fen:"rnbqkb1r/ppp1pppp/5n2/3P4/8/8/PPPP1PPP/RNBQKBNR w KQkq - 1 3", ann:"2...Nf6 — Modern! Developing instead of recapturing.", eval:20, nag:1 },
    { ply:5, san:"c4", uci:"c2c4", fen:"rnbqkb1r/ppp1pppp/5n2/3P4/2P5/8/PP1P1PPP/RNBQKBNR b KQkq - 0 3", ann:"3.c4 — White keeps the pawn.", eval:25 },
    { ply:6, san:"c6", uci:"c7c6", fen:"rnbqkb1r/pp2pppp/2p2n2/3P4/2P5/8/PP1P1PPP/RNBQKBNR w KQkq - 0 4", ann:"3...c6 — The Icelandic Gambit! Black sacrifices for development.", eval:20, nag:1 },
    { ply:7, san:"dxc6", uci:"d5c6", fen:"rnbqkb1r/pp2pppp/2P2n2/8/2P5/8/PP1P1PPP/RNBQKBNR b KQkq - 0 4", ann:"4.dxc6 — White accepts.", eval:25 },
    { ply:8, san:"Nxc6", uci:"f6c6", fen:"r1bqkb1r/pp2pppp/2n5/8/2P5/8/PP1P1PPP/RNBQKBNR w KQkq - 0 5", ann:"4...Nxc6 — Black recaptures.", eval:20 },
    { ply:9, san:"Nf3", uci:"g1f3", fen:"r1bqkb1r/pp2pppp/2n5/8/2P5/5N2/PP1P1PPP/RNBQKB1R b KQkq - 1 5", ann:"5.Nf3 — Development.", eval:25 },
    { ply:10, san:"e5", uci:"e7e5", fen:"r1bqkb1r/pp3ppp/2n5/4p3/2P5/5N2/PP1P1PPP/RNBQKB1R w KQkq - 0 6", ann:"5...e5 — Black seizes the center.", eval:20, nag:1 },
    { ply:11, san:"Nc3", uci:"b1c3", fen:"r1bqkb1r/pp3ppp/2n5/4p3/2P5/2N2N2/PP1P1PPP/R1BQKB1R b KQkq - 1 6", ann:"6.Nc3 — Development.", eval:25 },
    { ply:12, san:"Bc5", uci:"f8c5", fen:"r1bqk2r/pp3ppp/2n2n2/2b1p3/2P5/2N2N2/PP1P1PPP/R1BQKB1R w KQkq - 2 7", ann:"6...Bc5 — Active development. Black has excellent piece activity for the pawn.", eval:20, nag:1 },
  ]);
}

// ─────────────────────────────────────────────────────────────────────────────
// SLAV DEFENSE  id=MNr3AZwgIIvwPvSD
// ─────────────────────────────────────────────────────────────────────────────
const slavId = "MNr3AZwgIIvwPvSD";

{
  const lid = await insertLine(slavId, {
    title: "Main Line: 4.Nc3 dxc4",
    slug: "slav-main-dxc4",
    eco: "D17",
    pgn: "1. d4 d5 2. c4 c6 3. Nf3 Nf6 4. Nc3 dxc4 5. a4 Bf5 6. e3 e6 7. Bxc4",
    finalFen: "rn1qkb1r/pp3ppp/2p1pn2/5b2/P1BP4/2N1PN2/1P3PPP/R1BQK2R b KQkq - 0 7",
    plyCnt: 13, color: "black", difficulty: "intermediate",
    summary: "Slav Defense main line. Black accepts the gambit and develops the bishop.",
    sortOrder: 1,
  });
  await insertNodes(lid, [
    { ply:0, fen:"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", ann:"Starting position." },
    { ply:1, san:"d4", uci:"d2d4", fen:"rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq - 0 1", ann:"1.d4", eval:25 },
    { ply:2, san:"d5", uci:"d7d5", fen:"rnbqkbnr/ppp1pppp/8/3p4/3P4/8/PPP1PPPP/RNBQKBNR w KQkq - 0 2", ann:"1...d5", eval:20 },
    { ply:3, san:"c4", uci:"c2c4", fen:"rnbqkbnr/ppp1pppp/8/3p4/2PP4/8/PP2PPPP/RNBQKBNR b KQkq - 0 2", ann:"2.c4 — Queen's Gambit.", eval:25 },
    { ply:4, san:"c6", uci:"c7c6", fen:"rnbqkbnr/pp2pppp/2p5/3p4/2PP4/8/PP2PPPP/RNBQKBNR w KQkq - 0 3", ann:"2...c6 — The Slav! Solid support for d5.", eval:20, nag:1 },
    { ply:5, san:"Nf3", uci:"g1f3", fen:"rnbqkbnr/pp2pppp/2p5/3p4/2PP4/5N2/PP2PPPP/RNBQKB1R b KQkq - 1 3", ann:"3.Nf3 — Development.", eval:25 },
    { ply:6, san:"Nf6", uci:"g8f6", fen:"rnbqkb1r/pp2pppp/2p2n2/3p4/2PP4/5N2/PP2PPPP/RNBQKB1R w KQkq - 2 4", ann:"3...Nf6 — Development.", eval:20 },
    { ply:7, san:"Nc3", uci:"b1c3", fen:"rnbqkb1r/pp2pppp/2p2n2/3p4/2PP4/2N2N2/PP2PPPP/R1BQKB1R b KQkq - 3 4", ann:"4.Nc3 — Development.", eval:25 },
    { ply:8, san:"dxc4", uci:"d5c4", fen:"rnbqkb1r/pp2pppp/2p2n2/8/2pP4/2N2N2/PP2PPPP/R1BQKB1R w KQkq - 0 5", ann:"4...dxc4 — Black accepts the gambit!", eval:20, nag:1 },
    { ply:9, san:"a4", uci:"a2a4", fen:"rnbqkb1r/pp2pppp/2p2n2/8/P1pP4/2N2N2/1P2PPPP/R1BQKB1R b KQkq - 0 5", ann:"5.a4 — Preventing ...b5.", eval:25 },
    { ply:10, san:"Bf5", uci:"c8f5", fen:"rn1qkb1r/pp2pppp/2p2n2/5b2/P1pP4/2N2N2/1P2PPPP/R1BQKB1R w KQkq - 1 6", ann:"5...Bf5 — Active bishop development! The key Slav idea.", eval:20, nag:1 },
    { ply:11, san:"e3", uci:"e2e3", fen:"rn1qkb1r/pp2pppp/2p2n2/5b2/P1pP4/2N1PN2/1P3PPP/R1BQKB1R b KQkq - 0 6", ann:"6.e3 — Preparing to recapture.", eval:25 },
    { ply:12, san:"e6", uci:"e7e6", fen:"rn1qkb1r/pp3ppp/2p1pn2/5b2/P1pP4/2N1PN2/1P3PPP/R1BQKB1R w KQkq - 0 7", ann:"6...e6 — Solid.", eval:20 },
    { ply:13, san:"Bxc4", uci:"f1c4", fen:"rn1qkb1r/pp3ppp/2p1pn2/5b2/P1BP4/2N1PN2/1P3PPP/R1BQK2R b KQkq - 0 7", ann:"7.Bxc4 — White recaptures the pawn. The position is dynamically balanced.", eval:25 },
  ]);
}

// ─────────────────────────────────────────────────────────────────────────────
// VIENNA GAME  id=fEt9-mFmUqU_YzRt
// ─────────────────────────────────────────────────────────────────────────────
const viennaId = "fEt9-mFmUqU_YzRt";

{
  const lid = await insertLine(viennaId, {
    title: "Main Line: 2...Nf6 3.f4",
    slug: "vienna-main-nf6",
    eco: "C26",
    pgn: "1. e4 e5 2. Nc3 Nf6 3. Bc4 Nxe4 4. Qh5 Nd6 5. Bb3 Nc6 6. Nb5 g6 7. Qf3",
    finalFen: "r1bqkb1r/pppp1p1p/2nn2p1/1N6/8/1B3Q2/PPPP1PPP/R1B1K1NR b KQkq - 1 7",
    plyCnt: 13, color: "white", difficulty: "intermediate",
    summary: "Vienna Game main line. White develops aggressively with Bc4.",
    sortOrder: 1,
  });
  await insertNodes(lid, [
    { ply:0, fen:"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", ann:"Starting position." },
    { ply:1, san:"e4", uci:"e2e4", fen:"rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1", ann:"1.e4", eval:25 },
    { ply:2, san:"e5", uci:"e7e5", fen:"rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2", ann:"1...e5", eval:20 },
    { ply:3, san:"Nc3", uci:"b1c3", fen:"rnbqkbnr/pppp1ppp/8/4p3/4P3/2N5/PPPP1PPP/R1BQKBNR b KQkq - 1 2", ann:"2.Nc3 — Vienna Game! Flexible.", eval:25, nag:1 },
    { ply:4, san:"Nf6", uci:"g8f6", fen:"rnbqkb1r/pppp1ppp/5n2/4p3/4P3/2N5/PPPP1PPP/R1BQKBNR w KQkq - 2 3", ann:"2...Nf6 — Attacking e4.", eval:20 },
    { ply:5, san:"Bc4", uci:"f1c4", fen:"rnbqkb1r/pppp1ppp/5n2/4p3/2B1P3/2N5/PPPP1PPP/R1BQK1NR b KQkq - 3 3", ann:"3.Bc4 — Developing the bishop, targeting f7.", eval:25 },
    { ply:6, san:"Nxe4", uci:"f6e4", fen:"rnbqkb1r/pppp1ppp/8/4p3/2B1n3/2N5/PPPP1PPP/R1BQK1NR w KQkq - 0 4", ann:"3...Nxe4 — Black grabs the pawn!", eval:20, nag:5 },
    { ply:7, san:"Qh5", uci:"d1h5", fen:"rnbqkb1r/pppp1ppp/8/4p2Q/2B1n3/2N5/PPPP1PPP/R1B1K1NR b KQkq - 1 4", ann:"4.Qh5! — Attacking f7 and the knight!", eval:30, nag:1 },
    { ply:8, san:"Nd6", uci:"e4d6", fen:"rnbqkb1r/pppp1ppp/3n4/4p2Q/2B5/2N5/PPPP1PPP/R1B1K1NR w KQkq - 2 5", ann:"4...Nd6 — The knight retreats.", eval:25 },
    { ply:9, san:"Bb3", uci:"c4b3", fen:"rnbqkb1r/pppp1ppp/3n4/4p2Q/8/1BN5/PPPP1PPP/R1B1K1NR b KQkq - 3 5", ann:"5.Bb3 — Keeping the bishop.", eval:30 },
    { ply:10, san:"Nc6", uci:"b8c6", fen:"r1bqkb1r/pppp1ppp/2nn4/4p2Q/8/1BN5/PPPP1PPP/R1B1K1NR w KQkq - 4 6", ann:"5...Nc6 — Development.", eval:25 },
    { ply:11, san:"Nb5", uci:"c3b5", fen:"r1bqkb1r/pppp1ppp/2nn4/1N2p2Q/8/1B6/PPPP1PPP/R1B1K1NR b KQkq - 5 6", ann:"6.Nb5! — Threatening Nc7+.", eval:35, nag:1 },
    { ply:12, san:"g6", uci:"g7g6", fen:"r1bqkb1r/pppp1p1p/2nn2p1/1N2p2Q/8/1B6/PPPP1PPP/R1B1K1NR w KQkq - 0 7", ann:"6...g6 — Chasing the queen.", eval:25 },
    { ply:13, san:"Qf3", uci:"h5f3", fen:"r1bqkb1r/pppp1p1p/2nn2p1/1N6/8/1B3Q2/PPPP1PPP/R1B1K1NR b KQkq - 1 7", ann:"7.Qf3 — Threatening Qxf7#. White has a dangerous attack.", eval:35 },
  ]);
}

{
  const lid = await insertLine(viennaId, {
    title: "Solid: 2...Nc6 3.g3",
    slug: "vienna-solid-g3",
    eco: "C26",
    pgn: "1. e4 e5 2. Nc3 Nc6 3. g3 Nf6 4. Bg2 Bc5 5. Nge2 d6 6. O-O O-O",
    finalFen: "r1bq1rk1/ppp2ppp/2np1n2/2b1p3/4P3/2N3P1/PPPPNPBP/R1BQ1RK1 w - - 4 7",
    plyCnt: 12, color: "white", difficulty: "beginner",
    summary: "Vienna Game solid setup with g3. White fianchettoes the bishop.",
    sortOrder: 2,
  });
  await insertNodes(lid, [
    { ply:0, fen:"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", ann:"Starting position." },
    { ply:1, san:"e4", uci:"e2e4", fen:"rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1", ann:"1.e4", eval:25 },
    { ply:2, san:"e5", uci:"e7e5", fen:"rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2", ann:"1...e5", eval:20 },
    { ply:3, san:"Nc3", uci:"b1c3", fen:"rnbqkbnr/pppp1ppp/8/4p3/4P3/2N5/PPPP1PPP/R1BQKBNR b KQkq - 1 2", ann:"2.Nc3 — Vienna Game.", eval:25 },
    { ply:4, san:"Nc6", uci:"b8c6", fen:"r1bqkbnr/pppp1ppp/2n5/4p3/4P3/2N5/PPPP1PPP/R1BQKBNR w KQkq - 2 3", ann:"2...Nc6 — Solid development.", eval:20 },
    { ply:5, san:"g3", uci:"g2g3", fen:"r1bqkbnr/pppp1ppp/2n5/4p3/4P3/2N3P1/PPPP1P1P/R1BQKBNR b KQkq - 0 3", ann:"3.g3 — Fianchetto setup. Solid and flexible.", eval:25 },
    { ply:6, san:"Nf6", uci:"g8f6", fen:"r1bqkb1r/pppp1ppp/2n2n2/4p3/4P3/2N3P1/PPPP1P1P/R1BQKBNR w KQkq - 1 4", ann:"3...Nf6 — Development.", eval:20 },
    { ply:7, san:"Bg2", uci:"f1g2", fen:"r1bqkb1r/pppp1ppp/2n2n2/4p3/4P3/2N3P1/PPPP1PBP/R1BQK1NR b KQkq - 2 4", ann:"4.Bg2 — Completing the fianchetto.", eval:25 },
    { ply:8, san:"Bc5", uci:"f8c5", fen:"r1bqk2r/pppp1ppp/2n2n2/2b1p3/4P3/2N3P1/PPPP1PBP/R1BQK1NR w KQkq - 3 5", ann:"4...Bc5 — Active bishop development.", eval:20 },
    { ply:9, san:"Nge2", uci:"g1e2", fen:"r1bqk2r/pppp1ppp/2n2n2/2b1p3/4P3/2N3P1/PPPPNPBP/R1BQK2R b KQkq - 4 5", ann:"5.Nge2 — Flexible development.", eval:25 },
    { ply:10, san:"d6", uci:"d7d6", fen:"r1bqk2r/ppp2ppp/2np1n2/2b1p3/4P3/2N3P1/PPPPNPBP/R1BQK2R w KQkq - 0 6", ann:"5...d6 — Solid.", eval:20 },
    { ply:11, san:"O-O", uci:"e1g1", fen:"r1bqk2r/ppp2ppp/2np1n2/2b1p3/4P3/2N3P1/PPPPNPBP/R1BQ1RK1 b kq - 1 6", ann:"6.O-O — White castles.", eval:25 },
    { ply:12, san:"O-O", uci:"e8g8", fen:"r1bq1rk1/ppp2ppp/2np1n2/2b1p3/4P3/2N3P1/PPPPNPBP/R1BQ1RK1 w - - 2 7", ann:"6...O-O — Both sides have castled. The position is balanced.", eval:20 },
  ]);
}

// ─── Summary ─────────────────────────────────────────────────────────────────
console.log(`\nLines inserted: ${linesInserted}`);
console.log(`Nodes inserted: ${nodesInserted}`);

const [rows] = await conn.execute(`
  SELECT o.name, COUNT(DISTINCT l.id) as line_cnt, COUNT(n.id) as node_cnt
  FROM openings o
  LEFT JOIN opening_lines l ON l.opening_id = o.id AND l.is_published = 1
  LEFT JOIN line_nodes n ON n.line_id = l.id
  GROUP BY o.id, o.name
  ORDER BY o.name
`);
console.log("\nFinal state:");
rows.forEach(r => console.log(`  ${r.name}: ${r.line_cnt} lines, ${r.node_cnt} nodes`));

await conn.end();
console.log("\nSeed complete.");
