import { useState, useMemo, useEffect, useCallback } from "react";
import { Link } from "wouter";
import { useTheme } from "@/contexts/ThemeContext";
import { usePageMeta } from "@/hooks/usePageMeta";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AnimeNavBar } from "@/components/ui/anime-navbar";
import { AvatarNavDropdown } from "@/components/AvatarNavDropdown";
import { useAuthContext } from "@/context/AuthContext";
import { getAllRegistrations } from "@/lib/registrationStore";
import { resolveTournament, listTournaments, hasDirectorSession } from "@/lib/tournamentRegistry";
import { ArrowUpRight, Building2, LayoutDashboard, Trophy, GraduationCap } from "lucide-react";

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
    title: "Building Community Through the Board",
    excerpt: "William Guerrero turned a few park meetups into a 70-player tournament — by making chess less intimidating, not more.",
    category: "Community",
    date: "June 25, 2026",
    image: "/manus-storage/5FE28E81-FABF-4AA3-8EC4-6C0D5A8788A5_0ff2749c.JPG",
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
const POSTS_PER_PAGE = 6;

// ─── Category pill ────────────────────────────────────────────────────────────
function CategoryTag({ label, isDark }: { label: string; isDark: boolean }) {
  return (
    <span
      className={`inline-block px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider rounded-full border ${
        isDark
          ? "border-white/20 text-white/60 bg-white/5"
          : "border-[#12372A]/20 text-[#12372A]/70 bg-[#12372A]/5"
      }`}
    >
      {label}
    </span>
  );
}

// ─── Featured hero post ───────────────────────────────────────────────────────
function FeaturedPost({ post, isDark }: { post: BlogPost; isDark: boolean }) {
  return (
    <Link href={`/blog/${post.slug}`}>
      <article className="group relative overflow-hidden rounded-xl cursor-pointer" style={{ aspectRatio: "16/7" }}>
        {/* Full-bleed image */}
        <img
          src={post.image}
          alt={post.title}
          className={`absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.03] ${
            isDark ? "" : "grayscale"
          }`}
        />
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

        {/* Checkerboard accent (top-right corner) — mirrors reference */}
        <div className="absolute top-0 right-0 w-12 h-12 grid grid-cols-2 grid-rows-2 opacity-80">
          <div className="bg-[#12372A]" />
          <div className="bg-transparent" />
          <div className="bg-transparent" />
          <div className="bg-[#12372A]" />
        </div>

        {/* Content overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-8">
          <CategoryTag label={post.category} isDark={true} />
          <h2
            className="mt-3 text-2xl sm:text-3xl lg:text-4xl font-bold text-white leading-tight max-w-3xl"
            style={{ fontFamily: "'Clash Display', Georgia, serif" }}
          >
            {post.title}
          </h2>
          <p className="mt-2 text-white/70 text-sm sm:text-base max-w-2xl line-clamp-2 leading-relaxed">
            {post.excerpt}
          </p>
          <div className="mt-4 flex items-center gap-4 text-white/60 text-xs">
            <span>Written by <strong className="text-white/90">{post.author}</strong></span>
            <span>·</span>
            <span>Published on <strong className="text-white/90">{post.date}</strong></span>
            <span>·</span>
            <span>{post.readTime}</span>
          </div>
        </div>
      </article>
    </Link>
  );
}

// ─── Grid card ────────────────────────────────────────────────────────────────
function BlogCard({ post, isDark }: { post: BlogPost; isDark: boolean }) {
  return (
    <Link href={`/blog/${post.slug}`}>
      <article
        className={`group flex flex-col cursor-pointer border-b transition-colors duration-200 pb-6 ${
          isDark ? "border-white/10" : "border-[#12372A]/12"
        }`}
      >
        {/* Image */}
        <div className="relative overflow-hidden rounded-lg aspect-[4/3] mb-4">
          <img
            src={post.image}
            alt={post.title}
            className={`w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 ${
              isDark ? "" : "grayscale group-hover:grayscale-0"
            }`}
            loading="lazy"
          />
        </div>

        {/* Title row */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <h2
            className={`text-[15px] font-bold leading-snug line-clamp-2 flex-1 transition-colors duration-200 ${
              isDark
                ? "text-white group-hover:text-[#ADBC9F]"
                : "text-[#12372A] group-hover:text-[#436850]"
            }`}
          >
            {post.title}
          </h2>
          <ArrowUpRight
            className={`w-4 h-4 shrink-0 mt-0.5 transition-all duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 ${
              isDark ? "text-white/30 group-hover:text-white/70" : "text-[#12372A]/30 group-hover:text-[#12372A]/70"
            }`}
          />
        </div>

        {/* Excerpt */}
        <p
          className={`text-sm leading-relaxed line-clamp-2 mb-3 flex-1 ${
            isDark ? "text-white/55" : "text-[#12372A]/60"
          }`}
        >
          {post.excerpt}
        </p>

        {/* Tags row */}
        <div className="flex flex-wrap items-center gap-1.5">
          <CategoryTag label={post.category} isDark={isDark} />
          <span className={`text-[11px] ${isDark ? "text-white/30" : "text-[#12372A]/40"}`}>
            · {post.readTime}
          </span>
        </div>
      </article>
    </Link>
  );
}

// ─── Blog page ────────────────────────────────────────────────────────────────
export default function Blog() {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  // ── URL-state for category filter ────────────────────────────────────────
  const getCategoryFromUrl = (): string => {
    if (typeof window === "undefined") return "All";
    const params = new URLSearchParams(window.location.search);
    const cat = params.get("category") ?? "All";
    return ALL_CATEGORIES.includes(cat) ? cat : "All";
  };
  const [activeCategory, setActiveCategory] = useState<string>(getCategoryFromUrl);
  const [page, setPage] = useState(1);

  usePageMeta({
    title: "Chess Journal — ChessOTB.club",
    description: "Club spotlights, tournament strategy, platform updates, and community stories from the OTB chess world.",
    path: "/blog",
  });

  const handleCategoryChange = useCallback((cat: string) => {
    setActiveCategory(cat);
    setPage(1);
    const url = new URL(window.location.href);
    if (cat === "All") {
      url.searchParams.delete("category");
    } else {
      url.searchParams.set("category", cat);
    }
    window.history.replaceState({}, "", url.toString());
  }, []);
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
    { name: "Tournaments", url: "/tournaments", icon: LayoutDashboard },
    { name: "League",      url: leagueNavUrl,    icon: Trophy,         onClick: (e: React.MouseEvent) => { e.preventDefault(); window.location.href = leagueNavUrl; } },
    { name: "Tools",       url: "/training",     icon: GraduationCap },
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

  // ── Filtering + pagination ────────────────────────────────────────────────
  const filtered = useMemo(() => {
    setPage(1);
    return activeCategory === "All"
      ? POSTS
      : POSTS.filter((p) => p.category === activeCategory);
  }, [activeCategory]);

  // Featured = first post of the filtered set (always Chicago highlight when "All")
  const featuredPost = filtered[0];
  const gridPosts = filtered.slice(1);
  const totalPages = Math.ceil(gridPosts.length / POSTS_PER_PAGE);
  const pagedPosts = gridPosts.slice((page - 1) * POSTS_PER_PAGE, page * POSTS_PER_PAGE);

  // Light mode: off-white parchment bg + grid paper texture
  const lightBg = "bg-[#F5F0E8]";
  const lightText = "text-[#12372A]";

  return (
    <div
      className={`min-h-screen transition-colors duration-300 ${
        isDark ? "bg-background text-white" : `${lightBg} ${lightText}`
      }`}
    >
      {/* Grid-paper texture overlay (light mode) */}
      {!isDark && (
        <div
          className="fixed inset-0 pointer-events-none opacity-[0.35]"
          style={{
            backgroundImage:
              "linear-gradient(#12372A18 1px, transparent 1px), linear-gradient(90deg, #12372A18 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
      )}
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

      <div className="relative z-10 container max-w-6xl mx-auto px-4 pt-28 pb-20 sm:pt-32 sm:pb-28">

        {/* ── Journal header ── */}
        <div
          className={`mb-8 pb-6 border-b ${
            isDark ? "border-white/10" : "border-[#12372A]/15"
          }`}
        >
          <span
            className={`inline-block text-[11px] font-semibold uppercase tracking-[0.2em] px-3 py-1 rounded-full border mb-4 ${
              isDark
                ? "border-white/20 text-white/50 bg-white/5"
                : "border-[#12372A]/25 text-[#12372A]/60 bg-[#12372A]/5"
            }`}
          >
            Chess Journal
          </span>
          <h1
            className={`text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight mb-3 ${
              isDark ? "text-white" : "text-[#12372A]"
            }`}
            style={{ fontFamily: "'Clash Display', Georgia, serif" }}
          >
            The ChessOTB.club<br />
            <span className={isDark ? "text-[oklch(0.65_0.14_145)]" : "text-[#436850]"}>
              Journal &amp; Community
            </span>
          </h1>
          <p className={`text-base sm:text-lg max-w-xl leading-relaxed ${isDark ? "text-white/55" : "text-[#12372A]/60"}`}>
            Club spotlights, tournament strategy, platform updates, and community stories from the OTB chess world.
          </p>
        </div>

        {/* ── Featured hero post ── */}
        {featuredPost && (
          <div className="mb-10">
            <FeaturedPost post={featuredPost} isDark={isDark} />
          </div>
        )}

        {/* ── Category filter tabs ── */}
        <div
          className={`flex flex-wrap gap-1.5 mb-8 pb-6 border-b ${
            isDark ? "border-white/10" : "border-[#12372A]/12"
          }`}
        >
          {ALL_CATEGORIES.map((cat) => {
            const count = cat === "All" ? POSTS.length : POSTS.filter((p) => p.category === cat).length;
            const active = activeCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => handleCategoryChange(cat)}
                role="tab"
                aria-selected={active}
                aria-label={`Filter by ${cat} (${count} post${count !== 1 ? "s" : ""})`}
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[13px] font-medium transition-all duration-200 border ${
                  active
                    ? isDark
                      ? "bg-white text-[#12372A] border-white"
                      : "bg-[#12372A] text-white border-[#12372A]"
                    : isDark
                    ? "bg-transparent text-white/55 border-white/15 hover:border-white/30 hover:text-white/80"
                    : "bg-transparent text-[#12372A]/60 border-[#12372A]/18 hover:border-[#12372A]/40 hover:text-[#12372A]"
                }`}
              >
                {cat}
                <span
                  className={`text-[11px] px-1.5 py-0.5 rounded-full font-semibold ${
                    active
                      ? isDark ? "bg-[#12372A]/20 text-[#12372A]" : "bg-white/20 text-white"
                      : isDark ? "bg-white/10 text-white/40" : "bg-[#12372A]/10 text-[#12372A]/50"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* ── Post grid ── */}
        {pagedPosts.length === 0 && !featuredPost ? (
          <div className="text-center py-24">
            <p className={isDark ? "text-white/40" : "text-[#12372A]/40"}>No posts in this category yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-10">
            {pagedPosts.map((post) => (
              <BlogCard key={post.slug} post={post} isDark={isDark} />
            ))}
          </div>
        )}

        {/* ── Pagination ── */}
        {totalPages > 1 && (
          <div
            className={`flex items-center justify-between mt-12 pt-6 border-t text-sm font-medium ${
              isDark ? "border-white/10 text-white/50" : "border-[#12372A]/12 text-[#12372A]/60"
            }`}
          >
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className={`flex items-center gap-1.5 transition-colors disabled:opacity-30 ${
                isDark ? "hover:text-white" : "hover:text-[#12372A]"
              }`}
            >
              ← Previous
            </button>
            <span>Page {page} of {totalPages}</span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className={`flex items-center gap-1.5 transition-colors disabled:opacity-30 ${
                isDark ? "hover:text-white" : "hover:text-[#12372A]"
              }`}
            >
              Next →
            </button>
          </div>
        )}

        {/* ── CTA banner ── */}
        <div
          className={`mt-16 rounded-xl p-8 sm:p-10 flex flex-col sm:flex-row items-center justify-between gap-6 relative overflow-hidden ${
            isDark ? "bg-white/5 border border-white/10" : "bg-[#12372A] text-white"
          }`}
        >
          {/* Checkerboard accent */}
          <div className="absolute top-0 right-0 w-16 h-16 grid grid-cols-2 grid-rows-2 opacity-30">
            <div className="bg-white" />
            <div className="bg-transparent" />
            <div className="bg-transparent" />
            <div className="bg-white" />
          </div>
          <div>
            <p
              className={`text-2xl sm:text-3xl font-bold leading-tight mb-1 ${isDark ? "text-white" : "text-white"}`}
              style={{ fontFamily: "'Clash Display', Georgia, serif" }}
            >
              Host your own tournament
            </p>
            <p className={`text-sm ${isDark ? "text-white/55" : "text-white/70"}`}>
              Free for chess clubs. Swiss pairings, QR check-in, live standings.
            </p>
          </div>
          <a
            href="/?action=create"
            className="shrink-0 inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-white/40 text-white text-sm font-semibold hover:bg-white hover:text-[#12372A] transition-all duration-200 whitespace-nowrap"
          >
            Start your free trial
            <ArrowUpRight className="w-4 h-4" />
          </a>
        </div>
      </div>
    </div>
  );
}
