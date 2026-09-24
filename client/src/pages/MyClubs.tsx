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
  ImageIcon,
  MessageSquare,
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

function PrivateClubEmptyState({ isDark, onCreate }: { isDark: boolean; onCreate: () => void }) {
  const rule = isDark ? "border-white/10" : "border-[#dbe6d9]";
  const textMain = isDark ? "text-white" : "text-[#15291c]";
  const textMuted = isDark ? "text-white/60" : "text-[#516555]";

  return (
    <section className={`max-w-xl border-t pt-6 ${rule}`}>
      <p className={`text-base font-semibold ${textMain}`}>No clubs yet</p>
      <p className={`mt-1 max-w-lg text-sm leading-6 ${textMuted}`}>Create a home for your players, or join a club with an invitation.</p>
      <button
        type="button"
        onClick={onCreate}
        className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#426f45] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#345c38] active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4CAF50] focus-visible:ring-offset-2"
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
        Create a club
      </button>
    </section>
  );
}

function GuestClubLanding({ isDark, onCreate }: { isDark: boolean; onCreate: () => void }) {
  const textMain = isDark ? "text-white" : "text-[#15291c]";
  const textMuted = isDark ? "text-white/60" : "text-[#516555]";
  const rule = isDark ? "border-white/10" : "border-[#dbe6d9]";
  const previewRows = [
    { label: "Events", detail: "Plan the next round", icon: CalendarDays },
    { label: "Feed", detail: "Keep everyone in sync", icon: MessageSquare },
    { label: "Album", detail: "Keep the moments close", icon: ImageIcon },
  ];

  return (
    <section className={`relative isolate overflow-hidden border-y py-10 sm:py-14 lg:py-20 ${rule}`}>
      <div className="pointer-events-none absolute inset-0 chess-board-bg opacity-[0.025]" aria-hidden="true" />
      <div className="relative grid gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)] lg:gap-16">
        <div className="max-w-2xl">
          <p className={`text-sm font-medium ${isDark ? "text-[#9ce891]" : "text-[#356d3c]"}`}>Club spaces</p>
          <h1 className={`mt-4 max-w-xl text-4xl font-bold tracking-[-0.045em] sm:text-5xl lg:text-[3.5rem] lg:leading-[1.02] ${textMain}`} style={{ fontFamily: "'Clash Display', sans-serif" }}>
            A home for every game.
          </h1>
          <p className={`mt-5 max-w-lg text-base leading-7 sm:text-lg ${textMuted}`}>
            Bring events, updates, and the people who make your club matter into one considered place.
          </p>
          <div className="mt-8 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={onCreate}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#426f45] px-5 text-sm font-semibold text-white transition-[background-color,transform] hover:bg-[#345c38] active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4CAF50] focus-visible:ring-offset-2"
            >
              Start a club
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
            <Link
              href="/clubs/demo"
              className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4CAF50] focus-visible:ring-offset-2 ${
                isDark ? "text-white/74 hover:text-white" : "text-[#315c38] hover:text-[#17321d]"
              }`}
            >
              <Eye className="h-4 w-4" aria-hidden="true" />
              Explore the workspace
            </Link>
          </div>
        </div>

        <div className={`self-end border-t lg:border-l lg:border-t-0 lg:pl-10 ${rule}`}>
          <p className={`pt-5 text-sm leading-6 lg:pt-0 ${textMuted}`}>Built for the rhythm between rounds.</p>
          <dl className={`mt-6 divide-y ${rule}`}>
            {previewRows.map(({ label, detail, icon: Icon }) => (
              <div key={label} className="flex items-center gap-4 py-4 first:pt-0">
                <Icon className={`h-4 w-4 shrink-0 ${isDark ? "text-[#9ce891]" : "text-[#356d3c]"}`} strokeWidth={1.8} aria-hidden="true" />
                <div className="min-w-0">
                  <dt className={`text-sm font-semibold ${textMain}`}>{label}</dt>
                  <dd className={`mt-0.5 text-sm ${textMuted}`}>{detail}</dd>
                </div>
              </div>
            ))}
          </dl>
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
            {user && (
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
            )}
            <AvatarNavDropdown currentPage="Clubs" />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-[calc(2rem+env(safe-area-inset-bottom,0px))] pt-8 sm:px-6 sm:pt-12">
        {!user ? <GuestClubLanding isDark={isDark} onCreate={openCreateClub} /> : <>
          <section className="max-w-2xl">
            <h1 className={`text-3xl font-bold tracking-tight sm:text-4xl ${textMain}`} style={{ fontFamily: "'Clash Display', sans-serif" }}>
              {`Welcome back, ${user.displayName?.split(" ")[0] || "Player"}`}
            </h1>
            <p className={`mt-3 text-base leading-7 ${textMuted}`}>Your chess clubs hub.</p>
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
            <PrivateClubEmptyState isDark={isDark} onCreate={openCreateClub} />
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {orderedClubs.map((club) => <ClubCard key={club.id} club={club} isDark={isDark} isOwned={club.ownerId === user?.id} />)}
            </div>
          )}
        </section>
        </>}
      </main>

      {showWizard && <CreateClubWizard onClose={closeWizard} />}
      {showAuthGate && <CreateClubAuthGate onClose={() => setShowAuthGate(false)} onAuthenticated={() => { setShowAuthGate(false); openCreateClub(); }} onPreview={() => { setShowAuthGate(false); navigate("/clubs/demo"); }} />}
    </div>
  );
}
