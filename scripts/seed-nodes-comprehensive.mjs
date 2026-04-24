/**
 * seed-nodes-comprehensive.mjs
 *
 * Inserts move nodes for all 37 opening lines that are currently missing them.
 * Each node has: ply, moveSan, moveUci, fen, isMainLine, annotation, nag, eval.
 * Uses INSERT IGNORE — safe to re-run.
 *
 * Usage: node scripts/seed-nodes-comprehensive.mjs
 */
import mysql from "mysql2/promise";
import { randomUUID } from "crypto";

const nanoid = () => randomUUID().replace(/-/g, "").slice(0, 20);
const conn = await mysql.createConnection(process.env.DATABASE_URL);

let inserted = 0;

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
    inserted++;
    if (n.ply === 0 || n.isMain !== false) prevNodeId = nodeId;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ANTI-LONDON SYSTEM
// ─────────────────────────────────────────────────────────────────────────────

// IoaM-20tGSpsdGVc — Main Idea: ...c5 Challenge
// 1. d4 d5 2. Bf4 c5 3. e3 Nc6 4. c3 Nf6 5. Nd2 e6 6. Ngf3 Bd6
await insertNodes("IoaM-20tGSpsdGVc", [
  { ply:0, fen:"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", ann:"Starting position." },
  { ply:1, san:"d4", uci:"d2d4", fen:"rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq - 0 1", ann:"1.d4 — White opens with the Queen's Pawn.", eval:25 },
  { ply:2, san:"d5", uci:"d7d5", fen:"rnbqkbnr/ppp1pppp/8/3p4/3P4/8/PPP1PPPP/RNBQKBNR w KQkq - 0 2", ann:"1...d5 — Black stakes a claim in the center.", eval:20 },
  { ply:3, san:"Bf4", uci:"c1f4", fen:"rnbqkbnr/ppp1pppp/8/3p4/3P1B2/8/PPP1PPPP/RN1QKBNR b KQkq - 1 2", ann:"2.Bf4 — The London System. White develops the bishop outside the pawn chain early.", eval:25 },
  { ply:4, san:"c5", uci:"c7c5", fen:"rnbqkbnr/pp2pppp/8/2pp4/3P1B2/8/PPP1PPPP/RN1QKBNR w KQkq - 0 3", ann:"2...c5 — The Anti-London! Black immediately challenges the center, aiming to unbalance the position.", eval:15, nag:1 },
  { ply:5, san:"e3", uci:"e2e3", fen:"rnbqkbnr/pp2pppp/8/2pp4/3P1B2/4P3/PPP2PPP/RN1QKBNR b KQkq - 0 3", ann:"3.e3 — Solid. White supports d4 and prepares to develop the kingside.", eval:20 },
  { ply:6, san:"Nc6", uci:"b8c6", fen:"r1bqkbnr/pp2pppp/2n5/2pp4/3P1B2/4P3/PPP2PPP/RN1QKBNR w KQkq - 1 4", ann:"3...Nc6 — Developing with tempo, putting pressure on d4.", eval:15 },
  { ply:7, san:"c3", uci:"c2c3", fen:"r1bqkbnr/pp2pppp/2n5/2pp4/3P1B2/2P1P3/PP3PPP/RN1QKBNR b KQkq - 0 4", ann:"4.c3 — Defending d4. White keeps the pawn structure solid.", eval:20 },
  { ply:8, san:"Nf6", uci:"g8f6", fen:"r1bqkb1r/pp2pppp/2n2n2/2pp4/3P1B2/2P1P3/PP3PPP/RN1QKBNR w KQkq - 1 5", ann:"4...Nf6 — Developing the knight, attacking e4 if White plays it.", eval:15 },
  { ply:9, san:"Nd2", uci:"b1d2", fen:"r1bqkb1r/pp2pppp/2n2n2/2pp4/3P1B2/2P1P3/PP1N1PPP/R2QKBNR b KQkq - 2 5", ann:"5.Nd2 — Flexible development. The knight supports e4 and c4 breaks.", eval:20 },
  { ply:10, san:"e6", uci:"e7e6", fen:"r1bqkb1r/pp3ppp/2n1pn2/2pp4/3P1B2/2P1P3/PP1N1PPP/R2QKBNR w KQkq - 0 6", ann:"5...e6 — Solid. Black prepares ...Bd6 to challenge the bishop.", eval:15 },
  { ply:11, san:"Ngf3", uci:"g1f3", fen:"r1bqkb1r/pp3ppp/2n1pn2/2pp4/3P1B2/2P1PN2/PP1N1PPP/R2QKB1R b KQkq - 1 6", ann:"6.Ngf3 — Completing development. White has a solid London setup.", eval:20 },
  { ply:12, san:"Bd6", uci:"f8d6", fen:"r1bqk2r/pp3ppp/2nbpn2/2pp4/3P1B2/2P1PN2/PP1N1PPP/R2QKB1R w KQkq - 2 7", ann:"6...Bd6 — Challenging the London bishop. Black has a dynamic, active position with good counterplay against d4.", eval:15, nag:1 },
]);

// -Dhy5CYS1drXjuJa — Bishop Exchange: ...Bd6 Plan
// 1. d4 d5 2. Bf4 c5 3. e3 Nc6 4. Nf3 Nf6 5. c3 e6 6. Bd3 Bd6 7. Bxd6 Qxd6 8. O-O O-O
await insertNodes("-Dhy5CYS1drXjuJa", [
  { ply:0, fen:"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", ann:"Starting position." },
  { ply:1, san:"d4", uci:"d2d4", fen:"rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq - 0 1", ann:"1.d4", eval:25 },
  { ply:2, san:"d5", uci:"d7d5", fen:"rnbqkbnr/ppp1pppp/8/3p4/3P4/8/PPP1PPPP/RNBQKBNR w KQkq - 0 2", ann:"1...d5", eval:20 },
  { ply:3, san:"Bf4", uci:"c1f4", fen:"rnbqkbnr/ppp1pppp/8/3p4/3P1B2/8/PPP1PPPP/RN1QKBNR b KQkq - 1 2", ann:"2.Bf4 — The London System.", eval:25 },
  { ply:4, san:"c5", uci:"c7c5", fen:"rnbqkbnr/pp2pppp/8/2pp4/3P1B2/8/PPP1PPPP/RN1QKBNR w KQkq - 0 3", ann:"2...c5 — Anti-London! Immediate central challenge.", eval:15, nag:1 },
  { ply:5, san:"e3", uci:"e2e3", fen:"rnbqkbnr/pp2pppp/8/2pp4/3P1B2/4P3/PPP2PPP/RN1QKBNR b KQkq - 0 3", ann:"3.e3 — Solid support for d4.", eval:20 },
  { ply:6, san:"Nc6", uci:"b8c6", fen:"r1bqkbnr/pp2pppp/2n5/2pp4/3P1B2/4P3/PPP2PPP/RN1QKBNR w KQkq - 1 4", ann:"3...Nc6 — Development with pressure on d4.", eval:15 },
  { ply:7, san:"Nf3", uci:"g1f3", fen:"r1bqkbnr/pp2pppp/2n5/2pp4/3P1B2/4PN2/PPP2PPP/RN1QKB1R b KQkq - 2 4", ann:"4.Nf3 — Developing the knight.", eval:20 },
  { ply:8, san:"Nf6", uci:"g8f6", fen:"r1bqkb1r/pp2pppp/2n2n2/2pp4/3P1B2/4PN2/PPP2PPP/RN1QKB1R w KQkq - 3 5", ann:"4...Nf6 — Rapid development.", eval:15 },
  { ply:9, san:"c3", uci:"c2c3", fen:"r1bqkb1r/pp2pppp/2n2n2/2pp4/3P1B2/2P1PN2/PP3PPP/RN1QKB1R b KQkq - 0 5", ann:"5.c3 — Solidifying d4.", eval:20 },
  { ply:10, san:"e6", uci:"e7e6", fen:"r1bqkb1r/pp3ppp/2n1pn2/2pp4/3P1B2/2P1PN2/PP3PPP/RN1QKB1R w KQkq - 0 6", ann:"5...e6 — Preparing ...Bd6.", eval:15 },
  { ply:11, san:"Bd3", uci:"f1d3", fen:"r1bqkb1r/pp3ppp/2n1pn2/2pp4/3P1B2/2PBPN2/PP3PPP/RN1QK2R b KQkq - 1 6", ann:"6.Bd3 — White develops the bishop, inviting the exchange.", eval:20 },
  { ply:12, san:"Bd6", uci:"f8d6", fen:"r1bqk2r/pp3ppp/2nbpn2/2pp4/3P1B2/2PBPN2/PP3PPP/RN1QK2R w KQkq - 2 7", ann:"6...Bd6 — Challenging the bishop. Black wants to simplify and equalize.", eval:15 },
  { ply:13, san:"Bxd6", uci:"f4d6", fen:"r1bqk2r/pp3ppp/2nBpn2/2pp4/3P4/2PBPN2/PP3PPP/RN1QK2R b KQkq - 0 7", ann:"7.Bxd6 — White trades the bishop. This relieves tension but gives Black the bishop pair.", eval:20 },
  { ply:14, san:"Qxd6", uci:"d8d6", fen:"r1b1k2r/pp3ppp/2nqpn2/2pp4/3P4/2PBPN2/PP3PPP/RN1QK2R w KQkq - 0 8", ann:"7...Qxd6 — Black recaptures with the queen, centralizing it immediately.", eval:15, nag:1 },
  { ply:15, san:"O-O", uci:"e1g1", fen:"r1b1k2r/pp3ppp/2nqpn2/2pp4/3P4/2PBPN2/PP3PPP/RN1Q1RK1 b kq - 1 8", ann:"8.O-O — White castles safely.", eval:20 },
  { ply:16, san:"O-O", uci:"e8g8", fen:"r1b2rk1/pp3ppp/2nqpn2/2pp4/3P4/2PBPN2/PP3PPP/RN1Q1RK1 w - - 2 9", ann:"8...O-O — Both sides have castled. Black has a solid position with the queen actively placed on d6.", eval:15 },
]);

// wDITSXhJ_eFP_lUH — ...Qb6 Pressure Line
// 1. d4 d5 2. Bf4 c5 3. e3 Nc6 4. Nf3 Qb6 5. Nc3 cxd4 6. exd4 Nf6 7. Be2 Bf5
await insertNodes("wDITSXhJ_eFP_lUH", [
  { ply:0, fen:"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", ann:"Starting position." },
  { ply:1, san:"d4", uci:"d2d4", fen:"rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq - 0 1", ann:"1.d4", eval:25 },
  { ply:2, san:"d5", uci:"d7d5", fen:"rnbqkbnr/ppp1pppp/8/3p4/3P4/8/PPP1PPPP/RNBQKBNR w KQkq - 0 2", ann:"1...d5", eval:20 },
  { ply:3, san:"Bf4", uci:"c1f4", fen:"rnbqkbnr/ppp1pppp/8/3p4/3P1B2/8/PPP1PPPP/RN1QKBNR b KQkq - 1 2", ann:"2.Bf4 — London System.", eval:25 },
  { ply:4, san:"c5", uci:"c7c5", fen:"rnbqkbnr/pp2pppp/8/2pp4/3P1B2/8/PPP1PPPP/RN1QKBNR w KQkq - 0 3", ann:"2...c5 — Anti-London challenge.", eval:15, nag:1 },
  { ply:5, san:"e3", uci:"e2e3", fen:"rnbqkbnr/pp2pppp/8/2pp4/3P1B2/4P3/PPP2PPP/RN1QKBNR b KQkq - 0 3", ann:"3.e3", eval:20 },
  { ply:6, san:"Nc6", uci:"b8c6", fen:"r1bqkbnr/pp2pppp/2n5/2pp4/3P1B2/4P3/PPP2PPP/RN1QKBNR w KQkq - 1 4", ann:"3...Nc6", eval:15 },
  { ply:7, san:"Nf3", uci:"g1f3", fen:"r1bqkbnr/pp2pppp/2n5/2pp4/3P1B2/4PN2/PPP2PPP/RN1QKB1R b KQkq - 2 4", ann:"4.Nf3", eval:20 },
  { ply:8, san:"Qb6", uci:"d8b6", fen:"r1b1kbnr/pp2pppp/1qn5/2pp4/3P1B2/4PN2/PPP2PPP/RN1QKB1R w KQkq - 3 5", ann:"4...Qb6 — Aggressive! The queen attacks b2 and puts White under immediate pressure.", eval:10, nag:1 },
  { ply:9, san:"Nc3", uci:"b1c3", fen:"r1b1kbnr/pp2pppp/1qn5/2pp4/3P1B2/2N1PN2/PPP2PPP/R2QKB1R b KQkq - 4 5", ann:"5.Nc3 — Defending b2 and developing. White ignores the b2 threat.", eval:20 },
  { ply:10, san:"cxd4", uci:"c5d4", fen:"r1b1kbnr/pp2pppp/1qn5/3p4/3p1B2/2N1PN2/PPP2PPP/R2QKB1R w KQkq - 0 6", ann:"5...cxd4 — Black opens the center.", eval:15 },
  { ply:11, san:"exd4", uci:"e3d4", fen:"r1b1kbnr/pp2pppp/1qn5/3p4/3P1B2/2N2N2/PPP2PPP/R2QKB1R b KQkq - 0 6", ann:"6.exd4 — Recapturing. White has a strong pawn center.", eval:20 },
  { ply:12, san:"Nf6", uci:"g8f6", fen:"r1b1kb1r/pp2pppp/1qn2n2/3p4/3P1B2/2N2N2/PPP2PPP/R2QKB1R w KQkq - 1 7", ann:"6...Nf6 — Development with tempo.", eval:15 },
  { ply:13, san:"Be2", uci:"f1e2", fen:"r1b1kb1r/pp2pppp/1qn2n2/3p4/3P1B2/2N2N2/PPP1BPPP/R2QK2R b KQkq - 2 7", ann:"7.Be2 — Solid development, preparing to castle.", eval:20 },
  { ply:14, san:"Bf5", uci:"c8f5", fen:"r3kb1r/pp2pppp/1qn2n2/3p1b2/3P1B2/2N2N2/PPP1BPPP/R2QK2R w KQkq - 3 8", ann:"7...Bf5 — Developing the bishop actively, mirroring White's Bf4. Black has excellent piece activity.", eval:15, nag:1 },
]);

// CK0QpZ4EPmBq8AAq — Trap: b2 Pawn Grab
// 1. d4 d5 2. Bf4 c5 3. e3 Qb6 4. Nc3 Qxb2 5. Nb5 Na6 6. Rb1 Qa3
await insertNodes("CK0QpZ4EPmBq8AAq", [
  { ply:0, fen:"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", ann:"Starting position." },
  { ply:1, san:"d4", uci:"d2d4", fen:"rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq - 0 1", ann:"1.d4", eval:25 },
  { ply:2, san:"d5", uci:"d7d5", fen:"rnbqkbnr/ppp1pppp/8/3p4/3P4/8/PPP1PPPP/RNBQKBNR w KQkq - 0 2", ann:"1...d5", eval:20 },
  { ply:3, san:"Bf4", uci:"c1f4", fen:"rnbqkbnr/ppp1pppp/8/3p4/3P1B2/8/PPP1PPPP/RN1QKBNR b KQkq - 1 2", ann:"2.Bf4 — London System.", eval:25 },
  { ply:4, san:"c5", uci:"c7c5", fen:"rnbqkbnr/pp2pppp/8/2pp4/3P1B2/8/PPP1PPPP/RN1QKBNR w KQkq - 0 3", ann:"2...c5 — Anti-London challenge.", eval:15 },
  { ply:5, san:"e3", uci:"e2e3", fen:"rnbqkbnr/pp2pppp/8/2pp4/3P1B2/4P3/PPP2PPP/RN1QKBNR b KQkq - 0 3", ann:"3.e3", eval:20 },
  { ply:6, san:"Qb6", uci:"d8b6", fen:"r1b1kbnr/pp2pppp/1q6/2pp4/3P1B2/4P3/PPP2PPP/RN1QKBNR w KQkq - 1 4", ann:"3...Qb6 — Attacking b2 immediately. This is the trap variation!", eval:10, nag:5 },
  { ply:7, san:"Nc3", uci:"b1c3", fen:"r1b1kbnr/pp2pppp/1q6/2pp4/3P1B2/2N1P3/PPP2PPP/R2QKBNR b KQkq - 2 4", ann:"4.Nc3 — White defends b2 with the knight. This is the correct response.", eval:25 },
  { ply:8, san:"Qxb2", uci:"b6b2", fen:"r1b1kbnr/pp2pppp/8/2pp4/3P1B2/2N1P3/PqP2PPP/R2QKBNR w KQkq - 0 5", ann:"4...Qxb2?! — Black grabs the pawn, but this is very risky. The queen is now trapped in enemy territory.", eval:40, nag:6 },
  { ply:9, san:"Nb5", uci:"c3b5", fen:"r1b1kbnr/pp2pppp/8/1Npp4/3P1B2/4P3/PqP2PPP/R2QKBNR b KQkq - 1 5", ann:"5.Nb5! — White attacks the queen and threatens Nc7+ forking king and rook. The queen is in trouble!", eval:50, nag:1 },
  { ply:10, san:"Na6", uci:"b8a6", fen:"r1b1kbnr/pp2pppp/n7/1Npp4/3P1B2/4P3/PqP2PPP/R2QKBNR w KQkq - 2 6", ann:"5...Na6 — The only way to defend c7.", eval:45 },
  { ply:11, san:"Rb1", uci:"a1b1", fen:"r1b1kbnr/pp2pppp/n7/1Npp4/3P1B2/4P3/PqP2PPP/1R1QKBNR b Kkq - 3 6", ann:"6.Rb1 — Attacking the queen again. White has tremendous compensation.", eval:55, nag:1 },
  { ply:12, san:"Qa3", uci:"b2a3", fen:"r1b1kbnr/pp2pppp/n7/1Npp4/3P1B2/q3P3/P1P2PPP/1R1QKBNR w Kkq - 4 7", ann:"6...Qa3 — The queen escapes but is still misplaced. White has a massive lead in development and Black's queen is stranded.", eval:60, nag:4 },
]);

// d5B82YLk-Fp_L-Qd — vs d5 Close: Solid Approach
// 1. d4 d5 2. Bf4 c5 3. e3 Nc6 4. c3 e6 5. Nd2 Nf6 6. Ngf3 Be7 7. Bd3 O-O
await insertNodes("d5B82YLk-Fp_L-Qd", [
  { ply:0, fen:"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", ann:"Starting position." },
  { ply:1, san:"d4", uci:"d2d4", fen:"rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq - 0 1", ann:"1.d4", eval:25 },
  { ply:2, san:"d5", uci:"d7d5", fen:"rnbqkbnr/ppp1pppp/8/3p4/3P4/8/PPP1PPPP/RNBQKBNR w KQkq - 0 2", ann:"1...d5", eval:20 },
  { ply:3, san:"Bf4", uci:"c1f4", fen:"rnbqkbnr/ppp1pppp/8/3p4/3P1B2/8/PPP1PPPP/RN1QKBNR b KQkq - 1 2", ann:"2.Bf4 — London System.", eval:25 },
  { ply:4, san:"c5", uci:"c7c5", fen:"rnbqkbnr/pp2pppp/8/2pp4/3P1B2/8/PPP1PPPP/RN1QKBNR w KQkq - 0 3", ann:"2...c5 — Anti-London.", eval:15, nag:1 },
  { ply:5, san:"e3", uci:"e2e3", fen:"rnbqkbnr/pp2pppp/8/2pp4/3P1B2/4P3/PPP2PPP/RN1QKBNR b KQkq - 0 3", ann:"3.e3", eval:20 },
  { ply:6, san:"Nc6", uci:"b8c6", fen:"r1bqkbnr/pp2pppp/2n5/2pp4/3P1B2/4P3/PPP2PPP/RN1QKBNR w KQkq - 1 4", ann:"3...Nc6", eval:15 },
  { ply:7, san:"c3", uci:"c2c3", fen:"r1bqkbnr/pp2pppp/2n5/2pp4/3P1B2/2P1P3/PP3PPP/RN1QKBNR b KQkq - 0 4", ann:"4.c3 — Solid London setup.", eval:20 },
  { ply:8, san:"e6", uci:"e7e6", fen:"r1bqkbnr/pp3ppp/2n1p3/2pp4/3P1B2/2P1P3/PP3PPP/RN1QKBNR w KQkq - 0 5", ann:"4...e6 — Solid. Black prepares ...Be7 and ...O-O.", eval:15 },
  { ply:9, san:"Nd2", uci:"b1d2", fen:"r1bqkbnr/pp3ppp/2n1p3/2pp4/3P1B2/2P1P3/PP1N1PPP/R2QKBNR b KQkq - 1 5", ann:"5.Nd2 — Flexible development.", eval:20 },
  { ply:10, san:"Nf6", uci:"g8f6", fen:"r1bqkb1r/pp3ppp/2n1pn2/2pp4/3P1B2/2P1P3/PP1N1PPP/R2QKBNR w KQkq - 2 6", ann:"5...Nf6 — Development.", eval:15 },
  { ply:11, san:"Ngf3", uci:"g1f3", fen:"r1bqkb1r/pp3ppp/2n1pn2/2pp4/3P1B2/2P1PN2/PP1N1PPP/R2QKB1R b KQkq - 3 6", ann:"6.Ngf3 — Completing development.", eval:20 },
  { ply:12, san:"Be7", uci:"f8e7", fen:"r1bqk2r/pp2bppp/2n1pn2/2pp4/3P1B2/2P1PN2/PP1N1PPP/R2QKB1R w KQkq - 4 7", ann:"6...Be7 — Solid development. Black prepares to castle.", eval:15 },
  { ply:13, san:"Bd3", uci:"f1d3", fen:"r1bqk2r/pp2bppp/2n1pn2/2pp4/3P1B2/2PBPN2/PP1N1PPP/R2QK2R b KQkq - 5 7", ann:"7.Bd3 — White develops the bishop, completing the London setup.", eval:20 },
  { ply:14, san:"O-O", uci:"e8g8", fen:"r1bq1rk1/pp2bppp/2n1pn2/2pp4/3P1B2/2PBPN2/PP1N1PPP/R2QK2R w KQ - 6 8", ann:"7...O-O — Black castles safely. This is a solid, balanced position where both sides have clear plans.", eval:15 },
]);

// DARYDpBGLdathQgV — ...Bf5 Mirror: Fight for Light Squares
// 1. d4 d5 2. Bf4 Bf5 3. e3 e6 4. Nf3 Nf6 5. Bd3 Bxd3 6. Qxd3 Bd6 7. Bxd6 Qxd6
await insertNodes("DARYDpBGLdathQgV", [
  { ply:0, fen:"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", ann:"Starting position." },
  { ply:1, san:"d4", uci:"d2d4", fen:"rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq - 0 1", ann:"1.d4", eval:25 },
  { ply:2, san:"d5", uci:"d7d5", fen:"rnbqkbnr/ppp1pppp/8/3p4/3P4/8/PPP1PPPP/RNBQKBNR w KQkq - 0 2", ann:"1...d5", eval:20 },
  { ply:3, san:"Bf4", uci:"c1f4", fen:"rnbqkbnr/ppp1pppp/8/3p4/3P1B2/8/PPP1PPPP/RN1QKBNR b KQkq - 1 2", ann:"2.Bf4 — London System.", eval:25 },
  { ply:4, san:"Bf5", uci:"c8f5", fen:"rn1qkbnr/ppp1pppp/8/3p1b2/3P1B2/8/PPP1PPPP/RN1QKBNR w KQkq - 2 3", ann:"2...Bf5 — Mirror! Black copies White's bishop development, fighting for the same light squares.", eval:15, nag:1 },
  { ply:5, san:"e3", uci:"e2e3", fen:"rn1qkbnr/ppp1pppp/8/3p1b2/3P1B2/4P3/PPP2PPP/RN1QKBNR b KQkq - 0 3", ann:"3.e3 — Solid.", eval:20 },
  { ply:6, san:"e6", uci:"e7e6", fen:"rn1qkbnr/ppp2ppp/4p3/3p1b2/3P1B2/4P3/PPP2PPP/RN1QKBNR w KQkq - 0 4", ann:"3...e6 — Solid structure.", eval:15 },
  { ply:7, san:"Nf3", uci:"g1f3", fen:"rn1qkbnr/ppp2ppp/4p3/3p1b2/3P1B2/4PN2/PPP2PPP/RN1QKB1R b KQkq - 1 4", ann:"4.Nf3 — Development.", eval:20 },
  { ply:8, san:"Nf6", uci:"g8f6", fen:"rn1qkb1r/ppp2ppp/4pn2/3p1b2/3P1B2/4PN2/PPP2PPP/RN1QKB1R w KQkq - 2 5", ann:"4...Nf6 — Development.", eval:15 },
  { ply:9, san:"Bd3", uci:"f1d3", fen:"rn1qkb1r/ppp2ppp/4pn2/3p1b2/3P1B2/3BPN2/PPP2PPP/RN1QK2R b KQkq - 3 5", ann:"5.Bd3 — White develops the bishop, inviting an exchange.", eval:20 },
  { ply:10, san:"Bxd3", uci:"f5d3", fen:"rn1qkb1r/ppp2ppp/4pn2/3p4/3P1B2/3bPN2/PPP2PPP/RN1QK2R w KQkq - 0 6", ann:"5...Bxd3 — Black trades, eliminating the strong bishop.", eval:15 },
  { ply:11, san:"Qxd3", uci:"d1d3", fen:"rn1qkb1r/ppp2ppp/4pn2/3p4/3P1B2/3QPN2/PPP2PPP/RN2K2R b KQkq - 0 6", ann:"6.Qxd3 — White recaptures with the queen, centralizing it.", eval:20 },
  { ply:12, san:"Bd6", uci:"f8d6", fen:"rn1qk2r/ppp2ppp/3bpn2/3p4/3P1B2/3QPN2/PPP2PPP/RN2K2R w KQkq - 1 7", ann:"6...Bd6 — Challenging White's bishop.", eval:15 },
  { ply:13, san:"Bxd6", uci:"f4d6", fen:"rn1qk2r/ppp2ppp/3Bpn2/3p4/3P4/3QPN2/PPP2PPP/RN2K2R b KQkq - 0 7", ann:"7.Bxd6 — White trades off the bishop.", eval:20 },
  { ply:14, san:"Qxd6", uci:"d8d6", fen:"rn2k2r/ppp2ppp/3qpn2/3p4/3P4/3QPN2/PPP2PPP/RN2K2R w KQkq - 0 8", ann:"7...Qxd6 — Black recaptures, centralizing the queen. The position is symmetrical with equal chances. Both sides will castle and fight for the c-file.", eval:10 },
]);

// x3fgbRGs07_CS-ZK — Open Center: ...cxd4 Lines
// 1. d4 d5 2. Bf4 c5 3. e3 cxd4 4. exd4 Nc6 5. Nf3 Nf6 6. c3 Bf5 7. Bd3 Bxd3 8. Qxd3 e6
await insertNodes("x3fgbRGs07_CS-ZK", [
  { ply:0, fen:"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", ann:"Starting position." },
  { ply:1, san:"d4", uci:"d2d4", fen:"rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq - 0 1", ann:"1.d4", eval:25 },
  { ply:2, san:"d5", uci:"d7d5", fen:"rnbqkbnr/ppp1pppp/8/3p4/3P4/8/PPP1PPPP/RNBQKBNR w KQkq - 0 2", ann:"1...d5", eval:20 },
  { ply:3, san:"Bf4", uci:"c1f4", fen:"rnbqkbnr/ppp1pppp/8/3p4/3P1B2/8/PPP1PPPP/RN1QKBNR b KQkq - 1 2", ann:"2.Bf4 — London System.", eval:25 },
  { ply:4, san:"c5", uci:"c7c5", fen:"rnbqkbnr/pp2pppp/8/2pp4/3P1B2/8/PPP1PPPP/RN1QKBNR w KQkq - 0 3", ann:"2...c5 — Anti-London.", eval:15, nag:1 },
  { ply:5, san:"e3", uci:"e2e3", fen:"rnbqkbnr/pp2pppp/8/2pp4/3P1B2/4P3/PPP2PPP/RN1QKBNR b KQkq - 0 3", ann:"3.e3", eval:20 },
  { ply:6, san:"cxd4", uci:"c5d4", fen:"rnbqkbnr/pp2pppp/8/3p4/3p1B2/4P3/PPP2PPP/RN1QKBNR w KQkq - 0 4", ann:"3...cxd4 — Black opens the center immediately, trading off the c-pawn for White's e-pawn.", eval:15, nag:1 },
  { ply:7, san:"exd4", uci:"e3d4", fen:"rnbqkbnr/pp2pppp/8/3p4/3P1B2/8/PPP2PPP/RN1QKBNR b KQkq - 0 4", ann:"4.exd4 — White recaptures, maintaining the pawn center.", eval:20 },
  { ply:8, san:"Nc6", uci:"b8c6", fen:"r1bqkbnr/pp2pppp/2n5/3p4/3P1B2/8/PPP2PPP/RN1QKBNR w KQkq - 1 5", ann:"4...Nc6 — Development with pressure on d4.", eval:15 },
  { ply:9, san:"Nf3", uci:"g1f3", fen:"r1bqkbnr/pp2pppp/2n5/3p4/3P1B2/5N2/PPP2PPP/RN1QKB1R b KQkq - 2 5", ann:"5.Nf3 — Development.", eval:20 },
  { ply:10, san:"Nf6", uci:"g8f6", fen:"r1bqkb1r/pp2pppp/2n2n2/3p4/3P1B2/5N2/PPP2PPP/RN1QKB1R w KQkq - 3 6", ann:"5...Nf6 — Development.", eval:15 },
  { ply:11, san:"c3", uci:"c2c3", fen:"r1bqkb1r/pp2pppp/2n2n2/3p4/3P1B2/2P2N2/PP3PPP/RN1QKB1R b KQkq - 0 6", ann:"6.c3 — Solidifying d4.", eval:20 },
  { ply:12, san:"Bf5", uci:"c8f5", fen:"r2qkb1r/pp2pppp/2n2n2/3p1b2/3P1B2/2P2N2/PP3PPP/RN1QKB1R w KQkq - 1 7", ann:"6...Bf5 — Active bishop development, mirroring White's Bf4.", eval:15, nag:1 },
  { ply:13, san:"Bd3", uci:"f1d3", fen:"r2qkb1r/pp2pppp/2n2n2/3p1b2/3P1B2/2PB1N2/PP3PPP/RN1QK2R b KQkq - 2 7", ann:"7.Bd3 — Developing, inviting the exchange.", eval:20 },
  { ply:14, san:"Bxd3", uci:"f5d3", fen:"r2qkb1r/pp2pppp/2n2n2/3p4/3P1B2/2Pb1N2/PP3PPP/RN1QK2R w KQkq - 0 8", ann:"7...Bxd3 — Trading the bishop.", eval:15 },
  { ply:15, san:"Qxd3", uci:"d1d3", fen:"r2qkb1r/pp2pppp/2n2n2/3p4/3P1B2/2PQ1N2/PP3PPP/RN2K2R b KQkq - 0 8", ann:"8.Qxd3 — Recapturing, centralizing the queen.", eval:20 },
  { ply:16, san:"e6", uci:"e7e6", fen:"r2qkb1r/pp3ppp/2n1pn2/3p4/3P1B2/2PQ1N2/PP3PPP/RN2K2R w KQkq - 0 9", ann:"8...e6 — Solid. Black prepares ...Be7 and ...O-O. The position is balanced with both sides having clear plans.", eval:15 },
]);

// 9L0UHvoMIme4w-Pn — Trap: ...h5 Bishop Chase
// 1. d4 d5 2. Bf4 c5 3. e3 Nc6 4. Nf3 e6 5. Bd3 Bd6 6. Bg3 Nf6 7. O-O h5
await insertNodes("9L0UHvoMIme4w-Pn", [
  { ply:0, fen:"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", ann:"Starting position." },
  { ply:1, san:"d4", uci:"d2d4", fen:"rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq - 0 1", ann:"1.d4", eval:25 },
  { ply:2, san:"d5", uci:"d7d5", fen:"rnbqkbnr/ppp1pppp/8/3p4/3P4/8/PPP1PPPP/RNBQKBNR w KQkq - 0 2", ann:"1...d5", eval:20 },
  { ply:3, san:"Bf4", uci:"c1f4", fen:"rnbqkbnr/ppp1pppp/8/3p4/3P1B2/8/PPP1PPPP/RN1QKBNR b KQkq - 1 2", ann:"2.Bf4 — London System.", eval:25 },
  { ply:4, san:"c5", uci:"c7c5", fen:"rnbqkbnr/pp2pppp/8/2pp4/3P1B2/8/PPP1PPPP/RN1QKBNR w KQkq - 0 3", ann:"2...c5 — Anti-London.", eval:15, nag:1 },
  { ply:5, san:"e3", uci:"e2e3", fen:"rnbqkbnr/pp2pppp/8/2pp4/3P1B2/4P3/PPP2PPP/RN1QKBNR b KQkq - 0 3", ann:"3.e3", eval:20 },
  { ply:6, san:"Nc6", uci:"b8c6", fen:"r1bqkbnr/pp2pppp/2n5/2pp4/3P1B2/4P3/PPP2PPP/RN1QKBNR w KQkq - 1 4", ann:"3...Nc6", eval:15 },
  { ply:7, san:"Nf3", uci:"g1f3", fen:"r1bqkbnr/pp2pppp/2n5/2pp4/3P1B2/4PN2/PPP2PPP/RN1QKB1R b KQkq - 2 4", ann:"4.Nf3", eval:20 },
  { ply:8, san:"e6", uci:"e7e6", fen:"r1bqkbnr/pp3ppp/2n1p3/2pp4/3P1B2/4PN2/PPP2PPP/RN1QKB1R w KQkq - 0 5", ann:"4...e6 — Solid.", eval:15 },
  { ply:9, san:"Bd3", uci:"f1d3", fen:"r1bqkbnr/pp3ppp/2n1p3/2pp4/3P1B2/3BPN2/PPP2PPP/RN1QK2R b KQkq - 1 5", ann:"5.Bd3 — Developing.", eval:20 },
  { ply:10, san:"Bd6", uci:"f8d6", fen:"r1bqk1nr/pp3ppp/2nbp3/2pp4/3P1B2/3BPN2/PPP2PPP/RN1QK2R w KQkq - 2 6", ann:"5...Bd6 — Challenging the bishop.", eval:15 },
  { ply:11, san:"Bg3", uci:"f4g3", fen:"r1bqk1nr/pp3ppp/2nbp3/2pp4/3P4/3BPNB1/PPP2PPP/RN1QK2R b KQkq - 3 6", ann:"6.Bg3 — White retreats the bishop to avoid the exchange.", eval:20 },
  { ply:12, san:"Nf6", uci:"g8f6", fen:"r1bqk2r/pp3ppp/2nbpn2/2pp4/3P4/3BPNB1/PPP2PPP/RN1QK2R w KQkq - 4 7", ann:"6...Nf6 — Development.", eval:15 },
  { ply:13, san:"O-O", uci:"e1g1", fen:"r1bqk2r/pp3ppp/2nbpn2/2pp4/3P4/3BPNB1/PPP2PPP/RN1Q1RK1 b kq - 5 7", ann:"7.O-O — White castles.", eval:20 },
  { ply:14, san:"h5", uci:"h7h5", fen:"r1bqk2r/pp3pp1/2nbpn2/2pp3p/3P4/3BPNB1/PPP2PPP/RN1Q1RK1 w kq - 0 8", ann:"7...h5! — The bishop chase begins! Black advances the h-pawn to harass the bishop on g3. This is a key Anti-London idea.", eval:10, nag:1 },
]);

// ─────────────────────────────────────────────────────────────────────────────
// CARO-KANN DEFENSE
// ─────────────────────────────────────────────────────────────────────────────

// 7ooR4JXyVET9_3EM — Classical: 4...Bf5 Main Line
// 1. e4 c6 2. d4 d5 3. Nc3 dxe4 4. Nxe4 Bf5 5. Ng3 Bg6 6. h4 h6 7. Nf3 Nd7
await insertNodes("7ooR4JXyVET9_3EM", [
  { ply:0, fen:"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", ann:"Starting position." },
  { ply:1, san:"e4", uci:"e2e4", fen:"rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1", ann:"1.e4 — The most popular first move.", eval:25 },
  { ply:2, san:"c6", uci:"c7c6", fen:"rnbqkbnr/pp1ppppp/2p5/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2", ann:"1...c6 — The Caro-Kann! Solid and reliable.", eval:20 },
  { ply:3, san:"d4", uci:"d2d4", fen:"rnbqkbnr/pp1ppppp/2p5/8/3PP3/8/PPP2PPP/RNBQKBNR b KQkq - 0 2", ann:"2.d4 — White builds a strong pawn center.", eval:25 },
  { ply:4, san:"d5", uci:"d7d5", fen:"rnbqkbnr/pp2pppp/2p5/3p4/3PP3/8/PPP2PPP/RNBQKBNR w KQkq - 0 3", ann:"2...d5 — Challenging the center immediately.", eval:20 },
  { ply:5, san:"Nc3", uci:"b1c3", fen:"rnbqkbnr/pp2pppp/2p5/3p4/3PP3/2N5/PPP2PPP/R1BQKBNR b KQkq - 1 3", ann:"3.Nc3 — Classical variation. White defends e4 with the knight.", eval:25 },
  { ply:6, san:"dxe4", uci:"d5e4", fen:"rnbqkbnr/pp2pppp/2p5/8/3Pp3/2N5/PPP2PPP/R1BQKBNR w KQkq - 0 4", ann:"3...dxe4 — Black captures, forcing White to recapture.", eval:20 },
  { ply:7, san:"Nxe4", uci:"c3e4", fen:"rnbqkbnr/pp2pppp/2p5/8/3PN3/8/PPP2PPP/R1BQKBNR b KQkq - 0 4", ann:"4.Nxe4 — White recaptures with the knight, centralizing it.", eval:25 },
  { ply:8, san:"Bf5", uci:"c8f5", fen:"rn1qkbnr/pp2pppp/2p5/5b2/3PN3/8/PPP2PPP/R1BQKBNR w KQkq - 1 5", ann:"4...Bf5 — The Classical variation! Black develops the bishop outside the pawn chain.", eval:20, nag:1 },
  { ply:9, san:"Ng3", uci:"e4g3", fen:"rn1qkbnr/pp2pppp/2p5/5b2/3P4/6N1/PPP2PPP/R1BQKBNR b KQkq - 2 5", ann:"5.Ng3 — Attacking the bishop, forcing it to retreat.", eval:25 },
  { ply:10, san:"Bg6", uci:"f5g6", fen:"rn1qkbnr/pp2pppp/2p3b1/8/3P4/6N1/PPP2PPP/R1BQKBNR w KQkq - 3 6", ann:"5...Bg6 — The bishop retreats to g6, maintaining its diagonal.", eval:20 },
  { ply:11, san:"h4", uci:"h2h4", fen:"rn1qkbnr/pp2pppp/2p3b1/8/3P3P/6N1/PPP2PP1/R1BQKBNR b KQkq - 0 6", ann:"6.h4 — White advances the h-pawn to harass the bishop. A key idea in the Classical Caro-Kann.", eval:25 },
  { ply:12, san:"h6", uci:"h7h6", fen:"rn1qkbnr/pp2ppp1/2p3bp/8/3P3P/6N1/PPP2PP1/R1BQKBNR w KQkq - 0 7", ann:"6...h6 — Giving the bishop an escape square on h7.", eval:20 },
  { ply:13, san:"Nf3", uci:"g1f3", fen:"rn1qkbnr/pp2ppp1/2p3bp/8/3P3P/5NN1/PPP2PP1/R1BQKB1R b KQkq - 1 7", ann:"7.Nf3 — Developing the knight, preparing to castle.", eval:25 },
  { ply:14, san:"Nd7", uci:"b8d7", fen:"r2qkbnr/pp1nppp1/2p3bp/8/3P3P/5NN1/PPP2PP1/R1BQKB1R w KQkq - 2 8", ann:"7...Nd7 — Flexible development. The knight supports e5 and prepares ...Ngf6. Black has a solid, well-coordinated position.", eval:20 },
]);

// ─────────────────────────────────────────────────────────────────────────────
// KING'S INDIAN DEFENSE
// ─────────────────────────────────────────────────────────────────────────────

// MqE0RpRHJVCHEzwz — Classical: ...e5 Main Line
// 1. d4 Nf6 2. c4 g6 3. Nc3 Bg7 4. e4 d6 5. Nf3 O-O 6. Be2 e5 7. O-O Nc6
await insertNodes("MqE0RpRHJVCHEzwz", [
  { ply:0, fen:"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", ann:"Starting position." },
  { ply:1, san:"d4", uci:"d2d4", fen:"rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq - 0 1", ann:"1.d4 — White opens with the Queen's Pawn.", eval:25 },
  { ply:2, san:"Nf6", uci:"g8f6", fen:"rnbqkb1r/pppppppp/5n2/8/3P4/8/PPP1PPPP/RNBQKBNR w KQkq - 1 2", ann:"1...Nf6 — Flexible. Black can transpose to the King's Indian.", eval:20 },
  { ply:3, san:"c4", uci:"c2c4", fen:"rnbqkb1r/pppppppp/5n2/8/2PP4/8/PP2PPPP/RNBQKBNR b KQkq - 0 2", ann:"2.c4 — The English/Queen's Gambit setup. White builds a broad pawn center.", eval:25 },
  { ply:4, san:"g6", uci:"g7g6", fen:"rnbqkb1r/pppppp1p/5np1/8/2PP4/8/PP2PPPP/RNBQKBNR w KQkq - 0 3", ann:"2...g6 — The King's Indian! Black prepares to fianchetto the bishop.", eval:20, nag:1 },
  { ply:5, san:"Nc3", uci:"b1c3", fen:"rnbqkb1r/pppppp1p/5np1/8/2PP4/2N5/PP2PPPP/R1BQKBNR b KQkq - 1 3", ann:"3.Nc3 — Development.", eval:25 },
  { ply:6, san:"Bg7", uci:"f8g7", fen:"rnbqk2r/ppppppbp/5np1/8/2PP4/2N5/PP2PPPP/R1BQKBNR w KQkq - 2 4", ann:"3...Bg7 — The fianchettoed bishop. This is the heart of the King's Indian.", eval:20 },
  { ply:7, san:"e4", uci:"e2e4", fen:"rnbqk2r/ppppppbp/5np1/8/2PPP3/2N5/PP3PPP/R1BQKBNR b KQkq - 0 4", ann:"4.e4 — White establishes a massive pawn center.", eval:25 },
  { ply:8, san:"d6", uci:"d7d6", fen:"rnbqk2r/ppp1ppbp/3p1np1/8/2PPP3/2N5/PP3PPP/R1BQKBNR w KQkq - 0 5", ann:"4...d6 — Solid. Black supports e5 and prepares to challenge the center.", eval:20 },
  { ply:9, san:"Nf3", uci:"g1f3", fen:"rnbqk2r/ppp1ppbp/3p1np1/8/2PPP3/2N2N2/PP3PPP/R1BQKB1R b KQkq - 1 5", ann:"5.Nf3 — Development.", eval:25 },
  { ply:10, san:"O-O", uci:"e8g8", fen:"rnbq1rk1/ppp1ppbp/3p1np1/8/2PPP3/2N2N2/PP3PPP/R1BQKB1R w KQ - 2 6", ann:"5...O-O — Black castles, getting the king to safety.", eval:20 },
  { ply:11, san:"Be2", uci:"f1e2", fen:"rnbq1rk1/ppp1ppbp/3p1np1/8/2PPP3/2N2N2/PP2BPPP/R1BQK2R b KQ - 3 6", ann:"6.Be2 — The Classical variation. Solid development.", eval:25 },
  { ply:12, san:"e5", uci:"e7e5", fen:"rnbq1rk1/ppp2pbp/3p1np1/4p3/2PPP3/2N2N2/PP2BPPP/R1BQK2R w KQ - 0 7", ann:"6...e5! — The key KID move! Black challenges White's center, creating the classic KID tension.", eval:20, nag:1 },
  { ply:13, san:"O-O", uci:"e1g1", fen:"rnbq1rk1/ppp2pbp/3p1np1/4p3/2PPP3/2N2N2/PP2BPPP/R1BQ1RK1 b - - 1 7", ann:"7.O-O — White castles, entering the main line.", eval:25 },
  { ply:14, san:"Nc6", uci:"b8c6", fen:"r1bq1rk1/ppp2pbp/2np1np1/4p3/2PPP3/2N2N2/PP2BPPP/R1BQ1RK1 w - - 2 8", ann:"7...Nc6 — Developing the knight, adding pressure to d4. The position is dynamically balanced with both sides having clear plans.", eval:20 },
]);

// xxWdLHEpVr5Q8ZM7 — Saemisch: 5.f3 System
// 1. d4 Nf6 2. c4 g6 3. Nc3 Bg7 4. e4 d6 5. f3 O-O 6. Be3 e5 7. d5 Nh5
await insertNodes("xxWdLHEpVr5Q8ZM7", [
  { ply:0, fen:"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", ann:"Starting position." },
  { ply:1, san:"d4", uci:"d2d4", fen:"rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq - 0 1", ann:"1.d4", eval:25 },
  { ply:2, san:"Nf6", uci:"g8f6", fen:"rnbqkb1r/pppppppp/5n2/8/3P4/8/PPP1PPPP/RNBQKBNR w KQkq - 1 2", ann:"1...Nf6", eval:20 },
  { ply:3, san:"c4", uci:"c2c4", fen:"rnbqkb1r/pppppppp/5n2/8/2PP4/8/PP2PPPP/RNBQKBNR b KQkq - 0 2", ann:"2.c4", eval:25 },
  { ply:4, san:"g6", uci:"g7g6", fen:"rnbqkb1r/pppppp1p/5np1/8/2PP4/8/PP2PPPP/RNBQKBNR w KQkq - 0 3", ann:"2...g6 — King's Indian setup.", eval:20 },
  { ply:5, san:"Nc3", uci:"b1c3", fen:"rnbqkb1r/pppppp1p/5np1/8/2PP4/2N5/PP2PPPP/R1BQKBNR b KQkq - 1 3", ann:"3.Nc3", eval:25 },
  { ply:6, san:"Bg7", uci:"f8g7", fen:"rnbqk2r/ppppppbp/5np1/8/2PP4/2N5/PP2PPPP/R1BQKBNR w KQkq - 2 4", ann:"3...Bg7", eval:20 },
  { ply:7, san:"e4", uci:"e2e4", fen:"rnbqk2r/ppppppbp/5np1/8/2PPP3/2N5/PP3PPP/R1BQKBNR b KQkq - 0 4", ann:"4.e4 — White builds the center.", eval:25 },
  { ply:8, san:"d6", uci:"d7d6", fen:"rnbqk2r/ppp1ppbp/3p1np1/8/2PPP3/2N5/PP3PPP/R1BQKBNR w KQkq - 0 5", ann:"4...d6", eval:20 },
  { ply:9, san:"f3", uci:"f2f3", fen:"rnbqk2r/ppp1ppbp/3p1np1/8/2PPP3/2N2P2/PP4PP/R1BQKBNR b KQkq - 0 5", ann:"5.f3 — The Saemisch! White prepares a massive pawn center and plans Be3, Qd2, and O-O-O.", eval:30, nag:1 },
  { ply:10, san:"O-O", uci:"e8g8", fen:"rnbq1rk1/ppp1ppbp/3p1np1/8/2PPP3/2N2P2/PP4PP/R1BQKBNR w KQ - 1 6", ann:"5...O-O — Black castles, preparing for the coming storm.", eval:20 },
  { ply:11, san:"Be3", uci:"c1e3", fen:"rnbq1rk1/ppp1ppbp/3p1np1/8/2PPP3/2N1BP2/PP4PP/R2QKBNR b KQ - 2 6", ann:"6.Be3 — Developing the bishop, preparing Qd2.", eval:30 },
  { ply:12, san:"e5", uci:"e7e5", fen:"rnbq1rk1/ppp2pbp/3p1np1/4p3/2PPP3/2N1BP2/PP4PP/R2QKBNR w KQ - 0 7", ann:"6...e5 — Black challenges the center. The position becomes sharp.", eval:20, nag:1 },
  { ply:13, san:"d5", uci:"d4d5", fen:"rnbq1rk1/ppp2pbp/3p1np1/3Pp3/2P1P3/2N1BP2/PP4PP/R2QKBNR b KQ - 0 7", ann:"7.d5 — White closes the center. Both sides will attack on opposite wings.", eval:30 },
  { ply:14, san:"Nh5", uci:"f6h5", fen:"rnbq1rk1/ppp2pbp/3p2p1/3Pp2n/2P1P3/2N1BP2/PP4PP/R2QKBNR w KQ - 1 8", ann:"7...Nh5 — Black repositions the knight to f4, aiming for a kingside attack. The Saemisch leads to extremely sharp play.", eval:20, nag:1 },
]);

// hBNN1HS1TUcYZ1eK — Four Pawns Attack: 5.f4
// 1. d4 Nf6 2. c4 g6 3. Nc3 Bg7 4. e4 d6 5. f4 O-O 6. Nf3 c5 7. d5 e6
await insertNodes("hBNN1HS1TUcYZ1eK", [
  { ply:0, fen:"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", ann:"Starting position." },
  { ply:1, san:"d4", uci:"d2d4", fen:"rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq - 0 1", ann:"1.d4", eval:25 },
  { ply:2, san:"Nf6", uci:"g8f6", fen:"rnbqkb1r/pppppppp/5n2/8/3P4/8/PPP1PPPP/RNBQKBNR w KQkq - 1 2", ann:"1...Nf6", eval:20 },
  { ply:3, san:"c4", uci:"c2c4", fen:"rnbqkb1r/pppppppp/5n2/8/2PP4/8/PP2PPPP/RNBQKBNR b KQkq - 0 2", ann:"2.c4", eval:25 },
  { ply:4, san:"g6", uci:"g7g6", fen:"rnbqkb1r/pppppp1p/5np1/8/2PP4/8/PP2PPPP/RNBQKBNR w KQkq - 0 3", ann:"2...g6 — King's Indian setup.", eval:20 },
  { ply:5, san:"Nc3", uci:"b1c3", fen:"rnbqkb1r/pppppp1p/5np1/8/2PP4/2N5/PP2PPPP/R1BQKBNR b KQkq - 1 3", ann:"3.Nc3", eval:25 },
  { ply:6, san:"Bg7", uci:"f8g7", fen:"rnbqk2r/ppppppbp/5np1/8/2PP4/2N5/PP2PPPP/R1BQKBNR w KQkq - 2 4", ann:"3...Bg7", eval:20 },
  { ply:7, san:"e4", uci:"e2e4", fen:"rnbqk2r/ppppppbp/5np1/8/2PPP3/2N5/PP3PPP/R1BQKBNR b KQkq - 0 4", ann:"4.e4", eval:25 },
  { ply:8, san:"d6", uci:"d7d6", fen:"rnbqk2r/ppp1ppbp/3p1np1/8/2PPP3/2N5/PP3PPP/R1BQKBNR w KQkq - 0 5", ann:"4...d6", eval:20 },
  { ply:9, san:"f4", uci:"f2f4", fen:"rnbqk2r/ppp1ppbp/3p1np1/8/2PPPP2/2N5/PP4PP/R1BQKBNR b KQkq - 0 5", ann:"5.f4 — The Four Pawns Attack! White grabs maximum space. Very aggressive.", eval:30, nag:1 },
  { ply:10, san:"O-O", uci:"e8g8", fen:"rnbq1rk1/ppp1ppbp/3p1np1/8/2PPPP2/2N5/PP4PP/R1BQKBNR w KQ - 1 6", ann:"5...O-O — Black castles, preparing to counterattack.", eval:20 },
  { ply:11, san:"Nf3", uci:"g1f3", fen:"rnbq1rk1/ppp1ppbp/3p1np1/8/2PPPP2/2N2N2/PP4PP/R1BQKB1R b KQ - 2 6", ann:"6.Nf3 — Development.", eval:25 },
  { ply:12, san:"c5", uci:"c7c5", fen:"rnbq1rk1/pp2ppbp/3p1np1/2p5/2PPPP2/2N2N2/PP4PP/R1BQKB1R w KQ - 0 7", ann:"6...c5 — Black challenges the center immediately.", eval:20, nag:1 },
  { ply:13, san:"d5", uci:"d4d5", fen:"rnbq1rk1/pp2ppbp/3p1np1/2pP4/2P1PP2/2N2N2/PP4PP/R1BQKB1R b KQ - 0 7", ann:"7.d5 — White closes the center, creating a blocked pawn structure.", eval:25 },
  { ply:14, san:"e6", uci:"e7e6", fen:"rnbq1rk1/pp3pbp/3ppnp1/2pP4/2P1PP2/2N2N2/PP4PP/R1BQKB1R w KQ - 0 8", ann:"7...e6 — Black immediately counterattacks the pawn chain. The position is dynamically balanced.", eval:20, nag:1 },
]);

// 3aLOJM02S5OoqSgQ — Fianchetto: 3.Nf3 Bg7 4.g3
// 1. d4 Nf6 2. c4 g6 3. Nf3 Bg7 4. g3 O-O 5. Bg2 d6 6. O-O Nbd7 7. Nc3 e5
await insertNodes("3aLOJM02S5OoqSgQ", [
  { ply:0, fen:"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", ann:"Starting position." },
  { ply:1, san:"d4", uci:"d2d4", fen:"rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq - 0 1", ann:"1.d4", eval:25 },
  { ply:2, san:"Nf6", uci:"g8f6", fen:"rnbqkb1r/pppppppp/5n2/8/3P4/8/PPP1PPPP/RNBQKBNR w KQkq - 1 2", ann:"1...Nf6", eval:20 },
  { ply:3, san:"c4", uci:"c2c4", fen:"rnbqkb1r/pppppppp/5n2/8/2PP4/8/PP2PPPP/RNBQKBNR b KQkq - 0 2", ann:"2.c4", eval:25 },
  { ply:4, san:"g6", uci:"g7g6", fen:"rnbqkb1r/pppppp1p/5np1/8/2PP4/8/PP2PPPP/RNBQKBNR w KQkq - 0 3", ann:"2...g6 — King's Indian setup.", eval:20 },
  { ply:5, san:"Nf3", uci:"g1f3", fen:"rnbqkb1r/pppppp1p/5np1/8/2PP4/5N2/PP2PPPP/RNBQKB1R b KQkq - 1 3", ann:"3.Nf3 — Flexible. White avoids committing to e4 yet.", eval:25 },
  { ply:6, san:"Bg7", uci:"f8g7", fen:"rnbqk2r/ppppppbp/5np1/8/2PP4/5N2/PP2PPPP/RNBQKB1R w KQkq - 2 4", ann:"3...Bg7 — Fianchetto.", eval:20 },
  { ply:7, san:"g3", uci:"g2g3", fen:"rnbqk2r/ppppppbp/5np1/8/2PP4/5NP1/PP2PP1P/RNBQKB1R b KQkq - 0 4", ann:"4.g3 — White also fianchettoes! The Fianchetto variation leads to a strategic battle.", eval:25 },
  { ply:8, san:"O-O", uci:"e8g8", fen:"rnbq1rk1/ppppppbp/5np1/8/2PP4/5NP1/PP2PP1P/RNBQKB1R w KQ - 1 5", ann:"4...O-O — Black castles.", eval:20 },
  { ply:9, san:"Bg2", uci:"f1g2", fen:"rnbq1rk1/ppppppbp/5np1/8/2PP4/5NP1/PP2PPBP/RNBQK2R b KQ - 2 5", ann:"5.Bg2 — White completes the fianchetto.", eval:25 },
  { ply:10, san:"d6", uci:"d7d6", fen:"rnbq1rk1/ppp1ppbp/3p1np1/8/2PP4/5NP1/PP2PPBP/RNBQK2R w KQ - 0 6", ann:"5...d6 — Solid. Black prepares ...e5.", eval:20 },
  { ply:11, san:"O-O", uci:"e1g1", fen:"rnbq1rk1/ppp1ppbp/3p1np1/8/2PP4/5NP1/PP2PPBP/RNBQ1RK1 b - - 1 6", ann:"6.O-O — White castles.", eval:25 },
  { ply:12, san:"Nbd7", uci:"b8d7", fen:"r1bq1rk1/pppnppbp/3p1np1/8/2PP4/5NP1/PP2PPBP/RNBQ1RK1 w - - 2 7", ann:"6...Nbd7 — Flexible development. The knight can go to e5 or f8.", eval:20 },
  { ply:13, san:"Nc3", uci:"b1c3", fen:"r1bq1rk1/pppnppbp/3p1np1/8/2PP4/2N2NP1/PP2PPBP/R1BQ1RK1 b - - 3 7", ann:"7.Nc3 — Development.", eval:25 },
  { ply:14, san:"e5", uci:"e7e5", fen:"r1bq1rk1/pppn1pbp/3p1np1/4p3/2PP4/2N2NP1/PP2PPBP/R1BQ1RK1 w - - 0 8", ann:"7...e5 — The key KID move! Black challenges the center. The battle of the fianchettoed bishops begins.", eval:20, nag:1 },
]);

// WR6ULo182dcqdr1Q — vs London: 2.Bf4 System
// 1. d4 Nf6 2. Bf4 g6 3. e3 Bg7 4. Nf3 O-O 5. Be2 d6 6. O-O Nbd7
await insertNodes("WR6ULo182dcqdr1Q", [
  { ply:0, fen:"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", ann:"Starting position." },
  { ply:1, san:"d4", uci:"d2d4", fen:"rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq - 0 1", ann:"1.d4", eval:25 },
  { ply:2, san:"Nf6", uci:"g8f6", fen:"rnbqkb1r/pppppppp/5n2/8/3P4/8/PPP1PPPP/RNBQKBNR w KQkq - 1 2", ann:"1...Nf6", eval:20 },
  { ply:3, san:"Bf4", uci:"c1f4", fen:"rnbqkb1r/pppppppp/5n2/8/3P1B2/8/PPP1PPPP/RN1QKBNR b KQkq - 2 2", ann:"2.Bf4 — White plays the London System without c4.", eval:25 },
  { ply:4, san:"g6", uci:"g7g6", fen:"rnbqkb1r/pppppp1p/5np1/8/3P1B2/8/PPP1PPPP/RN1QKBNR w KQkq - 0 3", ann:"2...g6 — Black transposes to a King's Indian setup against the London.", eval:20, nag:1 },
  { ply:5, san:"e3", uci:"e2e3", fen:"rnbqkb1r/pppppp1p/5np1/8/3P1B2/4P3/PPP2PPP/RN1QKBNR b KQkq - 0 3", ann:"3.e3 — Solid.", eval:25 },
  { ply:6, san:"Bg7", uci:"f8g7", fen:"rnbqk2r/ppppppbp/5np1/8/3P1B2/4P3/PPP2PPP/RN1QKBNR w KQkq - 1 4", ann:"3...Bg7 — Completing the fianchetto.", eval:20 },
  { ply:7, san:"Nf3", uci:"g1f3", fen:"rnbqk2r/ppppppbp/5np1/8/3P1B2/4PN2/PPP2PPP/RN1QKB1R b KQkq - 2 4", ann:"4.Nf3 — Development.", eval:25 },
  { ply:8, san:"O-O", uci:"e8g8", fen:"rnbq1rk1/ppppppbp/5np1/8/3P1B2/4PN2/PPP2PPP/RN1QKB1R w KQ - 3 5", ann:"4...O-O — Black castles.", eval:20 },
  { ply:9, san:"Be2", uci:"f1e2", fen:"rnbq1rk1/ppppppbp/5np1/8/3P1B2/4PN2/PPP1BPPP/RN1QK2R b KQ - 4 5", ann:"5.Be2 — Solid development.", eval:25 },
  { ply:10, san:"d6", uci:"d7d6", fen:"rnbq1rk1/ppp1ppbp/3p1np1/8/3P1B2/4PN2/PPP1BPPP/RN1QK2R w KQ - 0 6", ann:"5...d6 — Preparing ...e5.", eval:20 },
  { ply:11, san:"O-O", uci:"e1g1", fen:"rnbq1rk1/ppp1ppbp/3p1np1/8/3P1B2/4PN2/PPP1BPPP/RN1Q1RK1 b - - 1 6", ann:"6.O-O — White castles.", eval:25 },
  { ply:12, san:"Nbd7", uci:"b8d7", fen:"r1bq1rk1/pppnppbp/3p1np1/8/3P1B2/4PN2/PPP1BPPP/RN1Q1RK1 w - - 2 7", ann:"6...Nbd7 — Flexible development. Black prepares ...e5 or ...c5 to challenge White's setup.", eval:20 },
]);

// zlqtgOVmSORyZvBl — Mar del Plata: ...f5 Attack
// 1. d4 Nf6 2. c4 g6 3. Nc3 Bg7 4. e4 d6 5. Nf3 O-O 6. Be2 e5 7. O-O Nc6 8. d5 Ne7 9. Ne1 Nd7 10. f3 f5
await insertNodes("zlqtgOVmSORyZvBl", [
  { ply:0, fen:"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", ann:"Starting position." },
  { ply:1, san:"d4", uci:"d2d4", fen:"rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq - 0 1", ann:"1.d4", eval:25 },
  { ply:2, san:"Nf6", uci:"g8f6", fen:"rnbqkb1r/pppppppp/5n2/8/3P4/8/PPP1PPPP/RNBQKBNR w KQkq - 1 2", ann:"1...Nf6", eval:20 },
  { ply:3, san:"c4", uci:"c2c4", fen:"rnbqkb1r/pppppppp/5n2/8/2PP4/8/PP2PPPP/RNBQKBNR b KQkq - 0 2", ann:"2.c4", eval:25 },
  { ply:4, san:"g6", uci:"g7g6", fen:"rnbqkb1r/pppppp1p/5np1/8/2PP4/8/PP2PPPP/RNBQKBNR w KQkq - 0 3", ann:"2...g6", eval:20 },
  { ply:5, san:"Nc3", uci:"b1c3", fen:"rnbqkb1r/pppppp1p/5np1/8/2PP4/2N5/PP2PPPP/R1BQKBNR b KQkq - 1 3", ann:"3.Nc3", eval:25 },
  { ply:6, san:"Bg7", uci:"f8g7", fen:"rnbqk2r/ppppppbp/5np1/8/2PP4/2N5/PP2PPPP/R1BQKBNR w KQkq - 2 4", ann:"3...Bg7", eval:20 },
  { ply:7, san:"e4", uci:"e2e4", fen:"rnbqk2r/ppppppbp/5np1/8/2PPP3/2N5/PP3PPP/R1BQKBNR b KQkq - 0 4", ann:"4.e4", eval:25 },
  { ply:8, san:"d6", uci:"d7d6", fen:"rnbqk2r/ppp1ppbp/3p1np1/8/2PPP3/2N5/PP3PPP/R1BQKBNR w KQkq - 0 5", ann:"4...d6", eval:20 },
  { ply:9, san:"Nf3", uci:"g1f3", fen:"rnbqk2r/ppp1ppbp/3p1np1/8/2PPP3/2N2N2/PP3PPP/R1BQKB1R b KQkq - 1 5", ann:"5.Nf3", eval:25 },
  { ply:10, san:"O-O", uci:"e8g8", fen:"rnbq1rk1/ppp1ppbp/3p1np1/8/2PPP3/2N2N2/PP3PPP/R1BQKB1R w KQ - 2 6", ann:"5...O-O", eval:20 },
  { ply:11, san:"Be2", uci:"f1e2", fen:"rnbq1rk1/ppp1ppbp/3p1np1/8/2PPP3/2N2N2/PP2BPPP/R1BQK2R b KQ - 3 6", ann:"6.Be2", eval:25 },
  { ply:12, san:"e5", uci:"e7e5", fen:"rnbq1rk1/ppp2pbp/3p1np1/4p3/2PPP3/2N2N2/PP2BPPP/R1BQK2R w KQ - 0 7", ann:"6...e5 — The key KID move!", eval:20, nag:1 },
  { ply:13, san:"O-O", uci:"e1g1", fen:"rnbq1rk1/ppp2pbp/3p1np1/4p3/2PPP3/2N2N2/PP2BPPP/R1BQ1RK1 b - - 1 7", ann:"7.O-O", eval:25 },
  { ply:14, san:"Nc6", uci:"b8c6", fen:"r1bq1rk1/ppp2pbp/2np1np1/4p3/2PPP3/2N2N2/PP2BPPP/R1BQ1RK1 w - - 2 8", ann:"7...Nc6", eval:20 },
  { ply:15, san:"d5", uci:"d4d5", fen:"r1bq1rk1/ppp2pbp/2np1np1/3Pp3/2P1P3/2N2N2/PP2BPPP/R1BQ1RK1 b - - 0 8", ann:"8.d5 — White closes the center. Now both sides attack on opposite wings.", eval:25 },
  { ply:16, san:"Ne7", uci:"c6e7", fen:"r1bq1rk1/ppp1npbp/3p1np1/3Pp3/2P1P3/2N2N2/PP2BPPP/R1BQ1RK1 w - - 1 9", ann:"8...Ne7 — Repositioning the knight for the kingside attack.", eval:20 },
  { ply:17, san:"Ne1", uci:"f3e1", fen:"r1bq1rk1/ppp1npbp/3p1np1/3Pp3/2P1P3/2N5/PP2BPPP/R1BQN1K1 b - - 2 9", ann:"9.Ne1 — White repositions for f3 and g4.", eval:25 },
  { ply:18, san:"Nd7", uci:"f6d7", fen:"r1bq1rk1/pppnnpbp/3p2p1/3Pp3/2P1P3/2N5/PP2BPPP/R1BQN1K1 w - - 3 10", ann:"9...Nd7 — Preparing ...f5.", eval:20 },
  { ply:19, san:"f3", uci:"f2f3", fen:"r1bq1rk1/pppnnpbp/3p2p1/3Pp3/2P1P3/2N2P2/PP2B1PP/R1BQN1K1 b - - 0 10", ann:"10.f3 — White prepares g4.", eval:25 },
  { ply:20, san:"f5", uci:"f7f5", fen:"r1bq1rk1/pppnn1bp/3p2p1/3Ppp2/2P1P3/2N2P2/PP2B1PP/R1BQN1K1 w - - 0 11", ann:"10...f5! — The Mar del Plata attack begins! Black launches a kingside pawn storm. This is one of the most dynamic positions in chess.", eval:20, nag:1 },
]);

// Y-n37TgHr_QIi4Bt — Trap: Premature dxe5
// 1. d4 Nf6 2. c4 g6 3. Nc3 Bg7 4. e4 d6 5. Nf3 O-O 6. Be2 e5 7. dxe5 dxe5 8. Qxd8 Rxd8 9. Nxe5 Nxe4
await insertNodes("Y-n37TgHr_QIi4Bt", [
  { ply:0, fen:"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", ann:"Starting position." },
  { ply:1, san:"d4", uci:"d2d4", fen:"rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq - 0 1", ann:"1.d4", eval:25 },
  { ply:2, san:"Nf6", uci:"g8f6", fen:"rnbqkb1r/pppppppp/5n2/8/3P4/8/PPP1PPPP/RNBQKBNR w KQkq - 1 2", ann:"1...Nf6", eval:20 },
  { ply:3, san:"c4", uci:"c2c4", fen:"rnbqkb1r/pppppppp/5n2/8/2PP4/8/PP2PPPP/RNBQKBNR b KQkq - 0 2", ann:"2.c4", eval:25 },
  { ply:4, san:"g6", uci:"g7g6", fen:"rnbqkb1r/pppppp1p/5np1/8/2PP4/8/PP2PPPP/RNBQKBNR w KQkq - 0 3", ann:"2...g6", eval:20 },
  { ply:5, san:"Nc3", uci:"b1c3", fen:"rnbqkb1r/pppppp1p/5np1/8/2PP4/2N5/PP2PPPP/R1BQKBNR b KQkq - 1 3", ann:"3.Nc3", eval:25 },
  { ply:6, san:"Bg7", uci:"f8g7", fen:"rnbqk2r/ppppppbp/5np1/8/2PP4/2N5/PP2PPPP/R1BQKBNR w KQkq - 2 4", ann:"3...Bg7", eval:20 },
  { ply:7, san:"e4", uci:"e2e4", fen:"rnbqk2r/ppppppbp/5np1/8/2PPP3/2N5/PP3PPP/R1BQKBNR b KQkq - 0 4", ann:"4.e4", eval:25 },
  { ply:8, san:"d6", uci:"d7d6", fen:"rnbqk2r/ppp1ppbp/3p1np1/8/2PPP3/2N5/PP3PPP/R1BQKBNR w KQkq - 0 5", ann:"4...d6", eval:20 },
  { ply:9, san:"Nf3", uci:"g1f3", fen:"rnbqk2r/ppp1ppbp/3p1np1/8/2PPP3/2N2N2/PP3PPP/R1BQKB1R b KQkq - 1 5", ann:"5.Nf3", eval:25 },
  { ply:10, san:"O-O", uci:"e8g8", fen:"rnbq1rk1/ppp1ppbp/3p1np1/8/2PPP3/2N2N2/PP3PPP/R1BQKB1R w KQ - 2 6", ann:"5...O-O", eval:20 },
  { ply:11, san:"Be2", uci:"f1e2", fen:"rnbq1rk1/ppp1ppbp/3p1np1/8/2PPP3/2N2N2/PP2BPPP/R1BQK2R b KQ - 3 6", ann:"6.Be2", eval:25 },
  { ply:12, san:"e5", uci:"e7e5", fen:"rnbq1rk1/ppp2pbp/3p1np1/4p3/2PPP3/2N2N2/PP2BPPP/R1BQK2R w KQ - 0 7", ann:"6...e5 — KID main move.", eval:20 },
  { ply:13, san:"dxe5", uci:"d4e5", fen:"rnbq1rk1/ppp2pbp/3p1np1/4P3/2P1P3/2N2N2/PP2BPPP/R1BQK2R b KQ - 0 7", ann:"7.dxe5?! — This is premature! White opens the position before completing development.", eval:5, nag:6 },
  { ply:14, san:"dxe5", uci:"d6e5", fen:"rnbq1rk1/ppp2pbp/5np1/4p3/2P1P3/2N2N2/PP2BPPP/R1BQK2R w KQ - 0 8", ann:"7...dxe5 — Black recaptures.", eval:5 },
  { ply:15, san:"Qxd8", uci:"d1d8", fen:"rnbr1rk1/ppp2pbp/5np1/4p3/2P1P3/2N2N2/PP2BPPP/R1B1K2R b KQ - 0 8", ann:"8.Qxd8 — White trades queens.", eval:5 },
  { ply:16, san:"Rxd8", uci:"f8d8", fen:"rnbr2k1/ppp2pbp/5np1/4p3/2P1P3/2N2N2/PP2BPPP/R1B1K2R w KQ - 0 9", ann:"8...Rxd8 — Black recaptures with the rook.", eval:5 },
  { ply:17, san:"Nxe5", uci:"f3e5", fen:"rnbr2k1/ppp2pbp/5np1/4N3/2P1P3/2N5/PP2BPPP/R1B1K2R b KQ - 0 9", ann:"9.Nxe5 — White grabs the pawn.", eval:10 },
  { ply:18, san:"Nxe4", uci:"f6e4", fen:"rnbr2k1/ppp2pbp/6p1/4N3/2P1n3/2N5/PP2BPPP/R1B1K2R w KQ - 0 10", ann:"9...Nxe4! — Black wins the pawn back immediately, and White's knight on e5 is now attacked. Black has excellent compensation.", eval:-10, nag:1 },
]);

// pKXNOrHVCVZgPEda — Averbakh: 5.Be2 O-O 6.Bg5
// 1. d4 Nf6 2. c4 g6 3. Nc3 Bg7 4. e4 d6 5. Be2 O-O 6. Bg5 c5 7. d5 h6 8. Bf4 e6
await insertNodes("pKXNOrHVCVZgPEda", [
  { ply:0, fen:"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", ann:"Starting position." },
  { ply:1, san:"d4", uci:"d2d4", fen:"rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq - 0 1", ann:"1.d4", eval:25 },
  { ply:2, san:"Nf6", uci:"g8f6", fen:"rnbqkb1r/pppppppp/5n2/8/3P4/8/PPP1PPPP/RNBQKBNR w KQkq - 1 2", ann:"1...Nf6", eval:20 },
  { ply:3, san:"c4", uci:"c2c4", fen:"rnbqkb1r/pppppppp/5n2/8/2PP4/8/PP2PPPP/RNBQKBNR b KQkq - 0 2", ann:"2.c4", eval:25 },
  { ply:4, san:"g6", uci:"g7g6", fen:"rnbqkb1r/pppppp1p/5np1/8/2PP4/8/PP2PPPP/RNBQKBNR w KQkq - 0 3", ann:"2...g6", eval:20 },
  { ply:5, san:"Nc3", uci:"b1c3", fen:"rnbqkb1r/pppppp1p/5np1/8/2PP4/2N5/PP2PPPP/R1BQKBNR b KQkq - 1 3", ann:"3.Nc3", eval:25 },
  { ply:6, san:"Bg7", uci:"f8g7", fen:"rnbqk2r/ppppppbp/5np1/8/2PP4/2N5/PP2PPPP/R1BQKBNR w KQkq - 2 4", ann:"3...Bg7", eval:20 },
  { ply:7, san:"e4", uci:"e2e4", fen:"rnbqk2r/ppppppbp/5np1/8/2PPP3/2N5/PP3PPP/R1BQKBNR b KQkq - 0 4", ann:"4.e4", eval:25 },
  { ply:8, san:"d6", uci:"d7d6", fen:"rnbqk2r/ppp1ppbp/3p1np1/8/2PPP3/2N5/PP3PPP/R1BQKBNR w KQkq - 0 5", ann:"4...d6", eval:20 },
  { ply:9, san:"Be2", uci:"f1e2", fen:"rnbqk2r/ppp1ppbp/3p1np1/8/2PPP3/2N5/PP2BPPP/R1BQKNR1 b KQkq - 1 5", ann:"5.Be2 — White develops the bishop, preparing to castle.", eval:25 },
  { ply:10, san:"O-O", uci:"e8g8", fen:"rnbq1rk1/ppp1ppbp/3p1np1/8/2PPP3/2N5/PP2BPPP/R1BQKNR1 w KQ - 2 6", ann:"5...O-O", eval:20 },
  { ply:11, san:"Bg5", uci:"c1g5", fen:"rnbq1rk1/ppp1ppbp/3p1np1/6B1/2PPP3/2N5/PP2BPPP/R2QKNR1 b KQ - 3 6", ann:"6.Bg5 — The Averbakh variation! White pins the knight, preventing ...e5.", eval:30, nag:1 },
  { ply:12, san:"c5", uci:"c7c5", fen:"rnbq1rk1/pp2ppbp/3p1np1/2p3B1/2PPP3/2N5/PP2BPPP/R2QKNR1 w KQ - 0 7", ann:"6...c5 — Black challenges the center.", eval:20, nag:1 },
  { ply:13, san:"d5", uci:"d4d5", fen:"rnbq1rk1/pp2ppbp/3p1np1/2pPB3/2P1P3/2N5/PP2BPPP/R2QKNR1 b KQ - 0 7", ann:"7.d5 — White closes the center.", eval:30 },
  { ply:14, san:"h6", uci:"h7h6", fen:"rnbq1rk1/pp2ppb1/3p1npp/2pPB3/2P1P3/2N5/PP2BPPP/R2QKNR1 w KQ - 0 8", ann:"7...h6 — Chasing the bishop.", eval:20 },
  { ply:15, san:"Bf4", uci:"g5f4", fen:"rnbq1rk1/pp2ppb1/3p1npp/2pP4/2P1PB2/2N5/PP2BPPP/R2QKNR1 b KQ - 1 8", ann:"8.Bf4 — The bishop retreats to f4.", eval:30 },
  { ply:16, san:"e6", uci:"e7e6", fen:"rnbq1rk1/pp3pb1/3ppnpp/2pP4/2P1PB2/2N5/PP2BPPP/R2QKNR1 w KQ - 0 9", ann:"8...e6 — Black counterattacks the pawn chain. The position is dynamically complex.", eval:20, nag:1 },
]);

// shj-pmSoX7btbntX — Bayonet Attack: 9.b4
// 1. d4 Nf6 2. c4 g6 3. Nc3 Bg7 4. e4 d6 5. Nf3 O-O 6. Be2 e5 7. O-O Nc6 8. d5 Ne7 9. b4 Nh5 10. g3 f5
await insertNodes("shj-pmSoX7btbntX", [
  { ply:0, fen:"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", ann:"Starting position." },
  { ply:1, san:"d4", uci:"d2d4", fen:"rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq - 0 1", ann:"1.d4", eval:25 },
  { ply:2, san:"Nf6", uci:"g8f6", fen:"rnbqkb1r/pppppppp/5n2/8/3P4/8/PPP1PPPP/RNBQKBNR w KQkq - 1 2", ann:"1...Nf6", eval:20 },
  { ply:3, san:"c4", uci:"c2c4", fen:"rnbqkb1r/pppppppp/5n2/8/2PP4/8/PP2PPPP/RNBQKBNR b KQkq - 0 2", ann:"2.c4", eval:25 },
  { ply:4, san:"g6", uci:"g7g6", fen:"rnbqkb1r/pppppp1p/5np1/8/2PP4/8/PP2PPPP/RNBQKBNR w KQkq - 0 3", ann:"2...g6", eval:20 },
  { ply:5, san:"Nc3", uci:"b1c3", fen:"rnbqkb1r/pppppp1p/5np1/8/2PP4/2N5/PP2PPPP/R1BQKBNR b KQkq - 1 3", ann:"3.Nc3", eval:25 },
  { ply:6, san:"Bg7", uci:"f8g7", fen:"rnbqk2r/ppppppbp/5np1/8/2PP4/2N5/PP2PPPP/R1BQKBNR w KQkq - 2 4", ann:"3...Bg7", eval:20 },
  { ply:7, san:"e4", uci:"e2e4", fen:"rnbqk2r/ppppppbp/5np1/8/2PPP3/2N5/PP3PPP/R1BQKBNR b KQkq - 0 4", ann:"4.e4", eval:25 },
  { ply:8, san:"d6", uci:"d7d6", fen:"rnbqk2r/ppp1ppbp/3p1np1/8/2PPP3/2N5/PP3PPP/R1BQKBNR w KQkq - 0 5", ann:"4...d6", eval:20 },
  { ply:9, san:"Nf3", uci:"g1f3", fen:"rnbqk2r/ppp1ppbp/3p1np1/8/2PPP3/2N2N2/PP3PPP/R1BQKB1R b KQkq - 1 5", ann:"5.Nf3", eval:25 },
  { ply:10, san:"O-O", uci:"e8g8", fen:"rnbq1rk1/ppp1ppbp/3p1np1/8/2PPP3/2N2N2/PP3PPP/R1BQKB1R w KQ - 2 6", ann:"5...O-O", eval:20 },
  { ply:11, san:"Be2", uci:"f1e2", fen:"rnbq1rk1/ppp1ppbp/3p1np1/8/2PPP3/2N2N2/PP2BPPP/R1BQK2R b KQ - 3 6", ann:"6.Be2", eval:25 },
  { ply:12, san:"e5", uci:"e7e5", fen:"rnbq1rk1/ppp2pbp/3p1np1/4p3/2PPP3/2N2N2/PP2BPPP/R1BQK2R w KQ - 0 7", ann:"6...e5", eval:20 },
  { ply:13, san:"O-O", uci:"e1g1", fen:"rnbq1rk1/ppp2pbp/3p1np1/4p3/2PPP3/2N2N2/PP2BPPP/R1BQ1RK1 b - - 1 7", ann:"7.O-O", eval:25 },
  { ply:14, san:"Nc6", uci:"b8c6", fen:"r1bq1rk1/ppp2pbp/2np1np1/4p3/2PPP3/2N2N2/PP2BPPP/R1BQ1RK1 w - - 2 8", ann:"7...Nc6", eval:20 },
  { ply:15, san:"d5", uci:"d4d5", fen:"r1bq1rk1/ppp2pbp/2np1np1/3Pp3/2P1P3/2N2N2/PP2BPPP/R1BQ1RK1 b - - 0 8", ann:"8.d5 — White closes the center.", eval:25 },
  { ply:16, san:"Ne7", uci:"c6e7", fen:"r1bq1rk1/ppp1npbp/3p1np1/3Pp3/2P1P3/2N2N2/PP2BPPP/R1BQ1RK1 w - - 1 9", ann:"8...Ne7 — Repositioning.", eval:20 },
  { ply:17, san:"b4", uci:"b2b4", fen:"r1bq1rk1/ppp1npbp/3p1np1/3Pp3/1PP1P3/2N2N2/P3BPPP/R1BQ1RK1 b - - 0 9", ann:"9.b4! — The Bayonet Attack! White launches a queenside pawn storm.", eval:30, nag:1 },
  { ply:18, san:"Nh5", uci:"f6h5", fen:"r1bq1rk1/ppp1npbp/3p2p1/3Pp2n/1PP1P3/2N2N2/P3BPPP/R1BQ1RK1 w - - 1 10", ann:"9...Nh5 — Black repositions the knight to f4.", eval:20 },
  { ply:19, san:"g3", uci:"g2g3", fen:"r1bq1rk1/ppp1npbp/3p2p1/3Pp2n/1PP1P3/2N2NP1/P3BP1P/R1BQ1RK1 b - - 0 10", ann:"10.g3 — Preventing ...Nf4.", eval:30 },
  { ply:20, san:"f5", uci:"f7f5", fen:"r1bq1rk1/ppp1n1bp/3p2p1/3Ppp1n/1PP1P3/2N2NP1/P3BP1P/R1BQ1RK1 w - - 0 11", ann:"10...f5! — Black launches the kingside attack. Both sides race on opposite wings in one of the most exciting KID positions.", eval:20, nag:1 },
]);

// ─────────────────────────────────────────────────────────────────────────────
// SCOTCH GAME
// ─────────────────────────────────────────────────────────────────────────────

// dJiDV1bv2p4467P1 — Main Line: 3...exd4 4.Nxd4
// 1. e4 e5 2. Nf3 Nc6 3. d4 exd4 4. Nxd4 Nf6 5. Nc3 Bb4 6. Nxc6 bxc6 7. Bd3
await insertNodes("dJiDV1bv2p4467P1", [
  { ply:0, fen:"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", ann:"Starting position." },
  { ply:1, san:"e4", uci:"e2e4", fen:"rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1", ann:"1.e4 — The most popular opening move.", eval:25 },
  { ply:2, san:"e5", uci:"e7e5", fen:"rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2", ann:"1...e5 — The Open Game.", eval:20 },
  { ply:3, san:"Nf3", uci:"g1f3", fen:"rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2", ann:"2.Nf3 — Attacking e5.", eval:25 },
  { ply:4, san:"Nc6", uci:"b8c6", fen:"r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3", ann:"2...Nc6 — Defending e5.", eval:20 },
  { ply:5, san:"d4", uci:"d2d4", fen:"r1bqkbnr/pppp1ppp/2n5/4p3/3PP3/5N2/PPP2PPP/RNBQKB1R b KQkq - 0 3", ann:"3.d4 — The Scotch Game! White immediately opens the center.", eval:25, nag:1 },
  { ply:6, san:"exd4", uci:"e5d4", fen:"r1bqkbnr/pppp1ppp/2n5/8/3pP3/5N2/PPP2PPP/RNBQKB1R w KQkq - 0 4", ann:"3...exd4 — Black accepts the challenge.", eval:20 },
  { ply:7, san:"Nxd4", uci:"f3d4", fen:"r1bqkbnr/pppp1ppp/2n5/8/3NP3/8/PPP2PPP/RNBQKB1R b KQkq - 0 4", ann:"4.Nxd4 — White recaptures, centralizing the knight.", eval:25 },
  { ply:8, san:"Nf6", uci:"g8f6", fen:"r1bqkb1r/pppp1ppp/2n2n2/8/3NP3/8/PPP2PPP/RNBQKB1R w KQkq - 1 5", ann:"4...Nf6 — Attacking e4 and developing.", eval:20, nag:1 },
  { ply:9, san:"Nc3", uci:"b1c3", fen:"r1bqkb1r/pppp1ppp/2n2n2/8/3NP3/2N5/PPP2PPP/R1BQKB1R b KQkq - 2 5", ann:"5.Nc3 — Defending e4 and developing.", eval:25 },
  { ply:10, san:"Bb4", uci:"f8b4", fen:"r1bqk2r/pppp1ppp/2n2n2/8/1b1NP3/2N5/PPP2PPP/R1BQKB1R w KQkq - 3 6", ann:"5...Bb4 — Pinning the knight! Black develops with tempo.", eval:20, nag:1 },
  { ply:11, san:"Nxc6", uci:"d4c6", fen:"r1bqk2r/pppp1ppp/2N2n2/8/1b2P3/2N5/PPP2PPP/R1BQKB1R b KQkq - 0 6", ann:"6.Nxc6 — White trades the knight, doubling Black's pawns.", eval:25 },
  { ply:12, san:"bxc6", uci:"b7c6", fen:"r1bqk2r/p1pp1ppp/2p2n2/8/1b2P3/2N5/PPP2PPP/R1BQKB1R w KQkq - 0 7", ann:"6...bxc6 — Black recaptures, accepting the doubled pawns but gaining the bishop pair.", eval:20 },
  { ply:13, san:"Bd3", uci:"f1d3", fen:"r1bqk2r/p1pp1ppp/2p2n2/8/1b2P3/2NB4/PPP2PPP/R1BQK2R b KQkq - 1 7", ann:"7.Bd3 — Developing the bishop, preparing to castle. White has a slight edge due to the bishop pair and pawn structure.", eval:25 },
]);

// LtC75SQDpGOgURjF — vs ...Qh4: Aggressive Queen
// 1. e4 e5 2. Nf3 Nc6 3. d4 exd4 4. Nxd4 Qh4 5. Nc3 Bb4 6. Be2 Qxe4 7. Nb5
await insertNodes("LtC75SQDpGOgURjF", [
  { ply:0, fen:"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", ann:"Starting position." },
  { ply:1, san:"e4", uci:"e2e4", fen:"rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1", ann:"1.e4", eval:25 },
  { ply:2, san:"e5", uci:"e7e5", fen:"rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2", ann:"1...e5", eval:20 },
  { ply:3, san:"Nf3", uci:"g1f3", fen:"rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2", ann:"2.Nf3", eval:25 },
  { ply:4, san:"Nc6", uci:"b8c6", fen:"r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3", ann:"2...Nc6", eval:20 },
  { ply:5, san:"d4", uci:"d2d4", fen:"r1bqkbnr/pppp1ppp/2n5/4p3/3PP3/5N2/PPP2PPP/RNBQKB1R b KQkq - 0 3", ann:"3.d4 — Scotch Game.", eval:25 },
  { ply:6, san:"exd4", uci:"e5d4", fen:"r1bqkbnr/pppp1ppp/2n5/8/3pP3/5N2/PPP2PPP/RNBQKB1R w KQkq - 0 4", ann:"3...exd4", eval:20 },
  { ply:7, san:"Nxd4", uci:"f3d4", fen:"r1bqkbnr/pppp1ppp/2n5/8/3NP3/8/PPP2PPP/RNBQKB1R b KQkq - 0 4", ann:"4.Nxd4", eval:25 },
  { ply:8, san:"Qh4", uci:"d8h4", fen:"r1b1kbnr/pppp1ppp/2n5/8/3NP2q/8/PPP2PPP/RNBQKB1R w KQkq - 1 5", ann:"4...Qh4?! — Aggressive but dubious. Black brings the queen out early.", eval:40, nag:6 },
  { ply:9, san:"Nc3", uci:"b1c3", fen:"r1b1kbnr/pppp1ppp/2n5/8/3NP2q/2N5/PPP2PPP/R1BQKB1R b KQkq - 2 5", ann:"5.Nc3 — Developing, ignoring the queen threat.", eval:40 },
  { ply:10, san:"Bb4", uci:"f8b4", fen:"r1b1k1nr/pppp1ppp/2n5/8/1b1NP2q/2N5/PPP2PPP/R1BQKB1R w KQkq - 3 6", ann:"5...Bb4 — Pinning the knight.", eval:35 },
  { ply:11, san:"Be2", uci:"f1e2", fen:"r1b1k1nr/pppp1ppp/2n5/8/1b1NP2q/2N5/PPP1BPPP/R1BQK2R b KQkq - 4 6", ann:"6.Be2 — Blocking the queen's attack on e1.", eval:40 },
  { ply:12, san:"Qxe4", uci:"h4e4", fen:"r1b1k1nr/pppp1ppp/2n5/8/1b1Nq3/2N5/PPP1BPPP/R1BQK2R w KQkq - 0 7", ann:"6...Qxe4?! — Black grabs the pawn but the queen is now exposed.", eval:50, nag:6 },
  { ply:13, san:"Nb5", uci:"d4b5", fen:"r1b1k1nr/pppp1ppp/2n5/1N6/1b2q3/2N5/PPP1BPPP/R1BQK2R b KQkq - 1 7", ann:"7.Nb5! — Attacking the queen and threatening Nc7+. White has a huge initiative.", eval:60, nag:1 },
]);

// v65vXO7WC-U3PmyS — vs ...Bc5: Classical Response
// 1. e4 e5 2. Nf3 Nc6 3. d4 exd4 4. Nxd4 Bc5 5. Nxc6 Qf6 6. Qd2 dxc6 7. Nc3
await insertNodes("v65vXO7WC-U3PmyS", [
  { ply:0, fen:"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", ann:"Starting position." },
  { ply:1, san:"e4", uci:"e2e4", fen:"rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1", ann:"1.e4", eval:25 },
  { ply:2, san:"e5", uci:"e7e5", fen:"rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2", ann:"1...e5", eval:20 },
  { ply:3, san:"Nf3", uci:"g1f3", fen:"rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2", ann:"2.Nf3", eval:25 },
  { ply:4, san:"Nc6", uci:"b8c6", fen:"r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3", ann:"2...Nc6", eval:20 },
  { ply:5, san:"d4", uci:"d2d4", fen:"r1bqkbnr/pppp1ppp/2n5/4p3/3PP3/5N2/PPP2PPP/RNBQKB1R b KQkq - 0 3", ann:"3.d4 — Scotch Game.", eval:25 },
  { ply:6, san:"exd4", uci:"e5d4", fen:"r1bqkbnr/pppp1ppp/2n5/8/3pP3/5N2/PPP2PPP/RNBQKB1R w KQkq - 0 4", ann:"3...exd4", eval:20 },
  { ply:7, san:"Nxd4", uci:"f3d4", fen:"r1bqkbnr/pppp1ppp/2n5/8/3NP3/8/PPP2PPP/RNBQKB1R b KQkq - 0 4", ann:"4.Nxd4", eval:25 },
  { ply:8, san:"Bc5", uci:"f8c5", fen:"r1bqk1nr/pppp1ppp/2n5/2b5/3NP3/8/PPP2PPP/RNBQKB1R w KQkq - 1 5", ann:"4...Bc5 — Classical! Black develops the bishop actively, attacking d4.", eval:20, nag:1 },
  { ply:9, san:"Nxc6", uci:"d4c6", fen:"r1bqk1nr/pppp1ppp/2N5/2b5/4P3/8/PPP2PPP/RNBQKB1R b KQkq - 0 5", ann:"5.Nxc6 — White trades the knight, gaining the bishop pair.", eval:25 },
  { ply:10, san:"Qf6", uci:"d8f6", fen:"r1b1k1nr/pppp1ppp/2N2q2/2b5/4P3/8/PPP2PPP/RNBQKB1R w KQkq - 1 6", ann:"5...Qf6 — Attacking the knight on c6 and the f2 pawn.", eval:20 },
  { ply:11, san:"Qd2", uci:"d1d2", fen:"r1b1k1nr/pppp1ppp/2N2q2/2b5/4P3/8/PPPQ1PPP/RNB1KB1R b KQkq - 2 6", ann:"6.Qd2 — Defending c1 and preparing to develop.", eval:25 },
  { ply:12, san:"dxc6", uci:"d7c6", fen:"r1b1k1nr/ppp2ppp/2p2q2/2b5/4P3/8/PPPQ1PPP/RNB1KB1R w KQkq - 0 7", ann:"6...dxc6 — Black recaptures, accepting the doubled pawns but gaining the bishop pair.", eval:20 },
  { ply:13, san:"Nc3", uci:"b1c3", fen:"r1b1k1nr/ppp2ppp/2p2q2/2b5/4P3/2N5/PPPQ1PPP/R1B1KB1R b KQkq - 1 7", ann:"7.Nc3 — Development. White has a slight edge with better pawn structure.", eval:25 },
]);

// RqlzsAyMlP_Szanp — vs ...Nf6: Classical 5.Nc3
// 1. e4 e5 2. Nf3 Nc6 3. d4 exd4 4. Nxd4 Nf6 5. Nc3 Be7 6. Bf4 O-O 7. Qd2
await insertNodes("RqlzsAyMlP_Szanp", [
  { ply:0, fen:"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", ann:"Starting position." },
  { ply:1, san:"e4", uci:"e2e4", fen:"rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1", ann:"1.e4", eval:25 },
  { ply:2, san:"e5", uci:"e7e5", fen:"rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2", ann:"1...e5", eval:20 },
  { ply:3, san:"Nf3", uci:"g1f3", fen:"rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2", ann:"2.Nf3", eval:25 },
  { ply:4, san:"Nc6", uci:"b8c6", fen:"r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3", ann:"2...Nc6", eval:20 },
  { ply:5, san:"d4", uci:"d2d4", fen:"r1bqkbnr/pppp1ppp/2n5/4p3/3PP3/5N2/PPP2PPP/RNBQKB1R b KQkq - 0 3", ann:"3.d4 — Scotch Game.", eval:25 },
  { ply:6, san:"exd4", uci:"e5d4", fen:"r1bqkbnr/pppp1ppp/2n5/8/3pP3/5N2/PPP2PPP/RNBQKB1R w KQkq - 0 4", ann:"3...exd4", eval:20 },
  { ply:7, san:"Nxd4", uci:"f3d4", fen:"r1bqkbnr/pppp1ppp/2n5/8/3NP3/8/PPP2PPP/RNBQKB1R b KQkq - 0 4", ann:"4.Nxd4", eval:25 },
  { ply:8, san:"Nf6", uci:"g8f6", fen:"r1bqkb1r/pppp1ppp/2n2n2/8/3NP3/8/PPP2PPP/RNBQKB1R w KQkq - 1 5", ann:"4...Nf6 — Attacking e4.", eval:20 },
  { ply:9, san:"Nc3", uci:"b1c3", fen:"r1bqkb1r/pppp1ppp/2n2n2/8/3NP3/2N5/PPP2PPP/R1BQKB1R b KQkq - 2 5", ann:"5.Nc3 — Defending e4.", eval:25 },
  { ply:10, san:"Be7", uci:"f8e7", fen:"r1bqk2r/ppppbppp/2n2n2/8/3NP3/2N5/PPP2PPP/R1BQKB1R w KQkq - 3 6", ann:"5...Be7 — Solid development, preparing to castle.", eval:20 },
  { ply:11, san:"Bf4", uci:"c1f4", fen:"r1bqk2r/ppppbppp/2n2n2/8/3NPB2/2N5/PPP2PPP/R2QKB1R b KQkq - 4 6", ann:"6.Bf4 — Developing the bishop, preparing Qd2 and O-O-O.", eval:25 },
  { ply:12, san:"O-O", uci:"e8g8", fen:"r1bq1rk1/ppppbppp/2n2n2/8/3NPB2/2N5/PPP2PPP/R2QKB1R w KQ - 5 7", ann:"6...O-O — Black castles safely.", eval:20 },
  { ply:13, san:"Qd2", uci:"d1d2", fen:"r1bq1rk1/ppppbppp/2n2n2/8/3NPB2/2N5/PPPQ1PPP/R3KB1R b KQ - 6 7", ann:"7.Qd2 — Preparing O-O-O. White aims for opposite-side castling and a kingside attack.", eval:25 },
]);

// dKCxwklAwkG6enos — Trap: ...Nxe4 Pawn Grab
// 1. e4 e5 2. Nf3 Nc6 3. d4 exd4 4. Nxd4 Nf6 5. Nxc6 bxc6 6. e5 Nd5 7. c4 Nb6 8. Bd3
await insertNodes("dKCxwklAwkG6enos", [
  { ply:0, fen:"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", ann:"Starting position." },
  { ply:1, san:"e4", uci:"e2e4", fen:"rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1", ann:"1.e4", eval:25 },
  { ply:2, san:"e5", uci:"e7e5", fen:"rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2", ann:"1...e5", eval:20 },
  { ply:3, san:"Nf3", uci:"g1f3", fen:"rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2", ann:"2.Nf3", eval:25 },
  { ply:4, san:"Nc6", uci:"b8c6", fen:"r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3", ann:"2...Nc6", eval:20 },
  { ply:5, san:"d4", uci:"d2d4", fen:"r1bqkbnr/pppp1ppp/2n5/4p3/3PP3/5N2/PPP2PPP/RNBQKB1R b KQkq - 0 3", ann:"3.d4 — Scotch Game.", eval:25 },
  { ply:6, san:"exd4", uci:"e5d4", fen:"r1bqkbnr/pppp1ppp/2n5/8/3pP3/5N2/PPP2PPP/RNBQKB1R w KQkq - 0 4", ann:"3...exd4", eval:20 },
  { ply:7, san:"Nxd4", uci:"f3d4", fen:"r1bqkbnr/pppp1ppp/2n5/8/3NP3/8/PPP2PPP/RNBQKB1R b KQkq - 0 4", ann:"4.Nxd4", eval:25 },
  { ply:8, san:"Nf6", uci:"g8f6", fen:"r1bqkb1r/pppp1ppp/2n2n2/8/3NP3/8/PPP2PPP/RNBQKB1R w KQkq - 1 5", ann:"4...Nf6", eval:20 },
  { ply:9, san:"Nxc6", uci:"d4c6", fen:"r1bqkb1r/pppp1ppp/2N2n2/8/4P3/8/PPP2PPP/RNBQKB1R b KQkq - 0 5", ann:"5.Nxc6 — White trades the knight.", eval:25 },
  { ply:10, san:"bxc6", uci:"b7c6", fen:"r1bqkb1r/p1pp1ppp/2p2n2/8/4P3/8/PPP2PPP/RNBQKB1R w KQkq - 0 6", ann:"5...bxc6 — Black recaptures.", eval:20 },
  { ply:11, san:"e5", uci:"e4e5", fen:"r1bqkb1r/p1pp1ppp/2p2n2/4P3/8/8/PPP2PPP/RNBQKB1R b KQkq - 0 6", ann:"6.e5! — White advances, attacking the knight.", eval:30, nag:1 },
  { ply:12, san:"Nd5", uci:"f6d5", fen:"r1bqkb1r/p1pp1ppp/2p5/3nP3/8/8/PPP2PPP/RNBQKB1R w KQkq - 1 7", ann:"6...Nd5 — The knight retreats to d5.", eval:25 },
  { ply:13, san:"c4", uci:"c2c4", fen:"r1bqkb1r/p1pp1ppp/2p5/3nP3/2P5/8/PP3PPP/RNBQKB1R b KQkq - 0 7", ann:"7.c4 — Attacking the knight again.", eval:30 },
  { ply:14, san:"Nb6", uci:"d5b6", fen:"r1bqkb1r/p1pp1ppp/1np5/4P3/2P5/8/PP3PPP/RNBQKB1R w KQkq - 1 8", ann:"7...Nb6 — The knight retreats.", eval:25 },
  { ply:15, san:"Bd3", uci:"f1d3", fen:"r1bqkb1r/p1pp1ppp/1np5/4P3/2P5/3B4/PP3PPP/RNBQK2R b KQkq - 2 8", ann:"8.Bd3 — White develops, preparing to castle. White has a strong pawn on e5 and good piece activity.", eval:30 },
]);

// DVlxBHrKIg6DhUfH — vs ...d6: Passive Decline
// 1. e4 e5 2. Nf3 Nc6 3. d4 d6 4. dxe5 dxe5 5. Qxd8+ Nxd8 6. Bc4
await insertNodes("DVlxBHrKIg6DhUfH", [
  { ply:0, fen:"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", ann:"Starting position." },
  { ply:1, san:"e4", uci:"e2e4", fen:"rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1", ann:"1.e4", eval:25 },
  { ply:2, san:"e5", uci:"e7e5", fen:"rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2", ann:"1...e5", eval:20 },
  { ply:3, san:"Nf3", uci:"g1f3", fen:"rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2", ann:"2.Nf3", eval:25 },
  { ply:4, san:"Nc6", uci:"b8c6", fen:"r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3", ann:"2...Nc6", eval:20 },
  { ply:5, san:"d4", uci:"d2d4", fen:"r1bqkbnr/pppp1ppp/2n5/4p3/3PP3/5N2/PPP2PPP/RNBQKB1R b KQkq - 0 3", ann:"3.d4 — Scotch Game.", eval:25 },
  { ply:6, san:"d6", uci:"d7d6", fen:"r1bqkbnr/ppp2ppp/2np4/4p3/3PP3/5N2/PPP2PPP/RNBQKB1R w KQkq - 0 4", ann:"3...d6 — Passive. Black declines the Scotch, choosing a solid approach.", eval:30 },
  { ply:7, san:"dxe5", uci:"d4e5", fen:"r1bqkbnr/ppp2ppp/2np4/4P3/4P3/5N2/PPP2PPP/RNBQKB1R b KQkq - 0 4", ann:"4.dxe5 — White opens the position.", eval:30 },
  { ply:8, san:"dxe5", uci:"d6e5", fen:"r1bqkbnr/ppp2ppp/2n5/4p3/4P3/5N2/PPP2PPP/RNBQKB1R w KQkq - 0 5", ann:"4...dxe5 — Black recaptures.", eval:25 },
  { ply:9, san:"Qxd8+", uci:"d1d8", fen:"r1bQkbnr/ppp2ppp/2n5/4p3/4P3/5N2/PPP2PPP/RNB1KB1R b KQkq - 0 5", ann:"5.Qxd8+! — White forces a queen trade, heading for an endgame advantage.", eval:30, nag:1 },
  { ply:10, san:"Nxd8", uci:"c6d8", fen:"r1bnkbnr/ppp2ppp/8/4p3/4P3/5N2/PPP2PPP/RNB1KB1R w KQkq - 0 6", ann:"5...Nxd8 — Black recaptures.", eval:25 },
  { ply:11, san:"Bc4", uci:"f1c4", fen:"r1bnkbnr/ppp2ppp/8/4p3/2B1P3/5N2/PPP2PPP/RNB1K2R b KQkq - 1 6", ann:"6.Bc4 — Developing the bishop, targeting f7. White has a slight endgame advantage.", eval:30 },
]);

// XHycykT4hcXJq18_ — vs ...d5: Counter-Gambit
// 1. e4 e5 2. Nf3 Nc6 3. d4 exd4 4. Nxd4 d5 5. exd5 Qxd5 6. Nb5 Qd8 7. c4
await insertNodes("XHycykT4hcXJq18_", [
  { ply:0, fen:"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", ann:"Starting position." },
  { ply:1, san:"e4", uci:"e2e4", fen:"rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1", ann:"1.e4", eval:25 },
  { ply:2, san:"e5", uci:"e7e5", fen:"rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2", ann:"1...e5", eval:20 },
  { ply:3, san:"Nf3", uci:"g1f3", fen:"rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2", ann:"2.Nf3", eval:25 },
  { ply:4, san:"Nc6", uci:"b8c6", fen:"r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3", ann:"2...Nc6", eval:20 },
  { ply:5, san:"d4", uci:"d2d4", fen:"r1bqkbnr/pppp1ppp/2n5/4p3/3PP3/5N2/PPP2PPP/RNBQKB1R b KQkq - 0 3", ann:"3.d4 — Scotch Game.", eval:25 },
  { ply:6, san:"exd4", uci:"e5d4", fen:"r1bqkbnr/pppp1ppp/2n5/8/3pP3/5N2/PPP2PPP/RNBQKB1R w KQkq - 0 4", ann:"3...exd4", eval:20 },
  { ply:7, san:"Nxd4", uci:"f3d4", fen:"r1bqkbnr/pppp1ppp/2n5/8/3NP3/8/PPP2PPP/RNBQKB1R b KQkq - 0 4", ann:"4.Nxd4", eval:25 },
  { ply:8, san:"d5", uci:"d7d5", fen:"r1bqkbnr/ppp2ppp/2n5/3p4/3NP3/8/PPP2PPP/RNBQKB1R w KQkq - 0 5", ann:"4...d5 — Counter-gambit! Black immediately challenges the center.", eval:15, nag:1 },
  { ply:9, san:"exd5", uci:"e4d5", fen:"r1bqkbnr/ppp2ppp/2n5/3P4/3N4/8/PPP2PPP/RNBQKB1R b KQkq - 0 5", ann:"5.exd5 — White captures.", eval:25 },
  { ply:10, san:"Qxd5", uci:"d8d5", fen:"r1b1kbnr/ppp2ppp/2n5/3q4/3N4/8/PPP2PPP/RNBQKB1R w KQkq - 0 6", ann:"5...Qxd5 — Black recaptures with the queen, centralizing it.", eval:20 },
  { ply:11, san:"Nb5", uci:"d4b5", fen:"r1b1kbnr/ppp2ppp/2n5/1N1q4/8/8/PPP2PPP/RNBQKB1R b KQkq - 1 6", ann:"6.Nb5! — Attacking the queen.", eval:30, nag:1 },
  { ply:12, san:"Qd8", uci:"d5d8", fen:"r1bqkbnr/ppp2ppp/2n5/1N6/8/8/PPP2PPP/RNBQKB1R w KQkq - 2 7", ann:"6...Qd8 — The queen retreats.", eval:25 },
  { ply:13, san:"c4", uci:"c2c4", fen:"r1bqkbnr/ppp2ppp/2n5/1N6/2P5/8/PP3PPP/RNBQKB1R b KQkq - 0 7", ann:"7.c4 — White establishes a strong pawn center. White has a significant advantage.", eval:35 },
]);

// 1zUkOUUwvtpFOS6A — Trap: Mate Threat after ...Qf6
// 1. e4 e5 2. Nf3 Nc6 3. d4 exd4 4. Nxd4 Qf6 5. Nxc6 bxc6 6. Nc3 Bc5 7. Qf3
await insertNodes("1zUkOUUwvtpFOS6A", [
  { ply:0, fen:"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", ann:"Starting position." },
  { ply:1, san:"e4", uci:"e2e4", fen:"rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1", ann:"1.e4", eval:25 },
  { ply:2, san:"e5", uci:"e7e5", fen:"rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2", ann:"1...e5", eval:20 },
  { ply:3, san:"Nf3", uci:"g1f3", fen:"rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2", ann:"2.Nf3", eval:25 },
  { ply:4, san:"Nc6", uci:"b8c6", fen:"r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3", ann:"2...Nc6", eval:20 },
  { ply:5, san:"d4", uci:"d2d4", fen:"r1bqkbnr/pppp1ppp/2n5/4p3/3PP3/5N2/PPP2PPP/RNBQKB1R b KQkq - 0 3", ann:"3.d4 — Scotch Game.", eval:25 },
  { ply:6, san:"exd4", uci:"e5d4", fen:"r1bqkbnr/pppp1ppp/2n5/8/3pP3/5N2/PPP2PPP/RNBQKB1R w KQkq - 0 4", ann:"3...exd4", eval:20 },
  { ply:7, san:"Nxd4", uci:"f3d4", fen:"r1bqkbnr/pppp1ppp/2n5/8/3NP3/8/PPP2PPP/RNBQKB1R b KQkq - 0 4", ann:"4.Nxd4", eval:25 },
  { ply:8, san:"Qf6", uci:"d8f6", fen:"r1b1kbnr/pppp1ppp/2n2q2/8/3NP3/8/PPP2PPP/RNBQKB1R w KQkq - 1 5", ann:"4...Qf6?! — Aggressive but premature. Black brings the queen out early.", eval:35, nag:6 },
  { ply:9, san:"Nxc6", uci:"d4c6", fen:"r1b1kbnr/pppp1ppp/2N2q2/8/4P3/8/PPP2PPP/RNBQKB1R b KQkq - 0 5", ann:"5.Nxc6! — White ignores the queen threat and trades the knight.", eval:40, nag:1 },
  { ply:10, san:"bxc6", uci:"b7c6", fen:"r1b1kbnr/p1pp1ppp/2p2q2/8/4P3/8/PPP2PPP/RNBQKB1R w KQkq - 0 6", ann:"5...bxc6 — Black recaptures.", eval:35 },
  { ply:11, san:"Nc3", uci:"b1c3", fen:"r1b1kbnr/p1pp1ppp/2p2q2/8/4P3/2N5/PPP2PPP/R1BQKB1R b KQkq - 1 6", ann:"6.Nc3 — Development.", eval:40 },
  { ply:12, san:"Bc5", uci:"f8c5", fen:"r1b1k1nr/p1pp1ppp/2p2q2/2b5/4P3/2N5/PPP2PPP/R1BQKB1R w KQkq - 2 7", ann:"6...Bc5 — Developing the bishop.", eval:35 },
  { ply:13, san:"Qf3", uci:"d1f3", fen:"r1b1k1nr/p1pp1ppp/2p2q2/2b5/4P3/2N2Q2/PPP2PPP/R1B1KB1R b KQkq - 3 7", ann:"7.Qf3! — White challenges the queen and threatens Qxf7#. Black must be careful.", eval:45, nag:1 },
]);

// Y_KDCvUDxhH8xsyT — vs ...g6: Modern Approach
// 1. e4 e5 2. Nf3 Nc6 3. d4 exd4 4. Nxd4 g6 5. Nc3 Bg7 6. Be3 Nf6 7. Bc4
await insertNodes("Y_KDCvUDxhH8xsyT", [
  { ply:0, fen:"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", ann:"Starting position." },
  { ply:1, san:"e4", uci:"e2e4", fen:"rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1", ann:"1.e4", eval:25 },
  { ply:2, san:"e5", uci:"e7e5", fen:"rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2", ann:"1...e5", eval:20 },
  { ply:3, san:"Nf3", uci:"g1f3", fen:"rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2", ann:"2.Nf3", eval:25 },
  { ply:4, san:"Nc6", uci:"b8c6", fen:"r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3", ann:"2...Nc6", eval:20 },
  { ply:5, san:"d4", uci:"d2d4", fen:"r1bqkbnr/pppp1ppp/2n5/4p3/3PP3/5N2/PPP2PPP/RNBQKB1R b KQkq - 0 3", ann:"3.d4 — Scotch Game.", eval:25 },
  { ply:6, san:"exd4", uci:"e5d4", fen:"r1bqkbnr/pppp1ppp/2n5/8/3pP3/5N2/PPP2PPP/RNBQKB1R w KQkq - 0 4", ann:"3...exd4", eval:20 },
  { ply:7, san:"Nxd4", uci:"f3d4", fen:"r1bqkbnr/pppp1ppp/2n5/8/3NP3/8/PPP2PPP/RNBQKB1R b KQkq - 0 4", ann:"4.Nxd4", eval:25 },
  { ply:8, san:"g6", uci:"g7g6", fen:"r1bqkbnr/pppp1p1p/2n3p1/8/3NP3/8/PPP2PPP/RNBQKB1R w KQkq - 0 5", ann:"4...g6 — Modern! Black prepares to fianchetto.", eval:20, nag:1 },
  { ply:9, san:"Nc3", uci:"b1c3", fen:"r1bqkbnr/pppp1p1p/2n3p1/8/3NP3/2N5/PPP2PPP/R1BQKB1R b KQkq - 1 5", ann:"5.Nc3 — Development.", eval:25 },
  { ply:10, san:"Bg7", uci:"f8g7", fen:"r1bqk1nr/pppp1pbp/2n3p1/8/3NP3/2N5/PPP2PPP/R1BQKB1R w KQkq - 2 6", ann:"5...Bg7 — The fianchetto.", eval:20 },
  { ply:11, san:"Be3", uci:"c1e3", fen:"r1bqk1nr/pppp1pbp/2n3p1/8/3NP3/2N1B3/PPP2PPP/R2QKB1R b KQkq - 3 6", ann:"6.Be3 — Developing the bishop.", eval:25 },
  { ply:12, san:"Nf6", uci:"g8f6", fen:"r1bqk2r/pppp1pbp/2n2np1/8/3NP3/2N1B3/PPP2PPP/R2QKB1R w KQkq - 4 7", ann:"6...Nf6 — Development.", eval:20 },
  { ply:13, san:"Bc4", uci:"f1c4", fen:"r1bqk2r/pppp1pbp/2n2np1/8/2BNP3/2N1B3/PPP2PPP/R2QK2R b KQkq - 5 7", ann:"7.Bc4 — Developing the bishop, targeting f7. White has a comfortable position with good piece activity.", eval:25 },
]);

// ─────────────────────────────────────────────────────────────────────────────
// VIENNA GAMBIT
// ─────────────────────────────────────────────────────────────────────────────

// rJf1mXL5M9wT-pho — Gambit Accepted: 3...exf4
// 1. e4 e5 2. Nc3 Nf6 3. f4 exf4 4. e5 Ng8 5. Nf3 d6 6. d4 dxe5 7. Qe2
await insertNodes("rJf1mXL5M9wT-pho", [
  { ply:0, fen:"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", ann:"Starting position." },
  { ply:1, san:"e4", uci:"e2e4", fen:"rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1", ann:"1.e4", eval:25 },
  { ply:2, san:"e5", uci:"e7e5", fen:"rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2", ann:"1...e5", eval:20 },
  { ply:3, san:"Nc3", uci:"b1c3", fen:"rnbqkbnr/pppp1ppp/8/4p3/4P3/2N5/PPPP1PPP/R1BQKBNR b KQkq - 1 2", ann:"2.Nc3 — The Vienna Game! Flexible development.", eval:25 },
  { ply:4, san:"Nf6", uci:"g8f6", fen:"rnbqkb1r/pppp1ppp/5n2/4p3/4P3/2N5/PPPP1PPP/R1BQKBNR w KQkq - 2 3", ann:"2...Nf6 — Attacking e4.", eval:20 },
  { ply:5, san:"f4", uci:"f2f4", fen:"rnbqkb1r/pppp1ppp/5n2/4p3/4PP2/2N5/PPPP2PP/R1BQKBNR b KQkq - 0 3", ann:"3.f4 — The Vienna Gambit! White offers a pawn for rapid development.", eval:30, nag:1 },
  { ply:6, san:"exf4", uci:"e5f4", fen:"rnbqkb1r/pppp1ppp/5n2/8/4Pp2/2N5/PPPP2PP/R1BQKBNR w KQkq - 0 4", ann:"3...exf4 — Black accepts the gambit.", eval:20 },
  { ply:7, san:"e5", uci:"e4e5", fen:"rnbqkb1r/pppp1ppp/5n2/4P3/5p2/2N5/PPPP2PP/R1BQKBNR b KQkq - 0 4", ann:"4.e5! — White advances, attacking the knight.", eval:30, nag:1 },
  { ply:8, san:"Ng8", uci:"f6g8", fen:"rnbqkbnr/pppp1ppp/8/4P3/5p2/2N5/PPPP2PP/R1BQKBNR w KQkq - 1 5", ann:"4...Ng8 — The knight retreats. Black keeps the pawn but loses time.", eval:30 },
  { ply:9, san:"Nf3", uci:"g1f3", fen:"rnbqkbnr/pppp1ppp/8/4P3/5p2/2N2N2/PPPP2PP/R1BQKB1R b KQkq - 2 5", ann:"5.Nf3 — Development.", eval:30 },
  { ply:10, san:"d6", uci:"d7d6", fen:"rnbqkbnr/ppp2ppp/3p4/4P3/5p2/2N2N2/PPPP2PP/R1BQKB1R w KQkq - 0 6", ann:"5...d6 — Challenging the pawn on e5.", eval:25 },
  { ply:11, san:"d4", uci:"d2d4", fen:"rnbqkbnr/ppp2ppp/3p4/4P3/3P1p2/2N2N2/PPP3PP/R1BQKB1R b KQkq - 0 6", ann:"6.d4 — Solidifying the center.", eval:30 },
  { ply:12, san:"dxe5", uci:"d6e5", fen:"rnbqkbnr/ppp2ppp/8/4p3/3P1p2/2N2N2/PPP3PP/R1BQKB1R w KQkq - 0 7", ann:"6...dxe5 — Black opens the position.", eval:25 },
  { ply:13, san:"Qe2", uci:"d1e2", fen:"rnbqkbnr/ppp2ppp/8/4p3/3P1p2/2N2N2/PPP1Q1PP/R1B1KB1R b KQkq - 1 7", ann:"7.Qe2 — Attacking e5 and preparing to castle. White has excellent compensation for the pawn.", eval:30 },
]);

// yXgbZo46km3XwMIE — Gambit Declined: 3...d6
// 1. e4 e5 2. Nc3 Nf6 3. f4 d6 4. Nf3 Nc6 5. Bb5 Bd7 6. d3
await insertNodes("yXgbZo46km3XwMIE", [
  { ply:0, fen:"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", ann:"Starting position." },
  { ply:1, san:"e4", uci:"e2e4", fen:"rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1", ann:"1.e4", eval:25 },
  { ply:2, san:"e5", uci:"e7e5", fen:"rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2", ann:"1...e5", eval:20 },
  { ply:3, san:"Nc3", uci:"b1c3", fen:"rnbqkbnr/pppp1ppp/8/4p3/4P3/2N5/PPPP1PPP/R1BQKBNR b KQkq - 1 2", ann:"2.Nc3 — Vienna Game.", eval:25 },
  { ply:4, san:"Nf6", uci:"g8f6", fen:"rnbqkb1r/pppp1ppp/5n2/4p3/4P3/2N5/PPPP1PPP/R1BQKBNR w KQkq - 2 3", ann:"2...Nf6", eval:20 },
  { ply:5, san:"f4", uci:"f2f4", fen:"rnbqkb1r/pppp1ppp/5n2/4p3/4PP2/2N5/PPPP2PP/R1BQKBNR b KQkq - 0 3", ann:"3.f4 — Vienna Gambit.", eval:30 },
  { ply:6, san:"d6", uci:"d7d6", fen:"rnbqkb1r/ppp2ppp/3p1n2/4p3/4PP2/2N5/PPPP2PP/R1BQKBNR w KQkq - 0 4", ann:"3...d6 — Declining the gambit. Solid approach.", eval:20 },
  { ply:7, san:"Nf3", uci:"g1f3", fen:"rnbqkb1r/ppp2ppp/3p1n2/4p3/4PP2/2N2N2/PPPP2PP/R1BQKB1R b KQkq - 1 4", ann:"4.Nf3 — Development.", eval:25 },
  { ply:8, san:"Nc6", uci:"b8c6", fen:"r1bqkb1r/ppp2ppp/2np1n2/4p3/4PP2/2N2N2/PPPP2PP/R1BQKB1R w KQkq - 2 5", ann:"4...Nc6 — Development.", eval:20 },
  { ply:9, san:"Bb5", uci:"f1b5", fen:"r1bqkb1r/ppp2ppp/2np1n2/1B2p3/4PP2/2N2N2/PPPP2PP/R1BQK2R b KQkq - 3 5", ann:"5.Bb5 — Pinning the knight, Ruy Lopez style.", eval:25 },
  { ply:10, san:"Bd7", uci:"c8d7", fen:"r2qkb1r/pppb1ppp/2np1n2/1B2p3/4PP2/2N2N2/PPPP2PP/R1BQK2R w KQkq - 4 6", ann:"5...Bd7 — Breaking the pin.", eval:20 },
  { ply:11, san:"d3", uci:"d2d3", fen:"r2qkb1r/pppb1ppp/2np1n2/1B2p3/4PP2/2NP1N2/PPP3PP/R1BQK2R b KQkq - 0 6", ann:"6.d3 — Solid. White has a Ruy Lopez-like setup with the f4 pawn adding aggression.", eval:25 },
]);

// CiqAuVcvItUnrwP6 — Gambit Declined: 3...d5 (Falkbeer Style)
// 1. e4 e5 2. Nc3 Nf6 3. f4 d5 4. fxe5 Nxe4 5. Nf3 Be7 6. d4
await insertNodes("CiqAuVcvItUnrwP6", [
  { ply:0, fen:"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", ann:"Starting position." },
  { ply:1, san:"e4", uci:"e2e4", fen:"rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1", ann:"1.e4", eval:25 },
  { ply:2, san:"e5", uci:"e7e5", fen:"rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2", ann:"1...e5", eval:20 },
  { ply:3, san:"Nc3", uci:"b1c3", fen:"rnbqkbnr/pppp1ppp/8/4p3/4P3/2N5/PPPP1PPP/R1BQKBNR b KQkq - 1 2", ann:"2.Nc3 — Vienna Game.", eval:25 },
  { ply:4, san:"Nf6", uci:"g8f6", fen:"rnbqkb1r/pppp1ppp/5n2/4p3/4P3/2N5/PPPP1PPP/R1BQKBNR w KQkq - 2 3", ann:"2...Nf6", eval:20 },
  { ply:5, san:"f4", uci:"f2f4", fen:"rnbqkb1r/pppp1ppp/5n2/4p3/4PP2/2N5/PPPP2PP/R1BQKBNR b KQkq - 0 3", ann:"3.f4 — Vienna Gambit.", eval:30 },
  { ply:6, san:"d5", uci:"d7d5", fen:"rnbqkb1r/ppp2ppp/5n2/3pp3/4PP2/2N5/PPPP2PP/R1BQKBNR w KQkq - 0 4", ann:"3...d5 — Counter-gambit! Black immediately strikes back in the center.", eval:20, nag:1 },
  { ply:7, san:"fxe5", uci:"f4e5", fen:"rnbqkb1r/ppp2ppp/5n2/3pP3/4P3/2N5/PPPP2PP/R1BQKBNR b KQkq - 0 4", ann:"4.fxe5 — White captures.", eval:25 },
  { ply:8, san:"Nxe4", uci:"f6e4", fen:"rnbqkb1r/ppp2ppp/8/3pP3/4n3/2N5/PPPP2PP/R1BQKBNR w KQkq - 0 5", ann:"4...Nxe4 — Black wins back the pawn.", eval:20, nag:1 },
  { ply:9, san:"Nf3", uci:"g1f3", fen:"rnbqkb1r/ppp2ppp/8/3pP3/4n3/2N2N2/PPPP2PP/R1BQKB1R b KQkq - 1 5", ann:"5.Nf3 — Development.", eval:25 },
  { ply:10, san:"Be7", uci:"f8e7", fen:"rnbqk2r/ppp1bppp/8/3pP3/4n3/2N2N2/PPPP2PP/R1BQKB1R w KQkq - 2 6", ann:"5...Be7 — Solid development.", eval:20 },
  { ply:11, san:"d4", uci:"d2d4", fen:"rnbqk2r/ppp1bppp/8/3pP3/3Pn3/2N2N2/PPP3PP/R1BQKB1R b KQkq - 0 6", ann:"6.d4 — White builds a strong pawn center. The position is dynamically balanced.", eval:25 },
]);

// k_eYjr6PV8zCgWZh — Trap: Copycat 3...f4?
// 1. e4 e5 2. Nc3 Nc6 3. f4 f5 4. fxe5 fxe4 5. d3 exd3 6. Bxd3
await insertNodes("k_eYjr6PV8zCgWZh", [
  { ply:0, fen:"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", ann:"Starting position." },
  { ply:1, san:"e4", uci:"e2e4", fen:"rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1", ann:"1.e4", eval:25 },
  { ply:2, san:"e5", uci:"e7e5", fen:"rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2", ann:"1...e5", eval:20 },
  { ply:3, san:"Nc3", uci:"b1c3", fen:"rnbqkbnr/pppp1ppp/8/4p3/4P3/2N5/PPPP1PPP/R1BQKBNR b KQkq - 1 2", ann:"2.Nc3 — Vienna Game.", eval:25 },
  { ply:4, san:"Nc6", uci:"b8c6", fen:"r1bqkbnr/pppp1ppp/2n5/4p3/4P3/2N5/PPPP1PPP/R1BQKBNR w KQkq - 2 3", ann:"2...Nc6", eval:20 },
  { ply:5, san:"f4", uci:"f2f4", fen:"r1bqkbnr/pppp1ppp/2n5/4p3/4PP2/2N5/PPPP2PP/R1BQKBNR b KQkq - 0 3", ann:"3.f4 — Vienna Gambit.", eval:30 },
  { ply:6, san:"f5", uci:"f7f5", fen:"r1bqkbnr/pppp2pp/2n5/4pp2/4PP2/2N5/PPPP2PP/R1BQKBNR w KQkq - 0 4", ann:"3...f5?! — Copycat! Black tries to mirror White's f4 push, but this is dubious.", eval:40, nag:6 },
  { ply:7, san:"fxe5", uci:"f4e5", fen:"r1bqkbnr/pppp2pp/2n5/4pP2/4P3/2N5/PPPP2PP/R1BQKBNR b KQkq - 0 4", ann:"4.fxe5 — White captures.", eval:40 },
  { ply:8, san:"fxe4", uci:"f5e4", fen:"r1bqkbnr/pppp2pp/2n5/4P3/4p3/2N5/PPPP2PP/R1BQKBNR w KQkq - 0 5", ann:"4...fxe4 — Black captures.", eval:35 },
  { ply:9, san:"d3", uci:"d2d3", fen:"r1bqkbnr/pppp2pp/2n5/4P3/4p3/2NP4/PPP3PP/R1BQKBNR b KQkq - 0 5", ann:"5.d3 — Undermining the pawn.", eval:40 },
  { ply:10, san:"exd3", uci:"e4d3", fen:"r1bqkbnr/pppp2pp/2n5/4P3/8/2Np4/PPP3PP/R1BQKBNR w KQkq - 0 6", ann:"5...exd3 — Black captures.", eval:35 },
  { ply:11, san:"Bxd3", uci:"f1d3", fen:"r1bqkbnr/pppp2pp/2n5/4P3/8/2NB4/PPP3PP/R1BQK1NR b KQkq - 0 6", ann:"6.Bxd3 — White recaptures with the bishop. White has a strong pawn on e5 and excellent piece activity. Black's position is difficult.", eval:50, nag:1 },
]);

// brY_UrpAYD9OmPR5 — Trap: 3...Nxe4 Grab
// 1. e4 e5 2. Nc3 Nf6 3. f4 Nxe4 4. Qf3 Nxc3 5. dxc3
await insertNodes("brY_UrpAYD9OmPR5", [
  { ply:0, fen:"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", ann:"Starting position." },
  { ply:1, san:"e4", uci:"e2e4", fen:"rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1", ann:"1.e4", eval:25 },
  { ply:2, san:"e5", uci:"e7e5", fen:"rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2", ann:"1...e5", eval:20 },
  { ply:3, san:"Nc3", uci:"b1c3", fen:"rnbqkbnr/pppp1ppp/8/4p3/4P3/2N5/PPPP1PPP/R1BQKBNR b KQkq - 1 2", ann:"2.Nc3 — Vienna Game.", eval:25 },
  { ply:4, san:"Nf6", uci:"g8f6", fen:"rnbqkb1r/pppp1ppp/5n2/4p3/4P3/2N5/PPPP1PPP/R1BQKBNR w KQkq - 2 3", ann:"2...Nf6", eval:20 },
  { ply:5, san:"f4", uci:"f2f4", fen:"rnbqkb1r/pppp1ppp/5n2/4p3/4PP2/2N5/PPPP2PP/R1BQKBNR b KQkq - 0 3", ann:"3.f4 — Vienna Gambit.", eval:30 },
  { ply:6, san:"Nxe4", uci:"f6e4", fen:"rnbqkb1r/pppp1ppp/8/4p3/4Pn2/2N5/PPPP2PP/R1BQKBNR w KQkq - 0 4", ann:"3...Nxe4?! — Black grabs the pawn, but this is risky.", eval:40, nag:6 },
  { ply:7, san:"Qf3", uci:"d1f3", fen:"rnbqkb1r/pppp1ppp/8/4p3/4Pn2/2N2Q2/PPPP2PP/R1B1KBNR b KQkq - 1 4", ann:"4.Qf3! — Attacking the knight and threatening Qxf7#.", eval:50, nag:1 },
  { ply:8, san:"Nxc3", uci:"e4c3", fen:"rnbqkb1r/pppp1ppp/8/4p3/4P3/2n2Q2/PPPP2PP/R1B1KBNR w KQkq - 0 5", ann:"4...Nxc3 — Black grabs another pawn but loses time.", eval:45 },
  { ply:9, san:"dxc3", uci:"d2c3", fen:"rnbqkb1r/pppp1ppp/8/4p3/4P3/2P2Q2/PPP3PP/R1B1KBNR b KQkq - 0 5", ann:"5.dxc3 — White recaptures. White has a massive lead in development and Black's king is stuck in the center. White will castle and attack.", eval:55 },
]);

// fwC1as4KDdT1LMAU — Accepted: 3...exf4 4.e5 Bc5
// 1. e4 e5 2. Nc3 Nf6 3. f4 exf4 4. e5 Ng8 5. d4 Bc5 6. Bxf4 d6 7. Nf3
await insertNodes("fwC1as4KDdT1LMAU", [
  { ply:0, fen:"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", ann:"Starting position." },
  { ply:1, san:"e4", uci:"e2e4", fen:"rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1", ann:"1.e4", eval:25 },
  { ply:2, san:"e5", uci:"e7e5", fen:"rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2", ann:"1...e5", eval:20 },
  { ply:3, san:"Nc3", uci:"b1c3", fen:"rnbqkbnr/pppp1ppp/8/4p3/4P3/2N5/PPPP1PPP/R1BQKBNR b KQkq - 1 2", ann:"2.Nc3 — Vienna Game.", eval:25 },
  { ply:4, san:"Nf6", uci:"g8f6", fen:"rnbqkb1r/pppp1ppp/5n2/4p3/4P3/2N5/PPPP1PPP/R1BQKBNR w KQkq - 2 3", ann:"2...Nf6", eval:20 },
  { ply:5, san:"f4", uci:"f2f4", fen:"rnbqkb1r/pppp1ppp/5n2/4p3/4PP2/2N5/PPPP2PP/R1BQKBNR b KQkq - 0 3", ann:"3.f4 — Vienna Gambit.", eval:30 },
  { ply:6, san:"exf4", uci:"e5f4", fen:"rnbqkb1r/pppp1ppp/5n2/8/4Pp2/2N5/PPPP2PP/R1BQKBNR w KQkq - 0 4", ann:"3...exf4 — Accepted!", eval:20 },
  { ply:7, san:"e5", uci:"e4e5", fen:"rnbqkb1r/pppp1ppp/5n2/4P3/5p2/2N5/PPPP2PP/R1BQKBNR b KQkq - 0 4", ann:"4.e5 — Attacking the knight.", eval:30 },
  { ply:8, san:"Ng8", uci:"f6g8", fen:"rnbqkbnr/pppp1ppp/8/4P3/5p2/2N5/PPPP2PP/R1BQKBNR w KQkq - 1 5", ann:"4...Ng8 — Knight retreats.", eval:30 },
  { ply:9, san:"d4", uci:"d2d4", fen:"rnbqkbnr/pppp1ppp/8/4P3/3P1p2/2N5/PPP3PP/R1BQKBNR b KQkq - 0 5", ann:"5.d4 — Solidifying the center.", eval:30 },
  { ply:10, san:"Bc5", uci:"f8c5", fen:"rnbqk1nr/pppp1ppp/8/2b1P3/3P1p2/2N5/PPP3PP/R1BQKBNR w KQkq - 1 6", ann:"5...Bc5 — Active! Black develops the bishop, attacking d4.", eval:20, nag:1 },
  { ply:11, san:"Bxf4", uci:"c1f4", fen:"rnbqk1nr/pppp1ppp/8/2b1P3/3P1B2/2N5/PPP3PP/R2QKBNR b KQkq - 0 6", ann:"6.Bxf4 — White recaptures the gambit pawn.", eval:30 },
  { ply:12, san:"d6", uci:"d7d6", fen:"rnbqk1nr/ppp2ppp/3p4/2b1P3/3P1B2/2N5/PPP3PP/R2QKBNR w KQkq - 0 7", ann:"6...d6 — Challenging the pawn on e5.", eval:25 },
  { ply:13, san:"Nf3", uci:"g1f3", fen:"rnbqk1nr/ppp2ppp/3p4/2b1P3/3P1B2/2N2N2/PPP3PP/R2QKB1R b KQkq - 1 7", ann:"7.Nf3 — Development. White has good compensation with the bishop pair and active pieces.", eval:30 },
]);

// oQUXYMo0Qq253wPF — Accepted: 3...exf4 4.e5 d6
// 1. e4 e5 2. Nc3 Nf6 3. f4 exf4 4. e5 Ng8 5. Nf3 d6 6. d4 Bg4 7. Bxf4
await insertNodes("oQUXYMo0Qq253wPF", [
  { ply:0, fen:"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", ann:"Starting position." },
  { ply:1, san:"e4", uci:"e2e4", fen:"rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1", ann:"1.e4", eval:25 },
  { ply:2, san:"e5", uci:"e7e5", fen:"rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2", ann:"1...e5", eval:20 },
  { ply:3, san:"Nc3", uci:"b1c3", fen:"rnbqkbnr/pppp1ppp/8/4p3/4P3/2N5/PPPP1PPP/R1BQKBNR b KQkq - 1 2", ann:"2.Nc3 — Vienna Game.", eval:25 },
  { ply:4, san:"Nf6", uci:"g8f6", fen:"rnbqkb1r/pppp1ppp/5n2/4p3/4P3/2N5/PPPP1PPP/R1BQKBNR w KQkq - 2 3", ann:"2...Nf6", eval:20 },
  { ply:5, san:"f4", uci:"f2f4", fen:"rnbqkb1r/pppp1ppp/5n2/4p3/4PP2/2N5/PPPP2PP/R1BQKBNR b KQkq - 0 3", ann:"3.f4 — Vienna Gambit.", eval:30 },
  { ply:6, san:"exf4", uci:"e5f4", fen:"rnbqkb1r/pppp1ppp/5n2/8/4Pp2/2N5/PPPP2PP/R1BQKBNR w KQkq - 0 4", ann:"3...exf4 — Accepted!", eval:20 },
  { ply:7, san:"e5", uci:"e4e5", fen:"rnbqkb1r/pppp1ppp/5n2/4P3/5p2/2N5/PPPP2PP/R1BQKBNR b KQkq - 0 4", ann:"4.e5 — Attacking the knight.", eval:30 },
  { ply:8, san:"Ng8", uci:"f6g8", fen:"rnbqkbnr/pppp1ppp/8/4P3/5p2/2N5/PPPP2PP/R1BQKBNR w KQkq - 1 5", ann:"4...Ng8 — Knight retreats.", eval:30 },
  { ply:9, san:"Nf3", uci:"g1f3", fen:"rnbqkbnr/pppp1ppp/8/4P3/5p2/2N2N2/PPPP2PP/R1BQKBNR b KQkq - 2 5", ann:"5.Nf3 — Development.", eval:30 },
  { ply:10, san:"d6", uci:"d7d6", fen:"rnbqkbnr/ppp2ppp/3p4/4P3/5p2/2N2N2/PPPP2PP/R1BQKBNR w KQkq - 0 6", ann:"5...d6 — Challenging e5.", eval:25 },
  { ply:11, san:"d4", uci:"d2d4", fen:"rnbqkbnr/ppp2ppp/3p4/4P3/3P1p2/2N2N2/PPP3PP/R1BQKBNR b KQkq - 0 6", ann:"6.d4 — Solidifying.", eval:30 },
  { ply:12, san:"Bg4", uci:"c8g4", fen:"rn1qkbnr/ppp2ppp/3p4/4P3/3P1pb1/2N2N2/PPP3PP/R1BQKBNR w KQkq - 1 7", ann:"6...Bg4 — Pinning the knight!", eval:25, nag:1 },
  { ply:13, san:"Bxf4", uci:"c1f4", fen:"rn1qkbnr/ppp2ppp/3p4/4P3/3P1Bb1/2N2N2/PPP3PP/R2QKB1R b KQkq - 0 7", ann:"7.Bxf4 — White recaptures the pawn. The position is complex with both sides having active pieces.", eval:30 },
]);

// LXolR3m2o28zproJ — vs 2...Nc6: Transposition
// 1. e4 e5 2. Nc3 Nc6 3. f4 exf4 4. Nf3 g5 5. d4 g4 6. Bc4
await insertNodes("LXolR3m2o28zproJ", [
  { ply:0, fen:"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", ann:"Starting position." },
  { ply:1, san:"e4", uci:"e2e4", fen:"rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1", ann:"1.e4", eval:25 },
  { ply:2, san:"e5", uci:"e7e5", fen:"rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2", ann:"1...e5", eval:20 },
  { ply:3, san:"Nc3", uci:"b1c3", fen:"rnbqkbnr/pppp1ppp/8/4p3/4P3/2N5/PPPP1PPP/R1BQKBNR b KQkq - 1 2", ann:"2.Nc3 — Vienna Game.", eval:25 },
  { ply:4, san:"Nc6", uci:"b8c6", fen:"r1bqkbnr/pppp1ppp/2n5/4p3/4P3/2N5/PPPP1PPP/R1BQKBNR w KQkq - 2 3", ann:"2...Nc6 — Solid development.", eval:20 },
  { ply:5, san:"f4", uci:"f2f4", fen:"r1bqkbnr/pppp1ppp/2n5/4p3/4PP2/2N5/PPPP2PP/R1BQKBNR b KQkq - 0 3", ann:"3.f4 — Vienna Gambit.", eval:30 },
  { ply:6, san:"exf4", uci:"e5f4", fen:"r1bqkbnr/pppp1ppp/2n5/8/4Pp2/2N5/PPPP2PP/R1BQKBNR w KQkq - 0 4", ann:"3...exf4 — Accepted!", eval:20 },
  { ply:7, san:"Nf3", uci:"g1f3", fen:"r1bqkbnr/pppp1ppp/2n5/8/4Pp2/2N2N2/PPPP2PP/R1BQKB1R b KQkq - 1 4", ann:"4.Nf3 — Development.", eval:25 },
  { ply:8, san:"g5", uci:"g7g5", fen:"r1bqkbnr/pppp1p1p/2n5/6p1/4Pp2/2N2N2/PPPP2PP/R1BQKB1R w KQkq - 0 5", ann:"4...g5 — Aggressive! Black defends the f4 pawn with the g-pawn.", eval:20, nag:1 },
  { ply:9, san:"d4", uci:"d2d4", fen:"r1bqkbnr/pppp1p1p/2n5/6p1/3PPp2/2N2N2/PPP3PP/R1BQKB1R b KQkq - 0 5", ann:"5.d4 — Building the center.", eval:25 },
  { ply:10, san:"g4", uci:"g5g4", fen:"r1bqkbnr/pppp1p1p/2n5/8/3PPpp1/2N2N2/PPP3PP/R1BQKB1R w KQkq - 0 6", ann:"5...g4 — Attacking the knight!", eval:20, nag:1 },
  { ply:11, san:"Bc4", uci:"f1c4", fen:"r1bqkbnr/pppp1p1p/2n5/8/2BPPpp1/2N2N2/PPP3PP/R1BQK2R b KQkq - 1 6", ann:"6.Bc4 — Developing the bishop, preparing for a sharp tactical battle. This is the King's Gambit transposition.", eval:30, nag:1 },
]);

// Ltes2fkJZTQZ7Ev2 — Trap: ...Qe7+ Premature
// 1. e4 e5 2. Nc3 Nf6 3. f4 exf4 4. e5 Qe7 5. Qe2 Ng8 6. Nf3 d6 7. d4
await insertNodes("Ltes2fkJZTQZ7Ev2", [
  { ply:0, fen:"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", ann:"Starting position." },
  { ply:1, san:"e4", uci:"e2e4", fen:"rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1", ann:"1.e4", eval:25 },
  { ply:2, san:"e5", uci:"e7e5", fen:"rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2", ann:"1...e5", eval:20 },
  { ply:3, san:"Nc3", uci:"b1c3", fen:"rnbqkbnr/pppp1ppp/8/4p3/4P3/2N5/PPPP1PPP/R1BQKBNR b KQkq - 1 2", ann:"2.Nc3 — Vienna Game.", eval:25 },
  { ply:4, san:"Nf6", uci:"g8f6", fen:"rnbqkb1r/pppp1ppp/5n2/4p3/4P3/2N5/PPPP1PPP/R1BQKBNR w KQkq - 2 3", ann:"2...Nf6", eval:20 },
  { ply:5, san:"f4", uci:"f2f4", fen:"rnbqkb1r/pppp1ppp/5n2/4p3/4PP2/2N5/PPPP2PP/R1BQKBNR b KQkq - 0 3", ann:"3.f4 — Vienna Gambit.", eval:30 },
  { ply:6, san:"exf4", uci:"e5f4", fen:"rnbqkb1r/pppp1ppp/5n2/8/4Pp2/2N5/PPPP2PP/R1BQKBNR w KQkq - 0 4", ann:"3...exf4 — Accepted!", eval:20 },
  { ply:7, san:"e5", uci:"e4e5", fen:"rnbqkb1r/pppp1ppp/5n2/4P3/5p2/2N5/PPPP2PP/R1BQKBNR b KQkq - 0 4", ann:"4.e5 — Attacking the knight.", eval:30 },
  { ply:8, san:"Qe7", uci:"d8e7", fen:"rnb1kb1r/ppppqppp/5n2/4P3/5p2/2N5/PPPP2PP/R1BQKBNR w KQkq - 1 5", ann:"4...Qe7?! — Premature queen development. Black tries to pin the e5 pawn.", eval:40, nag:6 },
  { ply:9, san:"Qe2", uci:"d1e2", fen:"rnb1kb1r/ppppqppp/5n2/4P3/5p2/2N5/PPPPQ1PP/R1B1KBNR b KQkq - 2 5", ann:"5.Qe2! — White defends e5 and trades queens if needed.", eval:45, nag:1 },
  { ply:10, san:"Ng8", uci:"f6g8", fen:"rnb1kbnr/ppppqppp/8/4P3/5p2/2N5/PPPPQ1PP/R1B1KBNR w KQkq - 3 6", ann:"5...Ng8 — The knight retreats.", eval:40 },
  { ply:11, san:"Nf3", uci:"g1f3", fen:"rnb1kbnr/ppppqppp/8/4P3/5p2/2N2N2/PPPPQ1PP/R1B1KB1R b KQkq - 4 6", ann:"6.Nf3 — Development.", eval:45 },
  { ply:12, san:"d6", uci:"d7d6", fen:"rnb1kbnr/ppp1qppp/3p4/4P3/5p2/2N2N2/PPPPQ1PP/R1B1KB1R w KQkq - 0 7", ann:"6...d6 — Challenging e5.", eval:40 },
  { ply:13, san:"d4", uci:"d2d4", fen:"rnb1kbnr/ppp1qppp/3p4/4P3/3P1p2/2N2N2/PPP1Q1PP/R1B1KB1R b KQkq - 0 7", ann:"7.d4 — White builds a strong center. White has a clear advantage in development.", eval:50 },
]);

// gmlDXuremfbhqFcg — Quiet Setup: 3.f4 d6 4.Nf3
// 1. e4 e5 2. Nc3 Nf6 3. f4 d6 4. Nf3 Bg4 5. Be2 Nc6 6. O-O Be7 7. d3
await insertNodes("gmlDXuremfbhqFcg", [
  { ply:0, fen:"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", ann:"Starting position." },
  { ply:1, san:"e4", uci:"e2e4", fen:"rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1", ann:"1.e4", eval:25 },
  { ply:2, san:"e5", uci:"e7e5", fen:"rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2", ann:"1...e5", eval:20 },
  { ply:3, san:"Nc3", uci:"b1c3", fen:"rnbqkbnr/pppp1ppp/8/4p3/4P3/2N5/PPPP1PPP/R1BQKBNR b KQkq - 1 2", ann:"2.Nc3 — Vienna Game.", eval:25 },
  { ply:4, san:"Nf6", uci:"g8f6", fen:"rnbqkb1r/pppp1ppp/5n2/4p3/4P3/2N5/PPPP1PPP/R1BQKBNR w KQkq - 2 3", ann:"2...Nf6", eval:20 },
  { ply:5, san:"f4", uci:"f2f4", fen:"rnbqkb1r/pppp1ppp/5n2/4p3/4PP2/2N5/PPPP2PP/R1BQKBNR b KQkq - 0 3", ann:"3.f4 — Vienna Gambit.", eval:30 },
  { ply:6, san:"d6", uci:"d7d6", fen:"rnbqkb1r/ppp2ppp/3p1n2/4p3/4PP2/2N5/PPPP2PP/R1BQKBNR w KQkq - 0 4", ann:"3...d6 — Solid decline.", eval:20 },
  { ply:7, san:"Nf3", uci:"g1f3", fen:"rnbqkb1r/ppp2ppp/3p1n2/4p3/4PP2/2N2N2/PPPP2PP/R1BQKB1R b KQkq - 1 4", ann:"4.Nf3 — Development.", eval:25 },
  { ply:8, san:"Bg4", uci:"c8g4", fen:"rn1qkb1r/ppp2ppp/3p1n2/4p3/4PPb1/2N2N2/PPPP2PP/R1BQKB1R w KQkq - 2 5", ann:"4...Bg4 — Pinning the knight!", eval:20, nag:1 },
  { ply:9, san:"Be2", uci:"f1e2", fen:"rn1qkb1r/ppp2ppp/3p1n2/4p3/4PPb1/2N2N2/PPPP2PP/R1BQKB1R w KQkq - 2 5", ann:"5.Be2 — Breaking the pin.", eval:25 },
  { ply:10, san:"Nc6", uci:"b8c6", fen:"r2qkb1r/ppp2ppp/2np1n2/4p3/4PPb1/2N2N2/PPP1B1PP/R1BQK2R w KQkq - 3 6", ann:"5...Nc6 — Development.", eval:20 },
  { ply:11, san:"O-O", uci:"e1g1", fen:"r2qkb1r/ppp2ppp/2np1n2/4p3/4PPb1/2N2N2/PPP1B1PP/R1BQ1RK1 b kq - 4 6", ann:"6.O-O — White castles.", eval:25 },
  { ply:12, san:"Be7", uci:"f8e7", fen:"r2qk2r/ppp1bppp/2np1n2/4p3/4PPb1/2N2N2/PPP1B1PP/R1BQ1RK1 w kq - 5 7", ann:"6...Be7 — Solid development.", eval:20 },
  { ply:13, san:"d3", uci:"d2d3", fen:"r2qk2r/ppp1bppp/2np1n2/4p3/4PPb1/2NP1N2/PPP1B1PP/R1BQ1RK1 b kq - 0 7", ann:"7.d3 — Solid. White has a Ruy Lopez-like setup. The position is balanced with both sides having clear plans.", eval:25 },
]);

// ─── Final verification ───────────────────────────────────────────────────────
console.log(`\nTotal nodes inserted: ${inserted}`);

// Verify
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
