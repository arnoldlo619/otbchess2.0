import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "wouter";
import { useTheme } from "@/contexts/ThemeContext";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AnimeNavBar } from "@/components/ui/anime-navbar";
import { AvatarNavDropdown } from "@/components/AvatarNavDropdown";
import { useAuthContext } from "@/context/AuthContext";
import { getAllRegistrations } from "@/lib/registrationStore";
import { resolveTournament, listTournaments, hasDirectorSession } from "@/lib/tournamentRegistry";
import { ArrowLeft, Calendar, Clock, ChevronRight, ExternalLink, Building2, LayoutDashboard, Trophy, GraduationCap } from "lucide-react";

// ─── Shared post data (mirrors Blog.tsx POSTS, extended with content) ─────────
export interface BlogPostData {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  date: string;
  image: string;
  readTime: string;
  author: string;
  authorRole: string;
  authorAvatar: string;
  authorBio: string;
  sections: {
    id: string;
    heading: string;
    content: ContentBlock[];
  }[];
}

type ContentBlock =
  | { type: "paragraph"; text: string }
  | { type: "list"; items: string[] }
  | { type: "callout"; text: string }
  | { type: "subheading"; text: string };

// ─── Full article content for all 6 posts ────────────────────────────────────
const POSTS: BlogPostData[] = [
  {
    slug: "introducing-chessotb-club",
    title: "Introducing ChessOTB.club: The Home for Over-the-Board Chess Communities",
    excerpt:
      "We built ChessOTB.club to solve the biggest pain point in OTB chess: running tournaments and clubs without the paperwork. Here's the story behind the platform.",
    category: "Company",
    date: "June 20, 2026",
    image: "https://images.unsplash.com/photo-1529699211952-734e80c4d42b?w=1200&q=80",
    readTime: "4 min read",
    author: "ChessOTB Team",
    authorRole: "Platform Builders",
    authorAvatar: "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=80&q=80",
    authorBio:
      "The ChessOTB.club team is a group of OTB chess enthusiasts and engineers on a mission to bring over-the-board chess into the digital age.",
    sections: [
      {
        id: "the-problem",
        heading: "The Problem We Set Out to Solve",
        content: [
          {
            type: "paragraph",
            text: "Every chess club organizer knows the drill: a Google Form for sign-ups, a spreadsheet for pairings, a whiteboard for standings, and a group chat for announcements. It works — until it doesn't. One missed entry, one formula error, and suddenly your Swiss pairings are wrong and players are arguing at the boards.",
          },
          {
            type: "paragraph",
            text: "We've been there. The ChessOTB.club team ran club nights and weekend tournaments for years before we decided to build the tool we always wished existed.",
          },
        ],
      },
      {
        id: "what-we-built",
        heading: "What We Built",
        content: [
          {
            type: "paragraph",
            text: "ChessOTB.club is a full-stack platform for OTB chess communities. At its core, it handles the three things that consume the most organizer time:",
          },
          {
            type: "list",
            items: [
              "Player registration — players sign up with their chess.com username, and we pull their rating automatically",
              "Swiss pairings — generated in seconds, with tiebreak rules built in",
              "Results and standings — updated in real time as games are reported",
            ],
          },
          {
            type: "paragraph",
            text: "But we didn't stop there. Clubs also get a public profile page, a member leaderboard, QR-code check-in for events, and a growth dashboard to track attendance trends over time.",
          },
        ],
      },
      {
        id: "the-vision",
        heading: "The Vision",
        content: [
          {
            type: "callout",
            text: "Our long-term goal is to become the infrastructure layer for every OTB chess community — the way Stripe is infrastructure for payments.",
          },
          {
            type: "paragraph",
            text: "That means integrating with FIDE, national federations, and rating systems so that results flow automatically. It means building tools for club coaches, league organizers, and tournament directors. And it means creating a social layer so players can follow their rivals, track their progress, and celebrate their wins.",
          },
          {
            type: "paragraph",
            text: "We're just getting started. If you run a chess club or organize tournaments, we'd love to have you on board. Create your club for free at ChessOTB.club.",
          },
        ],
      },
    ],
  },
  {
    slug: "how-swiss-pairings-work",
    title: "How Swiss Pairings Work — And Why They're Perfect for Club Tournaments",
    excerpt:
      "Swiss-system tournaments let every player compete in every round regardless of wins or losses. We break down the algorithm and why it's the gold standard for OTB events.",
    category: "Chess",
    date: "June 15, 2026",
    image: "https://images.unsplash.com/photo-1580541832626-2a7131ee809f?w=1200&q=80",
    readTime: "6 min read",
    author: "ChessOTB Team",
    authorRole: "Platform Builders",
    authorAvatar: "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=80&q=80",
    authorBio:
      "The ChessOTB.club team is a group of OTB chess enthusiasts and engineers on a mission to bring over-the-board chess into the digital age.",
    sections: [
      {
        id: "what-is-swiss",
        heading: "What Is the Swiss System?",
        content: [
          {
            type: "paragraph",
            text: "The Swiss system is a tournament format where players are paired against opponents with similar scores in each round. Unlike a round-robin (where everyone plays everyone), Swiss allows large fields to compete in a manageable number of rounds. Unlike single-elimination, no player is knocked out — everyone plays every round.",
          },
          {
            type: "paragraph",
            text: "It was first used in Zurich in 1895 and has since become the dominant format for club tournaments, open events, and scholastic chess worldwide.",
          },
        ],
      },
      {
        id: "the-algorithm",
        heading: "How the Pairing Algorithm Works",
        content: [
          {
            type: "paragraph",
            text: "In round 1, players are sorted by rating and paired top-half vs bottom-half (e.g., #1 vs #(N/2+1), #2 vs #(N/2+2), etc.). From round 2 onward, players are grouped by score and paired within each score group, with the following constraints:",
          },
          {
            type: "list",
            items: [
              "No two players may meet more than once",
              "Color balance is maintained (alternating white/black where possible)",
              "Players avoid playing the same color three times in a row",
              "Floaters (players who can't be paired within their score group) are paired down to the next group",
            ],
          },
          {
            type: "callout",
            text: "ChessOTB.club implements the FIDE Dutch system (BBP Pairings) — the same algorithm used at the World Chess Olympiad.",
          },
        ],
      },
      {
        id: "tiebreaks",
        heading: "Tiebreak Systems",
        content: [
          {
            type: "paragraph",
            text: "When two or more players finish with the same score, tiebreaks determine final standings. The most common tiebreak systems are:",
          },
          {
            type: "list",
            items: [
              "Buchholz — sum of opponents' scores (rewards playing strong opponents)",
              "Sonneborn-Berger — sum of scores of defeated opponents plus half the scores of drawn opponents",
              "Direct encounter — head-to-head result between tied players",
              "Number of wins — players with more decisive games rank higher",
            ],
          },
          {
            type: "paragraph",
            text: "ChessOTB.club calculates all major tiebreak systems automatically and displays them in the standings table.",
          },
        ],
      },
      {
        id: "why-swiss",
        heading: "Why Swiss Is Perfect for Club Tournaments",
        content: [
          {
            type: "paragraph",
            text: "For a club night with 12–40 players, Swiss is ideal: 4–5 rounds gives a clear winner, every player gets competitive games, and the format scales gracefully if players arrive late or drop out. Compare that to round-robin (impractical above 10 players) or single-elimination (half the field is out after round 1).",
          },
          {
            type: "paragraph",
            text: "With ChessOTB.club, you can generate Swiss pairings for your next event in under 30 seconds — no spreadsheets required.",
          },
        ],
      },
    ],
  },
  {
    slug: "club-growth-tips",
    title: "5 Proven Ways to Grow Your Chess Club Attendance",
    excerpt:
      "From recurring meetups to social media teasers, here are the strategies that top OTB clubs are using to double their attendance in 90 days.",
    category: "Clubs",
    date: "June 10, 2026",
    image: "https://images.unsplash.com/photo-1560472355-536de3962603?w=1200&q=80",
    readTime: "5 min read",
    author: "ChessOTB Team",
    authorRole: "Platform Builders",
    authorAvatar: "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=80&q=80",
    authorBio:
      "The ChessOTB.club team is a group of OTB chess enthusiasts and engineers on a mission to bring over-the-board chess into the digital age.",
    sections: [
      {
        id: "consistency",
        heading: "1. Meet on a Fixed Schedule",
        content: [
          {
            type: "paragraph",
            text: "The single biggest predictor of club growth is consistency. Clubs that meet on the same day and time every week (or every two weeks) retain members far better than those with irregular schedules. People plan their lives around recurring commitments.",
          },
          {
            type: "callout",
            text: "Tip: Use ChessOTB.club's recurring event feature to auto-schedule your club nights and send automatic reminders to members.",
          },
        ],
      },
      {
        id: "social-media",
        heading: "2. Post Post-Event Recaps",
        content: [
          {
            type: "paragraph",
            text: "After each event, post a quick recap on Instagram or X (Twitter): final standings, a photo of the top board, and a shoutout to the winner. This creates FOMO for people who missed it and gives your club a professional presence online.",
          },
          {
            type: "paragraph",
            text: "ChessOTB.club's Recap Generator creates a shareable image with standings and player names in one click — no design skills required.",
          },
        ],
      },
      {
        id: "beginner-friendly",
        heading: "3. Run a Beginner-Friendly Track",
        content: [
          {
            type: "paragraph",
            text: "Many potential members are intimidated by playing against experienced club players. Running a separate beginner section (or a casual 'learn to play' hour before the main tournament) dramatically lowers the barrier to entry.",
          },
          {
            type: "list",
            items: [
              "Designate one board as a teaching board where stronger players explain moves",
              "Run a separate G/15 blitz section for newer players",
              "Pair beginners with mid-level players who are willing to give feedback after the game",
            ],
          },
        ],
      },
      {
        id: "leaderboard",
        heading: "4. Publish a Club Leaderboard",
        content: [
          {
            type: "paragraph",
            text: "Friendly competition drives engagement. A public leaderboard showing season standings, win rates, and rating progress gives members a reason to keep coming back. It also gives your club a sense of ongoing narrative — who's on a hot streak, who's climbing the ranks.",
          },
          {
            type: "paragraph",
            text: "ChessOTB.club's club profile page includes a live leaderboard that updates automatically after each event.",
          },
        ],
      },
      {
        id: "partnerships",
        heading: "5. Partner with Local Venues",
        content: [
          {
            type: "paragraph",
            text: "Coffee shops, libraries, and co-working spaces are often eager to host chess clubs — it brings foot traffic and creates a community atmosphere. Approach venues with a clear pitch: 'We bring 10–30 people every week, we're quiet, and we're good for business.'",
          },
          {
            type: "paragraph",
            text: "Once you have a venue partner, use ChessOTB.club's QR code check-in to run smooth, paperless events that impress both your members and your venue host.",
          },
        ],
      },
    ],
  },
  {
    slug: "elo-ratings-explained",
    title: "ELO Ratings Explained: What Your Chess.com Rating Actually Means OTB",
    excerpt:
      "Online ratings and OTB ratings often diverge. We explain the Elo system, how ChessOTB.club uses chess.com ratings for fair pairings, and what to expect at your first tournament.",
    category: "Chess",
    date: "June 5, 2026",
    image: "https://images.unsplash.com/photo-1611195974226-a6a9be9dd763?w=1200&q=80",
    readTime: "7 min read",
    author: "ChessOTB Team",
    authorRole: "Platform Builders",
    authorAvatar: "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=80&q=80",
    authorBio:
      "The ChessOTB.club team is a group of OTB chess enthusiasts and engineers on a mission to bring over-the-board chess into the digital age.",
    sections: [
      {
        id: "what-is-elo",
        heading: "What Is the Elo Rating System?",
        content: [
          {
            type: "paragraph",
            text: "The Elo rating system, invented by physicist Arpad Elo in the 1960s, is a method for calculating the relative skill levels of players in zero-sum games. In chess, it's the universal language of strength: a 200-point rating difference means the higher-rated player is expected to win about 75% of games.",
          },
          {
            type: "paragraph",
            text: "FIDE (the World Chess Federation) uses Elo for official ratings. Chess.com and Lichess use their own variants (Glicko-2 for Lichess, a proprietary system for Chess.com), which behave similarly but are calibrated differently.",
          },
        ],
      },
      {
        id: "online-vs-otb",
        heading: "Why Online Ratings Differ from OTB Ratings",
        content: [
          {
            type: "paragraph",
            text: "Online ratings are typically inflated compared to OTB ratings for several reasons:",
          },
          {
            type: "list",
            items: [
              "Time controls — most online games are blitz (3–10 min), which rewards pattern recognition over deep calculation",
              "Engine assistance — even on reputable platforms, some opponents use engines, inflating their ratings",
              "Pool size — online rating pools are massive and self-contained, so calibration differs from FIDE's pool",
              "Psychological factors — playing from home removes the physical pressure of OTB competition",
            ],
          },
          {
            type: "callout",
            text: "A rough rule of thumb: subtract 100–200 points from your Chess.com rapid rating to estimate your OTB classical strength.",
          },
        ],
      },
      {
        id: "how-we-use-ratings",
        heading: "How ChessOTB.club Uses Chess.com Ratings",
        content: [
          {
            type: "paragraph",
            text: "When a player signs up for a ChessOTB.club event with their chess.com username, we fetch their rapid rating via the Chess.com API. We use this as a seeding rating for Swiss pairings — not as an official OTB rating.",
          },
          {
            type: "paragraph",
            text: "This approach has two advantages: it's frictionless (no need to submit FIDE IDs or paper rating cards), and it's a reasonable proxy for relative strength within a club. Over time, as players accumulate results on ChessOTB.club, we build a platform-specific rating that reflects their actual OTB performance.",
          },
        ],
      },
      {
        id: "first-tournament",
        heading: "What to Expect at Your First OTB Tournament",
        content: [
          {
            type: "paragraph",
            text: "If you're an online player stepping into your first OTB event, here's what to expect:",
          },
          {
            type: "list",
            items: [
              "Slower time controls — club games are typically G/30 or G/60, which rewards deeper thinking",
              "No takebacks — every move is final, which changes the psychology significantly",
              "Physical notation — you may be required to write down your moves on a score sheet",
              "Handshakes — OTB chess has a culture of sportsmanship; shake hands before and after each game",
            ],
          },
          {
            type: "paragraph",
            text: "Most players find that OTB chess is more satisfying than online chess — the social element, the physical pieces, and the focused atmosphere create an experience that screens can't replicate.",
          },
        ],
      },
    ],
  },
  {
    slug: "tournament-hosting-guide",
    title: "The Complete Guide to Hosting Your First OTB Chess Tournament",
    excerpt:
      "From venue setup to final standings, this step-by-step guide walks you through everything you need to run a smooth, professional chess tournament using ChessOTB.club.",
    category: "Tournaments",
    date: "May 28, 2026",
    image: "https://images.unsplash.com/photo-1586165368502-1bad197a6461?w=1200&q=80",
    readTime: "10 min read",
    author: "ChessOTB Team",
    authorRole: "Platform Builders",
    authorAvatar: "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=80&q=80",
    authorBio:
      "The ChessOTB.club team is a group of OTB chess enthusiasts and engineers on a mission to bring over-the-board chess into the digital age.",
    sections: [
      {
        id: "planning",
        heading: "Step 1: Plan Your Event",
        content: [
          {
            type: "paragraph",
            text: "Start with the basics: date, venue, format, and capacity. For a first tournament, we recommend keeping it simple — 12–24 players, 4–5 Swiss rounds, G/30 time control. This is manageable for a single director and finishes in 3–4 hours.",
          },
          {
            type: "list",
            items: [
              "Venue: a library, coffee shop, or community center with enough tables and good lighting",
              "Equipment: at least one set and clock per board (borrow from members if needed)",
              "Registration: open 2–3 weeks in advance via ChessOTB.club's event page",
              "Entry fee: optional, but a small fee ($5–10) reduces no-shows significantly",
            ],
          },
        ],
      },
      {
        id: "registration",
        heading: "Step 2: Set Up Registration",
        content: [
          {
            type: "paragraph",
            text: "Create your tournament on ChessOTB.club and share the registration link. Players sign up with their chess.com username — no forms, no spreadsheets. You'll see registrations in real time on your director dashboard.",
          },
          {
            type: "callout",
            text: "Pro tip: Enable the waitlist feature if you have a capacity limit. Players on the waitlist are automatically promoted when spots open up.",
          },
        ],
      },
      {
        id: "day-of",
        heading: "Step 3: Day-of Operations",
        content: [
          {
            type: "paragraph",
            text: "On the day of the event, use ChessOTB.club's QR code check-in to mark players as present. This takes 5–10 seconds per player and eliminates the chaos of paper sign-in sheets. Late arrivals and walk-ins can be added directly from your phone.",
          },
          {
            type: "paragraph",
            text: "When check-in closes, generate round 1 pairings with one tap. The app handles color assignments, board numbers, and bye assignments automatically.",
          },
        ],
      },
      {
        id: "running-rounds",
        heading: "Step 4: Running the Rounds",
        content: [
          {
            type: "paragraph",
            text: "As games finish, players report results via the tournament page on their phones — no need to queue at a director's table. You can also enter results manually from the director dashboard. Once all results are in, generate the next round's pairings instantly.",
          },
          {
            type: "list",
            items: [
              "Display the pairings on a screen or projector using the venue display mode",
              "Use the live standings view to show real-time leaderboard updates",
              "Handle disputes from the director dashboard — you can edit results and regenerate pairings if needed",
            ],
          },
        ],
      },
      {
        id: "wrap-up",
        heading: "Step 5: Wrap-Up and Prizes",
        content: [
          {
            type: "paragraph",
            text: "After the final round, the standings page shows the complete results with tiebreaks. Export the standings as a PDF for your records, or share the live link with players. Use the Recap Generator to create a shareable social media image with the top finishers.",
          },
          {
            type: "paragraph",
            text: "Congratulations — you've run your first OTB tournament. With ChessOTB.club, the administrative overhead is minimal, so you can focus on what matters: creating a great experience for your players.",
          },
        ],
      },
    ],
  },
  {
    slug: "qr-code-checkin",
    title: "QR Code Check-In: How We Eliminated Paper Sign-Up Sheets at Chess Events",
    excerpt:
      "Paper sign-up sheets are slow, error-prone, and hard to manage. Here's how ChessOTB.club's QR code check-in system cuts registration time by 80%.",
    category: "Product",
    date: "May 20, 2026",
    image: "https://images.unsplash.com/photo-1595079676339-1534801ad6cf?w=1200&q=80",
    readTime: "3 min read",
    author: "ChessOTB Team",
    authorRole: "Platform Builders",
    authorAvatar: "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=80&q=80",
    authorBio:
      "The ChessOTB.club team is a group of OTB chess enthusiasts and engineers on a mission to bring over-the-board chess into the digital age.",
    sections: [
      {
        id: "the-old-way",
        heading: "The Old Way: Paper Sign-Up Sheets",
        content: [
          {
            type: "paragraph",
            text: "Every chess organizer has a paper sign-up sheet story. Players write illegibly, names get misspelled, someone forgets to sign in, and you spend 20 minutes reconciling the sheet against your spreadsheet before you can generate pairings. It's a solved problem — we just hadn't solved it for chess yet.",
          },
        ],
      },
      {
        id: "how-it-works",
        heading: "How QR Check-In Works",
        content: [
          {
            type: "paragraph",
            text: "When you create an event on ChessOTB.club, we generate a unique QR code for that event. Display it on a screen, print it on a sign, or show it on your phone. Players scan it with their camera app and are instantly checked in — no app download required.",
          },
          {
            type: "list",
            items: [
              "Registered players are checked in with their existing profile and rating",
              "Walk-ins can enter their chess.com username to create a quick profile on the spot",
              "The director sees check-ins in real time on their dashboard",
              "Late arrivals are handled gracefully — they can check in between rounds",
            ],
          },
          {
            type: "callout",
            text: "In our testing, QR check-in reduces average registration time from 45 seconds per player (paper) to under 10 seconds.",
          },
        ],
      },
      {
        id: "admin-tools",
        heading: "Admin Tools for Directors",
        content: [
          {
            type: "paragraph",
            text: "The director dashboard gives you full control: see who's checked in, manually check in players, add walk-ins, and close registration when you're ready to generate pairings. You can also undo a check-in if a player needs to be removed.",
          },
          {
            type: "paragraph",
            text: "For clubs with recurring events, the QR code can be reused across multiple events — players who've attended before are recognized automatically.",
          },
        ],
      },
    ],
  },
];

export { POSTS as BLOG_POSTS };

// ─── Utility: render a content block ─────────────────────────────────────────
function ContentBlock({ block, isDark }: { block: ContentBlock; isDark: boolean }) {
  if (block.type === "paragraph") {
    return (
      <p className={`text-base leading-relaxed mb-4 ${isDark ? "text-white/80" : "text-[#12372A]/85"}`}>
        {block.text}
      </p>
    );
  }
  if (block.type === "list") {
    return (
      <ul className="mb-4 space-y-2 pl-1">
        {block.items.map((item, i) => (
          <li key={i} className={`flex gap-2.5 text-base leading-relaxed ${isDark ? "text-white/80" : "text-[#12372A]/85"}`}>
            <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#436850] shrink-0" />
            <span dangerouslySetInnerHTML={{ __html: item }} />
          </li>
        ))}
      </ul>
    );
  }
  if (block.type === "callout") {
    return (
      <blockquote
        className={`my-5 pl-4 border-l-4 border-[#436850] py-2 rounded-r-lg ${
          isDark ? "bg-white/5 text-white/80" : "bg-[#ADBC9F]/20 text-[#12372A]"
        }`}
      >
        <p className="text-base leading-relaxed italic">{block.text}</p>
      </blockquote>
    );
  }
  if (block.type === "subheading") {
    return (
      <h3 className={`text-lg font-bold mt-6 mb-2 ${isDark ? "text-white" : "text-[#12372A]"}`}>
        {block.text}
      </h3>
    );
  }
  return null;
}

// ─── TOC item ─────────────────────────────────────────────────────────────────
function TocItem({
  id,
  heading,
  active,
  isDark,
}: {
  id: string;
  heading: string;
  active: boolean;
  isDark: boolean;
}) {
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };
  return (
    <a
      href={`#${id}`}
      onClick={handleClick}
      className={`block text-sm py-1 leading-snug transition-colors duration-150 border-l-2 pl-3 ${
        active
          ? "border-[#436850] text-[#436850] font-semibold"
          : isDark
          ? "border-transparent text-white/50 hover:text-white/80 hover:border-white/30"
          : "border-transparent text-[#436850]/60 hover:text-[#12372A] hover:border-[#ADBC9F]"
      }`}
    >
      {heading}
    </a>
  );
}

// ─── Main BlogPost page ───────────────────────────────────────────────────────
export default function BlogPost() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const { user } = useAuthContext();

  // ── League smart routing ──────────────────────────────────────────────────
  interface MyLeague { id: string; name: string; status: string; }
  const [myLeagues, setMyLeagues] = useState<MyLeague[]>([]);
  const isGuest = !user || user.isGuest;
  useEffect(() => {
    if (isGuest) { setMyLeagues([]); return; }
    fetch("/api/leagues/mine", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : []))
      .then((data: MyLeague[]) => setMyLeagues(Array.isArray(data) ? data : []))
      .catch(() => setMyLeagues([]));
  }, [isGuest]);
  const leagueNavUrl = (() => {
    if (!myLeagues.length) return "/league-demo";
    const active = myLeagues.find((l) => l.status === "active");
    const target = active ?? myLeagues[0];
    return `/leagues/${target.id}`;
  })();

  // ── Dashboard smart routing ───────────────────────────────────────────────
  const getDashboardUrl = (): string => {
    const allTournaments = listTournaments();
    const getTournamentStatus = (id: string): string => {
      try {
        const raw = localStorage.getItem(`otb-director-state-v2-${id}`);
        if (raw) {
          const parsed = JSON.parse(raw) as { status?: string };
          return parsed.status ?? "unknown";
        }
      } catch { /* ignore */ }
      return "unknown";
    };
    const directedTournament = allTournaments.find((t) => {
      if (!hasDirectorSession(t.id)) return false;
      const status = getTournamentStatus(t.id);
      return status !== "completed";
    });
    if (directedTournament) return `/tournament/${directedTournament.id}/manage`;
    const registrations = getAllRegistrations();
    for (const reg of registrations) {
      const config = resolveTournament(reg.tournamentId);
      const tournamentId = config?.id ?? reg.tournamentId;
      const status = getTournamentStatus(tournamentId);
      if (status !== "completed") return `/tournament/${tournamentId}`;
    }
    return "/join";
  };

  // ── Nav items ─────────────────────────────────────────────────────────────
  const navItems = [
    { name: "Clubs",       url: "/clubs",         icon: Building2 },
    { name: "Tournaments", url: getDashboardUrl(), icon: LayoutDashboard, onClick: (e: React.MouseEvent) => { e.preventDefault(); window.location.href = getDashboardUrl(); } },
    { name: "League",      url: leagueNavUrl,    icon: Trophy,         onClick: (e: React.MouseEvent) => { e.preventDefault(); window.location.href = leagueNavUrl; } },
    { name: "Training",    url: "/training",     icon: GraduationCap },
  ];

  const logoEl = (
    <Link href="/" className="flex items-center">
      <img
        src="https://files.manuscdn.com/user_upload_by_module/session_file/117675823/bWANpVvGVfpfXSpZ.png"
        alt="OTB Chess"
        className={`h-8 w-auto object-contain transition-opacity hover:opacity-80 ${isDark ? "nav-logo-dark" : ""}`}
      />
    </Link>
  );

  const rightSlotEl = (
    <div className="flex items-center gap-2">
      <ThemeToggle />
      <AvatarNavDropdown
        currentPage="Blog"
        dashboardUrl={getDashboardUrl()}
        leagueUrl={leagueNavUrl}
      />
    </div>
  );

  const post = POSTS.find((p) => p.slug === slug);

  // Active TOC section tracking
  const [activeSection, setActiveSection] = useState<string>("");
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  useEffect(() => {
    if (!post) return;
    // Scroll to top on mount
    window.scrollTo({ top: 0 });

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        });
      },
      { rootMargin: "-20% 0px -70% 0px", threshold: 0 }
    );

    post.sections.forEach((section) => {
      const el = document.getElementById(section.id);
      if (el) {
        sectionRefs.current[section.id] = el;
        observer.observe(el);
      }
    });

    return () => observer.disconnect();
  }, [post]);

  // ── 404 state ──
  if (!post) {
    return (
    <div
      className={`min-h-screen flex flex-col items-center justify-center gap-6 ${
        isDark ? "bg-background text-white" : "bg-[#FBFADA] text-[#12372A]"
      }`}
    >
      <AnimeNavBar
        items={navItems}
        defaultActive="Blog"
        logo={logoEl}
        rightSlot={rightSlotEl}
        isDark={isDark}
      />
      <p className="text-6xl font-black opacity-20">404</p>
        <p className="text-xl font-semibold">Post not found</p>
        <Link
          href="/blog"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#12372A] text-white text-sm font-semibold hover:bg-[#436850] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Blog
        </Link>
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen transition-colors duration-300 ${
        isDark ? "bg-background text-white" : "bg-[#FBFADA] text-[#12372A]"
      }`}
    >
      {isDark && <div className="fixed inset-0 chess-board-bg opacity-[0.03] pointer-events-none" />}

      {/* ── Platform nav bar ── */}
      <AnimeNavBar
        items={navItems}
        defaultActive="Blog"
        logo={logoEl}
        rightSlot={rightSlotEl}
        isDark={isDark}
      />

      <div className="max-w-6xl mx-auto px-4 py-10 sm:py-16">

        {/* ── Breadcrumb ── */}
        <nav className="flex items-center gap-2 mb-6 flex-wrap">
          <Link
            href="/blog"
            className={`inline-flex items-center gap-1.5 text-sm font-medium transition-colors ${
              isDark ? "text-white/60 hover:text-white" : "text-[#436850]/70 hover:text-[#12372A]"
            }`}
          >
            <ArrowLeft className="w-4 h-4" />
            Blog
          </Link>
          <ChevronRight className={`w-3.5 h-3.5 ${isDark ? "text-white/30" : "text-[#ADBC9F]"}`} />
          <span
            className={`text-sm px-2.5 py-0.5 rounded-full font-medium border ${
              isDark
                ? "bg-white/10 text-white/70 border-white/10"
                : "bg-[#ADBC9F]/30 text-[#436850] border-[#ADBC9F]/60"
            }`}
          >
            {post.category}
          </span>
          <ChevronRight className={`w-3.5 h-3.5 ${isDark ? "text-white/30" : "text-[#ADBC9F]"}`} />
          <span className={`text-sm flex items-center gap-1.5 ${isDark ? "text-white/40" : "text-[#436850]/60"}`}>
            <Calendar className="w-3.5 h-3.5" />
            {post.date}
          </span>
          <span className={`text-sm flex items-center gap-1.5 ${isDark ? "text-white/40" : "text-[#436850]/60"}`}>
            <Clock className="w-3.5 h-3.5" />
            {post.readTime}
          </span>
        </nav>

        {/* ── Title + excerpt ── */}
        <div className="mb-8 max-w-3xl">
          <h1
            className={`text-3xl sm:text-4xl lg:text-5xl font-black leading-tight tracking-tight mb-4 ${
              isDark ? "text-white" : "text-[#12372A]"
            }`}
          >
            {post.title}
          </h1>
          <p className={`text-lg leading-relaxed ${isDark ? "text-white/60" : "text-[#436850]/80"}`}>
            {post.excerpt}
          </p>
        </div>

        {/* ── Two-column layout ── */}
        <div className="flex flex-col lg:grid lg:grid-cols-[1fr_300px] gap-10 lg:gap-12 items-start">

          {/* ── Main article column ── */}
          <article>
            {/* Hero image */}
            <div className="rounded-2xl overflow-hidden mb-8 aspect-[16/9] w-full">
              <img
                src={post.image}
                alt={post.title}
                className="w-full h-full object-cover"
              />
            </div>

            {/* Article body */}
            <div className="prose-content">
              {post.sections.map((section) => (
                <section key={section.id} id={section.id} className="mb-10 scroll-mt-24">
                  <h2
                    className={`text-xl sm:text-2xl font-bold mb-4 ${
                      isDark ? "text-white" : "text-[#12372A]"
                    }`}
                  >
                    {section.heading}
                  </h2>
                  {section.content.map((block, i) => (
                    <ContentBlock key={i} block={block} isDark={isDark} />
                  ))}
                </section>
              ))}
            </div>

            {/* ── Back to blog CTA ── */}
            <div
              className={`mt-12 pt-8 border-t flex items-center justify-between flex-wrap gap-4 ${
                isDark ? "border-white/10" : "border-[#ADBC9F]/50"
              }`}
            >
              <Link
                href="/blog"
                className={`inline-flex items-center gap-2 text-sm font-medium transition-colors ${
                  isDark ? "text-white/60 hover:text-white" : "text-[#436850]/70 hover:text-[#12372A]"
                }`}
              >
                <ArrowLeft className="w-4 h-4" />
                Back to all posts
              </Link>
              <span className={`text-xs ${isDark ? "text-white/30" : "text-[#ADBC9F]"}`}>
                © {new Date().getFullYear()} ChessOTB.club
              </span>
            </div>
          </article>

          {/* ── Sticky sidebar ── */}
          <aside className="lg:sticky lg:top-24 flex flex-col gap-5 w-full">

            {/* Author card */}
            <div
              className={`rounded-2xl p-5 border ${
                isDark ? "bg-white/5 border-white/10" : "bg-white border-[#ADBC9F]/60"
              }`}
            >
              <div className="flex items-center gap-3 mb-3">
                <img
                  src={post.authorAvatar}
                  alt={post.author}
                  className="w-10 h-10 rounded-full object-cover"
                />
                <div>
                  <p className={`text-sm font-bold ${isDark ? "text-white" : "text-[#12372A]"}`}>
                    {post.author}
                  </p>
                  <p className={`text-xs ${isDark ? "text-white/50" : "text-[#436850]/70"}`}>
                    {post.authorRole}
                  </p>
                </div>
              </div>
              <p className={`text-xs leading-relaxed ${isDark ? "text-white/60" : "text-[#436850]/80"}`}>
                {post.authorBio}
              </p>
            </div>

            {/* On This Page TOC */}
            {post.sections.length > 1 && (
              <div
                className={`rounded-2xl p-5 border ${
                  isDark ? "bg-white/5 border-white/10" : "bg-white border-[#ADBC9F]/60"
                }`}
              >
                <p className={`text-xs font-bold uppercase tracking-widest mb-3 ${isDark ? "text-white/40" : "text-[#436850]/60"}`}>
                  On this page
                </p>
                <nav className="flex flex-col gap-0.5">
                  {post.sections.map((section) => (
                    <TocItem
                      key={section.id}
                      id={section.id}
                      heading={section.heading}
                      active={activeSection === section.id}
                      isDark={isDark}
                    />
                  ))}
                </nav>
              </div>
            )}

            {/* CTA card */}
            <div
              className={`rounded-2xl overflow-hidden border ${
                isDark ? "bg-white/5 border-white/10" : "bg-white border-[#ADBC9F]/60"
              }`}
            >
              {/* CTA banner image */}
              <div className="h-28 bg-gradient-to-br from-[#12372A] to-[#436850] flex items-center justify-center">
                <div className="text-center px-4">
                  <p className="text-white font-black text-lg tracking-tight">OTB!!</p>
                  <p className="text-white/70 text-xs mt-0.5">Chess Tournaments, Over The Board.</p>
                </div>
              </div>
              <div className="p-5">
                <p className={`text-sm font-bold mb-1 ${isDark ? "text-white" : "text-[#12372A]"}`}>
                  Try ChessOTB.club free
                </p>
                <p className={`text-xs leading-relaxed mb-4 ${isDark ? "text-white/60" : "text-[#436850]/80"}`}>
                  Run your next tournament or club night in minutes — no spreadsheets, no paperwork.
                </p>
                <a
                  href="/"
                  className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl bg-[#12372A] text-white text-sm font-semibold hover:bg-[#436850] transition-colors"
                >
                  Get started free <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>

          </aside>
        </div>
      </div>
    </div>
  );
}
