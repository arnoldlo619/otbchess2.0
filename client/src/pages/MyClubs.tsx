/**
 * MyClubs — /clubs
 *
 * The Club area is a private workspace index. It intentionally lists only the
 * authenticated user's own memberships; product exploration happens in the
 * isolated `/clubs/demo` experience rather than through real club data.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { NavLogo } from "@/components/NavLogo";
import { AvatarNavDropdown } from "@/components/AvatarNavDropdown";
import { CreateClubAuthGate } from "@/components/CreateClubAuthGate";
import { CreateClubWizard, CREATE_CLUB_WIZARD_ACTIVE_KEY } from "@/components/CreateClubWizard";
import { useAuthContext } from "@/context/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { listMyClubs, type Club } from "@/lib/clubRegistry";
import { apiListMyClubs, migrateLocalClubsToServer } from "@/lib/clubsApi";
import { listClubEvents, type ClubEvent } from "@/lib/clubEventRegistry";
import {
  ArrowRight,
  CalendarDays,
  ChevronRight,
  Crown,
  Eye,
  FolderLock,
  Plus,
  Users,
} from "lucide-react";

interface EnrichedEvent extends ClubEvent {
  clubName: string;
  clubAccent: string;
}

function ClubCard({ club, isDark, isOwned }: { club: Club; isDark: boolean; isOwned: boolean }) {
  const initial = club.name.charAt(0).toUpperCase();
  const textMain = isDark ? "text-white" : "text-[#15291c]";
  const textMuted = isDark ? "text-white/58" : "text-[#496052]";

  return (
    <Link href={`/clubs/${club.id}/home`} className="group block min-w-0 focus:outline-none">
      <article
        className={`overflow-hidden rounded-2xl border transition-[transform,border-color,box-shadow] duration-200 ease-out group-hover:-translate-y-0.5 group-hover:shadow-xl group-active:scale-[0.99] group-focus-visible:ring-2 group-focus-visible:ring-[#4CAF50] group-focus-visible:ring-offset-2 ${
          isDark ? "border-white/10 bg-white/[0.055] group-hover:border-[#78c86c]/40" : "border-[#dbe6d9] bg-white group-hover:border-[#78a873]/65"
        }`}
      >
        <div
          className="relative aspect-[16/8] overflow-hidden"
          style={{
            background: club.bannerUrl
              ? undefined
              : `linear-gradient(135deg, ${club.accentColor} 0%, ${club.accentColor}99 47%, #102518 100%)`,
          }}
        >
          {club.bannerUrl ? (
            <img src={club.bannerUrl} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" />
          ) : (
            <>
              <div className="absolute inset-0 chess-board-bg opacity-[0.13]" />
              <span className="absolute bottom-3 right-4 text-7xl font-black leading-none text-white/20">{initial}</span>
            </>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
          {isOwned && (
            <div className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-bold text-[#17321d] shadow-sm">
              <Crown className="h-3.5 w-3.5 text-amber-600" aria-hidden="true" />
              Owner
            </div>
          )}
        </div>
        <div className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className={`truncate text-base font-bold ${textMain}`} style={{ fontFamily: "'Clash Display', sans-serif" }}>{club.name}</h2>
              <p className={`mt-1 line-clamp-1 text-sm ${textMuted}`}>{club.location || club.tagline || "Private club workspace"}</p>
            </div>
            <ChevronRight className={`mt-0.5 h-5 w-5 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5 ${isDark ? "text-white/45" : "text-[#5d7560]"}`} aria-hidden="true" />
          </div>
          <div className={`mt-4 flex items-center gap-4 border-t pt-3 text-xs font-medium ${isDark ? "border-white/8 text-white/55" : "border-[#e1eadf] text-[#5d7560]"}`}>
            <span className="inline-flex items-center gap-1.5"><Users className="h-3.5 w-3.5" aria-hidden="true" />{club.memberCount} member{club.memberCount === 1 ? "" : "s"}</span>
            <span className="inline-flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />{club.tournamentCount} event{club.tournamentCount === 1 ? "" : "s"}</span>
          </div>
        </div>
      </article>
    </Link>
  );
}

function PrivateClubEmptyState({ isDark, signedIn, onCreate }: { isDark: boolean; signedIn: boolean; onCreate: () => void }) {
  const surface = isDark ? "border-white/10 bg-white/[0.045]" : "border-[#dbe6d9] bg-white";
  const textMain = isDark ? "text-white" : "text-[#15291c]";
  const textMuted = isDark ? "text-white/60" : "text-[#516555]";

  return (
    <section className={`relative overflow-hidden rounded-3xl border p-6 sm:p-9 ${surface}`}>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_88%_5%,rgba(76,175,80,0.16),transparent_33%)]" />
      <div className="relative max-w-xl">
        <div className={`mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl ${isDark ? "bg-[#75c96a]/15 text-[#9ce891]" : "bg-[#e7f3e5] text-[#336d3e]"}`}>
          <FolderLock className="h-6 w-6" aria-hidden="true" />
        </div>
        <p className={`text-sm font-semibold ${textMain}`}>{signedIn ? "Your private club space starts here" : "A private home for every club"}</p>
        <p className={`mt-2 max-w-lg text-sm leading-6 ${textMuted}`}>
          {signedIn
            ? "Clubs you create or join will appear here. Their members, events, feed, and albums stay inside the community."
            : "Club workspaces are visible only to their members. Explore the experience with a safe product demo, or sign in to create your own."}
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/clubs/demo"
            className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4CAF50] focus-visible:ring-offset-2 ${
              isDark ? "border-white/16 text-white hover:bg-white/8" : "border-[#aac7aa] text-[#254d2b] hover:bg-[#f1f8ef]"
            }`}
          >
            <Eye className="h-4 w-4" aria-hidden="true" />
            View demo dashboard
          </Link>
          <button
            type="button"
            onClick={onCreate}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#426f45] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#345c38] active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4CAF50] focus-visible:ring-offset-2"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            {signedIn ? "Create a club" : "Sign in to create"}
          </button>
        </div>
      </div>
    </section>
  );
}

export default function MyClubs() {
  const [location, navigate] = useLocation();
  const { user } = useAuthContext();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [myClubs, setMyClubs] = useState<Club[]>([]);
  const [loading, setLoading] = useState(Boolean(user));
  const [showWizard, setShowWizard] = useState(() => typeof window !== "undefined" && window.sessionStorage.getItem(CREATE_CLUB_WIZARD_ACTIVE_KEY) === "1");
  const [showAuthGate, setShowAuthGate] = useState(false);

  const closeWizard = useCallback(() => {
    try { window.sessionStorage.removeItem(CREATE_CLUB_WIZARD_ACTIVE_KEY); } catch { /* storage unavailable */ }
    setShowWizard(false);
  }, []);

  const openCreateClub = useCallback(() => {
    if (!user) {
      setShowAuthGate(true);
      return;
    }
    try { window.sessionStorage.setItem(CREATE_CLUB_WIZARD_ACTIVE_KEY, "1"); } catch { /* storage unavailable */ }
    setShowWizard(true);
  }, [user]);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("create") !== "1") return;
    window.history.replaceState({}, "", "/clubs");
    openCreateClub();
  }, [location, openCreateClub]);

  const refreshClubs = useCallback(async () => {
    if (!user) {
      setMyClubs([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      // Existing owned browser-local clubs are migrated once; the server forces
      // their private visibility during sync.
      await migrateLocalClubsToServer(user.id);
      const serverClubs = await apiListMyClubs();
      setMyClubs(serverClubs.length > 0 ? serverClubs : listMyClubs(user.id));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { refreshClubs(); }, [refreshClubs, showWizard]);

  useEffect(() => {
    document.title = "My Private Chess Clubs | ChessOTB.club";
    const description = document.querySelector('meta[name="description"]');
    description?.setAttribute("content", "Private ChessOTB club workspaces for your teams, events, members, and community.");
    return () => { document.title = "ChessOTB.club — Chess Tournaments Over The Board"; };
  }, []);

  const orderedClubs = useMemo(() => [...myClubs].sort((a, b) => {
    const ownerA = user && a.ownerId === user.id ? 0 : 1;
    const ownerB = user && b.ownerId === user.id ? 0 : 1;
    return ownerA - ownerB || a.name.localeCompare(b.name);
  }), [myClubs, user]);

  const upcomingEvents = useMemo<EnrichedEvent[]>(() => {
    const now = new Date().toISOString();
    return myClubs.flatMap((club) => listClubEvents(club.id).filter((event) => event.isPublished && event.startAt >= now).map((event) => ({
      ...event,
      clubName: club.name,
      clubAccent: club.accentColor,
    }))).sort((a, b) => a.startAt.localeCompare(b.startAt)).slice(0, 4);
  }, [myClubs]);

  const shell = isDark ? "bg-[#0d1a0f]" : "bg-[#f5f7f2]";
  const textMain = isDark ? "text-white" : "text-[#15291c]";
  const textMuted = isDark ? "text-white/60" : "text-[#516555]";

  return (
    <div className={`min-h-[100dvh] ${shell}`}>
      <header className={`sticky top-0 z-30 border-b backdrop-blur-xl ${isDark ? "border-white/8 bg-[#0d1a0f]/92" : "border-[#dce7da] bg-[#f5f7f2]/92"}`}>
        <div className="mx-auto flex h-15 max-w-6xl items-center gap-3 px-4 sm:h-16 sm:px-6">
          <NavLogo className="h-7" />
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={openCreateClub}
              className={`inline-flex min-h-10 items-center gap-2 rounded-xl px-3.5 text-sm font-semibold transition-colors active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4CAF50] focus-visible:ring-offset-2 ${
                isDark ? "border border-white/12 bg-white/8 text-white hover:bg-white/12" : "bg-[#426f45] text-white hover:bg-[#345c38]"
              }`}
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">Create club</span>
            </button>
            <AvatarNavDropdown currentPage="Clubs" />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-[calc(2rem+env(safe-area-inset-bottom,0px))] pt-8 sm:px-6 sm:pt-12">
        <section className="max-w-2xl">
          <h1 className={`text-3xl font-bold tracking-tight sm:text-4xl ${textMain}`} style={{ fontFamily: "'Clash Display', sans-serif" }}>
            {user ? `Welcome back, ${user.displayName?.split(" ")[0] || "Player"}` : "Your club space"}
          </h1>
          <p className={`mt-3 text-base leading-7 ${textMuted}`}>
            {user ? "Your chess clubs hub." : "Club members keep their events, conversations, and media inside a private workspace."}
          </p>
        </section>

        {user && upcomingEvents.length > 0 && (
          <section className="mt-10">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className={`text-lg font-bold ${textMain}`}>Upcoming events</h2>
                <p className={`mt-1 text-sm ${textMuted}`}>From your private club calendar</p>
              </div>
              <CalendarDays className={`h-5 w-5 ${isDark ? "text-[#9ce891]" : "text-[#3f7546]"}`} aria-hidden="true" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {upcomingEvents.map((event) => (
                <Link key={event.id} href={`/clubs/${event.clubId}/home`} className={`group flex min-h-24 items-center gap-4 rounded-2xl border p-4 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4CAF50] focus-visible:ring-offset-2 ${isDark ? "border-white/9 bg-white/[0.045] hover:bg-white/[0.07]" : "border-[#dce7da] bg-white hover:border-[#a9c9a7]"}`}>
                  <div className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl text-white" style={{ background: event.clubAccent }}>
                    <span className="text-[10px] font-bold uppercase">{new Date(event.startAt).toLocaleDateString("en-US", { month: "short" })}</span>
                    <span className="text-base font-black leading-none">{new Date(event.startAt).getDate()}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`truncate text-sm font-bold ${textMain}`}>{event.title}</p>
                    <p className={`mt-1 truncate text-xs ${textMuted}`}>{event.clubName} · {new Date(event.startAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</p>
                  </div>
                  <ChevronRight className={`h-4 w-4 shrink-0 ${isDark ? "text-white/40" : "text-[#627565]"}`} aria-hidden="true" />
                </Link>
              ))}
            </div>
          </section>
        )}

        <section className="mt-10">
          <div className="mb-5">
            <div>
              <h2 className={`text-3xl font-bold tracking-tight sm:text-4xl ${textMain}`} style={{ fontFamily: "'Clash Display', sans-serif" }}>My clubs</h2>
              <p className={`mt-1 text-sm ${textMuted}`}>{loading ? "Loading your memberships…" : `${orderedClubs.length} private workspace${orderedClubs.length === 1 ? "" : "s"}`}</p>
            </div>
          </div>

          {loading ? (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }).map((_, index) => <div key={index} className={`h-64 animate-pulse rounded-2xl ${isDark ? "bg-white/[0.055]" : "bg-[#e6eee3]"}`} />)}
            </div>
          ) : orderedClubs.length === 0 ? (
            <PrivateClubEmptyState isDark={isDark} signedIn={Boolean(user)} onCreate={openCreateClub} />
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {orderedClubs.map((club) => <ClubCard key={club.id} club={club} isDark={isDark} isOwned={club.ownerId === user?.id} />)}
            </div>
          )}
        </section>

        {!user && (
          <section className="mt-10 flex flex-col justify-between gap-4 rounded-2xl border border-dashed p-5 sm:flex-row sm:items-center sm:p-6" style={{ borderColor: isDark ? "rgba(255,255,255,0.15)" : "#b7cfb5" }}>
            <div>
              <p className={`font-semibold ${textMain}`}>Ready to bring your club together?</p>
              <p className={`mt-1 text-sm ${textMuted}`}>Create a private home for the players who already belong in your community.</p>
            </div>
            <button type="button" onClick={() => navigate("/auth")} className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#426f45] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#345c38] active:scale-[0.98]">
              Sign in <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </section>
        )}
      </main>

      {showWizard && <CreateClubWizard onClose={closeWizard} />}
      {showAuthGate && <CreateClubAuthGate onClose={() => setShowAuthGate(false)} onAuthenticated={() => { setShowAuthGate(false); openCreateClub(); }} onPreview={() => { setShowAuthGate(false); navigate("/clubs/demo"); }} />}
    </div>
  );
}
