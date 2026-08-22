import { lazy, Suspense, useEffect, useRef } from "react";
import { OTBLoader } from "@/components/OTBLoader";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { InstallBanner } from "./components/InstallBanner";
import { AuthProvider } from "./context/AuthContext";
import { ApiErrorNotifier } from "./components/ApiErrorNotifier";
import { ClientErrorTelemetry } from "./components/ClientErrorTelemetry";
import { buildPreservedRedirect, buildTournamentCreateRedirect } from "./lib/routeRedirects";

// ── Lazy-loaded page components ──────────────────────────────────────────────
// Each page is split into its own JS chunk, dramatically reducing initial bundle
// size. The heavy pages (Director, Report, Archive) are only downloaded when
// the user navigates to them.
const Home = lazy(() => import("./pages/Home"));
const TournamentPage = lazy(() => import("./pages/Tournament"));
const Director = lazy(() => import("./pages/Director"));
const PrintPage = lazy(() => import("./pages/Print"));
const JoinPage = lazy(() => import("./pages/Join"));
const Archive = lazy(() => import("./pages/Archive"));
const ReportPage = lazy(() => import("./pages/Report"));
const DirectorAccessPage = lazy(() => import("./pages/DirectorAccess"));
const PlayerView = lazy(() => import("./pages/PlayerView"));
const ProfilePage = lazy(() => import("./pages/Profile"));
const NotFound = lazy(() => import("./pages/NotFound"));
const FinalStandings = lazy(() => import("./pages/FinalStandings"));
const ChessClock = lazy(() => import("./pages/ChessClock"));
const MyClubs = lazy(() => import("./pages/MyClubs"));
const ClubProfile = lazy(() => import("./pages/ClubProfile"));
const ClubDashboard = lazy(() => import("./pages/ClubDashboard"));
const ClubManage = lazy(() => import("./pages/ClubManage"));
const GameRecorder = lazy(() => import("./pages/GameRecorder"));
const GameAnalysis = lazy(() => import("./pages/GameAnalysis"));
const VideoRecorder = lazy(() => import("./pages/VideoRecorder"));
const Training = lazy(() => import("./pages/Training"));
const ClubMessages = lazy(() => import("./pages/ClubMessages"));
const ClubLeaderboard = lazy(() => import("./pages/ClubLeaderboard"));
const InviteAccept = lazy(() => import("./pages/InviteAccept"));
const GamesHistory = lazy(() => import("./pages/GamesHistory"));
const LeagueDashboard = lazy(() => import("./pages/LeagueDashboard"));
const LeagueHistory = lazy(() => import("./pages/LeagueHistory"));
const LeagueDemo = lazy(() => import("./pages/LeagueDemo"));
const LeagueOverview = lazy(() => import("./pages/LeagueOverview"));
const MatchupPrep = lazy(() => import("./pages/MatchupPrep"));
import PrepAnalysis from "@/pages/PrepAnalysis";
const PublicTournament = lazy(() => import("./pages/PublicTournament"));
const TournamentAnalytics = lazy(() => import("./pages/TournamentAnalytics"));
const OpeningsAdmin = lazy(() => import("./pages/OpeningsAdmin"));
const OpeningsLibrary = lazy(() => import("./pages/OpeningsLibrary"));
const OpeningDetail = lazy(() => import("./pages/OpeningDetail"));
const StudyMode = lazy(() => import("./pages/StudyMode"));
const Pricing = lazy(() => import("./pages/Pricing"));
const Terms = lazy(() => import("./pages/Terms"));
const ProSuccess = lazy(() => import("./pages/ProSuccess"));
const OpeningsLibraryDemo = lazy(() => import("./pages/OpeningsLibraryDemo"));
const OpeningDetailDemo = lazy(() => import("./pages/OpeningDetailDemo"));
const AdminStaff = lazy(() => import("./pages/AdminStaff"));
const RepertoireList = lazy(() => import("./pages/RepertoireList"));
const RepertoireBuilder = lazy(() => import("./pages/RepertoireBuilder"));
const MeetupEventPage = lazy(() => import("./pages/MeetupEventPage"));
const CheckInPage = lazy(() => import("./pages/CheckInPage"));
const CreateLeague = lazy(() => import("./pages/CreateLeague"));
const BroadcastControl = lazy(() => import("./pages/BroadcastControl"));
const BroadcastConsole = lazy(() => import("./pages/BroadcastConsole"));
const LiveBoard = lazy(() => import("./pages/LiveBoard"));
const VenueDisplay = lazy(() => import("./pages/VenueDisplay"));
const ChessnutTestLab = lazy(() => import("./pages/ChessnutTestLab"));
const ConnectBoard = lazy(() => import("./pages/ConnectBoard"));
const GameJoin = lazy(() => import("./pages/GameJoin"));
const OtbLeaderboard = lazy(() => import("./pages/OtbLeaderboard"));
const Blog = lazy(() => import("./pages/Blog"));
const BlogPost = lazy(() => import("./pages/BlogPost"));
const JoinClub = lazy(() => import("./pages/JoinClub"));
const TournamentRecap = lazy(() => import("./pages/TournamentRecap"));
const TournamentOverview = lazy(() => import("./pages/TournamentOverview"));
const AuthPage = lazy(() => import("./pages/Auth"));
const RsvpFormPage = lazy(() => import("./pages/RsvpFormPage"));
const RsvpFormBuilderPage = lazy(() => import("./pages/RsvpFormBuilderPage"));

function PageLoader() {
  return <OTBLoader fullPage label="Preparing the board" />;
}

function RouteFocusManager() {
  const [location] = useLocation();
  const isInitialRoute = useRef(true);

  useEffect(() => {
    if (isInitialRoute.current) {
      isInitialRoute.current = false;
      return;
    }

    let userMovedFocus = false;
    const noteUserInteraction = () => {
      userMovedFocus = true;
    };
    const focusMainContent = () => {
      const mainContent = document.getElementById("main-content");
      if (!mainContent) return;

      mainContent.focus({ preventScroll: true });
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    };

    document.addEventListener("keydown", noteUserInteraction, { once: true, capture: true });
    document.addEventListener("pointerdown", noteUserInteraction, { once: true, capture: true });
    const frameId = window.requestAnimationFrame(focusMainContent);
    const focusStabilizerId = window.setTimeout(() => {
      if (!userMovedFocus) focusMainContent();
    }, 450);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.clearTimeout(focusStabilizerId);
      document.removeEventListener("keydown", noteUserInteraction, true);
      document.removeEventListener("pointerdown", noteUserInteraction, true);
    };
  }, [location]);

  return null;
}

function HardRedirect({
  to,
  tournamentCreate = false,
}: {
  to: string;
  tournamentCreate?: boolean;
}) {
  useEffect(() => {
    const target = tournamentCreate
      ? buildTournamentCreateRedirect(window.location.search, window.location.hash)
      : buildPreservedRedirect(to, window.location.search, window.location.hash);
    window.location.replace(target);
  }, [to, tournamentCreate]);

  return <PageLoader />;
}

function Router() {
  // Show a toast if Google OAuth redirected back with an error
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const authError = params.get("auth_error");
    if (authError) {
      const url = new URL(window.location.href);
      url.searchParams.delete("auth_error");
      window.history.replaceState({}, "", url.toString());
      import("sonner").then(({ toast }) => {
        const messages: Record<string, string> = {
          access_denied: "Google sign-in was cancelled.",
          token_exchange_failed: "Google sign-in failed \u2014 please try again.",
          profile_fetch_failed: "Could not retrieve your Google profile.",
          server_error: "An unexpected error occurred during sign-in.",
        };
        toast.error(messages[authError] ?? "Google sign-in failed.");
      });
    }
  }, []);

  return (
    <>
      <RouteFocusManager />
      <a href="#main-content" className="otb-skip-link">
        Skip to main content
      </a>
      <main id="main-content" tabIndex={-1} aria-label="Main content">
        <Suspense fallback={<PageLoader />}>
          <Switch>
        <Route path={"/auth"} component={AuthPage} />
        <Route path={"/"} component={Home} />
        <Route path={"/tournament/:id"} component={TournamentPage} />
        <Route path={"/tournament/:id/manage"} component={Director} />
        <Route path={"/tournament/:id/play"} component={PlayerView} />
        <Route path={"/tournament/:id/print"} component={PrintPage} />
        <Route path={"/join/:code"} component={JoinPage} />
        <Route path={"/join"} component={JoinPage} />
        <Route path={"/tournaments"} component={Archive} />
        <Route path={"/tournament/:id/report"} component={ReportPage} />
        <Route path={"/director-access"} component={DirectorAccessPage} />
        <Route path={"/tournament/:id/results"} component={FinalStandings} />
        <Route path={"/tournament/:id/overview"} component={TournamentOverview} />
        <Route path={"/tournament/:id/clock"} component={ChessClock} />
        <Route path={"/clock"} component={ChessClock} />
        <Route path={"/profile"} component={ProfilePage} />
        <Route path={"/clubs"} component={MyClubs} />
        <Route path={"/clubs/leaderboard"} component={ClubLeaderboard} />
        <Route path={"/clubs/:id/manage"} component={ClubManage} />
        <Route path={"/clubs/:id/home"} component={ClubDashboard} />
        <Route path={"/clubs/:clubId/meetup/:eventId"} component={MeetupEventPage} />
        <Route path={"/clubs/:clubId/meetup/:eventId/rsvp-form/builder"} component={RsvpFormBuilderPage} />
        <Route path={"/checkin/:eventId"} component={CheckInPage} />
        <Route path={"/rsvp/:slug"} component={RsvpFormPage} />
        <Route path={"/clubs/:id/messages"} component={ClubMessages} />
        <Route path={"/join-club/:clubId"} component={JoinClub} />
        <Route path={"/clubs/:id"} component={ClubProfile} />
        <Route path={"/tournament/:id/broadcast-console"} component={BroadcastConsole} />
        <Route path={"/tournament/:id/connect-board"} component={ConnectBoard} />
        <Route path={"/tournament/:id/broadcast/:boardNumber"} component={BroadcastControl} />
        <Route path={"/live/board/:slug/display"} component={VenueDisplay} />
        <Route path={"/live/board/:slug"} component={LiveBoard} />
        <Route path={"/league"} component={LeagueOverview} />
        <Route path={"/league/new"} component={CreateLeague} />
        <Route path={"/league-demo"} component={LeagueDemo} />
        <Route path={"/league/:leagueId/history"} component={LeagueHistory} />
        <Route path={"/leagues/:leagueId/history"} component={LeagueHistory} />
        <Route path={"/league/:leagueId"} component={LeagueDashboard} />
        <Route path={"/leagues/:leagueId"} component={LeagueDashboard} />
        <Route path={"/prep/analysis"} component={PrepAnalysis} />
        <Route path={"/prep/:username"} component={MatchupPrep} />
        <Route path={"/prep"} component={MatchupPrep} />
        <Route path={"/games"} component={GamesHistory} />
        <Route path={"/record"} component={GameRecorder} />
        <Route path={"/record/camera"} component={VideoRecorder} />
        <Route path={"/game/join/:token"} component={GameJoin} />
        <Route path={"/otb/leaderboard"} component={OtbLeaderboard} />
        <Route path={"/game/:gameId/analysis"} component={GameAnalysis} />
        <Route path={"/training"} component={Training} />
        <Route path={"/invite/:token"} component={InviteAccept} />
        <Route path={"/live/:slug"} component={PublicTournament} />
        <Route path={"/tournament/:id/analytics"} component={TournamentAnalytics} />
        <Route path={"/openings/:openingSlug/study/:lineSlug"} component={StudyMode} />
        <Route path={"/openings/demo/:slug"} component={OpeningDetailDemo} />
        <Route path={"/openings/demo"} component={OpeningsLibraryDemo} />
        <Route path={"/openings/:slug"} component={OpeningDetail} />
        <Route path={"/openings"} component={OpeningsLibrary} />
        <Route path={"/repertoire/:id"} component={RepertoireBuilder} />
        <Route path={"/repertoire"} component={RepertoireList} />
        <Route path={"/pricing"} component={Pricing} />
        <Route path={"/terms"} component={Terms} />
        <Route path={"/pro/success"} component={ProSuccess} />
        <Route path={"/admin/staff"} component={AdminStaff} />
        <Route path={"/blog/:slug"} component={BlogPost} />
        <Route path={"/blog"} component={Blog} />
        <Route path={"/recap/:slug"} component={TournamentRecap} />
        <Route path={"/admin/openings"} component={OpeningsAdmin} />
        <Route path={"/dashboard/tools/chessnut-bluetooth-test-lab"} component={ChessnutTestLab} />
        {/* Canonical redirects preserve campaign/source query parameters. */}
        <Route path={"/tournaments/new"} component={() => <HardRedirect to="/" tournamentCreate />} />
        <Route path={"/create"} component={() => <HardRedirect to="/tournaments/new" />} />
        <Route path={"/tools"} component={() => <HardRedirect to="/training" />} />
        <Route path={"/404"} component={NotFound} />
        <Route component={NotFound} />
          </Switch>
        </Suspense>
      </main>
    </>
  );
}

function App() {
  return (
    <AuthProvider>
      <ErrorBoundary>
        <ThemeProvider
          defaultTheme="dark"
          switchable
        >
          <TooltipProvider>
            <Toaster />
            <ApiErrorNotifier />
            <ClientErrorTelemetry />
            <Router />
            <InstallBanner />
          </TooltipProvider>
        </ThemeProvider>
      </ErrorBoundary>
    </AuthProvider>
  );
}

export default App;
