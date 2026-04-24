/**
 * seed-queens-gambit-expansion.mjs
 *
 * Expands the Queen's Gambit opening with 7 new lines:
 *   Queen's Gambit (id: pPZkkBU968mr5_Pe):
 *     1. Tarrasch Defense: Main Line (D34)
 *     2. Tarrasch Defense: Schara-Hennig Gambit (D32)
 *     3. Semi-Slav: Meran Variation (D47)
 *     4. Semi-Slav: Moscow Variation (D44)
 *     5. Catalan Opening: Open Catalan (E04)
 *     6. Catalan Opening: Closed Catalan (E06)
 *
 *   Queen's Gambit Declined (id: 6-iMs3Qw6OfzwbDE):
 *     7. QGD: Exchange Variation (D35)
 *     8. QGD: Vienna Variation (D39)
 *
 * Usage: node scripts/seed-queens-gambit-expansion.mjs
 */
import mysql from "mysql2/promise";
import { randomUUID } from "crypto";

const nanoid = () => randomUUID().replace(/-/g, "").slice(0, 20);
const conn = await mysql.createConnection(process.env.DATABASE_URL);

const QG_ID  = "pPZkkBU968mr5_Pe";   // Queen's Gambit
const QGD_ID = "6-iMs3Qw6OfzwbDE";  // Queen's Gambit Declined

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

// ═════════════════════════════════════════════════════════════════════════════
// QUEEN'S GAMBIT LINES
// ═════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────
// LINE 1: Tarrasch Defense — Main Line (D34)
// 1.d4 d5 2.c4 e6 3.Nc3 c5 4.cxd5 exd5 5.Nf3 Nc6 6.g3 Nf6 7.Bg2 Be7 8.O-O O-O 9.dxc5
// ─────────────────────────────────────────────────────────────────────────────
{
  const lid = await insertLine(QG_ID, {
    title: "Tarrasch Defense: Main Line (3...c5)",
    slug: "qg-tarrasch-main-line",
    eco: "D34",
    pgn: "1. d4 d5 2. c4 e6 3. Nc3 c5 4. cxd5 exd5 5. Nf3 Nc6 6. g3 Nf6 7. Bg2 Be7 8. O-O O-O 9. dxc5 Bxc5 10. Bg5",
    finalFen: "r1bq1rk1/pp3ppp/2n2n2/2bpB3/8/2N2NP1/PP2PPBP/R2Q1RK1 b - - 2 10",
    plyCnt: 19, color: "black", difficulty: "intermediate",
    description: "The Tarrasch Defense is a dynamic response to the Queen's Gambit. Black accepts an isolated d-pawn in exchange for active piece play and open files. Favored by Spassky, Kasparov, and many modern GMs who prefer active play over solid structures.",
    sortOrder: 3, isMustKnow: true, themes: "isolated-pawn,active,dynamic,piece-play",
  });
  await insertNodes(lid, [
    { ply:0, fen:"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", ann:"Starting position." },
    { ply:1, san:"d4", uci:"d2d4", fen:"rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq - 0 1", ann:"1.d4 — Queen's pawn opening.", eval:25 },
    { ply:2, san:"d5", uci:"d7d5", fen:"rnbqkbnr/ppp1pppp/8/3p4/3P4/8/PPP1PPPP/RNBQKBNR w KQkq - 0 2", ann:"1...d5 — Symmetric response.", eval:20 },
    { ply:3, san:"c4", uci:"c2c4", fen:"rnbqkbnr/ppp1pppp/8/3p4/2PP4/8/PP2PPPP/RNBQKBNR b KQkq - 0 2", ann:"2.c4 — The Queen's Gambit!", eval:25, nag:1 },
    { ply:4, san:"e6", uci:"e7e6", fen:"rnbqkbnr/ppp2ppp/4p3/3p4/2PP4/8/PP2PPPP/RNBQKBNR w KQkq - 0 3", ann:"2...e6 — Declining the gambit.", eval:20 },
    { ply:5, san:"Nc3", uci:"b1c3", fen:"rnbqkbnr/ppp2ppp/4p3/3p4/2PP4/2N5/PP2PPPP/R1BQKBNR b KQkq - 1 3", ann:"3.Nc3 — Development.", eval:25 },
    { ply:6, san:"c5", uci:"c7c5", fen:"rnbqkbnr/pp3ppp/4p3/2pp4/2PP4/2N5/PP2PPPP/R1BQKBNR w KQkq - 0 4", ann:"3...c5! — Tarrasch Defense! Black immediately challenges the center.", eval:20, nag:1 },
    { ply:7, san:"cxd5", uci:"c4d5", fen:"rnbqkbnr/pp3ppp/4p3/2pP4/3P4/2N5/PP2PPPP/R1BQKBNR b KQkq - 0 4", ann:"4.cxd5 — White captures.", eval:25 },
    { ply:8, san:"exd5", uci:"e6d5", fen:"rnbqkbnr/pp3ppp/8/2pp4/3P4/2N5/PP2PPPP/R1BQKBNR w KQkq - 0 5", ann:"4...exd5 — Black recaptures, creating an isolated d-pawn.", eval:20 },
    { ply:9, san:"Nf3", uci:"g1f3", fen:"rnbqkbnr/pp3ppp/8/2pp4/3P4/2N2N2/PP2PPPP/R1BQKB1R b KQkq - 1 5", ann:"5.Nf3 — Development.", eval:25 },
    { ply:10, san:"Nc6", uci:"b8c6", fen:"r1bqkbnr/pp3ppp/2n5/2pp4/3P4/2N2N2/PP2PPPP/R1BQKB1R w KQkq - 2 6", ann:"5...Nc6 — Development.", eval:20 },
    { ply:11, san:"g3", uci:"g2g3", fen:"r1bqkbnr/pp3ppp/2n5/2pp4/3P4/2N2NP1/PP2PP1P/R1BQKB1R b KQkq - 0 6", ann:"6.g3 — Catalan-style fianchetto.", eval:25 },
    { ply:12, san:"Nf6", uci:"g8f6", fen:"r1bqkb1r/pp3ppp/2n2n2/2pp4/3P4/2N2NP1/PP2PP1P/R1BQKB1R w KQkq - 1 7", ann:"6...Nf6 — Development.", eval:20 },
    { ply:13, san:"Bg2", uci:"f1g2", fen:"r1bqkb1r/pp3ppp/2n2n2/2pp4/3P4/2N2NP1/PP2PPBP/R1BQK2R b KQkq - 2 7", ann:"7.Bg2 — Completing the fianchetto.", eval:25 },
    { ply:14, san:"Be7", uci:"f8e7", fen:"r1bqk2r/pp2bppp/2n2n2/2pp4/3P4/2N2NP1/PP2PPBP/R1BQK2R w KQkq - 3 8", ann:"7...Be7 — Development.", eval:20 },
    { ply:15, san:"O-O", uci:"e1g1", fen:"r1bqk2r/pp2bppp/2n2n2/2pp4/3P4/2N2NP1/PP2PPBP/R1BQ1RK1 b kq - 4 8", ann:"8.O-O — White castles.", eval:25 },
    { ply:16, san:"O-O", uci:"e8g8", fen:"r1bq1rk1/pp2bppp/2n2n2/2pp4/3P4/2N2NP1/PP2PPBP/R1BQ1RK1 w - - 5 9", ann:"8...O-O — Both sides castle.", eval:20 },
    { ply:17, san:"dxc5", uci:"d4c5", fen:"r1bq1rk1/pp2bppp/2n2n2/2Pp4/8/2N2NP1/PP2PPBP/R1BQ1RK1 b - - 0 9", ann:"9.dxc5 — White captures.", eval:25 },
    { ply:18, san:"Bxc5", uci:"e7c5", fen:"r1bq1rk1/pp3ppp/2n2n2/2bp4/8/2N2NP1/PP2PPBP/R1BQ1RK1 w - - 0 10", ann:"9...Bxc5 — Black recaptures with the bishop.", eval:20 },
    { ply:19, san:"Bg5", uci:"c1g5", fen:"r1bq1rk1/pp3ppp/2n2n2/2bpB3/8/2N2NP1/PP2PPBP/R2Q1RK1 b - - 1 10", ann:"10.Bg5 — Pinning the knight. The Tarrasch leads to rich middlegame positions where Black's isolated d-pawn is both a weakness and a source of dynamic play.", eval:25 },
  ]);
}

// ─────────────────────────────────────────────────────────────────────────────
// LINE 2: Tarrasch Defense — Schara-Hennig Gambit (D32)
// 1.d4 d5 2.c4 e6 3.Nc3 c5 4.cxd5 cxd4!? 5.Qxd4 Nc6 6.Qd1 exd5 7.Qxd5 Bd6
// ─────────────────────────────────────────────────────────────────────────────
{
  const lid = await insertLine(QG_ID, {
    title: "Tarrasch: Schara-Hennig Gambit (4...cxd4)",
    slug: "qg-tarrasch-schara-hennig",
    eco: "D32",
    pgn: "1. d4 d5 2. c4 e6 3. Nc3 c5 4. cxd5 cxd4 5. Qxd4 Nc6 6. Qd1 exd5 7. Qxd5 Bd6 8. Nf3 Nge7 9. Qd1",
    finalFen: "r1bqk2r/pp2nppp/2nb4/8/8/2N2N2/PP2PPPP/R1BQKB1R b KQkq - 2 9",
    plyCnt: 17, color: "black", difficulty: "advanced",
    description: "The Schara-Hennig Gambit is a bold pawn sacrifice in the Tarrasch. Black gives up a pawn for rapid development and attacking chances. White's queen is harassed and Black gets tremendous piece activity.",
    sortOrder: 4, isMustKnow: false, themes: "gambit,attack,initiative,piece-activity",
  });
  await insertNodes(lid, [
    { ply:0, fen:"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", ann:"Starting position." },
    { ply:1, san:"d4", uci:"d2d4", fen:"rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq - 0 1", ann:"1.d4", eval:25 },
    { ply:2, san:"d5", uci:"d7d5", fen:"rnbqkbnr/ppp1pppp/8/3p4/3P4/8/PPP1PPPP/RNBQKBNR w KQkq - 0 2", ann:"1...d5", eval:20 },
    { ply:3, san:"c4", uci:"c2c4", fen:"rnbqkbnr/ppp1pppp/8/3p4/2PP4/8/PP2PPPP/RNBQKBNR b KQkq - 0 2", ann:"2.c4 — Queen's Gambit.", eval:25 },
    { ply:4, san:"e6", uci:"e7e6", fen:"rnbqkbnr/ppp2ppp/4p3/3p4/2PP4/8/PP2PPPP/RNBQKBNR w KQkq - 0 3", ann:"2...e6", eval:20 },
    { ply:5, san:"Nc3", uci:"b1c3", fen:"rnbqkbnr/ppp2ppp/4p3/3p4/2PP4/2N5/PP2PPPP/R1BQKBNR b KQkq - 1 3", ann:"3.Nc3", eval:25 },
    { ply:6, san:"c5", uci:"c7c5", fen:"rnbqkbnr/pp3ppp/4p3/2pp4/2PP4/2N5/PP2PPPP/R1BQKBNR w KQkq - 0 4", ann:"3...c5 — Tarrasch.", eval:20 },
    { ply:7, san:"cxd5", uci:"c4d5", fen:"rnbqkbnr/pp3ppp/4p3/2pP4/3P4/2N5/PP2PPPP/R1BQKBNR b KQkq - 0 4", ann:"4.cxd5", eval:25 },
    { ply:8, san:"cxd4", uci:"c5d4", fen:"rnbqkbnr/pp3ppp/4p3/3P4/3p4/2N5/PP2PPPP/R1BQKBNR w KQkq - 0 5", ann:"4...cxd4!? — Schara-Hennig Gambit! Black sacrifices a pawn.", eval:20, nag:5 },
    { ply:9, san:"Qxd4", uci:"d1d4", fen:"rnbqkbnr/pp3ppp/4p3/3P4/3Q4/2N5/PP2PPPP/R1B1KBNR b KQkq - 0 5", ann:"5.Qxd4 — White accepts.", eval:25 },
    { ply:10, san:"Nc6", uci:"b8c6", fen:"r1bqkbnr/pp3ppp/2n1p3/3P4/3Q4/2N5/PP2PPPP/R1B1KBNR w KQkq - 1 6", ann:"5...Nc6 — Attacking the queen!", eval:20, nag:1 },
    { ply:11, san:"Qd1", uci:"d4d1", fen:"r1bqkbnr/pp3ppp/2n1p3/3P4/8/2N5/PP2PPPP/R1BQKBNR b KQkq - 2 6", ann:"6.Qd1 — Retreating.", eval:25 },
    { ply:12, san:"exd5", uci:"e6d5", fen:"r1bqkbnr/pp3ppp/2n5/3p4/8/2N5/PP2PPPP/R1BQKBNR w KQkq - 0 7", ann:"6...exd5 — Black recaptures.", eval:20 },
    { ply:13, san:"Qxd5", uci:"d1d5", fen:"r1bqkbnr/pp3ppp/2n5/3Q4/8/2N5/PP2PPPP/R1B1KBNR b KQkq - 0 7", ann:"7.Qxd5 — White grabs the pawn.", eval:25 },
    { ply:14, san:"Bd6", uci:"f8d6", fen:"r1bqk1nr/pp3ppp/2nb4/3Q4/8/2N5/PP2PPPP/R1B1KBNR w KQkq - 1 8", ann:"7...Bd6 — Developing with tempo, attacking the queen!", eval:20, nag:1 },
    { ply:15, san:"Nf3", uci:"g1f3", fen:"r1bqk1nr/pp3ppp/2nb4/3Q4/8/2N2N2/PP2PPPP/R1B1KB1R b KQkq - 2 8", ann:"8.Nf3 — Development.", eval:25 },
    { ply:16, san:"Nge7", uci:"g8e7", fen:"r1bqk2r/pp2nppp/2nb4/3Q4/8/2N2N2/PP2PPPP/R1B1KB1R w KQkq - 3 9", ann:"8...Nge7 — Development.", eval:20 },
    { ply:17, san:"Qd1", uci:"d5d1", fen:"r1bqk2r/pp2nppp/2nb4/8/8/2N2N2/PP2PPPP/R1BQKB1R b KQkq - 4 9", ann:"9.Qd1 — Retreating the queen. Black has excellent piece activity for the sacrificed pawn.", eval:20 },
  ]);
}

// ─────────────────────────────────────────────────────────────────────────────
// LINE 3: Semi-Slav — Meran Variation (D47)
// 1.d4 d5 2.c4 c6 3.Nc3 Nf6 4.Nf3 e6 5.e3 Nbd7 6.Bd3 dxc4 7.Bxc4 b5 8.Bd3 a6
// ─────────────────────────────────────────────────────────────────────────────
{
  const lid = await insertLine(QG_ID, {
    title: "Semi-Slav: Meran Variation (7...b5)",
    slug: "qg-semi-slav-meran",
    eco: "D47",
    pgn: "1. d4 d5 2. c4 c6 3. Nc3 Nf6 4. Nf3 e6 5. e3 Nbd7 6. Bd3 dxc4 7. Bxc4 b5 8. Bd3 a6 9. e4 c5 10. e5 cxd4",
    finalFen: "r1bqkb1r/3n1ppp/p3pn2/1p2P3/3p4/2NB1N2/PP3PPP/R1BQK2R w KQkq - 0 11",
    plyCnt: 19, color: "black", difficulty: "advanced",
    description: "The Meran Variation is one of the sharpest lines in the Semi-Slav. Black plays ...b5 and ...a6, launching queenside counterplay. The resulting positions are extremely complex and require precise knowledge of key ideas.",
    sortOrder: 5, isMustKnow: true, themes: "sharp,counterplay,queenside,complex",
  });
  await insertNodes(lid, [
    { ply:0, fen:"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", ann:"Starting position." },
    { ply:1, san:"d4", uci:"d2d4", fen:"rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq - 0 1", ann:"1.d4", eval:25 },
    { ply:2, san:"d5", uci:"d7d5", fen:"rnbqkbnr/ppp1pppp/8/3p4/3P4/8/PPP1PPPP/RNBQKBNR w KQkq - 0 2", ann:"1...d5", eval:20 },
    { ply:3, san:"c4", uci:"c2c4", fen:"rnbqkbnr/ppp1pppp/8/3p4/2PP4/8/PP2PPPP/RNBQKBNR b KQkq - 0 2", ann:"2.c4 — Queen's Gambit.", eval:25 },
    { ply:4, san:"c6", uci:"c7c6", fen:"rnbqkbnr/pp2pppp/2p5/3p4/2PP4/8/PP2PPPP/RNBQKBNR w KQkq - 0 3", ann:"2...c6 — Semi-Slav setup.", eval:20, nag:1 },
    { ply:5, san:"Nc3", uci:"b1c3", fen:"rnbqkbnr/pp2pppp/2p5/3p4/2PP4/2N5/PP2PPPP/R1BQKBNR b KQkq - 1 3", ann:"3.Nc3", eval:25 },
    { ply:6, san:"Nf6", uci:"g8f6", fen:"rnbqkb1r/pp2pppp/2p2n2/3p4/2PP4/2N5/PP2PPPP/R1BQKBNR w KQkq - 2 4", ann:"3...Nf6", eval:20 },
    { ply:7, san:"Nf3", uci:"g1f3", fen:"rnbqkb1r/pp2pppp/2p2n2/3p4/2PP4/2N2N2/PP2PPPP/R1BQKB1R b KQkq - 3 4", ann:"4.Nf3", eval:25 },
    { ply:8, san:"e6", uci:"e7e6", fen:"rnbqkb1r/pp3ppp/2p1pn2/3p4/2PP4/2N2N2/PP2PPPP/R1BQKB1R w KQkq - 0 5", ann:"4...e6 — Semi-Slav! Both c6 and e6 are played.", eval:20, nag:1 },
    { ply:9, san:"e3", uci:"e2e3", fen:"rnbqkb1r/pp3ppp/2p1pn2/3p4/2PP4/2N1PN2/PP3PPP/R1BQKB1R b KQkq - 0 5", ann:"5.e3 — Solid.", eval:25 },
    { ply:10, san:"Nbd7", uci:"b8d7", fen:"r1bqkb1r/pp1n1ppp/2p1pn2/3p4/2PP4/2N1PN2/PP3PPP/R1BQKB1R w KQkq - 1 6", ann:"5...Nbd7 — Development.", eval:20 },
    { ply:11, san:"Bd3", uci:"f1d3", fen:"r1bqkb1r/pp1n1ppp/2p1pn2/3p4/2PP4/2NBPN2/PP3PPP/R1BQK2R b KQkq - 2 6", ann:"6.Bd3 — Development.", eval:25 },
    { ply:12, san:"dxc4", uci:"d5c4", fen:"r1bqkb1r/pp1n1ppp/2p1pn2/8/2pP4/2NBPN2/PP3PPP/R1BQK2R w KQkq - 0 7", ann:"6...dxc4 — Black accepts the gambit.", eval:20 },
    { ply:13, san:"Bxc4", uci:"d3c4", fen:"r1bqkb1r/pp1n1ppp/2p1pn2/8/2BP4/2N1PN2/PP3PPP/R1BQK2R b KQkq - 0 7", ann:"7.Bxc4 — White recaptures.", eval:25 },
    { ply:14, san:"b5", uci:"b7b5", fen:"r1bqkb1r/p2n1ppp/2p1pn2/1p6/2BP4/2N1PN2/PP3PPP/R1BQK2R w KQkq - 0 8", ann:"7...b5! — Meran! Black attacks the bishop.", eval:20, nag:1 },
    { ply:15, san:"Bd3", uci:"c4d3", fen:"r1bqkb1r/p2n1ppp/2p1pn2/1p6/3P4/2NBPN2/PP3PPP/R1BQK2R b KQkq - 1 8", ann:"8.Bd3 — Retreating.", eval:25 },
    { ply:16, san:"a6", uci:"a7a6", fen:"r1bqkb1r/3n1ppp/p1p1pn2/1p6/3P4/2NBPN2/PP3PPP/R1BQK2R w KQkq - 0 9", ann:"8...a6 — Preparing ...c5.", eval:20 },
    { ply:17, san:"e4", uci:"e3e4", fen:"r1bqkb1r/3n1ppp/p1p1pn2/1p6/3PP3/2NB1N2/PP3PPP/R1BQK2R b KQkq - 0 9", ann:"9.e4 — White advances!", eval:25, nag:1 },
    { ply:18, san:"c5", uci:"c6c5", fen:"r1bqkb1r/3n1ppp/p3pn2/1pp5/3PP3/2NB1N2/PP3PPP/R1BQK2R w KQkq - 0 10", ann:"9...c5 — Black counterattacks!", eval:20, nag:1 },
    { ply:19, san:"e5", uci:"e4e5", fen:"r1bqkb1r/3n1ppp/p3pn2/1ppP4/3P4/2NB1N2/PP3PPP/R1BQK2R b KQkq - 0 10", ann:"10.e5 — White advances the pawn.", eval:25 },
    { ply:20, san:"cxd4", uci:"c5d4", fen:"r1bqkb1r/3n1ppp/p3pn2/1p2P3/3p4/2NB1N2/PP3PPP/R1BQK2R w KQkq - 0 11", ann:"10...cxd4 — The position is extremely sharp. This is the Meran at its most complex.", eval:20, nag:5 },
  ]);
}

// ─────────────────────────────────────────────────────────────────────────────
// LINE 4: Semi-Slav — Moscow Variation (D44)
// 1.d4 d5 2.c4 c6 3.Nc3 Nf6 4.Nf3 e6 5.Bg5 dxc4 6.e4 b5 7.e5 h6 8.Bh4 g5
// ─────────────────────────────────────────────────────────────────────────────
{
  const lid = await insertLine(QG_ID, {
    title: "Semi-Slav: Moscow/Anti-Moscow (5.Bg5)",
    slug: "qg-semi-slav-moscow",
    eco: "D44",
    pgn: "1. d4 d5 2. c4 c6 3. Nc3 Nf6 4. Nf3 e6 5. Bg5 dxc4 6. e4 b5 7. e5 h6 8. Bh4 g5 9. Nxg5 hxg5 10. Bxg5",
    finalFen: "rnbqkb1r/p4p2/2p1pn2/1p4B1/2pPP3/2N5/PP3PPP/R2QKB1R b KQkq - 0 10",
    plyCnt: 19, color: "black", difficulty: "advanced",
    description: "The Moscow Variation (5.Bg5) leads to the wildest positions in the Semi-Slav. After 5...dxc4 6.e4 b5, both sides launch attacks. The resulting positions require deep preparation and nerves of steel.",
    sortOrder: 6, isMustKnow: false, themes: "sharp,attack,complex,theory-heavy",
  });
  await insertNodes(lid, [
    { ply:0, fen:"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", ann:"Starting position." },
    { ply:1, san:"d4", uci:"d2d4", fen:"rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq - 0 1", ann:"1.d4", eval:25 },
    { ply:2, san:"d5", uci:"d7d5", fen:"rnbqkbnr/ppp1pppp/8/3p4/3P4/8/PPP1PPPP/RNBQKBNR w KQkq - 0 2", ann:"1...d5", eval:20 },
    { ply:3, san:"c4", uci:"c2c4", fen:"rnbqkbnr/ppp1pppp/8/3p4/2PP4/8/PP2PPPP/RNBQKBNR b KQkq - 0 2", ann:"2.c4", eval:25 },
    { ply:4, san:"c6", uci:"c7c6", fen:"rnbqkbnr/pp2pppp/2p5/3p4/2PP4/8/PP2PPPP/RNBQKBNR w KQkq - 0 3", ann:"2...c6 — Semi-Slav.", eval:20 },
    { ply:5, san:"Nc3", uci:"b1c3", fen:"rnbqkbnr/pp2pppp/2p5/3p4/2PP4/2N5/PP2PPPP/R1BQKBNR b KQkq - 1 3", ann:"3.Nc3", eval:25 },
    { ply:6, san:"Nf6", uci:"g8f6", fen:"rnbqkb1r/pp2pppp/2p2n2/3p4/2PP4/2N5/PP2PPPP/R1BQKBNR w KQkq - 2 4", ann:"3...Nf6", eval:20 },
    { ply:7, san:"Nf3", uci:"g1f3", fen:"rnbqkb1r/pp2pppp/2p2n2/3p4/2PP4/2N2N2/PP2PPPP/R1BQKB1R b KQkq - 3 4", ann:"4.Nf3", eval:25 },
    { ply:8, san:"e6", uci:"e7e6", fen:"rnbqkb1r/pp3ppp/2p1pn2/3p4/2PP4/2N2N2/PP2PPPP/R1BQKB1R w KQkq - 0 5", ann:"4...e6 — Semi-Slav.", eval:20 },
    { ply:9, san:"Bg5", uci:"c1g5", fen:"rnbqkb1r/pp3ppp/2p1pn2/3p2B1/2PP4/2N2N2/PP2PPPP/R2QKB1R b KQkq - 1 5", ann:"5.Bg5 — Moscow Variation! Pinning the knight.", eval:25, nag:1 },
    { ply:10, san:"dxc4", uci:"d5c4", fen:"rnbqkb1r/pp3ppp/2p1pn2/6B1/2pP4/2N2N2/PP2PPPP/R2QKB1R w KQkq - 0 6", ann:"5...dxc4 — Anti-Moscow! Black accepts the gambit.", eval:20, nag:1 },
    { ply:11, san:"e4", uci:"e2e4", fen:"rnbqkb1r/pp3ppp/2p1pn2/6B1/2pPP3/2N2N2/PP3PPP/R2QKB1R b KQkq - 0 6", ann:"6.e4 — White advances!", eval:25, nag:1 },
    { ply:12, san:"b5", uci:"b7b5", fen:"rnbqkb1r/p4ppp/2p1pn2/1p4B1/2pPP3/2N2N2/PP3PPP/R2QKB1R w KQkq - 0 7", ann:"6...b5 — Black holds the pawn!", eval:20, nag:1 },
    { ply:13, san:"e5", uci:"e4e5", fen:"rnbqkb1r/p4ppp/2p1pn2/1p2P1B1/2pP4/2N2N2/PP3PPP/R2QKB1R b KQkq - 0 7", ann:"7.e5 — White advances!", eval:25 },
    { ply:14, san:"h6", uci:"h7h6", fen:"rnbqkb1r/p4pp1/2p1pn1p/1p2P1B1/2pP4/2N2N2/PP3PPP/R2QKB1R w KQkq - 0 8", ann:"7...h6 — Attacking the bishop.", eval:20 },
    { ply:15, san:"Bh4", uci:"g5h4", fen:"rnbqkb1r/p4pp1/2p1pn1p/1p2P3/2pP3B/2N2N2/PP3PPP/R2QKB1R b KQkq - 1 8", ann:"8.Bh4 — Retreating.", eval:25 },
    { ply:16, san:"g5", uci:"g7g5", fen:"rnbqkb1r/p4p2/2p1pn1p/1p2P1p1/2pP3B/2N2N2/PP3PPP/R2QKB1R w KQkq - 0 9", ann:"8...g5! — Attacking the bishop again!", eval:20, nag:1 },
    { ply:17, san:"Nxg5", uci:"f3g5", fen:"rnbqkb1r/p4p2/2p1pn1p/1p2P1N1/2pP3B/2N5/PP3PPP/R2QKB1R b KQkq - 0 9", ann:"9.Nxg5! — Sacrifice!", eval:25, nag:1 },
    { ply:18, san:"hxg5", uci:"h6g5", fen:"rnbqkb1r/p4p2/2p1pn2/1p2P1p1/2pP3B/2N5/PP3PPP/R2QKB1R w KQkq - 0 10", ann:"9...hxg5 — Black captures.", eval:20 },
    { ply:19, san:"Bxg5", uci:"h4g5", fen:"rnbqkb1r/p4p2/2p1pn2/1p4B1/2pPP3/2N5/PP3PPP/R2QKB1R b KQkq - 0 10", ann:"10.Bxg5 — White recaptures. The position is extremely sharp — this is one of the most complex positions in all of chess theory!", eval:30, nag:5 },
  ]);
}

// ─────────────────────────────────────────────────────────────────────────────
// LINE 5: Catalan Opening — Open Catalan (E04)
// 1.d4 Nf6 2.c4 e6 3.g3 d5 4.Bg2 dxc4 5.Nf3 a6 6.O-O Nc6 7.Qc2 Bd7
// ─────────────────────────────────────────────────────────────────────────────
{
  const lid = await insertLine(QG_ID, {
    title: "Catalan Opening: Open Catalan (4...dxc4)",
    slug: "qg-catalan-open",
    eco: "E04",
    pgn: "1. d4 Nf6 2. c4 e6 3. g3 d5 4. Bg2 dxc4 5. Nf3 a6 6. O-O Nc6 7. Qc2 Bd7 8. Qxc4 b5 9. Qd3",
    finalFen: "r2qkb1r/1bpp1ppp/p1n1pn2/1p6/3P4/3Q1NP1/PP2PPBP/RNB2RK1 b kq - 2 9",
    plyCnt: 17, color: "white", difficulty: "intermediate",
    description: "The Open Catalan arises when Black accepts the gambit pawn with ...dxc4. White gets the c-file and the powerful g2 bishop for compensation. One of the most sophisticated openings at the top level.",
    sortOrder: 7, isMustKnow: true, themes: "fianchetto,bishop-pair,open-file,positional",
  });
  await insertNodes(lid, [
    { ply:0, fen:"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", ann:"Starting position." },
    { ply:1, san:"d4", uci:"d2d4", fen:"rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq - 0 1", ann:"1.d4", eval:25 },
    { ply:2, san:"Nf6", uci:"g8f6", fen:"rnbqkb1r/pppppppp/5n2/8/3P4/8/PPP1PPPP/RNBQKBNR w KQkq - 1 2", ann:"1...Nf6 — Development.", eval:20 },
    { ply:3, san:"c4", uci:"c2c4", fen:"rnbqkb1r/pppppppp/5n2/8/2PP4/8/PP2PPPP/RNBQKBNR b KQkq - 0 2", ann:"2.c4", eval:25 },
    { ply:4, san:"e6", uci:"e7e6", fen:"rnbqkb1r/pppp1ppp/4pn2/8/2PP4/8/PP2PPPP/RNBQKBNR w KQkq - 0 3", ann:"2...e6", eval:20 },
    { ply:5, san:"g3", uci:"g2g3", fen:"rnbqkb1r/pppp1ppp/4pn2/8/2PP4/6P1/PP2PP1P/RNBQKBNR b KQkq - 0 3", ann:"3.g3 — Catalan! White fianchettoes the bishop.", eval:25, nag:1 },
    { ply:6, san:"d5", uci:"d7d5", fen:"rnbqkb1r/ppp2ppp/4pn2/3p4/2PP4/6P1/PP2PP1P/RNBQKBNR w KQkq - 0 4", ann:"3...d5 — Challenging the center.", eval:20 },
    { ply:7, san:"Bg2", uci:"f1g2", fen:"rnbqkb1r/ppp2ppp/4pn2/3p4/2PP4/6P1/PP2PPBP/RNBQK1NR b KQkq - 1 4", ann:"4.Bg2 — Completing the fianchetto.", eval:25 },
    { ply:8, san:"dxc4", uci:"d5c4", fen:"rnbqkb1r/ppp2ppp/4pn2/8/2pP4/6P1/PP2PPBP/RNBQK1NR w KQkq - 0 5", ann:"4...dxc4 — Open Catalan! Black accepts the pawn.", eval:20, nag:1 },
    { ply:9, san:"Nf3", uci:"g1f3", fen:"rnbqkb1r/ppp2ppp/4pn2/8/2pP4/5NP1/PP2PPBP/RNBQK2R b KQkq - 1 5", ann:"5.Nf3 — Development.", eval:25 },
    { ply:10, san:"a6", uci:"a7a6", fen:"rnbqkb1r/1pp2ppp/p3pn2/8/2pP4/5NP1/PP2PPBP/RNBQK2R w KQkq - 0 6", ann:"5...a6 — Preventing Nb5.", eval:20 },
    { ply:11, san:"O-O", uci:"e1g1", fen:"rnbqkb1r/1pp2ppp/p3pn2/8/2pP4/5NP1/PP2PPBP/RNBQ1RK1 b kq - 1 6", ann:"6.O-O — White castles.", eval:25 },
    { ply:12, san:"Nc6", uci:"b8c6", fen:"r1bqkb1r/1pp2ppp/p1n1pn2/8/2pP4/5NP1/PP2PPBP/RNBQ1RK1 w kq - 2 7", ann:"6...Nc6 — Development.", eval:20 },
    { ply:13, san:"Qc2", uci:"d1c2", fen:"r1bqkb1r/1pp2ppp/p1n1pn2/8/2pP4/5NP1/PPQ1PPBP/RNB2RK1 b kq - 3 7", ann:"7.Qc2 — Preparing to win back the pawn.", eval:25 },
    { ply:14, san:"Bd7", uci:"c8d7", fen:"r2qkb1r/1ppb1ppp/p1n1pn2/8/2pP4/5NP1/PPQ1PPBP/RNB2RK1 w kq - 4 8", ann:"7...Bd7 — Development.", eval:20 },
    { ply:15, san:"Qxc4", uci:"c2c4", fen:"r2qkb1r/1ppb1ppp/p1n1pn2/8/2QP4/5NP1/PP2PPBP/RNB2RK1 b kq - 0 8", ann:"8.Qxc4 — White wins back the pawn.", eval:25 },
    { ply:16, san:"b5", uci:"b7b5", fen:"r2qkb1r/2pb1ppp/p1n1pn2/1p6/2QP4/5NP1/PP2PPBP/RNB2RK1 w kq - 0 9", ann:"8...b5 — Attacking the queen.", eval:20 },
    { ply:17, san:"Qd3", uci:"c4d3", fen:"r2qkb1r/2pb1ppp/p1n1pn2/1p6/3P4/3Q1NP1/PP2PPBP/RNB2RK1 b kq - 1 9", ann:"9.Qd3 — Retreating. White has the powerful Catalan bishop and excellent long-term compensation.", eval:25 },
  ]);
}

// ─────────────────────────────────────────────────────────────────────────────
// LINE 6: Catalan Opening — Closed Catalan (E06)
// 1.d4 Nf6 2.c4 e6 3.g3 d5 4.Bg2 Be7 5.Nf3 O-O 6.O-O dxc4 7.Qc2 a6 8.Qxc4 b5
// ─────────────────────────────────────────────────────────────────────────────
{
  const lid = await insertLine(QG_ID, {
    title: "Catalan Opening: Closed Catalan (4...Be7)",
    slug: "qg-catalan-closed",
    eco: "E06",
    pgn: "1. d4 Nf6 2. c4 e6 3. g3 d5 4. Bg2 Be7 5. Nf3 O-O 6. O-O dxc4 7. Qc2 a6 8. Qxc4 b5 9. Qd3 Bb7 10. Nbd2",
    finalFen: "rn1q1rk1/1bpp1ppp/p3pn2/1p6/3P4/3Q1NP1/PP1NPPBP/R1B2RK1 b - - 2 10",
    plyCnt: 19, color: "white", difficulty: "intermediate",
    description: "The Closed Catalan is the most popular version. Black develops solidly with ...Be7 and ...O-O before deciding whether to accept the gambit. The resulting positions are rich in strategic content.",
    sortOrder: 8, isMustKnow: false, themes: "fianchetto,strategic,solid,long-term",
  });
  await insertNodes(lid, [
    { ply:0, fen:"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", ann:"Starting position." },
    { ply:1, san:"d4", uci:"d2d4", fen:"rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq - 0 1", ann:"1.d4", eval:25 },
    { ply:2, san:"Nf6", uci:"g8f6", fen:"rnbqkb1r/pppppppp/5n2/8/3P4/8/PPP1PPPP/RNBQKBNR w KQkq - 1 2", ann:"1...Nf6", eval:20 },
    { ply:3, san:"c4", uci:"c2c4", fen:"rnbqkb1r/pppppppp/5n2/8/2PP4/8/PP2PPPP/RNBQKBNR b KQkq - 0 2", ann:"2.c4", eval:25 },
    { ply:4, san:"e6", uci:"e7e6", fen:"rnbqkb1r/pppp1ppp/4pn2/8/2PP4/8/PP2PPPP/RNBQKBNR w KQkq - 0 3", ann:"2...e6", eval:20 },
    { ply:5, san:"g3", uci:"g2g3", fen:"rnbqkb1r/pppp1ppp/4pn2/8/2PP4/6P1/PP2PP1P/RNBQKBNR b KQkq - 0 3", ann:"3.g3 — Catalan!", eval:25 },
    { ply:6, san:"d5", uci:"d7d5", fen:"rnbqkb1r/ppp2ppp/4pn2/3p4/2PP4/6P1/PP2PP1P/RNBQKBNR w KQkq - 0 4", ann:"3...d5", eval:20 },
    { ply:7, san:"Bg2", uci:"f1g2", fen:"rnbqkb1r/ppp2ppp/4pn2/3p4/2PP4/6P1/PP2PPBP/RNBQK1NR b KQkq - 1 4", ann:"4.Bg2", eval:25 },
    { ply:8, san:"Be7", uci:"f8e7", fen:"rnbqk2r/ppp1bppp/4pn2/3p4/2PP4/6P1/PP2PPBP/RNBQK1NR w KQkq - 2 5", ann:"4...Be7 — Closed Catalan! Solid development.", eval:20, nag:1 },
    { ply:9, san:"Nf3", uci:"g1f3", fen:"rnbqk2r/ppp1bppp/4pn2/3p4/2PP4/5NP1/PP2PPBP/RNBQK2R b KQkq - 3 5", ann:"5.Nf3", eval:25 },
    { ply:10, san:"O-O", uci:"e8g8", fen:"rnbq1rk1/ppp1bppp/4pn2/3p4/2PP4/5NP1/PP2PPBP/RNBQK2R w KQ - 4 6", ann:"5...O-O — Black castles.", eval:20 },
    { ply:11, san:"O-O", uci:"e1g1", fen:"rnbq1rk1/ppp1bppp/4pn2/3p4/2PP4/5NP1/PP2PPBP/RNBQ1RK1 b - - 5 6", ann:"6.O-O — White castles.", eval:25 },
    { ply:12, san:"dxc4", uci:"d5c4", fen:"rnbq1rk1/ppp1bppp/4pn2/8/2pP4/5NP1/PP2PPBP/RNBQ1RK1 w - - 0 7", ann:"6...dxc4 — Black accepts the pawn.", eval:20 },
    { ply:13, san:"Qc2", uci:"d1c2", fen:"rnbq1rk1/ppp1bppp/4pn2/8/2pP4/5NP1/PPQ1PPBP/RNB2RK1 b - - 1 7", ann:"7.Qc2 — Preparing to win back the pawn.", eval:25 },
    { ply:14, san:"a6", uci:"a7a6", fen:"rnbq1rk1/1pp1bppp/p3pn2/8/2pP4/5NP1/PPQ1PPBP/RNB2RK1 w - - 0 8", ann:"7...a6 — Preventing Nb5.", eval:20 },
    { ply:15, san:"Qxc4", uci:"c2c4", fen:"rnbq1rk1/1pp1bppp/p3pn2/8/2QP4/5NP1/PP2PPBP/RNB2RK1 b - - 0 8", ann:"8.Qxc4 — Winning back the pawn.", eval:25 },
    { ply:16, san:"b5", uci:"b7b5", fen:"rnbq1rk1/2p1bppp/p3pn2/1p6/2QP4/5NP1/PP2PPBP/RNB2RK1 w - - 0 9", ann:"8...b5 — Attacking the queen.", eval:20 },
    { ply:17, san:"Qd3", uci:"c4d3", fen:"rnbq1rk1/2p1bppp/p3pn2/1p6/3P4/3Q1NP1/PP2PPBP/RNB2RK1 b - - 1 9", ann:"9.Qd3 — Retreating.", eval:25 },
    { ply:18, san:"Bb7", uci:"c8b7", fen:"rn1q1rk1/1bpp1ppp/p3pn2/1p6/3P4/3Q1NP1/PP2PPBP/RNB2RK1 w - - 2 10", ann:"9...Bb7 — Developing the bishop.", eval:20 },
    { ply:19, san:"Nbd2", uci:"b1d2", fen:"rn1q1rk1/1bpp1ppp/p3pn2/1p6/3P4/3Q1NP1/PP1NPPBP/R1B2RK1 b - - 3 10", ann:"10.Nbd2 — Development. White has the powerful Catalan bishop and a solid position.", eval:25 },
  ]);
}

// ═════════════════════════════════════════════════════════════════════════════
// QUEEN'S GAMBIT DECLINED — ADDITIONAL LINES
// ═════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────
// LINE 7: QGD Exchange Variation (D35)
// 1.d4 d5 2.c4 e6 3.Nc3 Nf6 4.cxd5 exd5 5.Bg5 Be7 6.e3 O-O 7.Bd3 Nbd7
// ─────────────────────────────────────────────────────────────────────────────
{
  const lid = await insertLine(QGD_ID, {
    title: "QGD Exchange Variation: 4.cxd5",
    slug: "qgd-exchange-variation",
    eco: "D35",
    pgn: "1. d4 d5 2. c4 e6 3. Nc3 Nf6 4. cxd5 exd5 5. Bg5 Be7 6. e3 O-O 7. Bd3 Nbd7 8. Qc2 Re8 9. Nge2",
    finalFen: "r1bqr1k1/pppnbppp/5n2/3p2B1/3P4/2NBP3/PPQ1NPPP/R3K2R b KQ - 4 9",
    plyCnt: 17, color: "white", difficulty: "intermediate",
    description: "The Exchange Variation of the QGD is a positional weapon. White trades on d5 to create a symmetrical pawn structure, then aims to exploit the minority attack on the queenside. Used extensively by Karpov.",
    sortOrder: 2, isMustKnow: false, themes: "minority-attack,positional,endgame,pawn-structure",
  });
  await insertNodes(lid, [
    { ply:0, fen:"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", ann:"Starting position." },
    { ply:1, san:"d4", uci:"d2d4", fen:"rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq - 0 1", ann:"1.d4", eval:25 },
    { ply:2, san:"d5", uci:"d7d5", fen:"rnbqkbnr/ppp1pppp/8/3p4/3P4/8/PPP1PPPP/RNBQKBNR w KQkq - 0 2", ann:"1...d5", eval:20 },
    { ply:3, san:"c4", uci:"c2c4", fen:"rnbqkbnr/ppp1pppp/8/3p4/2PP4/8/PP2PPPP/RNBQKBNR b KQkq - 0 2", ann:"2.c4", eval:25 },
    { ply:4, san:"e6", uci:"e7e6", fen:"rnbqkbnr/ppp2ppp/4p3/3p4/2PP4/8/PP2PPPP/RNBQKBNR w KQkq - 0 3", ann:"2...e6 — QGD.", eval:20 },
    { ply:5, san:"Nc3", uci:"b1c3", fen:"rnbqkbnr/ppp2ppp/4p3/3p4/2PP4/2N5/PP2PPPP/R1BQKBNR b KQkq - 1 3", ann:"3.Nc3", eval:25 },
    { ply:6, san:"Nf6", uci:"g8f6", fen:"rnbqkb1r/ppp2ppp/4pn2/3p4/2PP4/2N5/PP2PPPP/R1BQKBNR w KQkq - 2 4", ann:"3...Nf6", eval:20 },
    { ply:7, san:"cxd5", uci:"c4d5", fen:"rnbqkb1r/ppp2ppp/4pn2/3P4/3P4/2N5/PP2PPPP/R1BQKBNR b KQkq - 0 4", ann:"4.cxd5 — Exchange Variation!", eval:25, nag:1 },
    { ply:8, san:"exd5", uci:"e6d5", fen:"rnbqkb1r/ppp2ppp/5n2/3p4/3P4/2N5/PP2PPPP/R1BQKBNR w KQkq - 0 5", ann:"4...exd5 — Symmetric pawn structure.", eval:20 },
    { ply:9, san:"Bg5", uci:"c1g5", fen:"rnbqkb1r/ppp2ppp/5n2/3p2B1/3P4/2N5/PP2PPPP/R2QKBNR b KQkq - 1 5", ann:"5.Bg5 — Pinning the knight.", eval:25 },
    { ply:10, san:"Be7", uci:"f8e7", fen:"rnbqk2r/ppp1bppp/5n2/3p2B1/3P4/2N5/PP2PPPP/R2QKBNR w KQkq - 2 6", ann:"5...Be7 — Unpinning.", eval:20 },
    { ply:11, san:"e3", uci:"e2e3", fen:"rnbqk2r/ppp1bppp/5n2/3p2B1/3P4/2N1P3/PP3PPP/R2QKBNR b KQkq - 0 6", ann:"6.e3 — Solid.", eval:25 },
    { ply:12, san:"O-O", uci:"e8g8", fen:"rnbq1rk1/ppp1bppp/5n2/3p2B1/3P4/2N1P3/PP3PPP/R2QKBNR w KQ - 1 7", ann:"6...O-O — Black castles.", eval:20 },
    { ply:13, san:"Bd3", uci:"f1d3", fen:"rnbq1rk1/ppp1bppp/5n2/3p2B1/3P4/2NBP3/PP3PPP/R2QK1NR b KQ - 2 7", ann:"7.Bd3 — Development.", eval:25 },
    { ply:14, san:"Nbd7", uci:"b8d7", fen:"r1bq1rk1/pppnbppp/5n2/3p2B1/3P4/2NBP3/PP3PPP/R2QK1NR w KQ - 3 8", ann:"7...Nbd7 — Development.", eval:20 },
    { ply:15, san:"Qc2", uci:"d1c2", fen:"r1bq1rk1/pppnbppp/5n2/3p2B1/3P4/2NBP3/PPQ2PPP/R3K1NR b KQ - 4 8", ann:"8.Qc2 — Preparing to castle queenside.", eval:25 },
    { ply:16, san:"Re8", uci:"f8e8", fen:"r1bqr1k1/pppnbppp/5n2/3p2B1/3P4/2NBP3/PPQ2PPP/R3K1NR w KQ - 5 9", ann:"8...Re8 — Centralizing the rook.", eval:20 },
    { ply:17, san:"Nge2", uci:"g1e2", fen:"r1bqr1k1/pppnbppp/5n2/3p2B1/3P4/2NBP3/PPQ1NPPP/R3K2R b KQ - 6 9", ann:"9.Nge2 — Development. White will play minority attack with b4-b5. The Exchange Variation is a classic strategic weapon.", eval:25 },
  ]);
}

// ─────────────────────────────────────────────────────────────────────────────
// LINE 8: QGD Vienna Variation (D39)
// 1.d4 d5 2.c4 e6 3.Nc3 Nf6 4.Nf3 dxc4 5.e4 Bb4 6.Bg5 c5 7.Bxc4 cxd4 8.Nxd4
// ─────────────────────────────────────────────────────────────────────────────
{
  const lid = await insertLine(QGD_ID, {
    title: "QGD Vienna Variation: 4...dxc4 5.e4",
    slug: "qgd-vienna-variation",
    eco: "D39",
    pgn: "1. d4 d5 2. c4 e6 3. Nc3 Nf6 4. Nf3 dxc4 5. e4 Bb4 6. Bg5 c5 7. Bxc4 cxd4 8. Nxd4 Bxc3+ 9. bxc3 Qa5",
    finalFen: "rnb1k2r/pp3ppp/4pn2/q5B1/2BNP3/2P5/P4PPP/R2QK2R w KQkq - 2 10",
    plyCnt: 17, color: "black", difficulty: "advanced",
    description: "The Vienna Variation is a sharp and dynamic line. Black accepts the gambit and develops the bishop to b4, creating immediate tension. The resulting positions are rich in tactical possibilities.",
    sortOrder: 3, isMustKnow: false, themes: "sharp,tactical,dynamic,bishop-pair",
  });
  await insertNodes(lid, [
    { ply:0, fen:"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", ann:"Starting position." },
    { ply:1, san:"d4", uci:"d2d4", fen:"rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq - 0 1", ann:"1.d4", eval:25 },
    { ply:2, san:"d5", uci:"d7d5", fen:"rnbqkbnr/ppp1pppp/8/3p4/3P4/8/PPP1PPPP/RNBQKBNR w KQkq - 0 2", ann:"1...d5", eval:20 },
    { ply:3, san:"c4", uci:"c2c4", fen:"rnbqkbnr/ppp1pppp/8/3p4/2PP4/8/PP2PPPP/RNBQKBNR b KQkq - 0 2", ann:"2.c4", eval:25 },
    { ply:4, san:"e6", uci:"e7e6", fen:"rnbqkbnr/ppp2ppp/4p3/3p4/2PP4/8/PP2PPPP/RNBQKBNR w KQkq - 0 3", ann:"2...e6", eval:20 },
    { ply:5, san:"Nc3", uci:"b1c3", fen:"rnbqkbnr/ppp2ppp/4p3/3p4/2PP4/2N5/PP2PPPP/R1BQKBNR b KQkq - 1 3", ann:"3.Nc3", eval:25 },
    { ply:6, san:"Nf6", uci:"g8f6", fen:"rnbqkb1r/ppp2ppp/4pn2/3p4/2PP4/2N5/PP2PPPP/R1BQKBNR w KQkq - 2 4", ann:"3...Nf6", eval:20 },
    { ply:7, san:"Nf3", uci:"g1f3", fen:"rnbqkb1r/ppp2ppp/4pn2/3p4/2PP4/2N2N2/PP2PPPP/R1BQKB1R b KQkq - 3 4", ann:"4.Nf3", eval:25 },
    { ply:8, san:"dxc4", uci:"d5c4", fen:"rnbqkb1r/ppp2ppp/4pn2/8/2pP4/2N2N2/PP2PPPP/R1BQKB1R w KQkq - 0 5", ann:"4...dxc4 — Vienna! Black accepts the gambit.", eval:20, nag:1 },
    { ply:9, san:"e4", uci:"e2e4", fen:"rnbqkb1r/ppp2ppp/4pn2/8/2pPP3/2N2N2/PP3PPP/R1BQKB1R b KQkq - 0 5", ann:"5.e4 — White advances!", eval:25, nag:1 },
    { ply:10, san:"Bb4", uci:"f8b4", fen:"rnbqk2r/ppp2ppp/4pn2/8/1bpPP3/2N2N2/PP3PPP/R1BQKB1R w KQkq - 1 6", ann:"5...Bb4 — Pinning the knight!", eval:20, nag:1 },
    { ply:11, san:"Bg5", uci:"c1g5", fen:"rnbqk2r/ppp2ppp/4pn2/6B1/1bpPP3/2N2N2/PP3PPP/R2QKB1R b KQkq - 2 6", ann:"6.Bg5 — Pinning the knight!", eval:25 },
    { ply:12, san:"c5", uci:"c7c5", fen:"rnbqk2r/pp3ppp/4pn2/2p3B1/1bpPP3/2N2N2/PP3PPP/R2QKB1R w KQkq - 0 7", ann:"6...c5 — Counterattacking!", eval:20, nag:1 },
    { ply:13, san:"Bxc4", uci:"f1c4", fen:"rnbqk2r/pp3ppp/4pn2/2p3B1/1bBPP3/2N2N2/PP3PPP/R2QK2R b KQkq - 0 7", ann:"7.Bxc4 — White wins back the pawn.", eval:25 },
    { ply:14, san:"cxd4", uci:"c5d4", fen:"rnbqk2r/pp3ppp/4pn2/6B1/1bBpP3/2N2N2/PP3PPP/R2QK2R w KQkq - 0 8", ann:"7...cxd4 — Black captures.", eval:20 },
    { ply:15, san:"Nxd4", uci:"f3d4", fen:"rnbqk2r/pp3ppp/4pn2/6B1/1bBNP3/2N5/PP3PPP/R2QK2R b KQkq - 0 8", ann:"8.Nxd4 — White recaptures.", eval:25 },
    { ply:16, san:"Bxc3+", uci:"b4c3", fen:"rnbqk2r/pp3ppp/4pn2/6B1/2BNP3/2b5/PP3PPP/R2QK2R w KQkq - 0 9", ann:"8...Bxc3+ — Check!", eval:20, nag:1 },
    { ply:17, san:"bxc3", uci:"b2c3", fen:"rnbqk2r/pp3ppp/4pn2/6B1/2BNP3/2P5/P4PPP/R2QK2R b KQkq - 0 9", ann:"9.bxc3 — White recaptures.", eval:25 },
    { ply:18, san:"Qa5", uci:"d8a5", fen:"rnb1k2r/pp3ppp/4pn2/q5B1/2BNP3/2P5/P4PPP/R2QK2R w KQkq - 1 10", ann:"9...Qa5 — Attacking c3! The position is dynamically balanced with both sides having active pieces.", eval:20, nag:1 },
  ]);
}

console.log(`\nQueen's Gambit expansion seeded:`);
console.log(`  Lines inserted: ${linesInserted}`);
console.log(`  Nodes inserted: ${nodesInserted}`);

// Final state
const [qgLines] = await conn.execute(
  `SELECT l.title, l.eco, COUNT(n.id) as nodes
   FROM opening_lines l
   LEFT JOIN line_nodes n ON n.line_id = l.id
   WHERE l.opening_id = ? AND l.is_published = 1
   GROUP BY l.id, l.title, l.eco
   ORDER BY l.sort_order`,
  [QG_ID]
);
console.log(`\nQueen's Gambit — all lines:`);
qgLines.forEach(r => console.log(`  [${r.eco}] "${r.title}" — ${r.nodes} nodes`));

const [qgdLines] = await conn.execute(
  `SELECT l.title, l.eco, COUNT(n.id) as nodes
   FROM opening_lines l
   LEFT JOIN line_nodes n ON n.line_id = l.id
   WHERE l.opening_id = ? AND l.is_published = 1
   GROUP BY l.id, l.title, l.eco
   ORDER BY l.sort_order`,
  [QGD_ID]
);
console.log(`\nQueen's Gambit Declined — all lines:`);
qgdLines.forEach(r => console.log(`  [${r.eco}] "${r.title}" — ${r.nodes} nodes`));

await conn.end();
console.log("\nDone.");
