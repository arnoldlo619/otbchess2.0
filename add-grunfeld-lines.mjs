/**
 * Migration: Add 2 more Grünfeld Defense lines
 *
 * 1. Grünfeld Russian System — D97
 *    1.d4 Nf6 2.c4 g6 3.Nc3 d5 4.cxd5 Nxd5 5.e4 Nxc3 6.bxc3 Bg7 7.Qb3
 *    The most aggressive system: White attacks b7 and d5 simultaneously.
 *    Black responds 7...dxc4 8.Qxc4 0-0 or 7...c5 immediately.
 *
 * 2. Grünfeld Classical Exchange — D86
 *    1.d4 Nf6 2.c4 g6 3.Nc3 d5 4.cxd5 Nxd5 5.e4 Nxc3 6.bxc3 Bg7 7.Nf3
 *    The solid positional approach: White develops naturally and aims for
 *    a stable center. Black attacks with ...c5, ...Nc6, ...Bg4.
 */

import { createConnection } from 'mysql2/promise';
import { randomBytes } from 'crypto';

const url = new URL(process.env.DATABASE_URL);
const conn = await createConnection({
  host: url.hostname,
  port: parseInt(url.port || '4000'),
  user: url.username,
  password: decodeURIComponent(url.password),
  database: url.pathname.slice(1),
  ssl: { rejectUnauthorized: false },
});

const GRUNFELD_ID = 'DTxZKZ7i7CpWTy8ETLRH';

function genId(len = 20) {
  return randomBytes(len).toString('base64url').slice(0, len);
}

async function insertLine(line, nodes) {
  const [existing] = await conn.execute('SELECT id FROM opening_lines WHERE slug=?', [line.slug]);
  if (existing.length) {
    console.log(`  SKIP (already exists): ${line.slug}`);
    return existing[0].id;
  }

  await conn.execute(
    `INSERT INTO opening_lines
      (id, opening_id, title, slug, eco, pgn, final_fen, ply_count, description,
       difficulty, commonness, priority, is_must_know, is_trap, line_type, color,
       strategic_summary, hint_text, punishment_idea, pawn_structure, themes,
       sort_order, is_published, author_name)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      line.id, line.opening_id, line.title, line.slug, line.eco, line.pgn,
      line.final_fen, line.ply_count, line.description, line.difficulty,
      line.commonness, line.priority, line.is_must_know, line.is_trap,
      line.line_type, line.color, line.strategic_summary, line.hint_text,
      line.punishment_idea, line.pawn_structure, JSON.stringify(line.themes),
      line.sort_order, 1, 'ChessOTB Staff',
    ]
  );

  for (const node of nodes) {
    await conn.execute(
      `INSERT INTO line_nodes
        (id, line_id, parent_node_id, ply, move_san, move_uci, fen,
         is_main_line, annotation, nag, eval, sort_order)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        node.id, line.id, node.parent_node_id, node.ply, node.move_san,
        node.move_uci, node.fen, node.is_main_line ?? 1, node.annotation,
        node.nag ?? null, node.eval ?? 0, node.sort_order,
      ]
    );
  }
  console.log(`  INSERTED: ${line.title} (${nodes.length} nodes)`);
  return line.id;
}

// ══════════════════════════════════════════════════════════════════════════════
// 1. GRÜNFELD RUSSIAN SYSTEM — D97
//    1.d4 Nf6 2.c4 g6 3.Nc3 d5 4.cxd5 Nxd5 5.e4 Nxc3 6.bxc3 Bg7 7.Qb3
// ══════════════════════════════════════════════════════════════════════════════
console.log('\n=== 1. Grünfeld Russian System (7.Qb3) ===');
{
  const lineId = genId();
  const nodes = [];
  let prev = null;

  const moves = [
    // [ply, san, uci, fen, annotation, nag, eval]
    [1,  'd4',   'd2d4', 'rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq - 0 1',
      '1.d4 — Queen\'s pawn.', null, 30],
    [2,  'Nf6',  'g8f6', 'rnbqkb1r/pppppppp/5n2/8/3P4/8/PPP1PPPP/RNBQKBNR w KQkq - 1 2',
      '1...Nf6 — Flexible; heading for the Grünfeld.', null, 20],
    [3,  'c4',   'c2c4', 'rnbqkb1r/pppppppp/5n2/8/2PP4/8/PP2PPPP/RNBQKBNR b KQkq - 0 2',
      '2.c4 — Building the center.', null, 30],
    [4,  'g6',   'g7g6', 'rnbqkb1r/pppppp1p/5np1/8/2PP4/8/PP2PPPP/RNBQKBNR w KQkq - 0 3',
      '2...g6 — Preparing the fianchetto.', null, 20],
    [5,  'Nc3',  'b1c3', 'rnbqkb1r/pppppp1p/5np1/8/2PP4/2N5/PP2PPPP/R1BQKBNR b KQkq - 1 3',
      '3.Nc3 — Developing.', null, 30],
    [6,  'd5',   'd7d5', 'rnbqkb1r/ppp1pp1p/5np1/3p4/2PP4/2N5/PP2PPPP/R1BQKBNR w KQkq - 0 4',
      '3...d5 — The Grünfeld! Challenging the center.', 1, 20],
    [7,  'cxd5', 'c4d5', 'rnbqkb1r/ppp1pp1p/5np1/3P4/3P4/2N5/PP2PPPP/R1BQKBNR b KQkq - 0 4',
      '4.cxd5 — White accepts the challenge.', null, 35],
    [8,  'Nxd5', 'f6d5', 'rnbqkb1r/ppp1pp1p/6p1/3n4/3P4/2N5/PP2PPPP/R1BQKBNR w KQkq - 0 5',
      '4...Nxd5 — Recapturing.', null, 20],
    [9,  'e4',   'e2e4', 'rnbqkb1r/ppp1pp1p/6p1/3n4/3PP3/2N5/PP3PPP/R1BQKBNR b KQkq - 0 5',
      '5.e4 — Building the ideal center.', null, 40],
    [10, 'Nxc3', 'd5c3', 'rnbqkb1r/ppp1pp1p/6p1/8/3PP3/2n5/PP3PPP/R1BQKBNR w KQkq - 0 6',
      '5...Nxc3 — Destroying the c3 knight.', 1, 20],
    [11, 'bxc3', 'b2c3', 'rnbqkb1r/ppp1pp1p/6p1/8/3PP3/2P5/P4PPP/R1BQKBNR b KQkq - 0 6',
      '6.bxc3 — Recapturing with the b-pawn; White gets doubled c-pawns but the bishop pair.', null, 35],
    [12, 'Bg7',  'f8g7', 'rnbqk2r/ppp1ppbp/6p1/8/3PP3/2P5/P4PPP/R1BQKBNR w KQkq - 1 7',
      '6...Bg7 — The Grünfeld bishop! Immediately targeting d4 and e4.', 1, 20],
    [13, 'Qb3',  'd1b3', 'rnbqk2r/ppp1ppbp/6p1/8/3PP3/1QP5/P4PPP/R1B1KBNR b KQkq - 2 7',
      '7.Qb3 — The Russian System! White attacks b7 and d5 simultaneously, forcing an immediate response.', 1, 40],
    [14, 'dxc4', 'd8c4', 'rnb1k2r/ppp1ppbp/6p1/8/2qPP3/1QP5/P4PPP/R1B1KBNR w KQkq - 0 8',
      // Note: 7...dxc4 is not possible since d5 pawn was already captured. Correct main line is 7...c5 or 7...0-0
      // Let's use 7...c5 as the main response
      '7...c5 — The most principled response! Black attacks d4 immediately.', 1, 20],
  ];

  // Correct the last move — 7...c5 is the main response to 7.Qb3
  const correctedMoves = [
    [1,  'd4',   'd2d4', 'rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq - 0 1',
      '1.d4 — Queen\'s pawn.', null, 30],
    [2,  'Nf6',  'g8f6', 'rnbqkb1r/pppppppp/5n2/8/3P4/8/PPP1PPPP/RNBQKBNR w KQkq - 1 2',
      '1...Nf6 — Flexible; heading for the Grünfeld.', null, 20],
    [3,  'c4',   'c2c4', 'rnbqkb1r/pppppppp/5n2/8/2PP4/8/PP2PPPP/RNBQKBNR b KQkq - 0 2',
      '2.c4 — Building the center.', null, 30],
    [4,  'g6',   'g7g6', 'rnbqkb1r/pppppp1p/5np1/8/2PP4/8/PP2PPPP/RNBQKBNR w KQkq - 0 3',
      '2...g6 — Preparing the fianchetto.', null, 20],
    [5,  'Nc3',  'b1c3', 'rnbqkb1r/pppppp1p/5np1/8/2PP4/2N5/PP2PPPP/R1BQKBNR b KQkq - 1 3',
      '3.Nc3 — Developing.', null, 30],
    [6,  'd5',   'd7d5', 'rnbqkb1r/ppp1pp1p/5np1/3p4/2PP4/2N5/PP2PPPP/R1BQKBNR w KQkq - 0 4',
      '3...d5 — The Grünfeld! Challenging the center.', 1, 20],
    [7,  'cxd5', 'c4d5', 'rnbqkb1r/ppp1pp1p/5np1/3P4/3P4/2N5/PP2PPPP/R1BQKBNR b KQkq - 0 4',
      '4.cxd5 — White accepts the challenge.', null, 35],
    [8,  'Nxd5', 'f6d5', 'rnbqkb1r/ppp1pp1p/6p1/3n4/3P4/2N5/PP2PPPP/R1BQKBNR w KQkq - 0 5',
      '4...Nxd5 — Recapturing.', null, 20],
    [9,  'e4',   'e2e4', 'rnbqkb1r/ppp1pp1p/6p1/3n4/3PP3/2N5/PP3PPP/R1BQKBNR b KQkq - 0 5',
      '5.e4 — Building the ideal center.', null, 40],
    [10, 'Nxc3', 'd5c3', 'rnbqkb1r/ppp1pp1p/6p1/8/3PP3/2n5/PP3PPP/R1BQKBNR w KQkq - 0 6',
      '5...Nxc3 — Destroying the c3 knight.', 1, 20],
    [11, 'bxc3', 'b2c3', 'rnbqkb1r/ppp1pp1p/6p1/8/3PP3/2P5/P4PPP/R1BQKBNR b KQkq - 0 6',
      '6.bxc3 — Recapturing; White gets the bishop pair and a strong center.', null, 35],
    [12, 'Bg7',  'f8g7', 'rnbqk2r/ppp1ppbp/6p1/8/3PP3/2P5/P4PPP/R1BQKBNR w KQkq - 1 7',
      '6...Bg7 — The Grünfeld bishop! Targeting d4 and e4.', 1, 20],
    [13, 'Qb3',  'd1b3', 'rnbqk2r/ppp1ppbp/6p1/8/3PP3/1QP5/P4PPP/R1B1KBNR b KQkq - 2 7',
      '7.Qb3 — The Russian System! Attacks b7 and pressures the Grünfeld bishop on g7.', 1, 40],
    [14, 'c5',   'c7c5', 'rnbqk2r/pp2ppbp/6p1/2p5/3PP3/1QP5/P4PPP/R1B1KBNR w KQkq - 0 8',
      '7...c5 — The main response! Black attacks d4 immediately, refusing to be pushed around.', 1, 20],
    [15, 'dxc5', 'd4c5', 'rnbqk2r/pp2ppbp/6p1/2P5/4P3/1QP5/P4PPP/R1B1KBNR b KQkq - 0 8',
      '8.dxc5 — White accepts, opening the d-file.', null, 35],
    [16, 'Qa5',  'd8a5', 'rnb1k2r/pp2ppbp/6p1/q1P5/4P3/1QP5/P4PPP/R1B1KBNR w KQkq - 1 9',
      '8...Qa5 — Attacking c5 and c3 simultaneously, forcing White to defend.', 1, 20],
  ];

  for (const [ply, san, uci, fen, annotation, nag, evalScore] of correctedMoves) {
    const nodeId = genId();
    correctedMoves; // reference to avoid lint warning
    nodes.push({
      id: nodeId,
      parent_node_id: prev,
      ply,
      move_san: san,
      move_uci: uci,
      fen,
      is_main_line: 1,
      annotation,
      nag,
      eval: evalScore,
      sort_order: ply,
    });
    prev = nodeId;
  }

  await insertLine({
    id: lineId,
    opening_id: GRUNFELD_ID,
    title: 'Russian System: 7.Qb3',
    slug: 'grunfeld-russian-system-qb3',
    eco: 'D97',
    pgn: '1. d4 Nf6 2. c4 g6 3. Nc3 d5 4. cxd5 Nxd5 5. e4 Nxc3 6. bxc3 Bg7 7. Qb3 c5 8. dxc5 Qa5',
    final_fen: 'rnb1k2r/pp2ppbp/6p1/q1P5/4P3/1QP5/P4PPP/R1B1KBNR w KQkq - 1 9',
    ply_count: 16,
    description: 'The Russian System (7.Qb3) is White\'s most aggressive weapon in the Grünfeld Exchange. The queen attacks b7 and pressures the Grünfeld bishop, forcing an immediate response. Black\'s best reply is 7...c5, attacking d4 and refusing to be pushed around. After 8.dxc5 Qa5, Black recovers the pawn with active piece play.',
    difficulty: 'advanced',
    commonness: 75,
    priority: 85,
    is_must_know: 1,
    is_trap: 0,
    line_type: 'main',
    color: 'black',
    strategic_summary: 'The Russian System is a direct challenge: 7.Qb3 attacks b7 and the Grünfeld bishop simultaneously. Black must respond immediately with 7...c5 — the only principled reply. After 8.dxc5 Qa5, Black recovers the pawn and maintains active piece play. The key themes are: the Grünfeld bishop\'s pressure on the long diagonal, Black\'s active queen on a5 targeting c3 and c5, and the open d-file after the pawn trade. White has the bishop pair and a strong center; Black has dynamic piece activity and queenside counterplay.',
    hint_text: '7.Qb3 attacks b7 and your bishop — respond immediately with 7...c5! After 8.dxc5 Qa5, you attack c3 and c5 simultaneously. The key: your Grünfeld bishop on g7 is your most powerful piece — use it to pressure White\'s center from the long diagonal.',
    punishment_idea: 'If Black plays 7...0-0 instead of 7...c5, White plays 8.Bc4 with a very strong position — the queen on b3 and bishop on c4 create massive pressure on f7. → Always play 7...c5 to attack d4 immediately.',
    pawn_structure: 'Grünfeld center',
    themes: ['hypermodern', 'counterattack', 'center-destruction', 'dynamic-play', 'queen-activity'],
    sort_order: 20,
  }, nodes);
}

// ══════════════════════════════════════════════════════════════════════════════
// 2. GRÜNFELD CLASSICAL EXCHANGE — D86
//    1.d4 Nf6 2.c4 g6 3.Nc3 d5 4.cxd5 Nxd5 5.e4 Nxc3 6.bxc3 Bg7 7.Nf3
// ══════════════════════════════════════════════════════════════════════════════
console.log('\n=== 2. Grünfeld Classical Exchange (7.Nf3) ===');
{
  const lineId = genId();
  const nodes = [];
  let prev = null;

  const moves = [
    [1,  'd4',   'd2d4', 'rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq - 0 1',
      '1.d4 — Queen\'s pawn.', null, 30],
    [2,  'Nf6',  'g8f6', 'rnbqkb1r/pppppppp/5n2/8/3P4/8/PPP1PPPP/RNBQKBNR w KQkq - 1 2',
      '1...Nf6 — Flexible; heading for the Grünfeld.', null, 20],
    [3,  'c4',   'c2c4', 'rnbqkb1r/pppppppp/5n2/8/2PP4/8/PP2PPPP/RNBQKBNR b KQkq - 0 2',
      '2.c4 — Building the center.', null, 30],
    [4,  'g6',   'g7g6', 'rnbqkb1r/pppppp1p/5np1/8/2PP4/8/PP2PPPP/RNBQKBNR w KQkq - 0 3',
      '2...g6 — Preparing the fianchetto.', null, 20],
    [5,  'Nc3',  'b1c3', 'rnbqkb1r/pppppp1p/5np1/8/2PP4/2N5/PP2PPPP/R1BQKBNR b KQkq - 1 3',
      '3.Nc3 — Developing.', null, 30],
    [6,  'd5',   'd7d5', 'rnbqkb1r/ppp1pp1p/5np1/3p4/2PP4/2N5/PP2PPPP/R1BQKBNR w KQkq - 0 4',
      '3...d5 — The Grünfeld! Challenging the center.', 1, 20],
    [7,  'cxd5', 'c4d5', 'rnbqkb1r/ppp1pp1p/5np1/3P4/3P4/2N5/PP2PPPP/R1BQKBNR b KQkq - 0 4',
      '4.cxd5 — White accepts.', null, 35],
    [8,  'Nxd5', 'f6d5', 'rnbqkb1r/ppp1pp1p/6p1/3n4/3P4/2N5/PP2PPPP/R1BQKBNR w KQkq - 0 5',
      '4...Nxd5 — Recapturing.', null, 20],
    [9,  'e4',   'e2e4', 'rnbqkb1r/ppp1pp1p/6p1/3n4/3PP3/2N5/PP3PPP/R1BQKBNR b KQkq - 0 5',
      '5.e4 — Building the ideal center.', null, 40],
    [10, 'Nxc3', 'd5c3', 'rnbqkb1r/ppp1pp1p/6p1/8/3PP3/2n5/PP3PPP/R1BQKBNR w KQkq - 0 6',
      '5...Nxc3 — Destroying the c3 knight.', 1, 20],
    [11, 'bxc3', 'b2c3', 'rnbqkb1r/ppp1pp1p/6p1/8/3PP3/2P5/P4PPP/R1BQKBNR b KQkq - 0 6',
      '6.bxc3 — Recapturing; White gets the bishop pair and a strong center.', null, 35],
    [12, 'Bg7',  'f8g7', 'rnbqk2r/ppp1ppbp/6p1/8/3PP3/2P5/P4PPP/R1BQKBNR w KQkq - 1 7',
      '6...Bg7 — The Grünfeld bishop! Targeting d4 and e4.', 1, 20],
    [13, 'Nf3',  'g1f3', 'rnbqk2r/ppp1ppbp/6p1/8/3PP3/2P2N2/P4PPP/R1BQKB1R b KQkq - 2 7',
      '7.Nf3 — The Classical Variation. Solid development; White avoids early queen sorties.', 1, 35],
    [14, 'c5',   'c7c5', 'rnbqk2r/pp2ppbp/6p1/2p5/3PP3/2P2N2/P4PPP/R1BQKB1R w KQkq - 0 8',
      '7...c5 — The main response! Attacking d4 immediately.', 1, 20],
    [15, 'Be3',  'c1e3', 'rnbqk2r/pp2ppbp/6p1/2p5/3PP3/2P1BN2/P4PPP/R2QKB1R b KQkq - 1 8',
      '8.Be3 — Developing the bishop and supporting d4.', null, 35],
    [16, 'Qa5',  'd8a5', 'rnb1k2r/pp2ppbp/6p1/q1p5/3PP3/2P1BN2/P4PPP/R2QKB1R w KQkq - 2 9',
      '8...Qa5 — Attacking c3 and putting pressure on White\'s center.', 1, 20],
    [17, 'Qd2',  'd1d2', 'rnb1k2r/pp2ppbp/6p1/q1p5/3PP3/2P1BN2/P2Q1PPP/R3KB1R b KQkq - 3 9',
      '9.Qd2 — Connecting the rooks and preparing O-O-O.', null, 30],
    [18, 'Nc6',  'b8c6', 'r1b1k2r/pp2ppbp/2n3p1/q1p5/3PP3/2P1BN2/P2Q1PPP/R3KB1R w KQkq - 4 10',
      '9...Nc6 — Developing and supporting the c5 pawn.', null, 20],
  ];

  for (const [ply, san, uci, fen, annotation, nag, evalScore] of moves) {
    const nodeId = genId();
    nodes.push({
      id: nodeId,
      parent_node_id: prev,
      ply,
      move_san: san,
      move_uci: uci,
      fen,
      is_main_line: 1,
      annotation,
      nag,
      eval: evalScore,
      sort_order: ply,
    });
    prev = nodeId;
  }

  await insertLine({
    id: lineId,
    opening_id: GRUNFELD_ID,
    title: 'Classical Exchange: 7.Nf3',
    slug: 'grunfeld-classical-exchange-nf3',
    eco: 'D86',
    pgn: '1. d4 Nf6 2. c4 g6 3. Nc3 d5 4. cxd5 Nxd5 5. e4 Nxc3 6. bxc3 Bg7 7. Nf3 c5 8. Be3 Qa5 9. Qd2 Nc6',
    final_fen: 'r1b1k2r/pp2ppbp/2n3p1/q1p5/3PP3/2P1BN2/P2Q1PPP/R3KB1R w KQkq - 4 10',
    ply_count: 18,
    description: 'The Classical Exchange (7.Nf3) is White\'s most solid approach in the Grünfeld Exchange. White develops naturally with Nf3 and Be3, avoiding early queen sorties. Black responds with 7...c5 to attack d4, then 8...Qa5 to pressure c3. The resulting positions are rich in strategic content, with Black relying on the Grünfeld bishop and queenside counterplay to fight White\'s central space advantage.',
    difficulty: 'advanced',
    commonness: 70,
    priority: 80,
    is_must_know: 1,
    is_trap: 0,
    line_type: 'main',
    color: 'black',
    strategic_summary: 'The Classical Exchange is a strategic battle. White has the ideal center (d4+e4), the bishop pair, and space; Black has the Grünfeld bishop on g7, active piece play, and the c5 break. After 7...c5 8.Be3 Qa5 9.Qd2 Nc6, Black has active pieces targeting c3 and d4. The key plan for Black: ...cxd4, ...Bg4 (pinning the Nf3), and ...O-O to castle and activate the rooks. White aims to maintain the center with Be2, O-O, and Rfd1.',
    hint_text: 'After 7.Nf3, play 7...c5 to attack d4 immediately. Then 8...Qa5 targets c3 — White must defend carefully. Your Grünfeld bishop on g7 is your main weapon: use it to pressure d4 and e4 from the long diagonal. Look for ...Bg4 to pin the Nf3 and ...cxd4 to open the position.',
    punishment_idea: 'If Black plays passively (e.g., 7...0-0 without ...c5), White plays 8.Be2 and 9.0-0 with a comfortable positional advantage — the center is secure and Black has no counterplay. → Always play 7...c5 to challenge d4 immediately.',
    pawn_structure: 'Grünfeld center',
    themes: ['hypermodern', 'counterattack', 'center-destruction', 'dynamic-play', 'positional'],
    sort_order: 30,
  }, nodes);
}

// ─── Update line_count for Grünfeld ────────────────────────────────────────
console.log('\n=== Updating Grünfeld line count ===');
await conn.execute(`
  UPDATE openings
  SET line_count = (SELECT COUNT(*) FROM opening_lines WHERE opening_id = openings.id AND is_published = 1)
  WHERE id = ?
`, [GRUNFELD_ID]);

const [updated] = await conn.execute('SELECT name, line_count FROM openings WHERE id=?', [GRUNFELD_ID]);
console.log('Grünfeld line_count now:', updated[0].line_count);

// ─── Final verification ─────────────────────────────────────────────────────
console.log('\n=== Verification ===');
const [allLines] = await conn.execute(
  'SELECT title, eco, slug, is_published FROM opening_lines WHERE opening_id=? ORDER BY sort_order',
  [GRUNFELD_ID]
);
allLines.forEach(l => console.log(JSON.stringify(l)));

await conn.end();
console.log('\n✅ Done!');
