/**
 * Migration: Add 5 new opening lines
 * 1. Sicilian Open (main line) — B20/B54
 * 2. Sicilian Dragon — B70
 * 3. Sicilian Najdorf English Attack — B90
 * 4. King's Indian Classical — E92
 * 5. Grünfeld Exchange — D85
 *
 * Schema:
 *   openings: id, name, slug, eco, color, starting_moves, starting_fen, description, summary,
 *             difficulty, popularity, play_character, themes, line_count, sort_order, is_published,
 *             author_name, cover_image_url, is_featured, starter_friendly, estimated_line_count,
 *             trap_potential, strategic_complexity
 *
 *   opening_lines: id, opening_id, title, slug, eco, pgn, final_fen, ply_count, description,
 *                  difficulty, commonness, priority, is_must_know, is_trap, line_type, color,
 *                  strategic_summary, hint_text, punishment_idea, pawn_structure, themes,
 *                  sort_order, is_published, author_name
 *
 *   line_nodes: id, line_id, parent_node_id, ply, move_san, move_uci, fen, is_main_line,
 *               annotation, nag, eval, transposition_node_id, sort_order
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

function genId(len = 20) {
  return randomBytes(len).toString('base64url').slice(0, len);
}

// ─── Existing opening IDs ───────────────────────────────────────────────────
const SICILIAN_ID = '940f1cc22ce64136896cd9a79a7015a5';
const KID_ID = 'd5PzI8LsDfgvSBf9';

// ─── Helper: insert a line + its nodes ─────────────────────────────────────
async function insertLine(line, nodes) {
  // Check if line slug already exists
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

  // Insert nodes
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

// ─── Helper: insert opening if not exists ──────────────────────────────────
async function insertOpening(opening) {
  const [existing] = await conn.execute('SELECT id FROM openings WHERE slug=?', [opening.slug]);
  if (existing.length) {
    console.log(`  Opening already exists: ${opening.slug} → id=${existing[0].id}`);
    return existing[0].id;
  }
  await conn.execute(
    `INSERT INTO openings
      (id, name, slug, eco, color, starting_moves, starting_fen, description, summary,
       difficulty, popularity, play_character, themes, line_count, sort_order, is_published,
       author_name, is_featured, starter_friendly, estimated_line_count, trap_potential, strategic_complexity)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      opening.id, opening.name, opening.slug, opening.eco, opening.color,
      opening.starting_moves, opening.starting_fen, opening.description, opening.summary,
      opening.difficulty, opening.popularity, opening.play_character,
      JSON.stringify(opening.themes), opening.line_count, opening.sort_order, 1,
      'ChessOTB Staff', 0, 0, opening.estimated_line_count,
      opening.trap_potential, opening.strategic_complexity,
    ]
  );
  console.log(`  INSERTED opening: ${opening.name}`);
  return opening.id;
}

// ══════════════════════════════════════════════════════════════════════════════
// 1. SICILIAN OPEN — B54 (1.e4 c5 2.Nf3 d6 3.d4 cxd4 4.Nxd4 Nf6 5.Nc3)
// ══════════════════════════════════════════════════════════════════════════════
console.log('\n=== 1. Sicilian Open ===');
{
  const lineId = genId();
  const nodes = [];
  let prev = null;

  const moves = [
    // ply, san, uci, fen, annotation, nag, eval
    [1, 'e4', 'e2e4', 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1', '1.e4 — Open game, fighting for the center.', null, 30],
    [2, 'c5', 'c7c5', 'rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2', '1...c5 — The Sicilian! Black fights for d4 without symmetry.', 1, 20],
    [3, 'Nf3', 'g1f3', 'rnbqkbnr/pp1ppppp/8/2p5/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2', '2.Nf3 — Developing toward the Open Sicilian.', null, 30],
    [4, 'd6', 'd7d6', 'rnbqkbnr/pp2pppp/3p4/2p5/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 0 3', '2...d6 — Preparing ...Nf6 and ...e5 or ...e6.', null, 20],
    [5, 'd4', 'd2d4', 'rnbqkbnr/pp2pppp/3p4/2p5/3PP3/5N2/PPP2PPP/RNBQKB1R b KQkq - 0 3', '3.d4 — The key thrust: White opens the center.', null, 35],
    [6, 'cxd4', 'c5d4', 'rnbqkbnr/pp2pppp/3p4/8/3pP3/5N2/PPP2PPP/RNBQKB1R w KQkq - 0 4', '3...cxd4 — Black accepts the trade, giving White a central pawn majority.', null, 25],
    [7, 'Nxd4', 'f3d4', 'rnbqkbnr/pp2pppp/3p4/8/3NP3/8/PPP2PPP/RNBQKB1R b KQkq - 0 4', '4.Nxd4 — The Open Sicilian begins. White has a strong knight on d4.', null, 35],
    [8, 'Nf6', 'g8f6', 'rnbqkb1r/pp2pppp/3p1n2/8/3NP3/8/PPP2PPP/RNBQKB1R w KQkq - 1 5', '4...Nf6 — Attacking e4 immediately.', 1, 25],
    [9, 'Nc3', 'b1c3', 'rnbqkb1r/pp2pppp/3p1n2/8/3NP3/2N5/PPP2PPP/R1BQKB1R b KQkq - 2 5', '5.Nc3 — The main line. White defends e4 and prepares Be3/Be2.', null, 35],
    [10, 'a6', 'a7a6', 'rnbqkb1r/1p2pppp/p2p1n2/8/3NP3/2N5/PPP2PPP/R1BQKB1R w KQkq - 0 6', '5...a6 — The Najdorf move order. Prevents Nb5 and prepares ...e5 or ...b5.', 1, 20],
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
    opening_id: SICILIAN_ID,
    title: 'Open Sicilian: 5.Nc3 Main Line',
    slug: 'sicilian-open-5nc3-main',
    eco: 'B54',
    pgn: '1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3',
    final_fen: 'rnbqkb1r/pp2pppp/3p1n2/8/3NP3/2N5/PPP2PPP/R1BQKB1R b KQkq - 2 5',
    ply_count: 9,
    description: 'The Open Sicilian arises after 1.e4 c5 2.Nf3 and 3.d4. White opens the center and gains a space advantage; Black gets a half-open c-file and dynamic counterplay. This is the most theoretically rich opening in chess.',
    difficulty: 'intermediate',
    commonness: 95,
    priority: 95,
    is_must_know: 1,
    is_trap: 0,
    line_type: 'main',
    color: 'black',
    strategic_summary: 'The Open Sicilian is a battle of imbalances. White gets a central pawn majority and attacking chances on the kingside; Black gets the half-open c-file, queenside counterplay, and often a superior endgame. The critical plans for Black are ...e5 (Najdorf/Classical), ...g6 (Dragon), or ...e6 (Scheveningen/Kan). White aims to attack on the kingside before Black\'s queenside counterplay becomes decisive.',
    hint_text: 'Key idea: After 3.d4 cxd4 4.Nxd4, White has a central pawn majority but Black gets the half-open c-file. Black\'s main plans are ...e5 (Najdorf), ...g6 (Dragon), or ...e6 (Scheveningen). White attacks the kingside; Black counterattacks on the queenside.',
    punishment_idea: 'If Black plays passively (e.g., ...e6 without ...d5 breaks), White\'s kingside attack with f4-f5 becomes overwhelming. → Always look for ...d5 or ...b5-b4 counterplay to keep White off-balance.',
    pawn_structure: 'Sicilian center',
    themes: ['dynamic-play', 'counterattack', 'open-files', 'imbalances'],
    sort_order: 105,
  }, nodes);
}

// ══════════════════════════════════════════════════════════════════════════════
// 2. SICILIAN DRAGON — B70 (1.e4 c5 2.Nf3 d6 3.d4 cxd4 4.Nxd4 Nf6 5.Nc3 g6)
// ══════════════════════════════════════════════════════════════════════════════
console.log('\n=== 2. Sicilian Dragon ===');
{
  const lineId = genId();
  const nodes = [];
  let prev = null;

  const moves = [
    [1, 'e4', 'e2e4', 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1', '1.e4 — Open game.', null, 30],
    [2, 'c5', 'c7c5', 'rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2', '1...c5 — Sicilian Defense.', null, 20],
    [3, 'Nf3', 'g1f3', 'rnbqkbnr/pp1ppppp/8/2p5/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2', '2.Nf3 — Heading for the Open Sicilian.', null, 30],
    [4, 'd6', 'd7d6', 'rnbqkbnr/pp2pppp/3p4/2p5/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 0 3', '2...d6 — Flexible; supports ...e5 or ...Nf6.', null, 20],
    [5, 'd4', 'd2d4', 'rnbqkbnr/pp2pppp/3p4/2p5/3PP3/5N2/PPP2PPP/RNBQKB1R b KQkq - 0 3', '3.d4 — Opening the center.', null, 35],
    [6, 'cxd4', 'c5d4', 'rnbqkbnr/pp2pppp/3p4/8/3pP3/5N2/PPP2PPP/RNBQKB1R w KQkq - 0 4', '3...cxd4 — Accepting the pawn trade.', null, 25],
    [7, 'Nxd4', 'f3d4', 'rnbqkbnr/pp2pppp/3p4/8/3NP3/8/PPP2PPP/RNBQKB1R b KQkq - 0 4', '4.Nxd4 — Open Sicilian.', null, 35],
    [8, 'Nf6', 'g8f6', 'rnbqkb1r/pp2pppp/3p1n2/8/3NP3/8/PPP2PPP/RNBQKB1R w KQkq - 1 5', '4...Nf6 — Attacking e4.', null, 25],
    [9, 'Nc3', 'b1c3', 'rnbqkb1r/pp2pppp/3p1n2/8/3NP3/2N5/PPP2PPP/R1BQKB1R b KQkq - 2 5', '5.Nc3 — Defending e4.', null, 35],
    [10, 'g6', 'g7g6', 'rnbqkb1r/pp2pp1p/3p1np1/8/3NP3/2N5/PPP2PPP/R1BQKB1R w KQkq - 0 6', '5...g6 — The Dragon! Black fianchettoes the bishop to g7, creating the famous "Dragon bishop".', 1, 20],
    [11, 'Be3', 'c1e3', 'rnbqkb1r/pp2pp1p/3p1np1/8/3NP3/2N1B3/PPP2PPP/R2QKB1R b KQkq - 1 6', '6.Be3 — Preparing for the Yugoslav Attack with f3 and Qd2.', null, 35],
    [12, 'Bg7', 'f8g7', 'rnbqk2r/pp2ppbp/3p1np1/8/3NP3/2N1B3/PPP2PPP/R2QKB1R w KQkq - 2 7', '6...Bg7 — The Dragon bishop! Controls the long diagonal h8-a1.', 1, 20],
    [13, 'f3', 'f2f3', 'rnbqk2r/pp2ppbp/3p1np1/8/3NP3/2N1BP2/PPP3PP/R2QKB1R b KQkq - 0 7', '7.f3 — Yugoslav Attack setup. White prepares Qd2 and O-O-O.', null, 35],
    [14, 'O-O', 'e8g8', 'rnbq1rk1/pp2ppbp/3p1np1/8/3NP3/2N1BP2/PPP3PP/R2QKB1R w KQ - 1 8', '7...O-O — Black castles kingside, entering the sharp Yugoslav Attack.', null, 20],
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
    opening_id: SICILIAN_ID,
    title: 'Sicilian Dragon: 5...g6 Main Line',
    slug: 'sicilian-dragon-main-line',
    eco: 'B70',
    pgn: '1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 g6 6. Be3 Bg7 7. f3 O-O',
    final_fen: 'rnbq1rk1/pp2ppbp/3p1np1/8/3NP3/2N1BP2/PPP3PP/R2QKB1R w KQ - 1 8',
    ply_count: 14,
    description: 'The Sicilian Dragon is one of the sharpest openings in chess. Black fianchettoes the bishop to g7, creating the "Dragon bishop" on the long diagonal. White typically responds with the Yugoslav Attack (Be3, f3, Qd2, O-O-O), launching a direct kingside assault while Black counterattacks on the queenside.',
    difficulty: 'advanced',
    commonness: 80,
    priority: 90,
    is_must_know: 1,
    is_trap: 0,
    line_type: 'main',
    color: 'black',
    strategic_summary: 'The Dragon is a race: White attacks the Black king on the kingside (h4-h5, g4-g5 pawn storm after O-O-O), while Black counterattacks on the queenside (Rc8, ...a5-a4, ...b5-b4). The Dragon bishop on g7 is Black\'s most powerful piece — it controls the long diagonal and supports queenside counterplay. Black must never trade the Dragon bishop without major compensation. The Yugoslav Attack (Be3, f3, Qd2, O-O-O) is White\'s most dangerous weapon.',
    hint_text: 'The Dragon bishop on g7 is your most important piece — never trade it lightly. Your plan: ...Rc8, ...a5, ...b5-b4, attacking queenside while White storms the kingside. It\'s a race — who gets there first?',
    punishment_idea: 'If Black plays passively and allows White\'s h4-h5-h6 pawn storm unopposed, White\'s attack becomes overwhelming. → Always counterattack with ...Rc8, ...a5, ...b5 to create queenside threats.',
    pawn_structure: 'Dragon pawn structure',
    themes: ['kingside-attack', 'counterattack', 'fianchetto', 'dynamic-play', 'pawn-storm'],
    sort_order: 106,
  }, nodes);
}

// ══════════════════════════════════════════════════════════════════════════════
// 3. SICILIAN NAJDORF ENGLISH ATTACK — B90
//    (1.e4 c5 2.Nf3 d6 3.d4 cxd4 4.Nxd4 Nf6 5.Nc3 a6 6.Be3)
// ══════════════════════════════════════════════════════════════════════════════
console.log('\n=== 3. Sicilian Najdorf English Attack ===');
{
  const lineId = genId();
  const nodes = [];
  let prev = null;

  const moves = [
    [1, 'e4', 'e2e4', 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1', '1.e4 — Open game.', null, 30],
    [2, 'c5', 'c7c5', 'rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2', '1...c5 — Sicilian Defense.', null, 20],
    [3, 'Nf3', 'g1f3', 'rnbqkbnr/pp1ppppp/8/2p5/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2', '2.Nf3 — Open Sicilian setup.', null, 30],
    [4, 'd6', 'd7d6', 'rnbqkbnr/pp2pppp/3p4/2p5/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 0 3', '2...d6 — Najdorf move order.', null, 20],
    [5, 'd4', 'd2d4', 'rnbqkbnr/pp2pppp/3p4/2p5/3PP3/5N2/PPP2PPP/RNBQKB1R b KQkq - 0 3', '3.d4 — Opening the center.', null, 35],
    [6, 'cxd4', 'c5d4', 'rnbqkbnr/pp2pppp/3p4/8/3pP3/5N2/PPP2PPP/RNBQKB1R w KQkq - 0 4', '3...cxd4 — Trade accepted.', null, 25],
    [7, 'Nxd4', 'f3d4', 'rnbqkbnr/pp2pppp/3p4/8/3NP3/8/PPP2PPP/RNBQKB1R b KQkq - 0 4', '4.Nxd4 — Open Sicilian.', null, 35],
    [8, 'Nf6', 'g8f6', 'rnbqkb1r/pp2pppp/3p1n2/8/3NP3/8/PPP2PPP/RNBQKB1R w KQkq - 1 5', '4...Nf6 — Attacking e4.', null, 25],
    [9, 'Nc3', 'b1c3', 'rnbqkb1r/pp2pppp/3p1n2/8/3NP3/2N5/PPP2PPP/R1BQKB1R b KQkq - 2 5', '5.Nc3 — Defending e4.', null, 35],
    [10, 'a6', 'a7a6', 'rnbqkb1r/1p2pppp/p2p1n2/8/3NP3/2N5/PPP2PPP/R1BQKB1R w KQkq - 0 6', '5...a6 — The Najdorf! Prevents Nb5 and prepares ...b5 queenside expansion.', 1, 20],
    [11, 'Be3', 'c1e3', 'rnbqkb1r/1p2pppp/p2p1n2/8/3NP3/2N1B3/PPP2PPP/R2QKB1R b KQkq - 1 6', '6.Be3 — The English Attack! White prepares f3, Qd2, g4-g5 kingside attack.', 1, 35],
    [12, 'e5', 'e7e5', 'rnbqkb1r/1p3ppp/p2p1n2/4p3/3NP3/2N1B3/PPP2PPP/R2QKB1R w KQkq - 0 7', '6...e5 — The main response. Black grabs central space and kicks the Nd4.', 1, 20],
    [13, 'Nb3', 'd4b3', 'rnbqkb1r/1p3ppp/p2p1n2/4p3/4P3/1NN1B3/PPP2PPP/R2QKB1R b KQkq - 1 7', '7.Nb3 — Retreating to a safe square, keeping options open.', null, 30],
    [14, 'Be6', 'c8e6', 'rn1qkb1r/1p3ppp/p2pbn2/4p3/4P3/1NN1B3/PPP2PPP/R2QKB1R w KQkq - 2 8', '7...Be6 — Developing the bishop, preparing ...Nbd7 and ...Be7.', null, 20],
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
    opening_id: SICILIAN_ID,
    title: 'Najdorf: English Attack (6.Be3)',
    slug: 'sicilian-najdorf-english-attack',
    eco: 'B90',
    pgn: '1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 a6 6. Be3 e5 7. Nb3 Be6',
    final_fen: 'rn1qkb1r/1p3ppp/p2pbn2/4p3/4P3/1NN1B3/PPP2PPP/R2QKB1R w KQkq - 2 8',
    ply_count: 14,
    description: 'The English Attack (6.Be3) is White\'s most popular weapon against the Najdorf. White prepares f3, Qd2, and a kingside pawn storm with g4-g5. Black typically responds with 6...e5 to grab central space and force the Nd4 to retreat, then develops with ...Be6, ...Nbd7, and ...Be7.',
    difficulty: 'advanced',
    commonness: 85,
    priority: 90,
    is_must_know: 1,
    is_trap: 0,
    line_type: 'main',
    color: 'black',
    strategic_summary: 'The English Attack is a direct kingside assault: White plays f3, Qd2, O-O-O, and launches g4-g5 to attack the Black king. Black\'s best response is 6...e5 to seize central space, then ...Be6, ...Nbd7, ...Be7 to complete development. Black aims for queenside counterplay with ...b5-b4 and ...a5-a4. The position is extremely sharp — both sides must attack without hesitation.',
    hint_text: '6.Be3 signals the English Attack — White will play f3, Qd2, O-O-O, g4-g5. Your response: 6...e5! grabs central space and kicks the Nd4. Then develop with ...Be6, ...Nbd7, ...Be7 and counterattack with ...b5-b4.',
    punishment_idea: 'If Black plays passively (e.g., 6...e6 without ...d5), White\'s g4-g5 pawn storm arrives too quickly. → Always play 6...e5 to grab central space and slow White\'s kingside attack.',
    pawn_structure: 'Najdorf center',
    themes: ['kingside-attack', 'counterattack', 'pawn-storm', 'dynamic-play'],
    sort_order: 107,
  }, nodes);
}

// ══════════════════════════════════════════════════════════════════════════════
// 4. KING'S INDIAN CLASSICAL — E92
//    (1.d4 Nf6 2.c4 g6 3.Nc3 Bg7 4.e4 d6 5.Nf3 O-O 6.Be2)
// ══════════════════════════════════════════════════════════════════════════════
console.log('\n=== 4. King\'s Indian Classical ===');
{
  const lineId = genId();
  const nodes = [];
  let prev = null;

  const moves = [
    [1, 'd4', 'd2d4', 'rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq - 0 1', '1.d4 — Queen\'s pawn opening.', null, 30],
    [2, 'Nf6', 'g8f6', 'rnbqkb1r/pppppppp/5n2/8/3P4/8/PPP1PPPP/RNBQKBNR w KQkq - 1 2', '1...Nf6 — Flexible; heading for the KID.', null, 20],
    [3, 'c4', 'c2c4', 'rnbqkb1r/pppppppp/5n2/8/2PP4/8/PP2PPPP/RNBQKBNR b KQkq - 0 2', '2.c4 — Establishing a large center.', null, 30],
    [4, 'g6', 'g7g6', 'rnbqkb1r/pppppp1p/5np1/8/2PP4/8/PP2PPPP/RNBQKBNR w KQkq - 0 3', '2...g6 — Preparing the fianchetto.', null, 20],
    [5, 'Nc3', 'b1c3', 'rnbqkb1r/pppppp1p/5np1/8/2PP4/2N5/PP2PPPP/R1BQKBNR b KQkq - 1 3', '3.Nc3 — Developing the knight.', null, 30],
    [6, 'Bg7', 'f8g7', 'rnbqk2r/ppppppbp/5np1/8/2PP4/2N5/PP2PPPP/R1BQKBNR w KQkq - 2 4', '3...Bg7 — The King\'s Indian bishop! Controls the long diagonal.', null, 20],
    [7, 'e4', 'e2e4', 'rnbqk2r/ppppppbp/5np1/8/2PPP3/2N5/PP3PPP/R1BQKBNR b KQkq - 0 4', '4.e4 — White builds a massive pawn center.', null, 35],
    [8, 'd6', 'd7d6', 'rnbqk2r/ppp1ppbp/3p1np1/8/2PPP3/2N5/PP3PPP/R1BQKBNR w KQkq - 0 5', '4...d6 — Solidifying the center, preparing ...e5.', null, 20],
    [9, 'Nf3', 'g1f3', 'rnbqk2r/ppp1ppbp/3p1np1/8/2PPP3/2N2N2/PP3PPP/R1BQKB1R b KQkq - 1 5', '5.Nf3 — Classical setup. White develops normally.', null, 30],
    [10, 'O-O', 'e8g8', 'rnbq1rk1/ppp1ppbp/3p1np1/8/2PPP3/2N2N2/PP3PPP/R1BQKB1R w KQ - 2 6', '5...O-O — Black castles, preparing ...e5.', null, 20],
    [11, 'Be2', 'f1e2', 'rnbq1rk1/ppp1ppbp/3p1np1/8/2PPP3/2N2N2/PP2BPPP/R1BQK2R b KQ - 3 6', '6.Be2 — The Classical Variation. Solid, aiming for a positional struggle.', 1, 30],
    [12, 'e5', 'e7e5', 'rnbq1rk1/ppp2pbp/3p1np1/4p3/2PPP3/2N2N2/PP2BPPP/R1BQK2R w KQ - 0 7', '6...e5 — The main KID break! Black challenges White\'s center immediately.', 1, 20],
    [13, 'O-O', 'e1g1', 'rnbq1rk1/ppp2pbp/3p1np1/4p3/2PPP3/2N2N2/PP2BPPP/R1BQ1RK1 b - - 1 7', '7.O-O — White castles, preparing d5 or dxe5.', null, 30],
    [14, 'Nc6', 'b8c6', 'r1bq1rk1/ppp2pbp/2np1np1/4p3/2PPP3/2N2N2/PP2BPPP/R1BQ1RK1 w - - 2 8', '7...Nc6 — Developing and supporting the e5 pawn.', null, 20],
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
    opening_id: KID_ID,
    title: 'Classical: 6.Be2 Main Line',
    slug: 'kid-classical-be2-main',
    eco: 'E92',
    pgn: '1. d4 Nf6 2. c4 g6 3. Nc3 Bg7 4. e4 d6 5. Nf3 O-O 6. Be2 e5 7. O-O Nc6',
    final_fen: 'r1bq1rk1/ppp2pbp/2np1np1/4p3/2PPP3/2N2N2/PP2BPPP/R1BQ1RK1 w - - 2 8',
    ply_count: 14,
    description: 'The Classical King\'s Indian (6.Be2) is White\'s most solid approach. White develops quietly with Be2 and O-O, planning to meet ...e5 with d5 (space advantage) or dxe5 (open position). Black\'s main plan is ...e5 followed by ...Nc6, ...Re8, and the classic ...Nd7-f6-h5 maneuver to attack the kingside.',
    difficulty: 'advanced',
    commonness: 80,
    priority: 85,
    is_must_know: 1,
    is_trap: 0,
    line_type: 'main',
    color: 'black',
    strategic_summary: 'The Classical KID is a strategic battle. After 6...e5, White usually plays d5 to close the center and gain queenside space. Black then attacks on the kingside with ...Nd7, ...f5, ...f4, and a kingside pawn storm. White attacks on the queenside with c5, b4, and a4-a5. The player who breaks through first wins. The KID bishop on g7 is crucial — it supports the kingside attack and controls the long diagonal.',
    hint_text: 'After 6.Be2, play 6...e5! to challenge White\'s center. If White plays d5, you get a closed center — attack on the kingside with ...Nd7, ...f5, ...f4. If White plays dxe5, you get an open position with active piece play.',
    punishment_idea: 'If Black plays passively after 6.Be2 (e.g., ...c6 without ...e5), White builds a massive center with d5 and queenside expansion. → Always play ...e5 to challenge the center and activate the KID bishop.',
    pawn_structure: 'King\'s Indian center',
    themes: ['kingside-attack', 'fianchetto', 'pawn-storm', 'dynamic-play', 'closed-center'],
    sort_order: 95,
  }, nodes);
}

// ══════════════════════════════════════════════════════════════════════════════
// 5. GRÜNFELD EXCHANGE — D85
//    (1.d4 Nf6 2.c4 g6 3.Nc3 d5 4.cxd5 Nxd5 5.e4 Nxc3 6.bxc3)
//    This requires creating a new "Grünfeld Defense" opening first.
// ══════════════════════════════════════════════════════════════════════════════
console.log('\n=== 5. Grünfeld Exchange ===');
{
  // Create Grünfeld opening
  const grunfeldId = genId();
  await insertOpening({
    id: grunfeldId,
    name: 'Grünfeld Defense',
    slug: 'grunfeld-defense',
    eco: 'D80',
    color: 'black',
    starting_moves: '1.d4 Nf6 2.c4 g6 3.Nc3 d5',
    starting_fen: 'rnbqkb1r/ppp1pp1p/5np1/3p4/2PP4/2N5/PP2PPPP/R1BQKBNR w KQkq - 0 4',
    description: 'The Grünfeld Defense is a hypermodern opening where Black allows White to build a large pawn center with d4, c4, and e4, then immediately attacks it with ...d5 and piece pressure. Named after Ernst Grünfeld, it has been a favorite of world champions including Bobby Fischer, Garry Kasparov, and Magnus Carlsen.',
    summary: 'Hypermodern defense: allow White\'s center, then destroy it with ...d5 and piece pressure.',
    difficulty: 'advanced',
    popularity: 85,
    play_character: 'dynamic',
    themes: ['hypermodern', 'counterattack', 'dynamic-play', 'center-destruction'],
    line_count: 1,
    sort_order: 170,
    estimated_line_count: 5,
    trap_potential: 60,
    strategic_complexity: 90,
  });

  const lineId = genId();
  const nodes = [];
  let prev = null;

  const moves = [
    [1, 'd4', 'd2d4', 'rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq - 0 1', '1.d4 — Queen\'s pawn.', null, 30],
    [2, 'Nf6', 'g8f6', 'rnbqkb1r/pppppppp/5n2/8/3P4/8/PPP1PPPP/RNBQKBNR w KQkq - 1 2', '1...Nf6 — Flexible.', null, 20],
    [3, 'c4', 'c2c4', 'rnbqkb1r/pppppppp/5n2/8/2PP4/8/PP2PPPP/RNBQKBNR b KQkq - 0 2', '2.c4 — Building the center.', null, 30],
    [4, 'g6', 'g7g6', 'rnbqkb1r/pppppp1p/5np1/8/2PP4/8/PP2PPPP/RNBQKBNR w KQkq - 0 3', '2...g6 — Preparing the fianchetto.', null, 20],
    [5, 'Nc3', 'b1c3', 'rnbqkb1r/pppppp1p/5np1/8/2PP4/2N5/PP2PPPP/R1BQKBNR b KQkq - 1 3', '3.Nc3 — Developing.', null, 30],
    [6, 'd5', 'd7d5', 'rnbqkb1r/ppp1pp1p/5np1/3p4/2PP4/2N5/PP2PPPP/R1BQKBNR w KQkq - 0 4', '3...d5 — The Grünfeld move! Challenging the center immediately.', 1, 20],
    [7, 'cxd5', 'c4d5', 'rnbqkb1r/ppp1pp1p/5np1/3P4/3P4/2N5/PP2PPPP/R1BQKBNR b KQkq - 0 4', '4.cxd5 — White accepts the challenge.', null, 35],
    [8, 'Nxd5', 'f6d5', 'rnbqkb1r/ppp1pp1p/6p1/3n4/3P4/2N5/PP2PPPP/R1BQKBNR w KQkq - 0 5', '4...Nxd5 — Recapturing with the knight.', null, 20],
    [9, 'e4', 'e2e4', 'rnbqkb1r/ppp1pp1p/6p1/3n4/3PP3/2N5/PP3PPP/R1BQKBNR b KQkq - 0 5', '5.e4 — White builds the ideal center: pawns on d4 and e4.', null, 40],
    [10, 'Nxc3', 'd5c3', 'rnbqkb1r/ppp1pp1p/6p1/8/3PP3/2n5/PP3PPP/R1BQKBNR w KQkq - 0 6', '5...Nxc3 — The Exchange Variation! Black destroys the c3 knight to weaken White\'s pawn structure.', 1, 20],
    [11, 'bxc3', 'b2c3', 'rnbqkb1r/ppp1pp1p/6p1/8/3PP3/2P5/P4PPP/R1BQKBNR b KQkq - 0 6', '6.bxc3 — White recaptures, creating doubled c-pawns but gaining the bishop pair and a strong center.', null, 35],
    [12, 'Bg7', 'f8g7', 'rnbqk2r/ppp1ppbp/6p1/8/3PP3/2P5/P4PPP/R1BQKBNR w KQkq - 1 7', '6...Bg7 — The Grünfeld bishop! Immediately attacks the d4-e4 pawn center.', 1, 20],
    [13, 'Bc4', 'f1c4', 'rnbqk2r/ppp1ppbp/6p1/8/2BPP3/2P5/P4PPP/R1BQK1NR b KQkq - 2 7', '7.Bc4 — Developing aggressively, targeting f7.', null, 35],
    [14, 'c5', 'c7c5', 'rnbqk2r/pp2ppbp/6p1/2p5/2BPP3/2P5/P4PPP/R1BQK1NR w KQkq - 0 8', '7...c5 — Attacking the d4 pawn, the key Grünfeld counterplay.', 1, 20],
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
    opening_id: grunfeldId,
    title: 'Exchange Variation: 4.cxd5 Nxd5 5.e4',
    slug: 'grunfeld-exchange-variation',
    eco: 'D85',
    pgn: '1. d4 Nf6 2. c4 g6 3. Nc3 d5 4. cxd5 Nxd5 5. e4 Nxc3 6. bxc3 Bg7 7. Bc4 c5',
    final_fen: 'rnbqk2r/pp2ppbp/6p1/2p5/2BPP3/2P5/P4PPP/R1BQK1NR w KQkq - 0 8',
    ply_count: 14,
    description: 'The Grünfeld Exchange Variation is the most critical test of the Grünfeld Defense. White builds the ideal pawn center (d4+e4), Black immediately attacks it with the Grünfeld bishop on g7 and ...c5. The resulting positions are extremely sharp and theoretically rich, with Black relying on piece activity to compensate for White\'s central space.',
    difficulty: 'advanced',
    commonness: 80,
    priority: 90,
    is_must_know: 1,
    is_trap: 0,
    line_type: 'main',
    color: 'black',
    strategic_summary: 'The Grünfeld Exchange is a pure battle of strategy vs. tactics. White has the ideal pawn center (d4+e4) and the bishop pair; Black has the Grünfeld bishop on g7 attacking the center, and counterplay with ...c5, ...Nc6, and ...Qa5. Black\'s plan: attack d4 with ...c5, ...Nc6, ...Bg4; White\'s plan: advance the center with e5 or d5. The position is extremely sharp — both sides must play precisely.',
    hint_text: 'The Grünfeld bishop on g7 is your weapon — it attacks White\'s d4-e4 center. After 6.bxc3, play 6...Bg7 immediately, then attack with ...c5, ...Nc6, ...Qa5. White has the center; you have the pieces. Destroy the center!',
    punishment_idea: 'If Black plays passively (e.g., ...O-O without ...c5), White\'s center advances with e5 and d5, becoming overwhelming. → Always attack d4 immediately with ...c5 and ...Nc6.',
    pawn_structure: 'Grünfeld center',
    themes: ['hypermodern', 'counterattack', 'center-destruction', 'dynamic-play', 'bishop-pair'],
    sort_order: 10,
  }, nodes);
}

// ─── Update line_count for openings ────────────────────────────────────────
console.log('\n=== Updating line counts ===');
await conn.execute(`
  UPDATE openings o
  SET line_count = (SELECT COUNT(*) FROM opening_lines WHERE opening_id = o.id AND is_published = 1)
  WHERE id IN (?, ?, ?)
`, [SICILIAN_ID, KID_ID, '']);

// Update Grünfeld separately (we don't have the id in scope here, but slug is known)
await conn.execute(`
  UPDATE openings o
  SET line_count = (SELECT COUNT(*) FROM opening_lines WHERE opening_id = o.id AND is_published = 1)
  WHERE slug = 'grunfeld-defense'
`);
await conn.execute(`
  UPDATE openings SET line_count = (SELECT COUNT(*) FROM opening_lines WHERE opening_id = openings.id AND is_published = 1)
  WHERE id IN (?, ?)
`, [SICILIAN_ID, KID_ID]);

console.log('\n✅ All 5 opening lines inserted successfully!');

// Final verification
const [newLines] = await conn.execute(`
  SELECT l.title, l.eco, l.slug, l.is_published, o.name as opening_name
  FROM opening_lines l
  JOIN openings o ON l.opening_id = o.id
  WHERE l.slug IN (
    'sicilian-open-5nc3-main',
    'sicilian-dragon-main-line',
    'sicilian-najdorf-english-attack',
    'kid-classical-be2-main',
    'grunfeld-exchange-variation'
  )
`);
console.log('\n=== Verification ===');
newLines.forEach(l => console.log(JSON.stringify(l)));

await conn.end();
