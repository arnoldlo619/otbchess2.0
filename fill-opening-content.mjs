/**
 * Fill missing strategicSummary + hintText for 43 published opening lines.
 * Run: node fill-opening-content.mjs
 */
import { createConnection } from "mysql2/promise";

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) throw new Error("DATABASE_URL not set");

const url = new URL(dbUrl);
const conn = await createConnection({
  host: url.hostname,
  port: parseInt(url.port || "4000"),
  user: url.username,
  password: decodeURIComponent(url.password),
  database: url.pathname.slice(1),
  ssl: { rejectUnauthorized: false },
});

console.log("✅ Connected\n");

// Each entry: { slug, strategicSummary, hintText }
const updates = [
  {
    slug: "sicilian-open-main",
    strategicSummary:
      "After 1.e4 c5 2.Nf3 Nc6 3.d4 cxd4 4.Nxd4, Black achieves an asymmetric position rich in dynamic possibilities. Black's queenside pawn majority and active piece play compensate for White's central space advantage. The key strategic idea is to challenge White's centre with ...d5 or ...e5 at the right moment, while keeping the position complex enough to avoid a dry positional squeeze.",
    hintText:
      "After 4.Nxd4, Black must decide between 4...Nf6 (fighting for the centre immediately), 4...e6 (solid, heading for Scheveningen or Taimanov), or 4...g6 (Dragon). Each choice defines a completely different strategic battle — pick based on your style.",
  },
  {
    slug: "sicilian-dragon-main",
    strategicSummary:
      "The Dragon is one of the sharpest openings in chess. Black fianchettos the dark-squared bishop on g7, creating a powerful long diagonal aimed at White's queenside. White typically launches a kingside attack with g4-g5, while Black counterattacks on the queenside with ...Rc8, ...Ne5, and ...b5. The race between the two attacks is often decided by a single tempo — precision is everything.",
    hintText:
      "After 6.Be3, Black should play 6...Bg7 and prepare ...Nc6, ...0-0, and ...d5 or ...Nxd4 followed by ...e5. The key move to remember is ...Rc8 to pressure the c-file before White can consolidate. Never play passively in the Dragon — counterattack is the only defence.",
  },
  {
    slug: "sicilian-najdorf-english",
    strategicSummary:
      "The English Attack (6.Be3 followed by f3, g4) is one of the most aggressive systems against the Najdorf. White builds a powerful kingside pawn storm while Black must react precisely on the queenside. Black's main plans involve ...Nbd7-c5, ...b5-b4, and ...a5-a4 to create queenside counterplay before White's attack crashes through. Timing and move order are critical — one passive move can be fatal.",
    hintText:
      "After 6.Bg5, Black's most critical response is 6...e6 (Poisoned Pawn: 6...Nbd7 7.Bc4 Qb6 is also possible). The key idea is to challenge White's centre with ...d5 at the right moment. Watch for the thematic ...Nxe4 sacrifice when White's bishop on g5 is unprotected.",
  },
  {
    slug: "kings-indian-classical",
    strategicSummary:
      "In the Classical King's Indian (6.Be2), White builds a solid centre and prepares long-term queenside expansion. Black's strategy is to attack on the kingside with ...Nf6-e8-d6-f5 or the classic ...f5-f4 pawn storm. The position is a true battle of plans — White expands with c5 or b4, while Black generates a fierce kingside attack. Understanding the thematic knight manoeuvre ...Ne8-d6 is essential.",
    hintText:
      "After 6.Be2 e5 7.0-0 Nc6 8.d5 Ne7, the key move is 9...Nd7 followed by ...f5. Black's knight on e8 will reroute to f6 or g6 to support the f5-f4 advance. Don't rush — prepare the kingside attack carefully before committing.",
  },
  {
    slug: "grunfeld-exchange-bc4",
    strategicSummary:
      "The Exchange Grünfeld with 7.Bc4 is one of White's most direct attempts to exploit the central pawn mass. White aims to use the d5 pawn as a battering ram while the bishop on c4 targets f7. Black must counterattack the centre immediately with ...c5 and ...Nc6, aiming to undermine d5 before White can consolidate. The resulting positions are extremely sharp and theoretically demanding.",
    hintText:
      "After 7.Bc4, Black's critical response is 7...c5 8.Ne2 Nc6 9.Be3 0-0. The key idea is to attack the d5 pawn with ...Bg4, ...Nd4, and ...cxd5 at the right moment. Black's dark-squared bishop on g7 is the most powerful piece in the position — keep it active.",
  },
  {
    slug: "qgd-e6",
    strategicSummary:
      "The Queen's Gambit Declined (2...e6) is one of the most solid and respected defences in chess. Black accepts a slightly cramped position in exchange for a rock-solid pawn structure. The key strategic battle revolves around Black's light-squared bishop — often called the 'problem piece' — which can become passive behind the e6-d5 pawn chain. Black must find the right moment to free the position with ...c5 or ...e5.",
    hintText:
      "After 3.Nc3 Nf6 4.Bg5, Black's main choices are 4...Be7 (solid, Classical), 4...Nbd7 (Lasker Defence), or 4...h6 (Manhattan Variation). The key idea in all lines is to eventually challenge White's centre with ...c5 or ...dxc4 followed by ...c5. Don't allow White to establish a bind with e4.",
  },
  {
    slug: "ruy-lopez-open",
    strategicSummary:
      "The Open Ruy Lopez (5...Nxe4) is Black's most dynamic response to the Spanish Game. By sacrificing the e-pawn temporarily, Black gains active piece play and counterattacking chances. The resulting positions are highly tactical — Black must be precise in recovering the pawn while keeping the initiative. White's compensation is long-term pressure on the e5 pawn and a space advantage.",
    hintText:
      "After 5...Nxe4 6.d4 b5 7.Bb3 d5 8.dxe5 Be6, the critical move is 9.c3 (or 9.Nbd2). Black must play 9...Be7 and castle quickly. The key defensive idea is ...f5 to support the e4 knight and maintain the pawn on d5. Don't allow White to win the e4 knight without sufficient compensation.",
  },
  {
    slug: "nimzo-classical-qc2",
    strategicSummary:
      "The Classical Nimzo-Indian with 4.Qc2 avoids the doubled pawns that arise after 4.e3 Bxc3+ 5.bxc3. White keeps the pawn structure intact and prepares e4 to establish a strong centre. Black must find active counterplay with ...d5, ...c5, or ...b6 followed by ...Ba6 to pressure White's queenside. The position rewards understanding of pawn structures over memorisation of long theoretical lines.",
    hintText:
      "After 4.Qc2 d5 5.a3 Bxc3+ 6.Qxc3, Black's key move is 6...Ne4 7.Qc2 c5. This forces White to make a structural decision. Alternatively, 4...0-0 5.a3 Bxc3+ 6.Qxc3 b6 followed by ...Ba6 is a solid plan to exchange the dark-squared bishop for the knight on f3.",
  },
  {
    slug: "italian-giuoco-pianissimo",
    strategicSummary:
      "The Giuoco Pianissimo (4.c3 d3) is a slow, positional system where White builds a solid centre without immediate confrontation. White's plan is to complete development, castle, and then expand with d4 at the optimal moment. Black has several solid setups: ...d6 with ...Be6, ...d5 directly, or the flexible ...a6 system. The resulting middlegames are rich in strategic nuance and reward long-term planning.",
    hintText:
      "After 4.c3 Nf6 5.d3 d6 6.0-0, Black's most solid plan is 6...a6 7.Bb3 Ba7 followed by ...0-0 and ...d5 at the right moment. The bishop on a7 is a powerful long-term asset. Alternatively, 6...Be6 7.Bxe6 fxe6 gives Black a solid pawn structure with the half-open f-file.",
  },
  {
    slug: "sicilian-smith-morra-gambit",
    strategicSummary:
      "The Smith-Morra Gambit (2.d4 cxd4 3.c3) is a sharp and dangerous weapon against the Sicilian. White sacrifices a pawn for rapid development and attacking chances. The key ideas are Nc3, Nf3, Bc4, and 0-0 with pressure on f7 and the d5 square. Black must return the pawn at the right moment or find a way to consolidate the extra material while neutralising White's initiative.",
    hintText:
      "After 3.c3 dxc3 4.Nxc3, Black's most solid response is 4...Nc6 5.Nf3 d6 6.Bc4 e6. The key defensive idea is ...Be7, ...Nf6, and ...0-0 followed by ...a6 and ...Qc7 to consolidate. Avoid 4...e5 which allows White excellent compensation after 5.Nf3 Nc6 6.Bc4.",
  },
  {
    slug: "french-exchange",
    strategicSummary:
      "The French Exchange Variation (3.exd5 exd5) leads to a symmetrical pawn structure with equal chances. White's main plan is to develop quickly and exploit any weaknesses in Black's position. Black has a solid position but must avoid passive play — the key is to activate the light-squared bishop (the 'problem piece' in the French) and create counterplay on the queenside or in the centre.",
    hintText:
      "After 3.exd5 exd5 4.Bd3 Bd6 5.Nf3 Ne7, Black should play 5...Nf6 and then ...0-0, ...Bg4, and ...Re8. The key idea is to activate the light-squared bishop via ...Bg4 pinning the knight, or to play ...c5 and ...Nc6 to create queenside pressure. The position is roughly equal but Black must play actively.",
  },
  {
    slug: "qg-tarrasch-main-line",
    strategicSummary:
      "The Tarrasch Defence (3...c5) is Black's most dynamic response to the Queen's Gambit. Black accepts an isolated d-pawn in exchange for active piece play and open lines. The isolated pawn on d5 is both a weakness and a strength — it controls key central squares and provides outposts for Black's pieces. The key is to use the active piece play to create threats before White can blockade the d-pawn.",
    hintText:
      "After 4.cxd5 exd5 5.Nf3 Nc6 6.g3 Nf6 7.Bg2 Be7 8.0-0 0-0, Black's key plan is 8...Be6 followed by ...Qd7 and ...Rad8. The isolated d-pawn must be supported actively — use it to create piece activity, not as a static weakness. The knight on c6 is ideally placed to support ...d4 breaks.",
  },
  {
    slug: "qgd-orthodox-rc1",
    strategicSummary:
      "The Orthodox QGD with 7.Rc1 is one of White's most precise systems. The rook on c1 prepares to support the c4-c5 advance and targets the c7 pawn. Black must react carefully — the standard plan is ...c6 followed by ...dxc4 and ...b5 to create queenside counterplay. Understanding the minority attack (b4-b5 by White) and how to counter it is essential in this line.",
    hintText:
      "After 7.Rc1 c6 8.Bd3 dxc4 9.Bxc4 Nd5, Black's key move is 9...b5 10.Bd3 Bb7. The plan is to use the queenside majority to create passed pawns. Watch for the thematic ...Nxc3 exchange to eliminate White's knight before the minority attack begins. Don't allow White to establish a knight on e5.",
  },
  {
    slug: "qg-tarrasch-schara-hennig",
    strategicSummary:
      "The Schara-Hennig Gambit (4...cxd4) is a bold pawn sacrifice that gives Black immediate active play. By giving up the c-pawn, Black gains rapid development and targets White's centre. The resulting positions are sharp and require precise play from both sides. White must be careful not to get overwhelmed by Black's piece activity, while Black must generate sufficient compensation for the pawn.",
    hintText:
      "After 4...cxd4 5.Qxd4 Nc6 6.Qd1 e5, Black's key idea is ...Nf6, ...Bc5, and ...0-0 with active piece play. The move ...d4 is a key thematic break to open the position. Watch for the tactical shot ...Nxe4 if White plays passively. Black's compensation is dynamic — don't allow the position to simplify prematurely.",
  },
  {
    slug: "ruy-lopez-exchange",
    strategicSummary:
      "The Exchange Ruy Lopez (4.Bxc6) is a direct attempt to give Black doubled pawns in exchange for the bishop pair. White's long-term plan is to exploit the structural weakness with a kingside attack and then transition to a favourable endgame. Black's compensation is the bishop pair and active piece play. The key is to use the half-open b-file and the bishop pair to create counterplay.",
    hintText:
      "After 4.Bxc6 dxc6 5.0-0 f6 6.d4 exd4 7.Nxd4 c5, Black's key plan is ...Bd6, ...Ne7, and ...0-0 followed by ...Be6 and queenside expansion. The doubled c-pawns are not as weak as they look — they control key central squares. Use the bishop pair actively and don't allow White to establish a knight on d5.",
  },
  {
    slug: "qgd-exchange-variation",
    strategicSummary:
      "The QGD Exchange Variation (4.cxd5) leads to the famous minority attack structure. White will play b4-b5 to create a passed pawn on the queenside, while Black must react with active piece play. The key strategic concept is the minority attack: White uses two pawns to attack three Black pawns, creating a weakness on c6. Black's counterplay involves piece activity and the half-open e-file.",
    hintText:
      "After 4.cxd5 exd5 5.Bg5 Be7 6.e3 0-0 7.Bd3 Nbd7 8.Qc2 Re8, Black's key plan is 8...Nf8 followed by ...Ne6 and ...g6 to defend against the minority attack. The knight on e6 is ideally placed to blockade White's queenside advances. Don't allow White to create a passed pawn on c6 without sufficient counterplay.",
  },
  {
    slug: "sicilian-classical-sozin",
    strategicSummary:
      "The Sozin Attack (6.Bc4) is one of White's most aggressive systems against the Classical Sicilian. The bishop on c4 targets f7 and supports a future e5 advance. White's plan is to launch a direct kingside attack with f4-f5 or the Fischer Attack (6.Bc4 Bd6 7.Bb3 followed by f4). Black must counterattack in the centre with ...d5 or on the queenside before White's attack becomes overwhelming.",
    hintText:
      "After 6.Bc4 Bd6 7.Bb3 0-0 8.f4, Black's key defensive idea is 8...Na5 to exchange the dangerous bishop on b3. Alternatively, 8...Nxd4 9.Qxd4 e5 10.Qd3 exf4 11.Bxf4 is a sharp equalising line. The key principle is to challenge White's centre before the f4-f5 advance becomes unstoppable.",
  },
  {
    slug: "qg-catalan-open",
    strategicSummary:
      "The Open Catalan (4...dxc4) is Black's most ambitious response to the Catalan. By capturing the c-pawn, Black gains material but must defend accurately against White's long-term pressure. White's bishop on g2 exerts powerful pressure on the queenside, and the open c-file creates additional threats. Black must return the pawn at the right moment or find a way to consolidate with ...a6, ...b5, and ...Bb7.",
    hintText:
      "After 4...dxc4 5.Bg2 a6 6.0-0 Nc6 7.e3 Bd7, Black's key plan is 7...b5 followed by ...Bb7 and ...Nf6. The pawn on c4 can be held temporarily with ...b5-b4, but White will eventually recover it. The key is to use the extra pawn to gain time for development and then equalise in the middlegame.",
  },
  {
    slug: "ruy-lopez-marshall-attack",
    strategicSummary:
      "The Marshall Attack (8...d5) is one of the most famous gambits in chess. Black sacrifices a pawn for massive piece activity and a direct attack on White's king. The resulting positions are extremely sharp and theoretically demanding. White must find precise defensive moves to neutralise Black's initiative, while Black must generate concrete threats before the extra pawn becomes decisive.",
    hintText:
      "After 8...d5 9.exd5 Nxd5 10.Nxe5 Nxe5 11.Rxe5 c6, Black's key move is 11...Nf4 with the threat of ...Qh4. The Marshall Attack requires precise knowledge of the key attacking ideas: ...Qh4, ...Bg4, ...Rae8, and the thematic ...Rxe5 sacrifice. Study the main defensive lines for White carefully — the Anti-Marshall (8.a4) is played precisely to avoid this.",
  },
  {
    slug: "french-winawer",
    strategicSummary:
      "The Winawer Variation (3.Nc3 Bb4) is one of the most complex and theoretically rich openings in chess. Black pins the knight and prepares to double White's pawns. The resulting positions are highly asymmetric — White has the bishop pair and a strong centre, while Black has a solid pawn structure and counterplay on the queenside. The key strategic battle is between White's kingside attack and Black's queenside counterplay.",
    hintText:
      "After 4.e5 c5 5.a3 Bxc3+ 6.bxc3 Ne7, Black's key plan is 6...Qa5 to pressure the c3 pawn, or 6...b6 followed by ...Ba6 to exchange the dark-squared bishop. The thematic break ...c4 is Black's most important strategic idea — it fixes White's pawn structure and creates a passed pawn on the queenside.",
  },
  {
    slug: "qga-accepted",
    strategicSummary:
      "The Queen's Gambit Accepted (2...dxc4) is a sound and active defence. Black accepts the pawn temporarily and aims to equalise with ...e5 or ...c5. White's plan is to recover the pawn and establish a strong centre. The key strategic idea for Black is to play ...e5 as quickly as possible to challenge White's centre before it becomes too strong. The resulting positions are rich in strategic complexity.",
    hintText:
      "After 3.Nf3 Nf6 4.e3 e6 5.Bxc4 c5 6.0-0 a6, Black's key plan is 6...Nc6 followed by ...cxd4 and ...b5 to hold the extra pawn. Alternatively, 6...b5 7.Bb3 Bb7 is a solid plan. The key principle is to use the extra pawn to gain time and then equalise in the middlegame with active piece play.",
  },
  {
    slug: "nimzo-rubinstein-e3",
    strategicSummary:
      "The Rubinstein Variation (4.e3) is White's most solid approach to the Nimzo-Indian. White avoids doubled pawns and builds a reliable pawn structure. The key strategic battle is between White's bishop pair (after ...Bxc3+) and Black's superior pawn structure. Black's plan typically involves ...b6 followed by ...Ba6 to exchange the dark-squared bishop, or ...d5 with ...c5 to challenge the centre.",
    hintText:
      "After 4.e3 b6 5.Nge2 Ba6, Black's key idea is to exchange the dark-squared bishop for White's knight on c3 or e2. After 6.a3 Bxc3+ 7.Nxc3 d5, Black has a solid position with the bishop pair exchanged. The plan is ...0-0, ...Nbd7, and ...c5 to challenge White's centre.",
  },
  {
    slug: "london-main-d5-nf6-e6",
    strategicSummary:
      "The London System main line (d5, Nf6, e6) is one of the most solid setups against White's London. Black builds a compact pawn structure and prepares to challenge White's centre. The key strategic idea is to play ...c5 at the right moment to challenge the d4 pawn, or to use the ...Ne4 manoeuvre to exchange pieces and equalise. The resulting positions are rich in strategic nuance.",
    hintText:
      "After 1.d4 d5 2.Nf3 Nf6 3.Bf4 e6 4.e3 Bd6, Black's key move is 4...Bxf4 5.exf4 c5 to challenge the centre immediately. Alternatively, 4...c5 5.c3 Nc6 is a solid equalising plan. The key principle is to challenge White's centre before the London structure becomes too solid.",
  },
  {
    slug: "qgd-vienna-variation",
    strategicSummary:
      "The Vienna Variation (4...dxc4 5.e4) is one of the sharpest lines in the QGD. Black accepts the pawn and White immediately grabs space in the centre. The resulting positions are extremely sharp and require precise play from both sides. Black must find a way to consolidate the extra pawn while neutralising White's powerful centre. The key defensive idea is ...Bb4+ followed by ...c5 to challenge the centre.",
    hintText:
      "After 5.e4 Bb4+ 6.Nc3 dxc4 7.Bxc4 0-0 8.0-0, Black's key plan is 8...b5 9.Bb3 c5 to challenge the centre. The bishop on b4 is a key piece — use it to pin the knight and create pressure on the centre. Don't allow White to establish a knight on d5 without sufficient counterplay.",
  },
  {
    slug: "sicilian-grand-prix-attack",
    strategicSummary:
      "The Grand Prix Attack (2.Nc3 f4) is a direct and aggressive system against the Sicilian. White builds a kingside attack with f4-f5 and a bishop on c4 or b3 targeting f7. The key strategic idea is to launch a direct kingside attack before Black can organise queenside counterplay. Black must react precisely with ...e6, ...d5, or ...g6 to neutralise White's attacking intentions.",
    hintText:
      "After 2.Nc3 Nc6 3.f4 g6 4.Nf3 Bg7 5.Bc4, Black's key move is 5...e6 followed by ...Nge7 and ...d5 to challenge the centre. Alternatively, 5...d6 6.0-0 e6 7.d3 Nge7 is a solid defensive setup. The key principle is to challenge White's centre before the f4-f5 advance becomes unstoppable.",
  },
  {
    slug: "italian-two-knights-traxler",
    strategicSummary:
      "The Traxler Counter-Attack (4...Bc5) is one of the most spectacular gambits in chess. Black sacrifices material to launch a ferocious attack on White's king. The resulting positions are extremely sharp and require precise calculation from both sides. White must find the best defensive moves to survive the initial onslaught, while Black must generate concrete threats before the material deficit becomes decisive.",
    hintText:
      "After 4...Bc5 5.Nxf7 Bxf2+ 6.Ke2 Nd4+, Black's key attacking idea is ...Ng4 with the threat of ...Nf2+ and ...Nxh1. The Traxler is a weapon of surprise — study the key variations carefully. The critical defensive move for White is 5.d4 instead of 5.Nxf7, which leads to a more positional game.",
  },
  {
    slug: "vienna-solid-g3",
    strategicSummary:
      "The Vienna Solid (2...Nc6 3.g3) is a flexible and positional approach. White fianchettos the bishop on g2 and builds a solid position. The key strategic idea is to control the centre with d3 and f4 while keeping the position flexible. Black must find the right plan to challenge White's setup — typically ...Nf6, ...d5, or ...f5 to create counterplay.",
    hintText:
      "After 3.g3 Nf6 4.Bg2 d5 5.exd5 Nxd5 6.Nge2, Black's key plan is 6...Bc5 followed by ...0-0 and ...Be6. The knight on d5 is well-placed — use it to control key central squares. Alternatively, 6...Nb4 7.0-0 Nd3 is a sharp equalising idea.",
  },
  {
    slug: "ruy-lopez-berlin-wall",
    strategicSummary:
      "The Berlin Defence (3...Nf6 4.0-0 Nxe4) is one of the most solid and respected defences in modern chess. After the queen exchange, Black accepts a slightly inferior endgame in exchange for a rock-solid pawn structure. The key strategic battle is in the endgame — Black's doubled c-pawns are a weakness, but the bishop pair and active rooks provide sufficient compensation. Precision in the endgame is everything.",
    hintText:
      "After 4...Nxe4 5.d4 Nd6 6.Bxc6 dxc6 7.dxe5 Nf5 8.Qxd8+ Kxd8, Black's key plan is 8...Ke8 followed by ...Be7, ...Rd8, and ...c5 to activate the pieces. The doubled c-pawns are not as weak as they look — they control key central squares. Use the bishop pair actively and aim for an active rook endgame.",
  },
  {
    slug: "ruy-lopez-closed-chigorin",
    strategicSummary:
      "The Chigorin Variation (9...Na5) is one of the most popular and dynamic systems in the Closed Ruy Lopez. Black's knight manoeuvres to c4 to exchange the important bishop on b3, while preparing queenside counterplay with ...c5-c4. White must react carefully to Black's queenside pressure while maintaining the initiative in the centre and kingside. The resulting positions are rich in strategic complexity.",
    hintText:
      "After 9...Na5 10.Bc2 c5 11.d4 Qc7, Black's key plan is 11...Nc4 to exchange the bishop on b3, or 11...cxd4 12.cxd4 Nc6 to challenge the centre. The knight on a5 is temporarily misplaced — bring it back to c4 or c6 quickly. Watch for the thematic ...d5 break when White's centre is overextended.",
  },
  {
    slug: "scandinavian-icelandic",
    strategicSummary:
      "The Icelandic Gambit (2...Nf6) is a bold and aggressive response to the Scandinavian. Black sacrifices a pawn to gain rapid development and attacking chances. The resulting positions are sharp and require precise play from both sides. White must find the best defensive moves to consolidate the extra pawn, while Black must generate concrete threats before the material deficit becomes decisive.",
    hintText:
      "After 2...Nf6 3.c4 e6 4.dxe6 Bxe6, Black's key attacking idea is ...Nc6, ...Bc5, and ...0-0 with rapid development. The gambit is most effective when White tries to hold the extra pawn — 5.Nf3 Nc6 6.Be2 Bc5 7.0-0 0-0 gives Black excellent compensation. The key principle is to develop quickly and create threats before White can consolidate.",
  },
  {
    slug: "sicilian-scheveningen-english-attack",
    strategicSummary:
      "The English Attack (7.f3) against the Scheveningen is one of White's most aggressive systems. White builds a powerful kingside attack with g4-g5 while Black must react with queenside counterplay. The key strategic battle is the race between White's kingside attack and Black's queenside counterplay. Black must play precisely with ...a5-a4, ...Nbd7-c5, and ...b5-b4 to create threats before White's attack crashes through.",
    hintText:
      "After 7.f3 a6 8.g4 h6 9.h4, Black's key defensive idea is 9...e5 to challenge the centre before White's attack becomes unstoppable. Alternatively, 9...b5 10.g5 hxg5 11.hxg5 Nfd7 is a sharp defensive setup. The key principle is to counterattack in the centre or on the queenside — passive defence is fatal in the English Attack.",
  },
  {
    slug: "italian-two-knights-modern-d3",
    strategicSummary:
      "The Modern Two Knights (4.d3) is a quiet, positional system that avoids the sharp tactical complications of the classical 4.Ng5. White builds a solid centre and prepares long-term pressure. The key strategic idea is to use the bishop on c4 and the d3-e4 pawn chain to control the centre. Black must find the right plan to create counterplay — typically ...d5 or ...Be6 to challenge the Italian bishop.",
    hintText:
      "After 4.d3 Be7 5.0-0 0-0 6.Re1 d6 7.a4, Black's key plan is 7...Na5 to exchange the bishop on c4, or 7...a5 to prevent White's queenside expansion. The knight manoeuvre ...Na5-c6 or ...Nb8-d7-f6 is a key defensive idea. Don't allow White to establish a strong centre with d4.",
  },
  {
    slug: "italian-evans-gambit-declined",
    strategicSummary:
      "The Evans Gambit Declined (4...Bb6) is Black's most solid response to the Evans Gambit. By retreating the bishop, Black avoids the sharp tactical complications of the accepted gambit. White has a slight space advantage but Black has a solid position. The key strategic idea is to use the bishop on b6 to control the a7-g1 diagonal and prepare ...d5 to challenge White's centre.",
    hintText:
      "After 4...Bb6 5.a4 a6 6.Nc3 Nf6 7.d3 d6, Black's key plan is 7...0-0 followed by ...d5 to challenge the centre. The bishop on b6 is well-placed — use it to control the a7-g1 diagonal. Alternatively, 5...a5 6.b5 d6 7.d4 exd4 8.Nxd4 is a sharp equalising line.",
  },
  {
    slug: "ruy-lopez-anti-marshall",
    strategicSummary:
      "The Anti-Marshall (8.a4) is White's most popular way to avoid the Marshall Attack. By playing a4 before Black can play ...d5, White sidesteps the gambit and maintains a slight positional advantage. The resulting positions are rich in strategic complexity — White has a space advantage while Black must find active counterplay. The key strategic battle revolves around the b5 square and Black's queenside pawn structure.",
    hintText:
      "After 8.a4 b4 9.d4 d6 10.dxe5 dxe5 11.Qxd8 Rxd8, Black's key plan is 11...Nxd8 followed by ...Ne6 and ...c6 to consolidate. The Anti-Marshall leads to a rich positional game — focus on piece activity and the control of key squares rather than material. The knight on e6 is ideally placed to blockade White's queenside advances.",
  },
  {
    slug: "scandinavian-main-qa5",
    strategicSummary:
      "The Scandinavian Main Line (2...Qxd5 3.Nc3 Qa5) is Black's most popular and solid response. The queen on a5 keeps pressure on the centre and prepares ...c6 and ...Bf5 for solid development. White's main plans involve Nf3, Bc4 or d4, and queenside castling for a direct attack. Black must develop quickly with ...Nf6, ...c6, and ...Bf5 or ...Bg4 to neutralise White's initiative.",
    hintText:
      "After 3.Nc3 Qa5 4.d4 Nf6 5.Nf3 Bf5 6.Bc4 e6, Black's key plan is 6...c6 followed by ...Bb4 and ...0-0. The queen on a5 is well-placed to pressure the centre. Watch for the thematic ...Nxe4 sacrifice if White plays passively. The key principle is to develop quickly and challenge White's centre before it becomes too strong.",
  },
  {
    slug: "slav-main-dxc4",
    strategicSummary:
      "The Slav Main Line (4.Nc3 dxc4) is one of Black's most dynamic responses to the Queen's Gambit. By capturing the c-pawn, Black gains material and creates an asymmetric position. White's compensation is the bishop pair and a space advantage. Black must find a way to consolidate the extra pawn with ...b5 and ...a6, or return it at the right moment for active piece play.",
    hintText:
      "After 4.Nc3 dxc4 5.a4 Bf5 6.e3 e6 7.Bxc4 Bb4, Black's key plan is 7...Nbd7 followed by ...Nb6 and ...Bxc4. The bishop on f5 is a key piece — keep it active. Alternatively, 7...0-0 8.0-0 Nbd7 is a solid setup. The key principle is to use the extra pawn to gain time and then equalise with active piece play.",
  },
  {
    slug: "vienna-main-nf6",
    strategicSummary:
      "The Vienna Main Line (2...Nf6 3.f4) is a direct and aggressive system. White builds a strong centre with f4 and prepares e5 to attack Black's knight. The resulting positions are sharp and require precise play from both sides. Black must react with ...d5 or ...d6 to challenge White's centre before the f4-e5 advance becomes unstoppable.",
    hintText:
      "After 2...Nf6 3.f4 d5 4.fxe5 Nxe4 5.Nf3 Be7, Black's key plan is 5...Bc5 followed by ...0-0 and ...Re8 to pressure the e5 pawn. Alternatively, 5...Bg4 6.d4 Nc6 is a sharp equalising idea. The key principle is to challenge White's centre immediately — don't allow the e5 pawn to become a permanent space advantage.",
  },
  {
    slug: "french-classical-nf6",
    strategicSummary:
      "The Classical French (3.Nc3 Nf6) is one of the most solid and respected defences. Black challenges White's centre immediately with ...Nf6 and prepares ...d5 to create a solid pawn structure. The key strategic battle is between White's kingside attack and Black's queenside counterplay. Black must find the right moment to play ...c5 to challenge the centre and create counterplay.",
    hintText:
      "After 3.Nc3 Nf6 4.Bg5 Be7 5.e5 Nfd7 6.Bxe7 Qxe7, Black's key plan is 6...h6 7.Be3 c5 to challenge the centre. The knight manoeuvre ...Nfd7-b6-c4 is a key strategic idea. Alternatively, 6...0-0 7.f4 c5 8.Nf3 Nc6 is a sharp equalising line. The key principle is to challenge White's centre before the e5 pawn becomes a permanent space advantage.",
  },
  {
    slug: "qg-catalan-closed",
    strategicSummary:
      "The Closed Catalan (4...Be7) is Black's most solid response to the Catalan. By keeping the pawn structure intact, Black avoids the complications of the Open Catalan. White's plan is to use the bishop on g2 and the open c-file to create long-term pressure. Black must find active counterplay with ...c5 or ...dxc4 followed by ...c5 to challenge White's centre.",
    hintText:
      "After 4...Be7 5.Bg2 0-0 6.0-0 dxc4 7.Qc2 a6 8.a4, Black's key plan is 8...Bd7 followed by ...Bc6 to challenge the Catalan bishop. Alternatively, 8...b5 9.axb5 axb5 10.Rxa8 Bxa8 is a sharp equalising line. The key principle is to challenge the Catalan bishop — it is White's most powerful piece in this structure.",
  },
  {
    slug: "qg-semi-slav-meran",
    strategicSummary:
      "The Meran Variation (7...b5) is one of the sharpest and most theoretically demanding lines in the Semi-Slav. Black sacrifices queenside pawns to gain active piece play and counterattacking chances. The resulting positions are extremely sharp and require precise knowledge of long theoretical lines. White must find the best attacking moves to exploit Black's weakened queenside, while Black must generate concrete threats before the material deficit becomes decisive.",
    hintText:
      "After 7...b5 8.Bd3 a6 9.e4 c5 10.e5 cxd4 11.Nxb5 axb5 12.exf6 gxf6, Black's key defensive idea is 12...Qb6 to pressure the f2 pawn. The Meran requires precise knowledge of the key attacking and defensive ideas — study the main variations carefully. The key principle is to generate concrete threats before White's attack becomes unstoppable.",
  },
  {
    slug: "london-vs-kings-indian",
    strategicSummary:
      "The London vs King's Indian Setup (...g6) is a rich strategic battle. White builds a solid London structure while Black fianchettos the bishop on g7. The key strategic battle is between White's queenside expansion and Black's kingside counterplay. Black must find the right moment to play ...c5 or ...e5 to challenge White's centre, while White must use the bishop on f4 and the d4 pawn to maintain central control.",
    hintText:
      "After 1.d4 Nf6 2.Nf3 g6 3.Bf4 Bg7 4.e3 0-0 5.Be2 d6 6.0-0 Nbd7, Black's key plan is 6...c5 to challenge the centre immediately. Alternatively, 6...b6 followed by ...Ba6 is a solid plan to exchange the dark-squared bishop. The key principle is to challenge White's centre before the London structure becomes too solid.",
  },
  {
    slug: "italian-two-knights-fried-liver",
    strategicSummary:
      "The Fried Liver Attack (6.Bxf7+) is one of the most spectacular sacrifices in chess. White sacrifices the bishop to expose Black's king and launch a direct attack. The resulting positions are extremely sharp and require precise calculation from both sides. Black must find the best defensive moves to survive the initial onslaught, while White must generate concrete threats before the material deficit becomes decisive.",
    hintText:
      "After 6.Bxf7+ Kxf7 7.Nd5 Ke6 8.Nc7+ Ke7 9.Nxa8, Black's key defensive idea is 9...b5 10.Nxb5 Qb6 to regain material. The Fried Liver requires precise defensive play — study the key variations carefully. The critical defensive move is 5...Na5 instead of 5...Nxd5, which avoids the Fried Liver entirely.",
  },
  {
    slug: "french-advance-main",
    strategicSummary:
      "The French Advance (3.e5) is White's most aggressive response to the French Defence. By advancing the e-pawn, White gains space and restricts Black's pieces. The key strategic battle is between White's kingside attack (f4-f5 or g4-g5) and Black's queenside counterplay (...c5-c4, ...b5-b4). Black must challenge the e5 pawn with ...c5 and ...Nc6 before White can consolidate the space advantage.",
    hintText:
      "After 3.e5 c5 4.c3 Nc6 5.Nf3 Qb6 6.a3 Nh6, Black's key plan is 6...c4 to fix White's queenside pawn structure. The knight on h6 will reroute to f5 to pressure the e3 or d4 pawn. Alternatively, 6...Bd7 followed by ...cxd4 and ...Nge7 is a solid equalising plan. The key principle is to challenge the e5 pawn — it is White's most important asset in the Advance Variation.",
  },
  {
    slug: "qg-semi-slav-moscow",
    strategicSummary:
      "The Moscow Variation (5.Bg5) is one of White's most ambitious systems against the Semi-Slav. By pinning the knight on f6, White creates immediate pressure and threatens to win the d5 pawn. Black must react precisely with 5...h6 (Anti-Moscow) or 5...dxc4 (Moscow Gambit) to create counterplay. The resulting positions are extremely sharp and theoretically demanding.",
    hintText:
      "After 5.Bg5 h6 6.Bh4 dxc4 7.e4 g5 8.Bg3 b5, Black's key plan is 8...Nxe4 to win material. The Anti-Moscow is one of the sharpest lines in chess — study the key variations carefully. The key principle is to challenge White's centre immediately with ...dxc4 and ...b5 before White can consolidate.",
  },
  {
    slug: "sicilian-closed",
    strategicSummary:
      "The Closed Sicilian (2.Nc3 g3) is a flexible and positional system. White fianchettos the bishop on g2 and builds a solid position without opening the centre. The key strategic idea is to use the bishop on g2 and the f4-f5 advance to create kingside pressure. Black must find the right plan to challenge White's setup — typically ...e5, ...d6, and ...Nge7 to prepare queenside counterplay.",
    hintText:
      "After 2.Nc3 Nc6 3.g3 g6 4.Bg2 Bg7 5.d3 d6 6.f4, Black's key plan is 6...e5 to challenge the centre immediately. Alternatively, 6...Nf6 7.Nf3 0-0 8.0-0 Rb8 is a solid setup for queenside counterplay. The key principle is to challenge White's centre before the f4-f5 advance becomes unstoppable.",
  },
  {
    slug: "italian-giuoco-piano-attack",
    strategicSummary:
      "The Italian Attack (5.d4) is White's most aggressive response in the Giuoco Piano. By advancing d4, White opens the centre and creates immediate tactical complications. The resulting positions are sharp and require precise play from both sides. Black must react with ...exd4 or ...d6 to challenge White's centre before it becomes too strong.",
    hintText:
      "After 5.d4 exd4 6.cxd4 Bb4+ 7.Nc3 Nxe4 8.0-0, Black's key defensive idea is 8...Bxc3 9.d5 Bf6 to maintain the extra pawn. Alternatively, 8...Nxc3 9.bxc3 Bxc3 10.Qb3 is a sharp equalising line. The key principle is to challenge White's centre immediately — don't allow the d4-e4 pawn centre to become too powerful.",
  },
  {
    slug: "italian-evans-gambit-accepted",
    strategicSummary:
      "The Evans Gambit Accepted (4...Bxb4) is one of the most romantic and aggressive openings in chess. White sacrifices a pawn to gain rapid development and a powerful centre. The resulting positions are extremely sharp and require precise calculation from both sides. Black must find the best defensive moves to survive the initial onslaught, while White must generate concrete threats before the material deficit becomes decisive.",
    hintText:
      "After 4...Bxb4 5.c3 Ba5 6.d4 exd4 7.0-0 Nge7, Black's key defensive idea is 7...d6 followed by ...Bb6 and ...0-0 to consolidate. The Evans Gambit requires precise defensive play — study the key variations carefully. The critical defensive move is 7...d6 8.cxd4 Bb6 9.d5 Na5 10.Bb2 Ne7 to return the pawn at the right moment.",
  },
];

console.log(`Updating ${updates.length} lines...\n`);

let updated = 0;
let notFound = 0;

for (const u of updates) {
  const [rows] = await conn.execute(
    `SELECT id, title FROM opening_lines WHERE slug = ? AND is_published = 1`,
    [u.slug]
  );
  if (!rows.length) {
    console.log(`  ⚠️  Not found: ${u.slug}`);
    notFound++;
    continue;
  }
  await conn.execute(
    `UPDATE opening_lines SET strategic_summary = ?, hint_text = ? WHERE slug = ?`,
    [u.strategicSummary, u.hintText, u.slug]
  );
  console.log(`  ✅ Updated: ${rows[0].title}`);
  updated++;
}

console.log(`\n═══════════════════════════════════════════`);
console.log(`Updated: ${updated}  |  Not found: ${notFound}`);

await conn.end();
