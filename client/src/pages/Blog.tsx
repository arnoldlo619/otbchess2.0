import { useState, useMemo, useEffect } from "react";
import { Link } from "wouter";
import { useTheme } from "@/contexts/ThemeContext";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AnimeNavBar } from "@/components/ui/anime-navbar";
import { AvatarNavDropdown } from "@/components/AvatarNavDropdown";
import { useAuthContext } from "@/context/AuthContext";
import { getAllRegistrations } from "@/lib/registrationStore";
import { resolveTournament, listTournaments, hasDirectorSession } from "@/lib/tournamentRegistry";
import { Calendar, ArrowRight, Tag, Building2, LayoutDashboard, Trophy, GraduationCap } from "lucide-react";

// ─── Blog post data ───────────────────────────────────────────────────────────
export interface BlogPost {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  date: string;
  image: string;
  readTime: string;
  author: string;
}

const POSTS: BlogPost[] = [
  {
    slug: "chicago-chess-club-highlight",
    title: "Building Community Through the Board: A Q&A with The Kid from Pilsen",
    excerpt: "William Guerrero — DJ, artist, and chess streamer — built the Chicago Chess Club on radical inclusivity. We sat down with him after he hosted a 70-player OTB tournament powered by ChessOTB.club.",
    category: "Community",
    date: "June 25, 2026",
    image: "https://images.unsplash.com/photo-1529699211952-734e80c4d42b?w=800&q=80",
    readTime: "6 min read",
    author: "ChessOTB Team",
  },
  {
    slug: "introducing-chessotb-club",
    title: "Introducing ChessOTB.club: The Home for Over-the-Board Chess Communities",
    excerpt: "We built ChessOTB.club to solve the biggest pain point in OTB chess: running tournaments and clubs without the paperwork. Here's the story behind the platform.",
    category: "Company",
    date: "June 20, 2026",
    image: "https://images.unsplash.com/photo-1529699211952-734e80c4d42b?w=800&q=80",
    readTime: "4 min read",
    author: "ChessOTB Team",
  },
  {
    slug: "how-swiss-pairings-work",
    title: "How Swiss Pairings Work — And Why They're Perfect for Club Tournaments",
    excerpt: "Swiss-system tournaments let every player compete in every round regardless of wins or losses. We break down the algorithm and why it's the gold standard for OTB events.",
    category: "Chess",
    date: "June 15, 2026",
    image: "https://images.unsplash.com/photo-1580541832626-2a7131ee809f?w=800&q=80",
    readTime: "6 min read",
    author: "ChessOTB Team",
  },
  {
    slug: "club-growth-tips",
    title: "5 Proven Ways to Grow Your Chess Club Attendance",
    excerpt: "From recurring meetups to social media teasers, here are the strategies that top OTB clubs are using to double their attendance in 90 days.",
    category: "Clubs",
    date: "June 10, 2026",
    image: "https://images.unsplash.com/photo-1560472355-536de3962603?w=800&q=80",
    readTime: "5 min read",
    author: "ChessOTB Team",
  },
  {
    slug: "elo-ratings-explained",
    title: "ELO Ratings Explained: What Your Chess.com Rating Actually Means OTB",
    excerpt: "Online ratings and OTB ratings often diverge. We explain the Elo system, how ChessOTB.club uses chess.com ratings for fair pairings, and what to expect at your first tournament.",
    category: "Chess",
    date: "June 5, 2026",
    image: "https://images.unsplash.com/photo-1611195974226-a6a9be9dd763?w=800&q=80",
    readTime: "7 min read",
    author: "ChessOTB Team",
  },
  {
    slug: "tournament-hosting-guide",
    title: "The Complete Guide to Hosting Your First OTB Chess Tournament",
    excerpt: "From venue setup to final standings, this step-by-step guide walks you through everything you need to run a smooth, professional chess tournament using ChessOTB.club.",
    category: "Tournaments",
    date: "May 28, 2026",
    image: "https://images.unsplash.com/photo-1586165368502-1bad197a6461?w=800&q=80",
    readTime: "10 min read",
    author: "ChessOTB Team",
  },
  {
    slug: "qr-code-checkin",
    title: "QR Code Check-In: How We Eliminated Paper Sign-Up Sheets at Chess Events",
    excerpt: "Paper sign-up sheets are slow, error-prone, and hard to manage. Here's how ChessOTB.club's QR code check-in system cuts registration time by 80%.",
    category: "Product",
    date: "May 20, 2026",
    image: "https://images.unsplash.com/photo-1595079676339-1534801ad6cf?w=800&q=80",
    readTime: "3 min read",
    author: "ChessOTB Team",
  },
];

const ALL_CATEGORIES = ["All", ...Array.from(new Set(POSTS.map((p) => p.category))).sort()];

// ─── Category pill ────────────────────────────────────────────────────────────
function CategoryPill({
  label,
  count,
  active,
  isDark,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  isDark: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200 border ${
        active
          ? "bg-[#12372A] text-white border-[#12372A] shadow-sm"
          : isDark
          ? "bg-white/5 text-white/70 border-white/10 hover:bg-white/10 hover:text-white"
          : "bg-white text-[#436850] border-[#ADBC9F] hover:bg-[#ADBC9F]/20 hover:border-[#436850]"
      }`}
    >
      {label}
      <span
        className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
          active
            ? "bg-white/20 text-white"
            : isDark
            ? "bg-white/10 text-white/50"
            : "bg-[#ADBC9F]/40 text-[#436850]"
        }`}
      >
        {count}
      </span>
    </button>
  );
}

// ─── Blog card ────────────────────────────────────────────────────────────────
function BlogCard({ post, isDark }: { post: BlogPost; isDark: boolean }) {
  return (
    <Link href={`/blog/${post.slug}`}>
      <article
        className={`group flex flex-col rounded-2xl overflow-hidden border transition-all duration-300 cursor-pointer hover:-translate-y-1 hover:shadow-xl ${
          isDark
            ? "bg-white/5 border-white/10 hover:border-white/20 hover:shadow-black/30"
            : "bg-white border-[#ADBC9F]/60 hover:border-[#436850]/40 hover:shadow-[#ADBC9F]/30"
        }`}
      >
        {/* Image */}
        <div className="relative overflow-hidden aspect-[16/9]">
          <img
            src={post.image}
            alt={post.title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
          {/* Category badge overlay */}
          <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#12372A]/90 text-white backdrop-blur-sm">
            {post.category}
          </span>
        </div>

        {/* Content */}
        <div className="flex flex-col flex-1 p-5 gap-3">
          <h2
            className={`text-base font-bold leading-snug line-clamp-2 group-hover:text-[#436850] transition-colors ${
              isDark ? "text-white" : "text-[#12372A]"
            }`}
          >
            {post.title}
          </h2>
          <p
            className={`text-sm leading-relaxed line-clamp-3 flex-1 ${
              isDark ? "text-white/60" : "text-[#436850]/80"
            }`}
          >
            {post.excerpt}
          </p>

          {/* Footer row */}
          <div
            className={`flex items-center justify-between pt-3 border-t text-xs ${
              isDark ? "border-white/10 text-white/40" : "border-[#ADBC9F]/50 text-[#6B6B50]"
            }`}
          >
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              <span>{post.date}</span>
              <span className="mx-1">·</span>
              <span>{post.readTime}</span>
            </div>
            <ArrowRight
              className={`w-4 h-4 transition-transform duration-200 group-hover:translate-x-1 ${
                isDark ? "text-white/40" : "text-[#436850]/60"
              }`}
            />
          </div>
        </div>
      </article>
    </Link>
  );
}

// ─── Blog page ────────────────────────────────────────────────────────────────
export default function Blog() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [activeCategory, setActiveCategory] = useState("All");
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
    { name: "Tools",    url: "/training",     icon: GraduationCap },
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

  const filtered = useMemo(
    () =>
      activeCategory === "All"
        ? POSTS
        : POSTS.filter((p) => p.category === activeCategory),
    [activeCategory]
  );

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { All: POSTS.length };
    POSTS.forEach((p) => {
      counts[p.category] = (counts[p.category] ?? 0) + 1;
    });
    return counts;
  }, []);

  return (
    <div
      className={`min-h-screen transition-colors duration-300 ${
        isDark ? "bg-background text-white" : "bg-[#FBFADA] text-[#12372A]"
      }`}
    >
      {/* Chess board background pattern (dark mode) */}
      {isDark && <div className="fixed inset-0 chess-board-bg opacity-[0.03] pointer-events-none" />}

      {/* ── Platform nav bar ── */}
      <AnimeNavBar
        items={navItems}
        defaultActive="Blog"
        logo={logoEl}
        rightSlot={rightSlotEl}
        isDark={isDark}
      />

      <div className="container max-w-6xl mx-auto px-4 pt-28 pb-16 sm:pt-32 sm:pb-24">
        {/* ── Header ── */}
        <div className="mb-10">
          <div className="flex items-center gap-2 mb-3">
            <Tag className="w-4 h-4 text-[#436850]" />
            <span className={`text-sm font-semibold uppercase tracking-widest ${isDark ? "text-white/50" : "text-[#436850]"}`}>
              ChessOTB.club
            </span>
          </div>
          <h1
            className={`text-4xl sm:text-5xl font-black tracking-tight mb-3 ${
              isDark ? "text-white" : "text-[#12372A]"
            }`}
          >
            Blog
          </h1>
          <p className={`text-lg ${isDark ? "text-white/60" : "text-[#436850]/80"}`}>
            Company updates, chess strategy, and community stories.
          </p>
        </div>

        {/* ── Category filter pills ── */}
        <div className="flex flex-wrap gap-2 mb-10">
          {ALL_CATEGORIES.map((cat) => (
            <CategoryPill
              key={cat}
              label={cat}
              count={categoryCounts[cat] ?? 0}
              active={activeCategory === cat}
              isDark={isDark}
              onClick={() => setActiveCategory(cat)}
            />
          ))}
        </div>

        {/* ── Post grid ── */}
        {filtered.length === 0 ? (
          <div className="text-center py-24">
            <p className={isDark ? "text-white/40" : "text-[#436850]/50"}>
              No posts in this category yet.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((post) => (
              <BlogCard key={post.slug} post={post} isDark={isDark} />
            ))}
          </div>
        )}

        {/* ── Contribute CTA ── */}
        <div
          className={`mt-16 rounded-2xl p-8 text-center border ${
            isDark
              ? "bg-white/5 border-white/10"
              : "bg-[#ADBC9F]/20 border-[#ADBC9F]/50"
          }`}
        >
          <h3 className={`text-lg font-bold mb-2 ${isDark ? "text-white" : "text-[#12372A]"}`}>
            Want to contribute?
          </h3>
          <p className={`text-sm mb-4 ${isDark ? "text-white/60" : "text-[#436850]/80"}`}>
            Have a chess story, club spotlight, or tournament recap to share? Reach out to us.
          </p>
          <a
            href="mailto:info@chessotb.club"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#12372A] text-white text-sm font-semibold hover:bg-[#436850] transition-colors"
          >
            Get in touch <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      </div>
    </div>
  );
}
