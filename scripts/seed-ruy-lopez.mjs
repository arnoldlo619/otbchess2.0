/**
 * seed-ruy-lopez.mjs
 *
 * Creates the Ruy Lopez opening and seeds 6 major lines with full node trees:
 *   1. Berlin Defense (C65)
 *   2. Marshall Attack (C89)
 *   3. Closed Variation — Chigorin (C97)
 *   4. Open Variation (C80)
 *   5. Exchange Variation (C68)
 *   6. Morphy Defense — Anti-Marshall (C88)
 *
 * Usage: node scripts/seed-ruy-lopez.mjs
 */
import mysql from "mysql2/promise";
import { randomUUID } from "crypto";

const nanoid = () => randomUUID().replace(/-/g, "").slice(0, 20);
const conn = await mysql.createConnection(process.env.DATABASE_URL);

// ── Create the Ruy Lopez opening ─────────────────────────────────────────────
const ruyId = nanoid();
await conn.execute(
  `INSERT IGNORE INTO openings
   (id, name, slug, description, eco, color, difficulty,
    is_published, sort_order, created_at, updated_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, 1, 5, NOW(), NOW())`,
  [
    ruyId,
    "Ruy Lopez",
    "ruy-lopez",
    "One of the oldest and most respected chess openings, the Ruy Lopez (Spanish Opening) begins 1.e4 e5 2.Nf3 Nc6 3.Bb5. White immediately pressures Black's e5 pawn by attacking the knight that defends it. Played by virtually every World Champion, the Ruy Lopez leads to rich strategic battles with both sides having clear plans.",
    "C60",
    "white",
    "intermediate",
  ]
);
console.log(`Created Ruy Lopez opening: id=${ruyId}`);

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
// LINE 1: Berlin Defense (C65) — "The Berlin Wall"
// 1.e4 e5 2.Nf3 Nc6 3.Bb5 Nf6 4.O-O Nxe4 5.d4 Nd6 6.Bxc6 dxc6 7.dxe5 Nf5
// ─────────────────────────────────────────────────────────────────────────────
{
  const lid = await insertLine(ruyId, {
    title: "Berlin Defense: The Berlin Wall",
    slug: "ruy-lopez-berlin-wall",
    eco: "C65",
    pgn: "1. e4 e5 2. Nf3 Nc6 3. Bb5 Nf6 4. O-O Nxe4 5. d4 Nd6 6. Bxc6 dxc6 7. dxe5 Nf5 8. Qxd8+ Kxd8",
    finalFen: "r1bk1b1r/ppp2ppp/2p2n2/4Pn2/8/5N2/PPP2PPP/RNBQ1RK1 w - - 0 9",
    plyCnt: 16, color: "black", difficulty: "advanced",
    description: "The Berlin Defense is one of the most solid responses to the Ruy Lopez. After the queens are traded, Black enters an endgame with doubled c-pawns but excellent piece activity. Famously used by Vladimir Kramnik to defeat Garry Kasparov in the 2000 World Championship match.",
    sortOrder: 1, isMustKnow: true, themes: "endgame,solid,pawn-structure",
  });
  await insertNodes(lid, [
    { ply:0, fen:"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", ann:"Starting position." },
    { ply:1, san:"e4", uci:"e2e4", fen:"rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1", ann:"1.e4 — King's pawn opening.", eval:25 },
    { ply:2, san:"e5", uci:"e7e5", fen:"rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2", ann:"1...e5 — Symmetric response.", eval:20 },
    { ply:3, san:"Nf3", uci:"g1f3", fen:"rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2", ann:"2.Nf3 — Attacking e5.", eval:25 },
    { ply:4, san:"Nc6", uci:"b8c6", fen:"r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3", ann:"2...Nc6 — Defending e5.", eval:20 },
    { ply:5, san:"Bb5", uci:"f1b5", fen:"r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3", ann:"3.Bb5 — The Ruy Lopez! Pinning the knight that defends e5.", eval:25, nag:1 },
    { ply:6, san:"Nf6", uci:"g8f6", fen:"r1bqkb1r/pppp1ppp/2n2n2/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4", ann:"3...Nf6 — The Berlin Defense! Counterattacking e4.", eval:20, nag:1 },
    { ply:7, san:"O-O", uci:"e1g1", fen:"r1bqkb1r/pppp1ppp/2n2n2/1B2p3/4P3/5N2/PPPP1PPP/RNBQ1RK1 b kq - 5 4", ann:"4.O-O — White castles, maintaining the tension.", eval:25 },
    { ply:8, san:"Nxe4", uci:"f6e4", fen:"r1bqkb1r/pppp1ppp/2n5/1B2p3/4n3/5N2/PPPP1PPP/RNBQ1RK1 w kq - 0 5", ann:"4...Nxe4 — Black captures the pawn!", eval:20, nag:5 },
    { ply:9, san:"d4", uci:"d2d4", fen:"r1bqkb1r/pppp1ppp/2n5/1B2p3/3Pn3/5N2/PPP2PPP/RNBQ1RK1 b kq - 0 5", ann:"5.d4 — Attacking the knight and opening the center.", eval:25, nag:1 },
    { ply:10, san:"Nd6", uci:"e4d6", fen:"r1bqkb1r/pppp1ppp/2nn4/1B2p3/3P4/5N2/PPP2PPP/RNBQ1RK1 w kq - 1 6", ann:"5...Nd6 — The knight retreats, attacking the bishop.", eval:20 },
    { ply:11, san:"Bxc6", uci:"b5c6", fen:"r1bqkb1r/pppp1ppp/2Nn4/4p3/3P4/5N2/PPP2PPP/RNBQ1RK1 b kq - 0 6", ann:"6.Bxc6 — White trades the bishop for the knight.", eval:25 },
    { ply:12, san:"dxc6", uci:"d7c6", fen:"r1bqkb1r/ppp2ppp/2pn4/4p3/3P4/5N2/PPP2PPP/RNBQ1RK1 w kq - 0 7", ann:"6...dxc6 — Black recaptures, accepting doubled pawns.", eval:20 },
    { ply:13, san:"dxe5", uci:"d4e5", fen:"r1bqkb1r/ppp2ppp/2pn4/4P3/8/5N2/PPP2PPP/RNBQ1RK1 b kq - 0 7", ann:"7.dxe5 — White wins a pawn.", eval:30 },
    { ply:14, san:"Nf5", uci:"d6f5", fen:"r1bqkb1r/ppp2ppp/2p5/4Pn2/8/5N2/PPP2PPP/RNBQ1RK1 w kq - 1 8", ann:"7...Nf5 — The knight jumps to f5, targeting d4 and g3.", eval:25, nag:1 },
    { ply:15, san:"Qxd8+", uci:"d1d8", fen:"r1bQkb1r/ppp2ppp/2p5/4Pn2/8/5N2/PPP2PPP/RNB2RK1 b kq - 0 8", ann:"8.Qxd8+ — White trades queens, entering the famous Berlin endgame.", eval:30, nag:1 },
    { ply:16, san:"Kxd8", uci:"e8d8", fen:"r1bk1b1r/ppp2ppp/2p5/4Pn2/8/5N2/PPP2PPP/RNB2RK1 w - - 0 9", ann:"8...Kxd8 — Black recaptures. The Berlin Endgame begins. Black has doubled pawns but excellent piece activity. This is one of the most theoretically important endgames in modern chess.", eval:25 },
  ]);
}

// ─────────────────────────────────────────────────────────────────────────────
// LINE 2: Marshall Attack (C89)
// 1.e4 e5 2.Nf3 Nc6 3.Bb5 a6 4.Ba4 Nf6 5.O-O Be7 6.Re1 b5 7.Bb3 O-O 8.c3 d5
// ─────────────────────────────────────────────────────────────────────────────
{
  const lid = await insertLine(ruyId, {
    title: "Marshall Attack: 8...d5 Gambit",
    slug: "ruy-lopez-marshall-attack",
    eco: "C89",
    pgn: "1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Re1 b5 7. Bb3 O-O 8. c3 d5 9. exd5 Nxd5 10. Nxe5 Nxe5 11. Rxe5",
    finalFen: "r1bq1rk1/2p1bppp/p7/1p1nR3/8/1BP5/PP1P1PPP/RNBQ2K1 b - - 0 11",
    plyCnt: 21, color: "black", difficulty: "advanced",
    description: "The Marshall Attack is one of the most famous gambits in chess. Black sacrifices a pawn on move 8 with ...d5 for a powerful attack. Introduced by Frank Marshall in 1918, it remains a feared weapon at all levels.",
    sortOrder: 2, isMustKnow: true, themes: "attack,gambit,initiative",
  });
  await insertNodes(lid, [
    { ply:0, fen:"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", ann:"Starting position." },
    { ply:1, san:"e4", uci:"e2e4", fen:"rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1", ann:"1.e4", eval:25 },
    { ply:2, san:"e5", uci:"e7e5", fen:"rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2", ann:"1...e5", eval:20 },
    { ply:3, san:"Nf3", uci:"g1f3", fen:"rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2", ann:"2.Nf3", eval:25 },
    { ply:4, san:"Nc6", uci:"b8c6", fen:"r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3", ann:"2...Nc6", eval:20 },
    { ply:5, san:"Bb5", uci:"f1b5", fen:"r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3", ann:"3.Bb5 — Ruy Lopez.", eval:25 },
    { ply:6, san:"a6", uci:"a7a6", fen:"r1bqkbnr/1ppp1ppp/p1n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 4", ann:"3...a6 — Morphy Defense! Attacking the bishop.", eval:20, nag:1 },
    { ply:7, san:"Ba4", uci:"b5a4", fen:"r1bqkbnr/1ppp1ppp/p1n5/4p3/B3P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 1 4", ann:"4.Ba4 — Retreating to maintain the pin.", eval:25 },
    { ply:8, san:"Nf6", uci:"g8f6", fen:"r1bqkb1r/1ppp1ppp/p1n2n2/4p3/B3P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 2 5", ann:"4...Nf6 — Development.", eval:20 },
    { ply:9, san:"O-O", uci:"e1g1", fen:"r1bqkb1r/1ppp1ppp/p1n2n2/4p3/B3P3/5N2/PPPP1PPP/RNBQ1RK1 b kq - 3 5", ann:"5.O-O — White castles.", eval:25 },
    { ply:10, san:"Be7", uci:"f8e7", fen:"r1bqk2r/1pppbppp/p1n2n2/4p3/B3P3/5N2/PPPP1PPP/RNBQ1RK1 w kq - 4 6", ann:"5...Be7 — Preparing to castle.", eval:20 },
    { ply:11, san:"Re1", uci:"f1e1", fen:"r1bqk2r/1pppbppp/p1n2n2/4p3/B3P3/5N2/PPPP1PPP/RNBQR1K1 b kq - 5 6", ann:"6.Re1 — Supporting e4.", eval:25 },
    { ply:12, san:"b5", uci:"b7b5", fen:"r1bqk2r/2ppbppp/p1n2n2/1p2p3/B3P3/5N2/PPPP1PPP/RNBQR1K1 w kq - 0 7", ann:"6...b5 — Attacking the bishop.", eval:20 },
    { ply:13, san:"Bb3", uci:"a4b3", fen:"r1bqk2r/2ppbppp/p1n2n2/1p2p3/4P3/1B3N2/PPPP1PPP/RNBQR1K1 b kq - 1 7", ann:"7.Bb3 — Retreating to a safe square.", eval:25 },
    { ply:14, san:"O-O", uci:"e8g8", fen:"r1bq1rk1/2ppbppp/p1n2n2/1p2p3/4P3/1B3N2/PPPP1PPP/RNBQR1K1 w - - 2 8", ann:"7...O-O — Black castles.", eval:20 },
    { ply:15, san:"c3", uci:"c2c3", fen:"r1bq1rk1/2ppbppp/p1n2n2/1p2p3/4P3/1BP2N2/PP1P1PPP/RNBQR1K1 b - - 0 8", ann:"8.c3 — Preparing d4.", eval:25 },
    { ply:16, san:"d5", uci:"d7d5", fen:"r1bq1rk1/2p1bppp/p1n2n2/1p1pp3/4P3/1BP2N2/PP1P1PPP/RNBQR1K1 w - - 0 9", ann:"8...d5! — The Marshall Attack! Black sacrifices a pawn for a powerful attack.", eval:15, nag:1 },
    { ply:17, san:"exd5", uci:"e4d5", fen:"r1bq1rk1/2p1bppp/p1n2n2/1p1Pp3/8/1BP2N2/PP1P1PPP/RNBQR1K1 b - - 0 9", ann:"9.exd5 — White accepts the gambit.", eval:25 },
    { ply:18, san:"Nxd5", uci:"f6d5", fen:"r1bq1rk1/2p1bppp/p1n5/1p1np3/8/1BP2N2/PP1P1PPP/RNBQR1K1 w - - 0 10", ann:"9...Nxd5 — Black recaptures.", eval:20 },
    { ply:19, san:"Nxe5", uci:"f3e5", fen:"r1bq1rk1/2p1bppp/p1n5/1p1nN3/8/1BP5/PP1P1PPP/RNBQR1K1 b - - 0 10", ann:"10.Nxe5 — White wins the pawn back.", eval:25 },
    { ply:20, san:"Nxe5", uci:"c6e5", fen:"r1bq1rk1/2p1bppp/p7/1p1nn3/8/1BP5/PP1P1PPP/RNBQR1K1 w - - 0 11", ann:"10...Nxe5 — Black recaptures.", eval:20 },
    { ply:21, san:"Rxe5", uci:"e1e5", fen:"r1bq1rk1/2p1bppp/p7/1p1nR3/8/1BP5/PP1P1PPP/RNBQ2K1 b - - 0 11", ann:"11.Rxe5 — White has an extra pawn but Black has tremendous piece activity and attacking chances. The Marshall Attack is extremely dangerous.", eval:20 },
  ]);
}

// ─────────────────────────────────────────────────────────────────────────────
// LINE 3: Closed Variation — Chigorin (C97)
// 1.e4 e5 2.Nf3 Nc6 3.Bb5 a6 4.Ba4 Nf6 5.O-O Be7 6.Re1 b5 7.Bb3 d6 8.c3 O-O 9.h3 Na5 10.Bc2 c5
// ─────────────────────────────────────────────────────────────────────────────
{
  const lid = await insertLine(ruyId, {
    title: "Closed: Chigorin Variation (9...Na5)",
    slug: "ruy-lopez-closed-chigorin",
    eco: "C97",
    pgn: "1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Re1 b5 7. Bb3 d6 8. c3 O-O 9. h3 Na5 10. Bc2 c5 11. d4 Qc7",
    finalFen: "r1b2rk1/ppq1bppp/3p1n2/n1p1p3/3PP3/2P2N1P/PPB2PP1/RNBQR1K1 w - - 2 12",
    plyCnt: 22, color: "black", difficulty: "advanced",
    description: "The Chigorin Variation is the most popular line in the Closed Ruy Lopez. Black repositions the knight to a5 to attack the bishop, then plays ...c5 to challenge the center. This leads to rich, complex middlegame positions.",
    sortOrder: 3, isMustKnow: true, themes: "strategy,pawn-structure,maneuver",
  });
  await insertNodes(lid, [
    { ply:0, fen:"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", ann:"Starting position." },
    { ply:1, san:"e4", uci:"e2e4", fen:"rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1", ann:"1.e4", eval:25 },
    { ply:2, san:"e5", uci:"e7e5", fen:"rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2", ann:"1...e5", eval:20 },
    { ply:3, san:"Nf3", uci:"g1f3", fen:"rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2", ann:"2.Nf3", eval:25 },
    { ply:4, san:"Nc6", uci:"b8c6", fen:"r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3", ann:"2...Nc6", eval:20 },
    { ply:5, san:"Bb5", uci:"f1b5", fen:"r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3", ann:"3.Bb5 — Ruy Lopez.", eval:25 },
    { ply:6, san:"a6", uci:"a7a6", fen:"r1bqkbnr/1ppp1ppp/p1n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 4", ann:"3...a6 — Morphy Defense.", eval:20 },
    { ply:7, san:"Ba4", uci:"b5a4", fen:"r1bqkbnr/1ppp1ppp/p1n5/4p3/B3P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 1 4", ann:"4.Ba4", eval:25 },
    { ply:8, san:"Nf6", uci:"g8f6", fen:"r1bqkb1r/1ppp1ppp/p1n2n2/4p3/B3P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 2 5", ann:"4...Nf6", eval:20 },
    { ply:9, san:"O-O", uci:"e1g1", fen:"r1bqkb1r/1ppp1ppp/p1n2n2/4p3/B3P3/5N2/PPPP1PPP/RNBQ1RK1 b kq - 3 5", ann:"5.O-O", eval:25 },
    { ply:10, san:"Be7", uci:"f8e7", fen:"r1bqk2r/1pppbppp/p1n2n2/4p3/B3P3/5N2/PPPP1PPP/RNBQ1RK1 w kq - 4 6", ann:"5...Be7", eval:20 },
    { ply:11, san:"Re1", uci:"f1e1", fen:"r1bqk2r/1pppbppp/p1n2n2/4p3/B3P3/5N2/PPPP1PPP/RNBQR1K1 b kq - 5 6", ann:"6.Re1", eval:25 },
    { ply:12, san:"b5", uci:"b7b5", fen:"r1bqk2r/2ppbppp/p1n2n2/1p2p3/B3P3/5N2/PPPP1PPP/RNBQR1K1 w kq - 0 7", ann:"6...b5", eval:20 },
    { ply:13, san:"Bb3", uci:"a4b3", fen:"r1bqk2r/2ppbppp/p1n2n2/1p2p3/4P3/1B3N2/PPPP1PPP/RNBQR1K1 b kq - 1 7", ann:"7.Bb3", eval:25 },
    { ply:14, san:"d6", uci:"d7d6", fen:"r1bqk2r/2p1bppp/p1np1n2/1p2p3/4P3/1B3N2/PPPP1PPP/RNBQR1K1 w kq - 0 8", ann:"7...d6 — Solid. Entering the Closed Ruy Lopez.", eval:20 },
    { ply:15, san:"c3", uci:"c2c3", fen:"r1bqk2r/2p1bppp/p1np1n2/1p2p3/4P3/1BP2N2/PP1P1PPP/RNBQR1K1 b kq - 0 8", ann:"8.c3 — Preparing d4.", eval:25 },
    { ply:16, san:"O-O", uci:"e8g8", fen:"r1bq1rk1/2p1bppp/p1np1n2/1p2p3/4P3/1BP2N2/PP1P1PPP/RNBQR1K1 w - - 1 9", ann:"8...O-O — Black castles.", eval:20 },
    { ply:17, san:"h3", uci:"h2h3", fen:"r1bq1rk1/2p1bppp/p1np1n2/1p2p3/4P3/1BP2N1P/PP1P1PP1/RNBQR1K1 b - - 0 9", ann:"9.h3 — Preventing ...Bg4.", eval:25 },
    { ply:18, san:"Na5", uci:"c6a5", fen:"r1bq1rk1/2p1bppp/p2p1n2/np2p3/4P3/1BP2N1P/PP1P1PP1/RNBQR1K1 w - - 1 10", ann:"9...Na5 — The Chigorin! The knight attacks the bishop.", eval:20, nag:1 },
    { ply:19, san:"Bc2", uci:"b3c2", fen:"r1bq1rk1/2p1bppp/p2p1n2/np2p3/4P3/2P2N1P/PPBP1PP1/RNBQR1K1 b - - 2 10", ann:"10.Bc2 — Retreating to a flexible square.", eval:25 },
    { ply:20, san:"c5", uci:"c7c5", fen:"r1bq1rk1/2p1bppp/p2p1n2/n1p1p3/4P3/2P2N1P/PPBP1PP1/RNBQR1K1 w - - 0 11", ann:"10...c5 — Challenging the center!", eval:20, nag:1 },
    { ply:21, san:"d4", uci:"d2d4", fen:"r1bq1rk1/2p1bppp/p2p1n2/n1p1p3/3PP3/2P2N1P/PPB2PP1/RNBQR1K1 b - - 0 11", ann:"11.d4 — White opens the center.", eval:25 },
    { ply:22, san:"Qc7", uci:"d8c7", fen:"r1b2rk1/ppq1bppp/3p1n2/n1p1p3/3PP3/2P2N1P/PPB2PP1/RNBQR1K1 w - - 2 12", ann:"11...Qc7 — Centralizing the queen. The position is rich and complex — this is the heart of the Closed Ruy Lopez.", eval:20 },
  ]);
}

// ─────────────────────────────────────────────────────────────────────────────
// LINE 4: Open Variation (C80)
// 1.e4 e5 2.Nf3 Nc6 3.Bb5 a6 4.Ba4 Nf6 5.O-O Nxe4 6.d4 b5 7.Bb3 d5 8.dxe5 Be6
// ─────────────────────────────────────────────────────────────────────────────
{
  const lid = await insertLine(ruyId, {
    title: "Open Variation: 5...Nxe4",
    slug: "ruy-lopez-open",
    eco: "C80",
    pgn: "1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Nxe4 6. d4 b5 7. Bb3 d5 8. dxe5 Be6 9. c3 Bc5",
    finalFen: "r2qk2r/2p2ppp/p1n1b3/1pbpP3/8/1BP2N2/PP3PPP/RNBQ1RK1 w kq - 2 10",
    plyCnt: 17, color: "black", difficulty: "advanced",
    description: "The Open Ruy Lopez is one of the sharpest responses. Black captures on e4 immediately, leading to dynamic play. Both sides have active pieces and the game often becomes highly tactical.",
    sortOrder: 4, isMustKnow: false, themes: "attack,tactics,open-game",
  });
  await insertNodes(lid, [
    { ply:0, fen:"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", ann:"Starting position." },
    { ply:1, san:"e4", uci:"e2e4", fen:"rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1", ann:"1.e4", eval:25 },
    { ply:2, san:"e5", uci:"e7e5", fen:"rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2", ann:"1...e5", eval:20 },
    { ply:3, san:"Nf3", uci:"g1f3", fen:"rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2", ann:"2.Nf3", eval:25 },
    { ply:4, san:"Nc6", uci:"b8c6", fen:"r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3", ann:"2...Nc6", eval:20 },
    { ply:5, san:"Bb5", uci:"f1b5", fen:"r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3", ann:"3.Bb5 — Ruy Lopez.", eval:25 },
    { ply:6, san:"a6", uci:"a7a6", fen:"r1bqkbnr/1ppp1ppp/p1n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 4", ann:"3...a6", eval:20 },
    { ply:7, san:"Ba4", uci:"b5a4", fen:"r1bqkbnr/1ppp1ppp/p1n5/4p3/B3P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 1 4", ann:"4.Ba4", eval:25 },
    { ply:8, san:"Nf6", uci:"g8f6", fen:"r1bqkb1r/1ppp1ppp/p1n2n2/4p3/B3P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 2 5", ann:"4...Nf6", eval:20 },
    { ply:9, san:"O-O", uci:"e1g1", fen:"r1bqkb1r/1ppp1ppp/p1n2n2/4p3/B3P3/5N2/PPPP1PPP/RNBQ1RK1 b kq - 3 5", ann:"5.O-O", eval:25 },
    { ply:10, san:"Nxe4", uci:"f6e4", fen:"r1bqkb1r/1ppp1ppp/p1n5/4p3/B3n3/5N2/PPPP1PPP/RNBQ1RK1 w kq - 0 6", ann:"5...Nxe4! — The Open Variation! Black grabs the pawn.", eval:20, nag:1 },
    { ply:11, san:"d4", uci:"d2d4", fen:"r1bqkb1r/1ppp1ppp/p1n5/4p3/B2Pn3/5N2/PPP2PPP/RNBQ1RK1 b kq - 0 6", ann:"6.d4 — Opening the center.", eval:25 },
    { ply:12, san:"b5", uci:"b7b5", fen:"r1bqkb1r/2pp1ppp/p1n5/1p2p3/B2Pn3/5N2/PPP2PPP/RNBQ1RK1 w kq - 0 7", ann:"6...b5 — Attacking the bishop.", eval:20 },
    { ply:13, san:"Bb3", uci:"a4b3", fen:"r1bqkb1r/2pp1ppp/p1n5/1p2p3/3Pn3/1B3N2/PPP2PPP/RNBQ1RK1 b kq - 1 7", ann:"7.Bb3 — Retreating.", eval:25 },
    { ply:14, san:"d5", uci:"d7d5", fen:"r1bqkb1r/2p2ppp/p1n5/1p1pp3/3Pn3/1B3N2/PPP2PPP/RNBQ1RK1 w kq - 0 8", ann:"7...d5 — Black advances in the center!", eval:20, nag:1 },
    { ply:15, san:"dxe5", uci:"d4e5", fen:"r1bqkb1r/2p2ppp/p1n5/1p1pP3/4n3/1B3N2/PPP2PPP/RNBQ1RK1 b kq - 0 8", ann:"8.dxe5 — White captures.", eval:25 },
    { ply:16, san:"Be6", uci:"c8e6", fen:"r2qkb1r/2p2ppp/p1n1b3/1p1pP3/4n3/1B3N2/PPP2PPP/RNBQ1RK1 w kq - 1 9", ann:"8...Be6 — Developing with tempo.", eval:20, nag:1 },
    { ply:17, san:"c3", uci:"c2c3", fen:"r2qkb1r/2p2ppp/p1n1b3/1p1pP3/4n3/1BP2N2/PP3PPP/RNBQ1RK1 b kq - 0 9", ann:"9.c3 — Preparing to defend.", eval:25 },
    { ply:18, san:"Bc5", uci:"f8c5", fen:"r2qk2r/2p2ppp/p1n1b3/1pbpP3/4n3/1BP2N2/PP3PPP/RNBQ1RK1 w kq - 1 10", ann:"9...Bc5 — Active bishop development. The position is dynamically balanced with both sides having active pieces.", eval:20 },
  ]);
}

// ─────────────────────────────────────────────────────────────────────────────
// LINE 5: Exchange Variation (C68)
// 1.e4 e5 2.Nf3 Nc6 3.Bb5 a6 4.Bxc6 dxc6 5.O-O f6 6.d4 exd4 7.Nxd4
// ─────────────────────────────────────────────────────────────────────────────
{
  const lid = await insertLine(ruyId, {
    title: "Exchange Variation: 4.Bxc6",
    slug: "ruy-lopez-exchange",
    eco: "C68",
    pgn: "1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Bxc6 dxc6 5. O-O f6 6. d4 exd4 7. Nxd4 c5 8. Ne2 Qxd1 9. Rxd1",
    finalFen: "r1b1kb1r/1pp3pp/p4p2/2p5/4P3/8/PPP1NPPP/RNB1R1K1 b kq - 0 9",
    plyCnt: 17, color: "white", difficulty: "intermediate",
    description: "The Exchange Variation gives Black doubled c-pawns but the bishop pair. White aims for a long-term endgame advantage. Bobby Fischer used this variation extensively.",
    sortOrder: 5, isMustKnow: false, themes: "endgame,pawn-structure,bishop-pair",
  });
  await insertNodes(lid, [
    { ply:0, fen:"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", ann:"Starting position." },
    { ply:1, san:"e4", uci:"e2e4", fen:"rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1", ann:"1.e4", eval:25 },
    { ply:2, san:"e5", uci:"e7e5", fen:"rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2", ann:"1...e5", eval:20 },
    { ply:3, san:"Nf3", uci:"g1f3", fen:"rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2", ann:"2.Nf3", eval:25 },
    { ply:4, san:"Nc6", uci:"b8c6", fen:"r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3", ann:"2...Nc6", eval:20 },
    { ply:5, san:"Bb5", uci:"f1b5", fen:"r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3", ann:"3.Bb5 — Ruy Lopez.", eval:25 },
    { ply:6, san:"a6", uci:"a7a6", fen:"r1bqkbnr/1ppp1ppp/p1n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 4", ann:"3...a6", eval:20 },
    { ply:7, san:"Bxc6", uci:"b5c6", fen:"r1bqkbnr/1ppp1ppp/p1B5/4p3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 0 4", ann:"4.Bxc6! — The Exchange Variation! White trades the bishop for the knight.", eval:25, nag:1 },
    { ply:8, san:"dxc6", uci:"d7c6", fen:"r1bqkbnr/1pp2ppp/p1p5/4p3/4P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 5", ann:"4...dxc6 — Black recaptures, accepting doubled c-pawns.", eval:20 },
    { ply:9, san:"O-O", uci:"e1g1", fen:"r1bqkbnr/1pp2ppp/p1p5/4p3/4P3/5N2/PPPP1PPP/RNBQ1RK1 b kq - 1 5", ann:"5.O-O — White castles.", eval:25 },
    { ply:10, san:"f6", uci:"f7f6", fen:"r1bqkbnr/1pp3pp/p1p2p2/4p3/4P3/5N2/PPPP1PPP/RNBQ1RK1 w kq - 0 6", ann:"5...f6 — Defending e5.", eval:20 },
    { ply:11, san:"d4", uci:"d2d4", fen:"r1bqkbnr/1pp3pp/p1p2p2/4p3/3PP3/5N2/PPP2PPP/RNBQ1RK1 b kq - 0 6", ann:"6.d4 — Opening the center.", eval:25 },
    { ply:12, san:"exd4", uci:"e5d4", fen:"r1bqkbnr/1pp3pp/p1p2p2/8/3pP3/5N2/PPP2PPP/RNBQ1RK1 w kq - 0 7", ann:"6...exd4 — Black captures.", eval:20 },
    { ply:13, san:"Nxd4", uci:"f3d4", fen:"r1bqkbnr/1pp3pp/p1p2p2/8/3NP3/8/PPP2PPP/RNBQ1RK1 b kq - 0 7", ann:"7.Nxd4 — White recaptures.", eval:25 },
    { ply:14, san:"c5", uci:"c6c5", fen:"r1bqkbnr/1pp3pp/p4p2/2p5/3NP3/8/PPP2PPP/RNBQ1RK1 w kq - 0 8", ann:"7...c5 — Attacking the knight.", eval:20 },
    { ply:15, san:"Ne2", uci:"d4e2", fen:"r1bqkbnr/1pp3pp/p4p2/2p5/4P3/8/PPP1NPPP/RNBQ1RK1 b kq - 1 8", ann:"8.Ne2 — Retreating.", eval:25 },
    { ply:16, san:"Qxd1", uci:"d8d1", fen:"r1b1kbnr/1pp3pp/p4p2/2p5/4P3/8/PPP1NPPP/RNBQR1K1 b kq - 0 9", ann:"8...Qxd1 — Trading queens.", eval:20 },
    { ply:17, san:"Rxd1", uci:"f1d1", fen:"r1b1kb1r/1pp3pp/p4p2/2p5/4P3/8/PPP1NPPP/RNB1R1K1 b kq - 0 9", ann:"9.Rxd1 — White recaptures. The endgame favors White due to Black's doubled pawns, but Black has the bishop pair.", eval:30 },
  ]);
}

// ─────────────────────────────────────────────────────────────────────────────
// LINE 6: Anti-Marshall (C88) — Avoiding the Marshall Attack
// 1.e4 e5 2.Nf3 Nc6 3.Bb5 a6 4.Ba4 Nf6 5.O-O Be7 6.Re1 b5 7.Bb3 O-O 8.a4
// ─────────────────────────────────────────────────────────────────────────────
{
  const lid = await insertLine(ruyId, {
    title: "Anti-Marshall: 8.a4",
    slug: "ruy-lopez-anti-marshall",
    eco: "C88",
    pgn: "1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Re1 b5 7. Bb3 O-O 8. a4 b4 9. d3 d6 10. Nbd2 Na5 11. Ba2",
    finalFen: "r1bq1rk1/2p1bppp/p2p1n2/n7/Pp2P3/3P1N2/BPPN1PPP/R1BQR1K1 b - - 1 11",
    plyCnt: 21, color: "white", difficulty: "intermediate",
    description: "The Anti-Marshall sidesteps the Marshall Attack with 8.a4. White challenges the b5 pawn immediately, leading to a slower strategic game rather than the tactical fireworks of the Marshall.",
    sortOrder: 6, isMustKnow: false, themes: "strategy,anti-gambit,positional",
  });
  await insertNodes(lid, [
    { ply:0, fen:"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", ann:"Starting position." },
    { ply:1, san:"e4", uci:"e2e4", fen:"rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1", ann:"1.e4", eval:25 },
    { ply:2, san:"e5", uci:"e7e5", fen:"rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2", ann:"1...e5", eval:20 },
    { ply:3, san:"Nf3", uci:"g1f3", fen:"rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2", ann:"2.Nf3", eval:25 },
    { ply:4, san:"Nc6", uci:"b8c6", fen:"r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3", ann:"2...Nc6", eval:20 },
    { ply:5, san:"Bb5", uci:"f1b5", fen:"r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3", ann:"3.Bb5 — Ruy Lopez.", eval:25 },
    { ply:6, san:"a6", uci:"a7a6", fen:"r1bqkbnr/1ppp1ppp/p1n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 4", ann:"3...a6", eval:20 },
    { ply:7, san:"Ba4", uci:"b5a4", fen:"r1bqkbnr/1ppp1ppp/p1n5/4p3/B3P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 1 4", ann:"4.Ba4", eval:25 },
    { ply:8, san:"Nf6", uci:"g8f6", fen:"r1bqkb1r/1ppp1ppp/p1n2n2/4p3/B3P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 2 5", ann:"4...Nf6", eval:20 },
    { ply:9, san:"O-O", uci:"e1g1", fen:"r1bqkb1r/1ppp1ppp/p1n2n2/4p3/B3P3/5N2/PPPP1PPP/RNBQ1RK1 b kq - 3 5", ann:"5.O-O", eval:25 },
    { ply:10, san:"Be7", uci:"f8e7", fen:"r1bqk2r/1pppbppp/p1n2n2/4p3/B3P3/5N2/PPPP1PPP/RNBQ1RK1 w kq - 4 6", ann:"5...Be7", eval:20 },
    { ply:11, san:"Re1", uci:"f1e1", fen:"r1bqk2r/1pppbppp/p1n2n2/4p3/B3P3/5N2/PPPP1PPP/RNBQR1K1 b kq - 5 6", ann:"6.Re1", eval:25 },
    { ply:12, san:"b5", uci:"b7b5", fen:"r1bqk2r/2ppbppp/p1n2n2/1p2p3/B3P3/5N2/PPPP1PPP/RNBQR1K1 w kq - 0 7", ann:"6...b5", eval:20 },
    { ply:13, san:"Bb3", uci:"a4b3", fen:"r1bqk2r/2ppbppp/p1n2n2/1p2p3/4P3/1B3N2/PPPP1PPP/RNBQR1K1 b kq - 1 7", ann:"7.Bb3", eval:25 },
    { ply:14, san:"O-O", uci:"e8g8", fen:"r1bq1rk1/2ppbppp/p1n2n2/1p2p3/4P3/1B3N2/PPPP1PPP/RNBQR1K1 w - - 2 8", ann:"7...O-O", eval:20 },
    { ply:15, san:"a4", uci:"a2a4", fen:"r1bq1rk1/2ppbppp/p1n2n2/1p2p3/P3P3/1B3N2/1PPP1PPP/RNBQR1K1 b - - 0 8", ann:"8.a4! — Anti-Marshall! White sidesteps the Marshall Attack.", eval:25, nag:1 },
    { ply:16, san:"b4", uci:"b5b4", fen:"r1bq1rk1/2ppbppp/p1n2n2/4p3/Pp2P3/1B3N2/1PPP1PPP/RNBQR1K1 w - - 0 9", ann:"8...b4 — Black advances the pawn.", eval:20 },
    { ply:17, san:"d3", uci:"d2d3", fen:"r1bq1rk1/2ppbppp/p1n2n2/4p3/Pp2P3/1B1P1N2/1PP2PPP/RNBQR1K1 b - - 0 9", ann:"9.d3 — Solid. White builds a strong center.", eval:25 },
    { ply:18, san:"d6", uci:"d7d6", fen:"r1bq1rk1/2p1bppp/p1np1n2/4p3/Pp2P3/1B1P1N2/1PP2PPP/RNBQR1K1 w - - 0 10", ann:"9...d6 — Solid.", eval:20 },
    { ply:19, san:"Nbd2", uci:"b1d2", fen:"r1bq1rk1/2p1bppp/p1np1n2/4p3/Pp2P3/1B1P1N2/1PPNBPPP/R1BQR1K1 b - - 1 10", ann:"10.Nbd2 — Development.", eval:25 },
    { ply:20, san:"Na5", uci:"c6a5", fen:"r1bq1rk1/2p1bppp/p2p1n2/n3p3/Pp2P3/1B1P1N2/1PPNBPPP/R1BQR1K1 w - - 2 11", ann:"10...Na5 — Attacking the bishop.", eval:20 },
    { ply:21, san:"Ba2", uci:"b3a2", fen:"r1bq1rk1/2p1bppp/p2p1n2/n3p3/Pp2P3/3P1N2/BPPN1PPP/R1BQR1K1 b - - 3 11", ann:"11.Ba2 — The bishop retreats to a2, staying on the a2-g8 diagonal. White has a solid position.", eval:25 },
  ]);
}

console.log(`\nRuy Lopez seeded:`);
console.log(`  Lines inserted: ${linesInserted}`);
console.log(`  Nodes inserted: ${nodesInserted}`);
await conn.end();
console.log("Done.");
