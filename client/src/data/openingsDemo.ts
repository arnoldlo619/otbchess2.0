/**
 * openingsDemo.ts — Static demo data for the Openings & Repertoire feature.
 *
 * Used when a non-Pro / unauthenticated user enters "View Demo" mode.
 * Data is intentionally curated to showcase the breadth of the feature:
 * a mix of sides, difficulties, and styles.
 */

// ── Types (mirror the API shapes) ─────────────────────────────────────────────
export interface DemoOpeningCard {
  id: string;
  slug: string;
  name: string;
  side: "white" | "black";
  eco: string;
  shortDescription: string;
  difficulty: "beginner" | "intermediate" | "advanced" | "expert";
  popularity: number;
  thumbnailFen: string;
  isFeatured: boolean;
  starterFriendly: boolean;
  trapPotential: number;
  strategicComplexity: number;
  estimatedLineCount: number;
  lineCount: number;
  tags: { name: string; category: string; slug: string }[];
}

export interface DemoLineCard {
  id: string;
  slug: string;
  title: string;
  description: string;
  difficulty: "beginner" | "intermediate" | "advanced" | "expert";
  moveCount: number;
  commonness: number;
  priority: number;
  mustKnow: boolean;
  starterFriendly: boolean;
  trapLine: boolean;
  lineType: string;
  branchLabel: string;
  progress: null;
  locked: boolean; // true = blurred in demo
}

export interface DemoChapter {
  name: string;
  lines: DemoLineCard[];
}

export interface DemoOpeningDetail {
  id: string;
  slug: string;
  name: string;
  side: "white" | "black";
  eco: string;
  shortDescription: string;
  longDescription: string;
  difficulty: "beginner" | "intermediate" | "advanced" | "expert";
  popularity: number;
  thumbnailFen: string;
  playCharacter: string;
  isFeatured: boolean;
  starterFriendly: boolean;
  trapPotential: number;
  strategicComplexity: number;
  tags: { name: string; category: string; slug: string }[];
  chapters: DemoChapter[];
  lineCount: number;
}

// ── Demo Library (5 openings) ─────────────────────────────────────────────────
export const DEMO_OPENINGS: DemoOpeningCard[] = [
  {
    id: "demo-1",
    slug: "demo-london-system",
    name: "London System",
    side: "white",
    eco: "D02",
    shortDescription:
      "A solid, low-theory system for White. Build a strong pawn structure and develop naturally.",
    difficulty: "beginner",
    popularity: 92,
    thumbnailFen: "rnbqkbnr/pppppppp/8/8/3P4/2NB4/PPP1PPPP/R1BQK1NR b KQkq - 3 2",
    isFeatured: true,
    starterFriendly: true,
    trapPotential: 30,
    strategicComplexity: 40,
    estimatedLineCount: 8,
    lineCount: 8,
    tags: [
      { name: "Solid", category: "style", slug: "solid" },
      { name: "Low Theory", category: "theme", slug: "low-theory" },
      { name: "Positional", category: "style", slug: "positional" },
    ],
  },
  {
    id: "demo-2",
    slug: "demo-sicilian-najdorf",
    name: "Sicilian Najdorf",
    side: "black",
    eco: "B90",
    shortDescription:
      "The most popular and combative reply to 1.e4. Black fights for the initiative from move one.",
    difficulty: "advanced",
    popularity: 98,
    thumbnailFen: "rnbqkb1r/1p2pppp/p2p1n2/2p5/3PP3/2N2N2/PPP2PPP/R1BQKB1R w KQkq - 0 6",
    isFeatured: true,
    starterFriendly: false,
    trapPotential: 65,
    strategicComplexity: 90,
    estimatedLineCount: 14,
    lineCount: 14,
    tags: [
      { name: "Sharp", category: "style", slug: "sharp" },
      { name: "Dynamic", category: "theme", slug: "dynamic" },
      { name: "Counterplay", category: "theme", slug: "counterplay" },
    ],
  },
  {
    id: "demo-3",
    slug: "demo-kings-indian-defense",
    name: "King's Indian Defense",
    side: "black",
    eco: "E60",
    shortDescription:
      "A hyper-modern defense where Black allows White a big center, then attacks it with pieces.",
    difficulty: "intermediate",
    popularity: 88,
    thumbnailFen: "rnbq1rk1/ppp1ppbp/3p1np1/8/2PPP3/2N2N2/PP2BPPP/R1BQK2R w KQ - 4 7",
    isFeatured: false,
    starterFriendly: false,
    trapPotential: 55,
    strategicComplexity: 75,
    estimatedLineCount: 10,
    lineCount: 10,
    tags: [
      { name: "Hypermodern", category: "style", slug: "hypermodern" },
      { name: "Kingside Attack", category: "theme", slug: "kingside-attack" },
    ],
  },
  {
    id: "demo-4",
    slug: "demo-queens-gambit",
    name: "Queen's Gambit",
    side: "white",
    eco: "D06",
    shortDescription:
      "One of the oldest and most respected openings. White immediately contests the center with 2.c4.",
    difficulty: "intermediate",
    popularity: 95,
    thumbnailFen: "rnbqkbnr/ppp1pppp/8/3p4/2PP4/8/PP2PPPP/RNBQKBNR b KQkq - 0 2",
    isFeatured: false,
    starterFriendly: true,
    trapPotential: 40,
    strategicComplexity: 65,
    estimatedLineCount: 12,
    lineCount: 12,
    tags: [
      { name: "Classical", category: "style", slug: "classical" },
      { name: "Positional", category: "style", slug: "positional" },
      { name: "Center Control", category: "theme", slug: "center-control" },
    ],
  },
  {
    id: "demo-5",
    slug: "demo-french-defense",
    name: "French Defense",
    side: "black",
    eco: "C00",
    shortDescription:
      "A solid, strategic defense against 1.e4. Black builds a compact pawn chain and counterattacks on the queenside.",
    difficulty: "beginner",
    popularity: 82,
    thumbnailFen: "rnbqkbnr/pppp1ppp/4p3/8/3PP3/8/PPP2PPP/RNBQKBNR b KQkq - 0 2",
    isFeatured: false,
    starterFriendly: true,
    trapPotential: 35,
    strategicComplexity: 55,
    estimatedLineCount: 9,
    lineCount: 9,
    tags: [
      { name: "Solid", category: "style", slug: "solid" },
      { name: "Queenside Play", category: "theme", slug: "queenside-play" },
      { name: "Pawn Structure", category: "theme", slug: "pawn-structure" },
    ],
  },
];

// ── Demo Detail (London System) ───────────────────────────────────────────────
export const DEMO_OPENING_DETAIL: DemoOpeningDetail = {
  id: "demo-1",
  slug: "demo-london-system",
  name: "London System",
  side: "white",
  eco: "D02",
  shortDescription:
    "A solid, low-theory system for White. Build a strong pawn structure and develop naturally.",
  longDescription:
    "The London System is one of the most reliable openings for club players. White sets up a solid pawn triangle on d4, e3, and c3, develops the dark-squared bishop to f4 before closing the center, and castles kingside. Because the structure is nearly the same against any Black response, you spend less time memorizing theory and more time understanding plans.\n\nThe London is favored by players who prefer positional chess — controlling space, trading off Black's active pieces, and grinding out endgame advantages. It's also a great weapon for time-pressure situations because the moves are almost automatic.",
  difficulty: "beginner",
  popularity: 92,
  thumbnailFen: "rnbqkbnr/pppppppp/8/8/3P4/2NB4/PPP1PPPP/R1BQK1NR b KQkq - 3 2",
  playCharacter: "positional",
  isFeatured: true,
  starterFriendly: true,
  trapPotential: 30,
  strategicComplexity: 40,
  tags: [
    { name: "Solid", category: "style", slug: "solid" },
    { name: "Low Theory", category: "theme", slug: "low-theory" },
    { name: "Positional", category: "style", slug: "positional" },
    { name: "Endgame Strength", category: "theme", slug: "endgame-strength" },
  ],
  lineCount: 8,
  chapters: [
    {
      name: "Main Lines",
      lines: [
        {
          id: "dl-1",
          slug: "demo-london-main",
          title: "London Setup — Core Structure",
          description: "1.d4 d5 2.Nf3 Nf6 3.Bf4 e6 4.e3 Be7 5.Bd3 O-O 6.O-O",
          difficulty: "beginner",
          moveCount: 12,
          commonness: 90,
          priority: 1,
          mustKnow: true,
          starterFriendly: true,
          trapLine: false,
          lineType: "main",
          branchLabel: "Main",
          progress: null,
          locked: false,
        },
        {
          id: "dl-2",
          slug: "demo-london-c5-push",
          title: "Black plays …c5 — Breaking the Center",
          description: "How to handle Black's most common counter-thrust with …c5.",
          difficulty: "beginner",
          moveCount: 16,
          commonness: 80,
          priority: 2,
          mustKnow: true,
          starterFriendly: true,
          trapLine: false,
          lineType: "variation",
          branchLabel: "Variation A",
          progress: null,
          locked: false,
        },
        {
          id: "dl-3",
          slug: "demo-london-kingside-attack",
          title: "Kingside Attack with h4–h5",
          description: "Aggressive plan when Black castles kingside — storm the h-file.",
          difficulty: "intermediate",
          moveCount: 20,
          commonness: 55,
          priority: 3,
          mustKnow: false,
          starterFriendly: false,
          trapLine: false,
          lineType: "plan",
          branchLabel: "Plan B",
          progress: null,
          locked: true,
        },
      ],
    },
    {
      name: "Traps & Tricks",
      lines: [
        {
          id: "dl-4",
          slug: "demo-london-trap",
          title: "The Jobava London Trap",
          description: "A sharp early deviation that wins material if Black is careless.",
          difficulty: "intermediate",
          moveCount: 14,
          commonness: 40,
          priority: 4,
          mustKnow: false,
          starterFriendly: false,
          trapLine: true,
          lineType: "trap",
          branchLabel: "Trap",
          progress: null,
          locked: true,
        },
        {
          id: "dl-5",
          slug: "demo-london-bishop-trap",
          title: "Bishop Trap on h7",
          description: "Win the h7 pawn and more when Black misplaces the knight.",
          difficulty: "intermediate",
          moveCount: 18,
          commonness: 35,
          priority: 5,
          mustKnow: false,
          starterFriendly: false,
          trapLine: true,
          lineType: "trap",
          branchLabel: "Trap",
          progress: null,
          locked: true,
        },
      ],
    },
    {
      name: "Endgame Plans",
      lines: [
        {
          id: "dl-6",
          slug: "demo-london-endgame",
          title: "Rook Endgame Technique",
          description: "Converting the London's structural advantage in the endgame.",
          difficulty: "advanced",
          moveCount: 30,
          commonness: 25,
          priority: 6,
          mustKnow: false,
          starterFriendly: false,
          trapLine: false,
          lineType: "endgame",
          branchLabel: "Endgame",
          progress: null,
          locked: true,
        },
      ],
    },
  ],
};
