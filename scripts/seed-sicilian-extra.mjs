/**
 * seed-sicilian-extra.mjs
 *
 * Adds 6 more lines to the existing Sicilian Defense opening:
 *   1. Scheveningen Variation (B80)
 *   2. Classical Variation — Sozin Attack (B57)
 *   3. Kan/Taimanov Variation (B41)
 *   4. Grand Prix Attack (B23)
 *   5. Smith-Morra Gambit (B21)
 *   6. Closed Sicilian (A07)
 *
 * Existing lines: Alapin (B22), Dragon Yugoslav (B77), Najdorf 6.Bg5 (B96)
 *
 * Usage: node scripts/seed-sicilian-extra.mjs
 */
import mysql from "mysql2/promise";
import { randomUUID } from "crypto";

const nanoid = () => randomUUID().replace(/-/g, "").slice(0, 20);
const conn = await mysql.createConnection(process.env.DATABASE_URL);

const sicilianId = "940f1cc22ce64136896cd9a79a7015a5";

let linesInserted = 0;
let nodesInserted = 0;

async function insertLine(openingId, { title, slug, eco, pgn, finalFen, plyCnt, color, difficulty, description, sortOrder, themes, isMustKnow }) {
  const id = nanoid();
  await conn.execute(
    `INSERT IGNORE INTO opening_lines
     (id, opening_id, title, slug, eco, pgn, final_fen, ply_count, color,
      difficulty, description, themes, is_must_know, is_published, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, NOW(), NOW())`,
    [id, openingId, title, slug, eco, pgn, finalFen, plyCnt, color, difficulty,
     description, themes ?? null, isMustKnow ? 1 : 0, sortOrder]
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
// LINE 4: Scheveningen Variation (B80)
// 1.e4 c5 2.Nf3 d6 3.d4 cxd4 4.Nxd4 Nf6 5.Nc3 e6 6.Be3 a6 7.f3 b5
// ─────────────────────────────────────────────────────────────────────────────
{
  const lid = await insertLine(sicilianId, {
    title: "Scheveningen: English Attack",
    slug: "sicilian-scheveningen-english-attack",
    eco: "B80",
    pgn: "1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 e6 6. Be3 a6 7. f3 b5 8. Qd2 Bb7 9. g4",
    finalFen: "rn1qkb1r/1b3ppp/p2ppn2/1p6/3NP1P1/2N1BP2/PPPQ3P/R3KB1R b KQkq - 0 9",
    plyCnt: 17, color: "black", difficulty: "advanced",
    description: "The Scheveningen is a flexible Sicilian system where Black plays ...e6 and ...d6, creating a small center. The English Attack (Be3, f3, g4) is White's most aggressive response, launching a kingside pawn storm.",
    sortOrder: 4, isMustKnow: true, themes: "attack,pawn-storm,flexible",
  });
  await insertNodes(lid, [
    { ply:0, fen:"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", ann:"Starting position." },
    { ply:1, san:"e4", uci:"e2e4", fen:"rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1", ann:"1.e4", eval:25 },
    { ply:2, san:"c5", uci:"c7c5", fen:"rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2", ann:"1...c5 — The Sicilian Defense! Black fights for the center asymmetrically.", eval:20, nag:1 },
    { ply:3, san:"Nf3", uci:"g1f3", fen:"rnbqkbnr/pp1ppppp/8/2p5/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2", ann:"2.Nf3", eval:25 },
    { ply:4, san:"d6", uci:"d7d6", fen:"rnbqkbnr/pp2pppp/3p4/2p5/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 0 3", ann:"2...d6 — Preparing ...Nf6 and ...e5 or ...e6.", eval:20 },
    { ply:5, san:"d4", uci:"d2d4", fen:"rnbqkbnr/pp2pppp/3p4/2p5/3PP3/5N2/PPP2PPP/RNBQKB1R b KQkq - 0 3", ann:"3.d4 — Opening the center.", eval:25 },
    { ply:6, san:"cxd4", uci:"c5d4", fen:"rnbqkbnr/pp2pppp/3p4/8/3pP3/5N2/PPP2PPP/RNBQKB1R w KQkq - 0 4", ann:"3...cxd4 — Black trades pawns.", eval:20 },
    { ply:7, san:"Nxd4", uci:"f3d4", fen:"rnbqkbnr/pp2pppp/3p4/8/3NP3/8/PPP2PPP/RNBQKB1R b KQkq - 0 4", ann:"4.Nxd4 — White recaptures.", eval:25 },
    { ply:8, san:"Nf6", uci:"g8f6", fen:"rnbqkb1r/pp2pppp/3p1n2/8/3NP3/8/PPP2PPP/RNBQKB1R w KQkq - 1 5", ann:"4...Nf6 — Development.", eval:20 },
    { ply:9, san:"Nc3", uci:"b1c3", fen:"rnbqkb1r/pp2pppp/3p1n2/8/3NP3/2N5/PPP2PPP/R1BQKB1R b KQkq - 2 5", ann:"5.Nc3 — Development.", eval:25 },
    { ply:10, san:"e6", uci:"e7e6", fen:"rnbqkb1r/pp3ppp/3ppn2/8/3NP3/2N5/PPP2PPP/R1BQKB1R w KQkq - 0 6", ann:"5...e6 — The Scheveningen! Black creates a solid pawn structure.", eval:20, nag:1 },
    { ply:11, san:"Be3", uci:"c1e3", fen:"rnbqkb1r/pp3ppp/3ppn2/8/3NP3/2N1B3/PPP2PPP/R2QKB1R b KQkq - 1 6", ann:"6.Be3 — English Attack begins.", eval:25 },
    { ply:12, san:"a6", uci:"a7a6", fen:"rnbqkb1r/1p3ppp/p2ppn2/8/3NP3/2N1B3/PPP2PPP/R2QKB1R w KQkq - 0 7", ann:"6...a6 — Preventing Nb5 and preparing ...b5.", eval:20 },
    { ply:13, san:"f3", uci:"f2f3", fen:"rnbqkb1r/1p3ppp/p2ppn2/8/3NP3/2N1BP2/PPP3PP/R2QKB1R b KQkq - 0 7", ann:"7.f3 — Supporting e4 and preparing g4.", eval:25 },
    { ply:14, san:"b5", uci:"b7b5", fen:"rnbqkb1r/5ppp/p2ppn2/1p6/3NP3/2N1BP2/PPP3PP/R2QKB1R w KQkq - 0 8", ann:"7...b5 — Queenside expansion!", eval:20, nag:1 },
    { ply:15, san:"Qd2", uci:"d1d2", fen:"rnbqkb1r/5ppp/p2ppn2/1p6/3NP3/2N1BP2/PPPQ2PP/R3KB1R b KQkq - 1 8", ann:"8.Qd2 — Preparing to castle queenside.", eval:25 },
    { ply:16, san:"Bb7", uci:"c8b7", fen:"rn1qkb1r/1b3ppp/p2ppn2/1p6/3NP3/2N1BP2/PPPQ2PP/R3KB1R w KQkq - 2 9", ann:"8...Bb7 — Developing the bishop.", eval:20 },
    { ply:17, san:"g4", uci:"g2g4", fen:"rn1qkb1r/1b3ppp/p2ppn2/1p6/3NP1P1/2N1BP2/PPPQ3P/R3KB1R b KQkq - 0 9", ann:"9.g4! — The pawn storm begins! White launches a kingside attack. This is one of the sharpest positions in chess.", eval:30, nag:1 },
  ]);
}

// ─────────────────────────────────────────────────────────────────────────────
// LINE 5: Classical Variation — Sozin Attack (B57)
// 1.e4 c5 2.Nf3 Nc6 3.d4 cxd4 4.Nxd4 Nf6 5.Nc3 d6 6.Bc4 Bd7 7.Bb3 g6
// ─────────────────────────────────────────────────────────────────────────────
{
  const lid = await insertLine(sicilianId, {
    title: "Classical: Sozin Attack (6.Bc4)",
    slug: "sicilian-classical-sozin",
    eco: "B57",
    pgn: "1. e4 c5 2. Nf3 Nc6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 d6 6. Bc4 Qb6 7. Nb3 e6 8. Be3 Qc7 9. f4",
    finalFen: "r1b1kb1r/ppq2ppp/2nppn2/8/4PP2/1NN1B3/PPP3PP/R2QKB1R b KQkq - 0 9",
    plyCnt: 17, color: "black", difficulty: "advanced",
    description: "The Sozin Attack targets the f7 square with Bc4. Black must be precise to avoid getting crushed. The variation leads to sharp tactical battles where knowledge of key ideas is essential.",
    sortOrder: 5, isMustKnow: false, themes: "attack,tactics,bishop-attack",
  });
  await insertNodes(lid, [
    { ply:0, fen:"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", ann:"Starting position." },
    { ply:1, san:"e4", uci:"e2e4", fen:"rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1", ann:"1.e4", eval:25 },
    { ply:2, san:"c5", uci:"c7c5", fen:"rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2", ann:"1...c5 — Sicilian Defense.", eval:20 },
    { ply:3, san:"Nf3", uci:"g1f3", fen:"rnbqkbnr/pp1ppppp/8/2p5/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2", ann:"2.Nf3", eval:25 },
    { ply:4, san:"Nc6", uci:"b8c6", fen:"r1bqkbnr/pp1ppppp/2n5/2p5/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3", ann:"2...Nc6 — Classical Sicilian.", eval:20 },
    { ply:5, san:"d4", uci:"d2d4", fen:"r1bqkbnr/pp1ppppp/2n5/2p5/3PP3/5N2/PPP2PPP/RNBQKB1R b KQkq - 0 3", ann:"3.d4", eval:25 },
    { ply:6, san:"cxd4", uci:"c5d4", fen:"r1bqkbnr/pp1ppppp/2n5/8/3pP3/5N2/PPP2PPP/RNBQKB1R w KQkq - 0 4", ann:"3...cxd4", eval:20 },
    { ply:7, san:"Nxd4", uci:"f3d4", fen:"r1bqkbnr/pp1ppppp/2n5/8/3NP3/8/PPP2PPP/RNBQKB1R b KQkq - 0 4", ann:"4.Nxd4", eval:25 },
    { ply:8, san:"Nf6", uci:"g8f6", fen:"r1bqkb1r/pp1ppppp/2n2n2/8/3NP3/8/PPP2PPP/RNBQKB1R w KQkq - 1 5", ann:"4...Nf6 — Development.", eval:20 },
    { ply:9, san:"Nc3", uci:"b1c3", fen:"r1bqkb1r/pp1ppppp/2n2n2/8/3NP3/2N5/PPP2PPP/R1BQKB1R b KQkq - 2 5", ann:"5.Nc3", eval:25 },
    { ply:10, san:"d6", uci:"d7d6", fen:"r1bqkb1r/pp2pppp/2np1n2/8/3NP3/2N5/PPP2PPP/R1BQKB1R w KQkq - 0 6", ann:"5...d6 — Classical Sicilian.", eval:20 },
    { ply:11, san:"Bc4", uci:"f1c4", fen:"r1bqkb1r/pp2pppp/2np1n2/8/2BNP3/2N5/PPP2PPP/R1BQK2R b KQkq - 1 6", ann:"6.Bc4 — Sozin Attack! The bishop targets f7.", eval:25, nag:1 },
    { ply:12, san:"Qb6", uci:"d8b6", fen:"r1b1kb1r/pp2pppp/1qnp1n2/8/2BNP3/2N5/PPP2PPP/R1BQK2R w KQkq - 2 7", ann:"6...Qb6 — Attacking b2 and the bishop.", eval:20, nag:1 },
    { ply:13, san:"Nb3", uci:"d4b3", fen:"r1b1kb1r/pp2pppp/1qnp1n2/8/2B1P3/1NN5/PPP2PPP/R1BQK2R b KQkq - 3 7", ann:"7.Nb3 — Retreating the knight.", eval:25 },
    { ply:14, san:"e6", uci:"e7e6", fen:"r1b1kb1r/pp3ppp/1qnppn2/8/2B1P3/1NN5/PPP2PPP/R1BQK2R w KQkq - 0 8", ann:"7...e6 — Solid.", eval:20 },
    { ply:15, san:"Be3", uci:"c1e3", fen:"r1b1kb1r/pp3ppp/1qnppn2/8/2B1P3/1NN1B3/PPP2PPP/R2QK2R b KQkq - 1 8", ann:"8.Be3 — Development.", eval:25 },
    { ply:16, san:"Qc7", uci:"b6c7", fen:"r1b1kb1r/ppq2ppp/2nppn2/8/2B1P3/1NN1B3/PPP2PPP/R2QK2R w KQkq - 2 9", ann:"8...Qc7 — Retreating the queen.", eval:20 },
    { ply:17, san:"f4", uci:"f2f4", fen:"r1b1kb1r/ppq2ppp/2nppn2/8/2B1PP2/1NN1B3/PPP3PP/R2QK2R b KQkq - 0 9", ann:"9.f4 — White launches the kingside attack. The position is very sharp.", eval:30, nag:1 },
  ]);
}

// ─────────────────────────────────────────────────────────────────────────────
// LINE 6: Kan/Taimanov Variation (B41)
// 1.e4 c5 2.Nf3 e6 3.d4 cxd4 4.Nxd4 a6 5.Nc3 Qc7 6.Bd3 Nf6 7.O-O Nc6
// ─────────────────────────────────────────────────────────────────────────────
{
  const lid = await insertLine(sicilianId, {
    title: "Kan/Taimanov: 4...a6 Flexible Setup",
    slug: "sicilian-kan-taimanov",
    eco: "B41",
    pgn: "1. e4 c5 2. Nf3 e6 3. d4 cxd4 4. Nxd4 a6 5. Nc3 Qc7 6. Bd3 Nf6 7. O-O Nc6 8. Nxc6 bxc6 9. f4",
    finalFen: "r1b1kb1r/2q2ppp/p1p1pn2/8/4PP2/2NB4/PPP3PP/R1BQ1RK1 b kq - 0 9",
    plyCnt: 17, color: "black", difficulty: "intermediate",
    description: "The Kan (or Taimanov) is a flexible Sicilian where Black plays ...e6 and ...a6, keeping options open. Black can transpose to many different setups. The Kan is popular at club level for its flexibility.",
    sortOrder: 6, isMustKnow: false, themes: "flexible,solid,queenside",
  });
  await insertNodes(lid, [
    { ply:0, fen:"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", ann:"Starting position." },
    { ply:1, san:"e4", uci:"e2e4", fen:"rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1", ann:"1.e4", eval:25 },
    { ply:2, san:"c5", uci:"c7c5", fen:"rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2", ann:"1...c5 — Sicilian Defense.", eval:20 },
    { ply:3, san:"Nf3", uci:"g1f3", fen:"rnbqkbnr/pp1ppppp/8/2p5/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2", ann:"2.Nf3", eval:25 },
    { ply:4, san:"e6", uci:"e7e6", fen:"rnbqkbnr/pp1p1ppp/4p3/2p5/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 0 3", ann:"2...e6 — Kan/Taimanov setup.", eval:20 },
    { ply:5, san:"d4", uci:"d2d4", fen:"rnbqkbnr/pp1p1ppp/4p3/2p5/3PP3/5N2/PPP2PPP/RNBQKB1R b KQkq - 0 3", ann:"3.d4", eval:25 },
    { ply:6, san:"cxd4", uci:"c5d4", fen:"rnbqkbnr/pp1p1ppp/4p3/8/3pP3/5N2/PPP2PPP/RNBQKB1R w KQkq - 0 4", ann:"3...cxd4", eval:20 },
    { ply:7, san:"Nxd4", uci:"f3d4", fen:"rnbqkbnr/pp1p1ppp/4p3/8/3NP3/8/PPP2PPP/RNBQKB1R b KQkq - 0 4", ann:"4.Nxd4", eval:25 },
    { ply:8, san:"a6", uci:"a7a6", fen:"rnbqkbnr/1p1p1ppp/p3p3/8/3NP3/8/PPP2PPP/RNBQKB1R w KQkq - 0 5", ann:"4...a6 — The Kan! Flexible, preventing Nb5.", eval:20, nag:1 },
    { ply:9, san:"Nc3", uci:"b1c3", fen:"rnbqkbnr/1p1p1ppp/p3p3/8/3NP3/2N5/PPP2PPP/R1BQKB1R b KQkq - 1 5", ann:"5.Nc3 — Development.", eval:25 },
    { ply:10, san:"Qc7", uci:"d8c7", fen:"rnb1kbnr/1pqp1ppp/p3p3/8/3NP3/2N5/PPP2PPP/R1BQKB1R w KQkq - 2 6", ann:"5...Qc7 — Taimanov move. Centralizing the queen.", eval:20, nag:1 },
    { ply:11, san:"Bd3", uci:"f1d3", fen:"rnb1kbnr/1pqp1ppp/p3p3/8/3NP3/2NB4/PPP2PPP/R1BQK2R b KQkq - 3 6", ann:"6.Bd3 — Development.", eval:25 },
    { ply:12, san:"Nf6", uci:"g8f6", fen:"rnb1kb1r/1pqp1ppp/p3pn2/8/3NP3/2NB4/PPP2PPP/R1BQK2R w KQkq - 4 7", ann:"6...Nf6 — Development.", eval:20 },
    { ply:13, san:"O-O", uci:"e1g1", fen:"rnb1kb1r/1pqp1ppp/p3pn2/8/3NP3/2NB4/PPP2PPP/R1BQ1RK1 b kq - 5 7", ann:"7.O-O — White castles.", eval:25 },
    { ply:14, san:"Nc6", uci:"b8c6", fen:"r1b1kb1r/1pqp1ppp/p1n1pn2/8/3NP3/2NB4/PPP2PPP/R1BQ1RK1 w kq - 6 8", ann:"7...Nc6 — Development.", eval:20 },
    { ply:15, san:"Nxc6", uci:"d4c6", fen:"r1b1kb1r/1pqp1ppp/p1N1pn2/8/4P3/2NB4/PPP2PPP/R1BQ1RK1 b kq - 0 8", ann:"8.Nxc6 — White trades.", eval:25 },
    { ply:16, san:"bxc6", uci:"b7c6", fen:"r1b1kb1r/2qp1ppp/p1p1pn2/8/4P3/2NB4/PPP2PPP/R1BQ1RK1 w kq - 0 9", ann:"8...bxc6 — Black recaptures.", eval:20 },
    { ply:17, san:"f4", uci:"f2f4", fen:"r1b1kb1r/2qp1ppp/p1p1pn2/8/4PP2/2NB4/PPP3PP/R1BQ1RK1 b kq - 0 9", ann:"9.f4 — White prepares a kingside advance. The position is dynamically balanced.", eval:25 },
  ]);
}

// ─────────────────────────────────────────────────────────────────────────────
// LINE 7: Grand Prix Attack (B23)
// 1.e4 c5 2.Nc3 Nc6 3.f4 g6 4.Nf3 Bg7 5.Bc4 e6 6.f5
// ─────────────────────────────────────────────────────────────────────────────
{
  const lid = await insertLine(sicilianId, {
    title: "Grand Prix Attack: 2.Nc3 f4",
    slug: "sicilian-grand-prix-attack",
    eco: "B23",
    pgn: "1. e4 c5 2. Nc3 Nc6 3. f4 g6 4. Nf3 Bg7 5. Bc4 e6 6. f5 gxf5 7. exf5 d5 8. Bb3",
    finalFen: "r1bqk1nr/pp3pbp/2n1p3/2pp1P2/8/1BN2N2/PPPP2PP/R1BQK2R b KQkq - 1 8",
    plyCnt: 15, color: "white", difficulty: "intermediate",
    description: "The Grand Prix Attack is a dangerous weapon against the Sicilian. White plays Nc3 and f4, launching a quick kingside attack before Black can complete development. Very popular at club level.",
    sortOrder: 7, isMustKnow: false, themes: "attack,kingside,aggressive",
  });
  await insertNodes(lid, [
    { ply:0, fen:"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", ann:"Starting position." },
    { ply:1, san:"e4", uci:"e2e4", fen:"rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1", ann:"1.e4", eval:25 },
    { ply:2, san:"c5", uci:"c7c5", fen:"rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2", ann:"1...c5 — Sicilian Defense.", eval:20 },
    { ply:3, san:"Nc3", uci:"b1c3", fen:"rnbqkbnr/pp1ppppp/8/2p5/4P3/2N5/PPPP1PPP/R1BQKBNR b KQkq - 1 2", ann:"2.Nc3 — Grand Prix Attack setup.", eval:25 },
    { ply:4, san:"Nc6", uci:"b8c6", fen:"r1bqkbnr/pp1ppppp/2n5/2p5/4P3/2N5/PPPP1PPP/R1BQKBNR w KQkq - 2 3", ann:"2...Nc6 — Development.", eval:20 },
    { ply:5, san:"f4", uci:"f2f4", fen:"r1bqkbnr/pp1ppppp/2n5/2p5/4PP2/2N5/PPPP2PP/R1BQKBNR b KQkq - 0 3", ann:"3.f4! — Grand Prix Attack! White prepares a kingside pawn storm.", eval:25, nag:1 },
    { ply:6, san:"g6", uci:"g7g6", fen:"r1bqkbnr/pp1ppp1p/2n3p1/2p5/4PP2/2N5/PPPP2PP/R1BQKBNR w KQkq - 0 4", ann:"3...g6 — Black fianchettoes.", eval:20 },
    { ply:7, san:"Nf3", uci:"g1f3", fen:"r1bqkbnr/pp1ppp1p/2n3p1/2p5/4PP2/2N2N2/PPPP2PP/R1BQKB1R b KQkq - 1 4", ann:"4.Nf3 — Development.", eval:25 },
    { ply:8, san:"Bg7", uci:"f8g7", fen:"r1bqk1nr/pp1pppbp/2n3p1/2p5/4PP2/2N2N2/PPPP2PP/R1BQKB1R w KQkq - 2 5", ann:"4...Bg7 — Completing the fianchetto.", eval:20 },
    { ply:9, san:"Bc4", uci:"f1c4", fen:"r1bqk1nr/pp1pppbp/2n3p1/2p5/2B1PP2/2N2N2/PPPP2PP/R1BQK2R b KQkq - 3 5", ann:"5.Bc4 — Developing the bishop, targeting f7.", eval:25 },
    { ply:10, san:"e6", uci:"e7e6", fen:"r1bqk1nr/pp1p1pbp/2n1p1p1/2p5/2B1PP2/2N2N2/PPPP2PP/R1BQK2R w KQkq - 0 6", ann:"5...e6 — Solid.", eval:20 },
    { ply:11, san:"f5", uci:"f4f5", fen:"r1bqk1nr/pp1p1pbp/2n1p1p1/2p2P2/2B1P3/2N2N2/PPPP2PP/R1BQK2R b KQkq - 0 6", ann:"6.f5! — The pawn storm begins!", eval:30, nag:1 },
    { ply:12, san:"gxf5", uci:"g6f5", fen:"r1bqk1nr/pp1p1pbp/2n1p3/2p2p2/2B1P3/2N2N2/PPPP2PP/R1BQK2R w KQkq - 0 7", ann:"6...gxf5 — Black captures.", eval:20 },
    { ply:13, san:"exf5", uci:"e4f5", fen:"r1bqk1nr/pp1p1pbp/2n1p3/2p2P2/2B5/2N2N2/PPPP2PP/R1BQK2R b KQkq - 0 7", ann:"7.exf5 — White recaptures.", eval:25 },
    { ply:14, san:"d5", uci:"d7d5", fen:"r1bqk1nr/pp3pbp/2n1p3/2pp1P2/2B5/2N2N2/PPPP2PP/R1BQK2R w KQkq - 0 8", ann:"7...d5 — Black fights back in the center.", eval:20, nag:1 },
    { ply:15, san:"Bb3", uci:"c4b3", fen:"r1bqk1nr/pp3pbp/2n1p3/2pp1P2/8/1BN2N2/PPPP2PP/R1BQK2R b KQkq - 1 8", ann:"8.Bb3 — Retreating the bishop. White has a dangerous attack.", eval:30 },
  ]);
}

// ─────────────────────────────────────────────────────────────────────────────
// LINE 8: Smith-Morra Gambit (B21)
// 1.e4 c5 2.d4 cxd4 3.c3 dxc3 4.Nxc3 Nc6 5.Nf3 d6 6.Bc4 e6 7.O-O Nf6
// ─────────────────────────────────────────────────────────────────────────────
{
  const lid = await insertLine(sicilianId, {
    title: "Smith-Morra Gambit: 2.d4 cxd4 3.c3",
    slug: "sicilian-smith-morra-gambit",
    eco: "B21",
    pgn: "1. e4 c5 2. d4 cxd4 3. c3 dxc3 4. Nxc3 Nc6 5. Nf3 d6 6. Bc4 e6 7. O-O Nf6 8. Qe2 Be7 9. Rd1",
    finalFen: "r1bqk2r/pp2bppp/2nppn2/8/2B1P3/2N2N2/PP2QPPP/R1BR2K1 b kq - 4 9",
    plyCnt: 17, color: "white", difficulty: "intermediate",
    description: "The Smith-Morra Gambit is a popular weapon at club level. White sacrifices a pawn for rapid development and attacking chances. Black must be precise to hold the extra pawn and neutralize White's initiative.",
    sortOrder: 8, isMustKnow: false, themes: "gambit,attack,development",
  });
  await insertNodes(lid, [
    { ply:0, fen:"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", ann:"Starting position." },
    { ply:1, san:"e4", uci:"e2e4", fen:"rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1", ann:"1.e4", eval:25 },
    { ply:2, san:"c5", uci:"c7c5", fen:"rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2", ann:"1...c5 — Sicilian Defense.", eval:20 },
    { ply:3, san:"d4", uci:"d2d4", fen:"rnbqkbnr/pp1ppppp/8/2p5/3PP3/8/PPP2PPP/RNBQKBNR b KQkq - 0 2", ann:"2.d4 — Smith-Morra begins.", eval:25 },
    { ply:4, san:"cxd4", uci:"c5d4", fen:"rnbqkbnr/pp1ppppp/8/8/3pP3/8/PPP2PPP/RNBQKBNR w KQkq - 0 3", ann:"2...cxd4 — Black accepts.", eval:20 },
    { ply:5, san:"c3", uci:"c2c3", fen:"rnbqkbnr/pp1ppppp/8/8/3pP3/2P5/PP3PPP/RNBQKBNR b KQkq - 0 3", ann:"3.c3! — The Smith-Morra Gambit! White offers a second pawn.", eval:25, nag:1 },
    { ply:6, san:"dxc3", uci:"d4c3", fen:"rnbqkbnr/pp1ppppp/8/8/4P3/2p5/PP3PPP/RNBQKBNR w KQkq - 0 4", ann:"3...dxc3 — Black accepts the gambit.", eval:20 },
    { ply:7, san:"Nxc3", uci:"b1c3", fen:"rnbqkbnr/pp1ppppp/8/8/4P3/2N5/PP3PPP/R1BQKBNR b KQkq - 0 4", ann:"4.Nxc3 — White recaptures with the knight, gaining rapid development.", eval:25 },
    { ply:8, san:"Nc6", uci:"b8c6", fen:"r1bqkbnr/pp1ppppp/2n5/8/4P3/2N5/PP3PPP/R1BQKBNR w KQkq - 1 5", ann:"4...Nc6 — Development.", eval:20 },
    { ply:9, san:"Nf3", uci:"g1f3", fen:"r1bqkbnr/pp1ppppp/2n5/8/4P3/2N2N2/PP3PPP/R1BQKB1R b KQkq - 2 5", ann:"5.Nf3 — Development.", eval:25 },
    { ply:10, san:"d6", uci:"d7d6", fen:"r1bqkbnr/pp2pppp/2np4/8/4P3/2N2N2/PP3PPP/R1BQKB1R w KQkq - 0 6", ann:"5...d6 — Solid.", eval:20 },
    { ply:11, san:"Bc4", uci:"f1c4", fen:"r1bqkbnr/pp2pppp/2np4/8/2B1P3/2N2N2/PP3PPP/R1BQK2R b KQkq - 1 6", ann:"6.Bc4 — Targeting f7.", eval:25 },
    { ply:12, san:"e6", uci:"e7e6", fen:"r1bqkbnr/pp3ppp/2npp3/8/2B1P3/2N2N2/PP3PPP/R1BQK2R w KQkq - 0 7", ann:"6...e6 — Solid.", eval:20 },
    { ply:13, san:"O-O", uci:"e1g1", fen:"r1bqkbnr/pp3ppp/2npp3/8/2B1P3/2N2N2/PP3PPP/R1BQ1RK1 b kq - 1 7", ann:"7.O-O — White castles.", eval:25 },
    { ply:14, san:"Nf6", uci:"g8f6", fen:"r1bqkb1r/pp3ppp/2nppp2/8/2B1P3/2N2N2/PP3PPP/R1BQ1RK1 w kq - 2 8", ann:"7...Nf6 — Development.", eval:20 },
    { ply:15, san:"Qe2", uci:"d1e2", fen:"r1bqkb1r/pp3ppp/2nppp2/8/2B1P3/2N2N2/PP2QPPP/R1B2RK1 b kq - 3 8", ann:"8.Qe2 — Preparing Rd1.", eval:25 },
    { ply:16, san:"Be7", uci:"f8e7", fen:"r1bqk2r/pp2bppp/2nppp2/8/2B1P3/2N2N2/PP2QPPP/R1B2RK1 w kq - 4 9", ann:"8...Be7 — Development.", eval:20 },
    { ply:17, san:"Rd1", uci:"f1d1", fen:"r1bqk2r/pp2bppp/2nppn2/8/2B1P3/2N2N2/PP2QPPP/R1BR2K1 b kq - 5 9", ann:"9.Rd1 — Centralizing the rook. White has excellent compensation for the pawn.", eval:30, nag:1 },
  ]);
}

// ─────────────────────────────────────────────────────────────────────────────
// LINE 9: Closed Sicilian (A07)
// 1.e4 c5 2.Nc3 Nc6 3.g3 g6 4.Bg2 Bg7 5.d3 d6 6.Be3 e5 7.Nge2
// ─────────────────────────────────────────────────────────────────────────────
{
  const lid = await insertLine(sicilianId, {
    title: "Closed Sicilian: 2.Nc3 g3",
    slug: "sicilian-closed",
    eco: "A07",
    pgn: "1. e4 c5 2. Nc3 Nc6 3. g3 g6 4. Bg2 Bg7 5. d3 d6 6. Be3 e5 7. Nge2 Nge7 8. O-O O-O 9. f4",
    finalFen: "r1bq1rk1/pp2npbp/2np2p1/2p1p3/4PP2/2NPBB2/PPP1N1PP/R2Q1RK1 b - - 0 9",
    plyCnt: 17, color: "white", difficulty: "beginner",
    description: "The Closed Sicilian avoids the Open Sicilian theory. White builds a solid setup with g3 and Bg2, then launches a kingside attack with f4. Excellent for players who want to avoid heavy theory.",
    sortOrder: 9, isMustKnow: false, themes: "solid,kingside,fianchetto",
  });
  await insertNodes(lid, [
    { ply:0, fen:"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", ann:"Starting position." },
    { ply:1, san:"e4", uci:"e2e4", fen:"rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1", ann:"1.e4", eval:25 },
    { ply:2, san:"c5", uci:"c7c5", fen:"rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2", ann:"1...c5 — Sicilian Defense.", eval:20 },
    { ply:3, san:"Nc3", uci:"b1c3", fen:"rnbqkbnr/pp1ppppp/8/2p5/4P3/2N5/PPPP1PPP/R1BQKBNR b KQkq - 1 2", ann:"2.Nc3 — Closed Sicilian.", eval:25 },
    { ply:4, san:"Nc6", uci:"b8c6", fen:"r1bqkbnr/pp1ppppp/2n5/2p5/4P3/2N5/PPPP1PPP/R1BQKBNR w KQkq - 2 3", ann:"2...Nc6 — Development.", eval:20 },
    { ply:5, san:"g3", uci:"g2g3", fen:"r1bqkbnr/pp1ppppp/2n5/2p5/4P3/2N3P1/PPPP1P1P/R1BQKBNR b KQkq - 0 3", ann:"3.g3 — Fianchetto setup.", eval:25 },
    { ply:6, san:"g6", uci:"g7g6", fen:"r1bqkbnr/pp1ppp1p/2n3p1/2p5/4P3/2N3P1/PPPP1P1P/R1BQKBNR w KQkq - 0 4", ann:"3...g6 — Mirroring White's setup.", eval:20 },
    { ply:7, san:"Bg2", uci:"f1g2", fen:"r1bqkbnr/pp1ppp1p/2n3p1/2p5/4P3/2N3P1/PPPP1PBP/R1BQK1NR b KQkq - 1 4", ann:"4.Bg2 — Completing the fianchetto.", eval:25 },
    { ply:8, san:"Bg7", uci:"f8g7", fen:"r1bqk1nr/pp1pppbp/2n3p1/2p5/4P3/2N3P1/PPPP1PBP/R1BQK1NR w KQkq - 2 5", ann:"4...Bg7 — Mirroring.", eval:20 },
    { ply:9, san:"d3", uci:"d2d3", fen:"r1bqk1nr/pp1pppbp/2n3p1/2p5/4P3/2NP2P1/PPP2PBP/R1BQK1NR b KQkq - 0 5", ann:"5.d3 — Solid center.", eval:25 },
    { ply:10, san:"d6", uci:"d7d6", fen:"r1bqk1nr/pp2ppbp/2np2p1/2p5/4P3/2NP2P1/PPP2PBP/R1BQK1NR w KQkq - 0 6", ann:"5...d6 — Solid.", eval:20 },
    { ply:11, san:"Be3", uci:"c1e3", fen:"r1bqk1nr/pp2ppbp/2np2p1/2p5/4P3/2NPBPP1/PPP3BP/R2QK1NR b KQkq - 1 6", ann:"6.Be3 — Development.", eval:25 },
    { ply:12, san:"e5", uci:"e7e5", fen:"r1bqk1nr/pp3pbp/2np2p1/2p1p3/4P3/2NPBPP1/PPP3BP/R2QK1NR w KQkq - 0 7", ann:"6...e5 — Black mirrors the center.", eval:20 },
    { ply:13, san:"Nge2", uci:"g1e2", fen:"r1bqk1nr/pp3pbp/2np2p1/2p1p3/4P3/2NPBPP1/PPP1NBPP/R2QK2R b KQkq - 1 7", ann:"7.Nge2 — Flexible development.", eval:25 },
    { ply:14, san:"Nge7", uci:"g8e7", fen:"r1bqk2r/pp2npbp/2np2p1/2p1p3/4P3/2NPBPP1/PPP1NBPP/R2QK2R w KQkq - 2 8", ann:"7...Nge7 — Development.", eval:20 },
    { ply:15, san:"O-O", uci:"e1g1", fen:"r1bqk2r/pp2npbp/2np2p1/2p1p3/4P3/2NPBPP1/PPP1NBPP/R2Q1RK1 b kq - 3 8", ann:"8.O-O — White castles.", eval:25 },
    { ply:16, san:"O-O", uci:"e8g8", fen:"r1bq1rk1/pp2npbp/2np2p1/2p1p3/4P3/2NPBPP1/PPP1NBPP/R2Q1RK1 w - - 4 9", ann:"8...O-O — Both sides have castled.", eval:20 },
    { ply:17, san:"f4", uci:"f2f4", fen:"r1bq1rk1/pp2npbp/2np2p1/2p1p3/4PP2/2NPBPP1/PPP1N1PP/R2Q1RK1 b - - 0 9", ann:"9.f4 — White launches the kingside attack! The Closed Sicilian leads to rich strategic battles.", eval:25, nag:1 },
  ]);
}

console.log(`\nSicilian extra lines seeded:`);
console.log(`  Lines inserted: ${linesInserted}`);
console.log(`  Nodes inserted: ${nodesInserted}`);

// Final state for Sicilian
const [sicRows] = await conn.execute(
  `SELECT l.title, l.eco, COUNT(n.id) as node_cnt
   FROM opening_lines l
   LEFT JOIN line_nodes n ON n.line_id = l.id
   WHERE l.opening_id = ? AND l.is_published = 1
   GROUP BY l.id, l.title, l.eco
   ORDER BY l.sort_order`,
  [sicilianId]
);
console.log(`\nSicilian Defense — all lines:`);
sicRows.forEach(r => console.log(`  [${r.eco}] "${r.title}" — ${r.node_cnt} nodes`));

await conn.end();
console.log("\nDone.");
