/**
 * seed-italian-game.mjs
 *
 * Adds 7 lines to the existing Italian Game opening (id: 2e8538e0cec449e5ba6642dd2616cfe5):
 *   1. Giuoco Pianissimo (C53) — slow, strategic
 *   2. Giuoco Piano: Italian Attack (C54) — aggressive d4 push
 *   3. Evans Gambit Accepted (C51) — classic gambit
 *   4. Evans Gambit Declined (C51) — solid refusal
 *   5. Two Knights: Fried Liver Attack (C57) — sacrificial attack
 *   6. Two Knights: Traxler Counter-Attack (C57) — wild counter-gambit
 *   7. Two Knights: Modern 4.d3 (C55) — quiet positional line
 *
 * Existing line: Giuoco Piano Main Line (C53) — sort_order 100
 *
 * Usage: node scripts/seed-italian-game.mjs
 */
import mysql from "mysql2/promise";
import { randomUUID } from "crypto";

const nanoid = () => randomUUID().replace(/-/g, "").slice(0, 20);
const conn = await mysql.createConnection(process.env.DATABASE_URL);

const italianId = "2e8538e0cec449e5ba6642dd2616cfe5";

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
// LINE 1: Giuoco Pianissimo (C53)
// 1.e4 e5 2.Nf3 Nc6 3.Bc4 Bc5 4.c3 Nf6 5.d3 d6 6.O-O O-O 7.Nbd2 a6
// ─────────────────────────────────────────────────────────────────────────────
{
  const lid = await insertLine(italianId, {
    title: "Giuoco Pianissimo: 4.c3 d3 Slow System",
    slug: "italian-giuoco-pianissimo",
    eco: "C53",
    pgn: "1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. c3 Nf6 5. d3 d6 6. O-O O-O 7. Nbd2 a6 8. Bb3 Ba7 9. Re1",
    finalFen: "r1bq1rk1/bpp2ppp/p1np1n2/4p3/4P3/1BPP1N2/PP1N1PPP/R1BQR1K1 b - - 2 9",
    plyCnt: 17, color: "white", difficulty: "beginner",
    description: "The Giuoco Pianissimo ('very quiet game') is the most popular Italian Game system today, used by Magnus Carlsen and other top players. White builds slowly with c3 and d3, preparing a later d4 break. Ideal for players who prefer strategic over tactical play.",
    sortOrder: 101, isMustKnow: true, themes: "strategy,slow,positional,center",
  });
  await insertNodes(lid, [
    { ply:0, fen:"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", ann:"Starting position." },
    { ply:1, san:"e4", uci:"e2e4", fen:"rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1", ann:"1.e4 — King's pawn opening.", eval:25 },
    { ply:2, san:"e5", uci:"e7e5", fen:"rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2", ann:"1...e5 — Symmetric response.", eval:20 },
    { ply:3, san:"Nf3", uci:"g1f3", fen:"rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2", ann:"2.Nf3 — Attacking e5.", eval:25 },
    { ply:4, san:"Nc6", uci:"b8c6", fen:"r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3", ann:"2...Nc6 — Defending e5.", eval:20 },
    { ply:5, san:"Bc4", uci:"f1c4", fen:"r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3", ann:"3.Bc4 — The Italian Game! The bishop targets f7.", eval:25, nag:1 },
    { ply:6, san:"Bc5", uci:"f8c5", fen:"r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4", ann:"3...Bc5 — Giuoco Piano! Black mirrors White.", eval:20, nag:1 },
    { ply:7, san:"c3", uci:"c2c3", fen:"r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/2P2N2/PP1P1PPP/RNBQK2R b KQkq - 0 4", ann:"4.c3 — Preparing d4. Giuoco Pianissimo begins.", eval:25 },
    { ply:8, san:"Nf6", uci:"g8f6", fen:"r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/2P2N2/PP1P1PPP/RNBQK2R w KQkq - 1 5", ann:"4...Nf6 — Development.", eval:20 },
    { ply:9, san:"d3", uci:"d2d3", fen:"r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/2PP1N2/PP3PPP/RNBQK2R b KQkq - 0 5", ann:"5.d3 — Solid. White builds slowly.", eval:25 },
    { ply:10, san:"d6", uci:"d7d6", fen:"r1bqk2r/ppp2ppp/2np1n2/2b1p3/2B1P3/2PP1N2/PP3PPP/RNBQK2R w KQkq - 0 6", ann:"5...d6 — Solid center.", eval:20 },
    { ply:11, san:"O-O", uci:"e1g1", fen:"r1bqk2r/ppp2ppp/2np1n2/2b1p3/2B1P3/2PP1N2/PP3PPP/RNBQ1RK1 b kq - 1 6", ann:"6.O-O — White castles.", eval:25 },
    { ply:12, san:"O-O", uci:"e8g8", fen:"r1bq1rk1/ppp2ppp/2np1n2/2b1p3/2B1P3/2PP1N2/PP3PPP/RNBQ1RK1 w - - 2 7", ann:"6...O-O — Both sides castle.", eval:20 },
    { ply:13, san:"Nbd2", uci:"b1d2", fen:"r1bq1rk1/ppp2ppp/2np1n2/2b1p3/2B1P3/2PP1N2/PP1N1PPP/R1BQ1RK1 b - - 3 7", ann:"7.Nbd2 — Flexible development.", eval:25 },
    { ply:14, san:"a6", uci:"a7a6", fen:"r1bq1rk1/1pp2ppp/p1np1n2/2b1p3/2B1P3/2PP1N2/PP1N1PPP/R1BQ1RK1 w - - 0 8", ann:"7...a6 — Preventing Nb5.", eval:20 },
    { ply:15, san:"Bb3", uci:"c4b3", fen:"r1bq1rk1/1pp2ppp/p1np1n2/2b1p3/4P3/1BPP1N2/PP1N1PPP/R1BQ1RK1 b - - 1 8", ann:"8.Bb3 — Retreating to a safe square.", eval:25 },
    { ply:16, san:"Ba7", uci:"c5a7", fen:"r1bq1rk1/bpp2ppp/p1np1n2/4p3/4P3/1BPP1N2/PP1N1PPP/R1BQ1RK1 w - - 2 9", ann:"8...Ba7 — Keeping the bishop active.", eval:20 },
    { ply:17, san:"Re1", uci:"f1e1", fen:"r1bq1rk1/bpp2ppp/p1np1n2/4p3/4P3/1BPP1N2/PP1N1PPP/R1BQR1K1 b - - 3 9", ann:"9.Re1 — Supporting e4 and preparing for the d4 break. This is the Giuoco Pianissimo — a rich strategic battle lies ahead.", eval:25 },
  ]);
}

// ─────────────────────────────────────────────────────────────────────────────
// LINE 2: Giuoco Piano Italian Attack (C54)
// 1.e4 e5 2.Nf3 Nc6 3.Bc4 Bc5 4.c3 Nf6 5.d4 exd4 6.cxd4 Bb4+ 7.Nc3 Nxe4 8.O-O
// ─────────────────────────────────────────────────────────────────────────────
{
  const lid = await insertLine(italianId, {
    title: "Giuoco Piano: Italian Attack (5.d4)",
    slug: "italian-giuoco-piano-attack",
    eco: "C54",
    pgn: "1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. c3 Nf6 5. d4 exd4 6. cxd4 Bb4+ 7. Nc3 Nxe4 8. O-O Bxc3 9. d5",
    finalFen: "r1bqk2r/pppp1ppp/8/2bPp3/4n3/5N2/PP3PPP/R1BQ1RK1 b kq - 0 9",
    plyCnt: 17, color: "white", difficulty: "intermediate",
    description: "The Italian Attack with 5.d4 is the aggressive approach. White immediately opens the center, leading to sharp tactical play. Black must navigate carefully to avoid getting overwhelmed.",
    sortOrder: 102, isMustKnow: true, themes: "attack,tactics,center,open-game",
  });
  await insertNodes(lid, [
    { ply:0, fen:"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", ann:"Starting position." },
    { ply:1, san:"e4", uci:"e2e4", fen:"rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1", ann:"1.e4", eval:25 },
    { ply:2, san:"e5", uci:"e7e5", fen:"rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2", ann:"1...e5", eval:20 },
    { ply:3, san:"Nf3", uci:"g1f3", fen:"rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2", ann:"2.Nf3", eval:25 },
    { ply:4, san:"Nc6", uci:"b8c6", fen:"r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3", ann:"2...Nc6", eval:20 },
    { ply:5, san:"Bc4", uci:"f1c4", fen:"r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3", ann:"3.Bc4 — Italian Game.", eval:25 },
    { ply:6, san:"Bc5", uci:"f8c5", fen:"r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4", ann:"3...Bc5 — Giuoco Piano.", eval:20 },
    { ply:7, san:"c3", uci:"c2c3", fen:"r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/2P2N2/PP1P1PPP/RNBQK2R b KQkq - 0 4", ann:"4.c3 — Preparing d4.", eval:25 },
    { ply:8, san:"Nf6", uci:"g8f6", fen:"r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/2P2N2/PP1P1PPP/RNBQK2R w KQkq - 1 5", ann:"4...Nf6 — Development.", eval:20 },
    { ply:9, san:"d4", uci:"d2d4", fen:"r1bqk2r/pppp1ppp/2n2n2/2b1p3/2BPP3/2P2N2/PP3PPP/RNBQK2R b KQkq - 0 5", ann:"5.d4! — Italian Attack! White opens the center immediately.", eval:25, nag:1 },
    { ply:10, san:"exd4", uci:"e5d4", fen:"r1bqk2r/pppp1ppp/2n2n2/2b5/2BpP3/2P2N2/PP3PPP/RNBQK2R w KQkq - 0 6", ann:"5...exd4 — Black captures.", eval:20 },
    { ply:11, san:"cxd4", uci:"c3d4", fen:"r1bqk2r/pppp1ppp/2n2n2/2b5/2BPP3/5N2/PP3PPP/RNBQK2R b KQkq - 0 6", ann:"6.cxd4 — White recaptures.", eval:25 },
    { ply:12, san:"Bb4+", uci:"c5b4", fen:"r1bqk2r/pppp1ppp/2n2n2/8/1bBPP3/5N2/PP3PPP/RNBQK2R w KQkq - 1 7", ann:"6...Bb4+ — Check! Black attacks the king.", eval:20, nag:1 },
    { ply:13, san:"Nc3", uci:"b1c3", fen:"r1bqk2r/pppp1ppp/2n2n2/8/1bBPP3/2N2N2/PP3PPP/R1BQK2R b KQkq - 2 7", ann:"7.Nc3 — Blocking the check.", eval:25 },
    { ply:14, san:"Nxe4", uci:"f6e4", fen:"r1bqk2r/pppp1ppp/2n5/8/1bBPn3/2N2N2/PP3PPP/R1BQK2R w KQkq - 0 8", ann:"7...Nxe4 — Black grabs a pawn!", eval:20, nag:5 },
    { ply:15, san:"O-O", uci:"e1g1", fen:"r1bqk2r/pppp1ppp/2n5/8/1bBPn3/2N2N2/PP3PPP/R1BQ1RK1 b kq - 1 8", ann:"8.O-O — White castles, sacrificing material for the attack!", eval:25, nag:1 },
    { ply:16, san:"Bxc3", uci:"b4c3", fen:"r1bqk2r/pppp1ppp/2n5/8/2BPn3/2b2N2/PP3PPP/R1BQ1RK1 w kq - 0 9", ann:"8...Bxc3 — Black captures the knight.", eval:20 },
    { ply:17, san:"d5", uci:"d4d5", fen:"r1bqk2r/pppp1ppp/2n5/3Pp3/2B1n3/5N2/PP3PPP/R1BQ1RK1 b kq - 0 9", ann:"9.d5! — White advances the pawn with tempo, attacking the knight. White has a powerful attack for the sacrificed material.", eval:30, nag:1 },
  ]);
}

// ─────────────────────────────────────────────────────────────────────────────
// LINE 3: Evans Gambit Accepted (C51)
// 1.e4 e5 2.Nf3 Nc6 3.Bc4 Bc5 4.b4 Bxb4 5.c3 Ba5 6.d4 exd4 7.O-O dxc3 8.Qb3
// ─────────────────────────────────────────────────────────────────────────────
{
  const lid = await insertLine(italianId, {
    title: "Evans Gambit Accepted: 4...Bxb4",
    slug: "italian-evans-gambit-accepted",
    eco: "C51",
    pgn: "1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. b4 Bxb4 5. c3 Ba5 6. d4 exd4 7. O-O dxc3 8. Qb3 Qf6 9. e5 Qg6 10. Nxc3",
    finalFen: "r1b1k1nr/pppp1ppp/2n3q1/b3P3/2B5/1QN2N2/P4PPP/R1B2RK1 b kq - 0 10",
    plyCnt: 19, color: "white", difficulty: "advanced",
    description: "The Evans Gambit is one of the most romantic gambits in chess history. White sacrifices a pawn on b4 for rapid development and a powerful center. Played by Morphy, Anderssen, and Kasparov, it remains a dangerous weapon.",
    sortOrder: 103, isMustKnow: true, themes: "gambit,attack,romantic,initiative",
  });
  await insertNodes(lid, [
    { ply:0, fen:"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", ann:"Starting position." },
    { ply:1, san:"e4", uci:"e2e4", fen:"rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1", ann:"1.e4", eval:25 },
    { ply:2, san:"e5", uci:"e7e5", fen:"rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2", ann:"1...e5", eval:20 },
    { ply:3, san:"Nf3", uci:"g1f3", fen:"rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2", ann:"2.Nf3", eval:25 },
    { ply:4, san:"Nc6", uci:"b8c6", fen:"r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3", ann:"2...Nc6", eval:20 },
    { ply:5, san:"Bc4", uci:"f1c4", fen:"r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3", ann:"3.Bc4 — Italian Game.", eval:25 },
    { ply:6, san:"Bc5", uci:"f8c5", fen:"r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4", ann:"3...Bc5 — Giuoco Piano.", eval:20 },
    { ply:7, san:"b4", uci:"b2b4", fen:"r1bqk1nr/pppp1ppp/2n5/2b1p3/1PB1P3/5N2/P1PP1PPP/RNBQK2R b KQkq - 0 4", ann:"4.b4!! — The Evans Gambit! A pawn sacrifice for rapid development.", eval:25, nag:1 },
    { ply:8, san:"Bxb4", uci:"c5b4", fen:"r1bqk1nr/pppp1ppp/2n5/4p3/1bB1P3/5N2/P1PP1PPP/RNBQK2R w KQkq - 0 5", ann:"4...Bxb4 — Black accepts the gambit.", eval:20 },
    { ply:9, san:"c3", uci:"c2c3", fen:"r1bqk1nr/pppp1ppp/2n5/4p3/1bB1P3/2P2N2/P2P1PPP/RNBQK2R b KQkq - 0 5", ann:"5.c3 — Attacking the bishop.", eval:25 },
    { ply:10, san:"Ba5", uci:"b4a5", fen:"r1bqk1nr/pppp1ppp/2n5/b3p3/2B1P3/2P2N2/P2P1PPP/RNBQK2R w KQkq - 1 6", ann:"5...Ba5 — Retreating to a5.", eval:20 },
    { ply:11, san:"d4", uci:"d2d4", fen:"r1bqk1nr/pppp1ppp/2n5/b3p3/2BPP3/2P2N2/P4PPP/RNBQK2R b KQkq - 0 6", ann:"6.d4 — Opening the center!", eval:25, nag:1 },
    { ply:12, san:"exd4", uci:"e5d4", fen:"r1bqk1nr/pppp1ppp/2n5/b7/2BpP3/2P2N2/P4PPP/RNBQK2R w KQkq - 0 7", ann:"6...exd4 — Black captures.", eval:20 },
    { ply:13, san:"O-O", uci:"e1g1", fen:"r1bqk1nr/pppp1ppp/2n5/b7/2BpP3/2P2N2/P4PPP/RNBQ1RK1 b kq - 1 7", ann:"7.O-O — White castles, sacrificing another pawn!", eval:25, nag:1 },
    { ply:14, san:"dxc3", uci:"d4c3", fen:"r1bqk1nr/pppp1ppp/2n5/b7/2B1P3/2p2N2/P4PPP/RNBQ1RK1 w kq - 0 8", ann:"7...dxc3 — Black grabs the pawn.", eval:20 },
    { ply:15, san:"Qb3", uci:"d1b3", fen:"r1bqk1nr/pppp1ppp/2n5/b7/2B1P3/1Qp2N2/P4PPP/RNB2RK1 b kq - 1 8", ann:"8.Qb3 — Attacking f7 and a5!", eval:25, nag:1 },
    { ply:16, san:"Qf6", uci:"d8f6", fen:"r1b1k1nr/pppp1ppp/2n2q2/b7/2B1P3/1Qp2N2/P4PPP/RNB2RK1 w kq - 2 9", ann:"8...Qf6 — Defending f7.", eval:20 },
    { ply:17, san:"e5", uci:"e4e5", fen:"r1b1k1nr/pppp1ppp/2n2q2/b3P3/2B5/1Qp2N2/P4PPP/RNB2RK1 b kq - 0 9", ann:"9.e5 — Attacking the queen!", eval:25, nag:1 },
    { ply:18, san:"Qg6", uci:"f6g6", fen:"r1b1k1nr/pppp1ppp/2n3q1/b3P3/2B5/1Qp2N2/P4PPP/RNB2RK1 w kq - 1 10", ann:"9...Qg6 — Retreating.", eval:20 },
    { ply:19, san:"Nxc3", uci:"b1c3", fen:"r1b1k1nr/pppp1ppp/2n3q1/b3P3/2B5/1QN2N2/P4PPP/R1B2RK1 b kq - 0 10", ann:"10.Nxc3 — White recaptures. White has tremendous piece activity and attacking chances for the sacrificed pawns. This is the Evans Gambit at its most dynamic!", eval:35, nag:1 },
  ]);
}

// ─────────────────────────────────────────────────────────────────────────────
// LINE 4: Evans Gambit Declined (C51)
// 1.e4 e5 2.Nf3 Nc6 3.Bc4 Bc5 4.b4 Bb6 5.a4 a6 6.Nc3 Nf6 7.d3
// ─────────────────────────────────────────────────────────────────────────────
{
  const lid = await insertLine(italianId, {
    title: "Evans Gambit Declined: 4...Bb6",
    slug: "italian-evans-gambit-declined",
    eco: "C51",
    pgn: "1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. b4 Bb6 5. a4 a6 6. Nc3 Nf6 7. d3 d6 8. Be3 Bxe3 9. fxe3",
    finalFen: "r1bqk2r/1pp2ppp/pn1p1n2/4p3/PpB1P3/2NPP3/2P3PP/R2QK2R b KQkq - 0 9",
    plyCnt: 17, color: "black", difficulty: "intermediate",
    description: "Declining the Evans Gambit with 4...Bb6 is a solid choice. Black avoids the complications of the accepted gambit while maintaining a sound position. White still gets some initiative but Black has fewer weaknesses.",
    sortOrder: 104, isMustKnow: false, themes: "solid,anti-gambit,positional",
  });
  await insertNodes(lid, [
    { ply:0, fen:"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", ann:"Starting position." },
    { ply:1, san:"e4", uci:"e2e4", fen:"rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1", ann:"1.e4", eval:25 },
    { ply:2, san:"e5", uci:"e7e5", fen:"rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2", ann:"1...e5", eval:20 },
    { ply:3, san:"Nf3", uci:"g1f3", fen:"rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2", ann:"2.Nf3", eval:25 },
    { ply:4, san:"Nc6", uci:"b8c6", fen:"r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3", ann:"2...Nc6", eval:20 },
    { ply:5, san:"Bc4", uci:"f1c4", fen:"r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3", ann:"3.Bc4 — Italian Game.", eval:25 },
    { ply:6, san:"Bc5", uci:"f8c5", fen:"r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4", ann:"3...Bc5 — Giuoco Piano.", eval:20 },
    { ply:7, san:"b4", uci:"b2b4", fen:"r1bqk1nr/pppp1ppp/2n5/2b1p3/1PB1P3/5N2/P1PP1PPP/RNBQK2R b KQkq - 0 4", ann:"4.b4 — Evans Gambit offered.", eval:25 },
    { ply:8, san:"Bb6", uci:"c5b6", fen:"r1bqk1nr/pppp1ppp/1bn5/4p3/1PB1P3/5N2/P1PP1PPP/RNBQK2R w KQkq - 1 5", ann:"4...Bb6 — Declining the gambit! Solid and sound.", eval:20, nag:1 },
    { ply:9, san:"a4", uci:"a2a4", fen:"r1bqk1nr/pppp1ppp/1bn5/4p3/PPB1P3/5N2/2PP1PPP/RNBQK2R b KQkq - 0 5", ann:"5.a4 — Attacking the bishop.", eval:25 },
    { ply:10, san:"a6", uci:"a7a6", fen:"r1bqk1nr/1ppp1ppp/pbn5/4p3/PPB1P3/5N2/2PP1PPP/RNBQK2R w KQkq - 0 6", ann:"5...a6 — Defending the bishop.", eval:20 },
    { ply:11, san:"Nc3", uci:"b1c3", fen:"r1bqk1nr/1ppp1ppp/pbn5/4p3/PPB1P3/2N2N2/2PP1PPP/R1BQK2R b KQkq - 1 6", ann:"6.Nc3 — Development.", eval:25 },
    { ply:12, san:"Nf6", uci:"g8f6", fen:"r1bqk2r/1ppp1ppp/pbn2n2/4p3/PPB1P3/2N2N2/2PP1PPP/R1BQK2R w KQkq - 2 7", ann:"6...Nf6 — Development.", eval:20 },
    { ply:13, san:"d3", uci:"d2d3", fen:"r1bqk2r/1ppp1ppp/pbn2n2/4p3/PPB1P3/2NP1N2/2P2PPP/R1BQK2R b KQkq - 0 7", ann:"7.d3 — Solid.", eval:25 },
    { ply:14, san:"d6", uci:"d7d6", fen:"r1bqk2r/1pp2ppp/pbn2n2/3pp3/PPB1P3/2NP1N2/2P2PPP/R1BQK2R w KQkq - 0 8", ann:"7...d6 — Solid center.", eval:20 },
    { ply:15, san:"Be3", uci:"c1e3", fen:"r1bqk2r/1pp2ppp/pbn2n2/3pp3/PPB1P3/2NPBN2/2P2PPP/R2QK2R b KQkq - 1 8", ann:"8.Be3 — Development.", eval:25 },
    { ply:16, san:"Bxe3", uci:"b6e3", fen:"r1bqk2r/1pp2ppp/p1n2n2/3pp3/PPB1P3/2NPbN2/2P2PPP/R2QK2R w KQkq - 0 9", ann:"8...Bxe3 — Trading the bishop.", eval:20 },
    { ply:17, san:"fxe3", uci:"f2e3", fen:"r1bqk2r/1pp2ppp/p1n2n2/3pp3/PPB1P3/2NPpN2/2P3PP/R2QK2R b KQkq - 0 9", ann:"9.fxe3 — Recapturing. The position is solid for Black who has avoided the gambit complications.", eval:20 },
  ]);
}

// ─────────────────────────────────────────────────────────────────────────────
// LINE 5: Two Knights Defense — Fried Liver Attack (C57)
// 1.e4 e5 2.Nf3 Nc6 3.Bc4 Nf6 4.Ng5 d5 5.exd5 Na5 6.Bxf7+!
// ─────────────────────────────────────────────────────────────────────────────
{
  const lid = await insertLine(italianId, {
    title: "Two Knights: Fried Liver Attack (6.Bxf7+)",
    slug: "italian-two-knights-fried-liver",
    eco: "C57",
    pgn: "1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6 4. Ng5 d5 5. exd5 Na5 6. Bxf7+ Kxf7 7. Qf3+ Ke6 8. Nc3 Nb3 9. axb3",
    finalFen: "r1bq1b1r/ppp3pp/2k1pn2/3Pp3/8/1PN2Q2/1PPP1PPP/R1B1K2R b KQ - 0 9",
    plyCnt: 17, color: "white", difficulty: "advanced",
    description: "The Fried Liver Attack is one of the most famous sacrificial attacks in chess. White sacrifices the bishop on f7, forcing the Black king into the open. Extremely dangerous for unprepared opponents.",
    sortOrder: 105, isMustKnow: true, themes: "sacrifice,attack,king-hunt,tactical",
  });
  await insertNodes(lid, [
    { ply:0, fen:"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", ann:"Starting position." },
    { ply:1, san:"e4", uci:"e2e4", fen:"rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1", ann:"1.e4", eval:25 },
    { ply:2, san:"e5", uci:"e7e5", fen:"rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2", ann:"1...e5", eval:20 },
    { ply:3, san:"Nf3", uci:"g1f3", fen:"rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2", ann:"2.Nf3", eval:25 },
    { ply:4, san:"Nc6", uci:"b8c6", fen:"r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3", ann:"2...Nc6", eval:20 },
    { ply:5, san:"Bc4", uci:"f1c4", fen:"r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3", ann:"3.Bc4 — Italian Game.", eval:25 },
    { ply:6, san:"Nf6", uci:"g8f6", fen:"r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4", ann:"3...Nf6 — Two Knights Defense!", eval:20, nag:1 },
    { ply:7, san:"Ng5", uci:"f3g5", fen:"r1bqkb1r/pppp1ppp/2n2n2/4p1N1/2B1P3/8/PPPP1PPP/RNBQK2R b KQkq - 5 4", ann:"4.Ng5 — Attacking f7!", eval:25, nag:1 },
    { ply:8, san:"d5", uci:"d7d5", fen:"r1bqkb1r/ppp2ppp/2n2n2/3pp1N1/2B1P3/8/PPPP1PPP/RNBQK2R w KQkq - 0 5", ann:"4...d5 — The best response! Black counterattacks.", eval:20, nag:1 },
    { ply:9, san:"exd5", uci:"e4d5", fen:"r1bqkb1r/ppp2ppp/2n2n2/3Pp1N1/2B5/8/PPPP1PPP/RNBQK2R b KQkq - 0 5", ann:"5.exd5 — White captures.", eval:25 },
    { ply:10, san:"Na5", uci:"c6a5", fen:"r1bqkb1r/ppp2ppp/5n2/n2Pp1N1/2B5/8/PPPP1PPP/RNBQK2R w KQkq - 1 6", ann:"5...Na5 — Attacking the bishop.", eval:20 },
    { ply:11, san:"Bxf7+", uci:"c4f7", fen:"r1bqkb1r/ppp2Bpp/5n2/n2Pp1N1/8/8/PPPP1PPP/RNBQK2R b KQkq - 0 6", ann:"6.Bxf7+!! — The Fried Liver Attack! White sacrifices the bishop!", eval:30, nag:3 },
    { ply:12, san:"Kxf7", uci:"e8f7", fen:"r1bq1b1r/ppp2kpp/5n2/n2Pp1N1/8/8/PPPP1PPP/RNBQK2R w KQ - 0 7", ann:"6...Kxf7 — The king is forced to capture.", eval:25 },
    { ply:13, san:"Qf3+", uci:"d1f3", fen:"r1bq1b1r/ppp2kpp/5n2/n2Pp1N1/8/5Q2/PPPP1PPP/RNB1K2R b KQ - 1 7", ann:"7.Qf3+ — Check! Attacking the king.", eval:30, nag:1 },
    { ply:14, san:"Ke6", uci:"f7e6", fen:"r1bq1b1r/ppp3pp/4kn2/n2Pp1N1/8/5Q2/PPPP1PPP/RNB1K2R w KQ - 2 8", ann:"7...Ke6 — The king walks into the center.", eval:25 },
    { ply:15, san:"Nc3", uci:"b1c3", fen:"r1bq1b1r/ppp3pp/4kn2/n2Pp1N1/8/2N2Q2/PPPP1PPP/R1B1K2R b KQ - 3 8", ann:"8.Nc3 — Development with tempo.", eval:30, nag:1 },
    { ply:16, san:"Nb3", uci:"a5b3", fen:"r1bq1b1r/ppp3pp/4kn2/3Pp1N1/8/1nN2Q2/PPPP1PPP/R1B1K2R w KQ - 4 9", ann:"8...Nb3 — Black attacks the rook.", eval:25 },
    { ply:17, san:"axb3", uci:"a2b3", fen:"r1bq1b1r/ppp3pp/4kn2/3Pp1N1/8/1PN2Q2/1PPP1PPP/R1B1K2R b KQ - 0 9", ann:"9.axb3 — White recaptures. The Black king is dangerously exposed in the center. White has a powerful attack.", eval:40, nag:1 },
  ]);
}

// ─────────────────────────────────────────────────────────────────────────────
// LINE 6: Two Knights — Traxler Counter-Attack (C57)
// 1.e4 e5 2.Nf3 Nc6 3.Bc4 Nf6 4.Ng5 Bc5!? 5.Nxf7 Bxf2+
// ─────────────────────────────────────────────────────────────────────────────
{
  const lid = await insertLine(italianId, {
    title: "Two Knights: Traxler Counter-Attack (4...Bc5)",
    slug: "italian-two-knights-traxler",
    eco: "C57",
    pgn: "1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6 4. Ng5 Bc5 5. Nxf7 Bxf2+ 6. Kxf2 Nxe4+ 7. Kg1 Qh4 8. g3 Nxg3 9. hxg3 Qxg3+",
    finalFen: "r1b1k2r/pppp1Npp/2n5/2b1p3/8/6q1/PPPP2PP/RNBQ1RK1 w kq - 0 10",
    plyCnt: 18, color: "black", difficulty: "advanced",
    description: "The Traxler Counter-Attack is one of the wildest openings in chess. Instead of defending against Ng5, Black counter-sacrifices with 4...Bc5, leading to chaotic positions where both kings are exposed. Extremely dangerous for unprepared White players.",
    sortOrder: 106, isMustKnow: false, themes: "counter-attack,sacrifice,chaos,tactical",
  });
  await insertNodes(lid, [
    { ply:0, fen:"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", ann:"Starting position." },
    { ply:1, san:"e4", uci:"e2e4", fen:"rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1", ann:"1.e4", eval:25 },
    { ply:2, san:"e5", uci:"e7e5", fen:"rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2", ann:"1...e5", eval:20 },
    { ply:3, san:"Nf3", uci:"g1f3", fen:"rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2", ann:"2.Nf3", eval:25 },
    { ply:4, san:"Nc6", uci:"b8c6", fen:"r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3", ann:"2...Nc6", eval:20 },
    { ply:5, san:"Bc4", uci:"f1c4", fen:"r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3", ann:"3.Bc4 — Italian Game.", eval:25 },
    { ply:6, san:"Nf6", uci:"g8f6", fen:"r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4", ann:"3...Nf6 — Two Knights Defense.", eval:20 },
    { ply:7, san:"Ng5", uci:"f3g5", fen:"r1bqkb1r/pppp1ppp/2n2n2/4p1N1/2B1P3/8/PPPP1PPP/RNBQK2R b KQkq - 5 4", ann:"4.Ng5 — Attacking f7.", eval:25 },
    { ply:8, san:"Bc5", uci:"f8c5", fen:"r1bqk2r/pppp1ppp/2n2n2/2b1p1N1/2B1P3/8/PPPP1PPP/RNBQK2R w KQkq - 6 5", ann:"4...Bc5!? — The Traxler Counter-Attack! Black ignores the threat and counter-attacks!", eval:20, nag:5 },
    { ply:9, san:"Nxf7", uci:"g5f7", fen:"r1bqk2r/pppp1Npp/2n2n2/2b1p3/2B1P3/8/PPPP1PPP/RNBQK2R b KQkq - 0 5", ann:"5.Nxf7 — White takes the bait!", eval:25 },
    { ply:10, san:"Bxf2+", uci:"c5f2", fen:"r1bqk2r/pppp1Npp/2n2n2/4p3/2B1P3/8/PPPPbPPP/RNBQK2R w KQkq - 0 6", ann:"5...Bxf2+!! — The counter-sacrifice! Black gives up the bishop to expose the White king.", eval:20, nag:3 },
    { ply:11, san:"Kxf2", uci:"e1f2", fen:"r1bqk2r/pppp1Npp/2n2n2/4p3/2B1P3/8/PPPPkPPP/RNBQ3R b kq - 0 6", ann:"6.Kxf2 — White must capture.", eval:25 },
    { ply:12, san:"Nxe4+", uci:"f6e4", fen:"r1bqk2r/pppp1Npp/2n5/4p3/2B1n3/8/PPPPkPPP/RNBQ3R w kq - 0 7", ann:"6...Nxe4+ — Check! Black wins back material.", eval:20, nag:1 },
    { ply:13, san:"Kg1", uci:"f2g1", fen:"r1bqk2r/pppp1Npp/2n5/4p3/2B1n3/8/PPPPkPPP/RNBQ2KR b kq - 1 7", ann:"7.Kg1 — King retreats.", eval:25 },
    { ply:14, san:"Qh4", uci:"d8h4", fen:"r1b1k2r/pppp1Npp/2n5/4p3/2B1n2q/8/PPPPkPPP/RNBQ2KR w kq - 2 8", ann:"7...Qh4 — Attacking h2!", eval:20, nag:1 },
    { ply:15, san:"g3", uci:"g2g3", fen:"r1b1k2r/pppp1Npp/2n5/4p3/2B1n2q/6P1/PPPPkP1P/RNBQ2KR b kq - 0 8", ann:"8.g3 — Defending h2.", eval:25 },
    { ply:16, san:"Nxg3", uci:"e4g3", fen:"r1b1k2r/pppp1Npp/2n5/4p3/2B4q/6n1/PPPPkP1P/RNBQ2KR w kq - 0 9", ann:"8...Nxg3 — Black captures!", eval:20, nag:1 },
    { ply:17, san:"hxg3", uci:"h2g3", fen:"r1b1k2r/pppp1Npp/2n5/4p3/2B4q/6P1/PPPPkP2/RNBQ2KR b kq - 0 9", ann:"9.hxg3 — White recaptures.", eval:25 },
    { ply:18, san:"Qxg3+", uci:"h4g3", fen:"r1b1k2r/pppp1Npp/2n5/4p3/2B5/6q1/PPPPkP2/RNBQ2KR w kq - 0 10", ann:"9...Qxg3+ — Check! The position is completely chaotic. Both kings are exposed and material is roughly equal. This is the Traxler at its most wild!", eval:0, nag:5 },
  ]);
}

// ─────────────────────────────────────────────────────────────────────────────
// LINE 7: Two Knights — Modern 4.d3 (C55)
// 1.e4 e5 2.Nf3 Nc6 3.Bc4 Nf6 4.d3 Bc5 5.c3 d6 6.O-O O-O 7.Nbd2 a6
// ─────────────────────────────────────────────────────────────────────────────
{
  const lid = await insertLine(italianId, {
    title: "Two Knights: Modern 4.d3 (Quiet System)",
    slug: "italian-two-knights-modern-d3",
    eco: "C55",
    pgn: "1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6 4. d3 Bc5 5. c3 d6 6. O-O O-O 7. Nbd2 a6 8. Bb3 Ba7 9. h3",
    finalFen: "r1bq1rk1/bpp2ppp/p1np1n2/4p3/4P3/1BPP1N1P/PP1N1PP1/R1BQ1RK1 b - - 0 9",
    plyCnt: 17, color: "white", difficulty: "beginner",
    description: "The modern 4.d3 system against the Two Knights is the safest approach. White builds a solid position without entering sharp tactical lines. This is the setup favored by Magnus Carlsen and is ideal for players who want to avoid theory.",
    sortOrder: 107, isMustKnow: false, themes: "solid,modern,positional,flexible",
  });
  await insertNodes(lid, [
    { ply:0, fen:"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", ann:"Starting position." },
    { ply:1, san:"e4", uci:"e2e4", fen:"rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1", ann:"1.e4", eval:25 },
    { ply:2, san:"e5", uci:"e7e5", fen:"rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2", ann:"1...e5", eval:20 },
    { ply:3, san:"Nf3", uci:"g1f3", fen:"rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2", ann:"2.Nf3", eval:25 },
    { ply:4, san:"Nc6", uci:"b8c6", fen:"r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3", ann:"2...Nc6", eval:20 },
    { ply:5, san:"Bc4", uci:"f1c4", fen:"r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3", ann:"3.Bc4 — Italian Game.", eval:25 },
    { ply:6, san:"Nf6", uci:"g8f6", fen:"r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4", ann:"3...Nf6 — Two Knights Defense.", eval:20 },
    { ply:7, san:"d3", uci:"d2d3", fen:"r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/3P1N2/PPP2PPP/RNBQK2R b KQkq - 0 4", ann:"4.d3 — Modern system! Avoiding the sharp Ng5 lines.", eval:25, nag:1 },
    { ply:8, san:"Bc5", uci:"f8c5", fen:"r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/3P1N2/PPP2PPP/RNBQK2R w KQkq - 1 5", ann:"4...Bc5 — Development.", eval:20 },
    { ply:9, san:"c3", uci:"c2c3", fen:"r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/2PP1N2/PP3PPP/RNBQK2R b KQkq - 0 5", ann:"5.c3 — Preparing d4.", eval:25 },
    { ply:10, san:"d6", uci:"d7d6", fen:"r1bqk2r/ppp2ppp/2np1n2/2b1p3/2B1P3/2PP1N2/PP3PPP/RNBQK2R w KQkq - 0 6", ann:"5...d6 — Solid.", eval:20 },
    { ply:11, san:"O-O", uci:"e1g1", fen:"r1bqk2r/ppp2ppp/2np1n2/2b1p3/2B1P3/2PP1N2/PP3PPP/RNBQ1RK1 b kq - 1 6", ann:"6.O-O — White castles.", eval:25 },
    { ply:12, san:"O-O", uci:"e8g8", fen:"r1bq1rk1/ppp2ppp/2np1n2/2b1p3/2B1P3/2PP1N2/PP3PPP/RNBQ1RK1 w - - 2 7", ann:"6...O-O — Both sides castle.", eval:20 },
    { ply:13, san:"Nbd2", uci:"b1d2", fen:"r1bq1rk1/ppp2ppp/2np1n2/2b1p3/2B1P3/2PP1N2/PP1N1PPP/R1BQ1RK1 b - - 3 7", ann:"7.Nbd2 — Flexible development.", eval:25 },
    { ply:14, san:"a6", uci:"a7a6", fen:"r1bq1rk1/1pp2ppp/p1np1n2/2b1p3/2B1P3/2PP1N2/PP1N1PPP/R1BQ1RK1 w - - 0 8", ann:"7...a6 — Preventing Nb5.", eval:20 },
    { ply:15, san:"Bb3", uci:"c4b3", fen:"r1bq1rk1/1pp2ppp/p1np1n2/2b1p3/4P3/1BPP1N2/PP1N1PPP/R1BQ1RK1 b - - 1 8", ann:"8.Bb3 — Retreating the bishop.", eval:25 },
    { ply:16, san:"Ba7", uci:"c5a7", fen:"r1bq1rk1/bpp2ppp/p1np1n2/4p3/4P3/1BPP1N2/PP1N1PPP/R1BQ1RK1 w - - 2 9", ann:"8...Ba7 — Keeping the bishop active.", eval:20 },
    { ply:17, san:"h3", uci:"h2h3", fen:"r1bq1rk1/bpp2ppp/p1np1n2/4p3/4P3/1BPP1N1P/PP1N1PP1/R1BQ1RK1 b - - 0 9", ann:"9.h3 — Preventing ...Bg4. White has a solid position and will prepare the d4 break. This is the modern Italian — strategic and deep.", eval:25 },
  ]);
}

console.log(`\nItalian Game extra lines seeded:`);
console.log(`  Lines inserted: ${linesInserted}`);
console.log(`  Nodes inserted: ${nodesInserted}`);

// Final state
const [allLines] = await conn.execute(
  `SELECT l.title, l.eco, l.sort_order, COUNT(n.id) as nodes
   FROM opening_lines l
   LEFT JOIN line_nodes n ON n.line_id = l.id
   WHERE l.opening_id = ? AND l.is_published = 1
   GROUP BY l.id, l.title, l.eco, l.sort_order
   ORDER BY l.sort_order`,
  [italianId]
);
console.log(`\nItalian Game — all lines:`);
allLines.forEach(r => console.log(`  [${r.eco}] "${r.title}" — ${r.nodes} nodes`));

await conn.end();
console.log("\nDone.");
