import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { InstallBanner } from "./components/InstallBanner";
import { AuthProvider } from "./context/AuthContext";

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
const PublicTournament = lazy(() => import("./pages/PublicTournament"));
const TournamentAnalytics = lazy(() => import("./pages/TournamentAnalytics"));
const OpeningsAdmin = lazy(() => import("./pages/OpeningsAdmin"));
const OpeningsLibrary = lazy(() => import("./pages/OpeningsLibrary"));
const OpeningDetail = lazy(() => import("./pages/OpeningDetail"));
const StudyMode = lazy(() => import("./pages/StudyMode"));
const Pricing = lazy(() => import("./pages/Pricing"));
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

// ── Thin top progress bar — replaces full-screen loader on route transitions ────────────
function RouteProgressBar() {
  const [visible, setVisible] = useState(false);
  const [width, setWidth] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    setVisible(true);
    setWidth(0);
    // Animate to 85% quickly, then stall — completes when component unmounts
    let w = 0;
    const step = () => {
      w = w < 40 ? w + 8 : w < 70 ? w + 3 : w < 85 ? w + 0.5 : w;
      setWidth(Math.min(w, 85));
      if (w < 85) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      // Complete the bar on unmount (page loaded)
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      setWidth(100);
      timerRef.current = setTimeout(() => setVisible(false), 300);
    };
  }, []);

  if (!visible) return null;
  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        zIndex: 9999,
        height: 3,
        width: `${width}%`,
        background: "linear-gradient(90deg, oklch(0.65 0.18 145), oklch(0.75 0.20 145))",
        transition: width === 100 ? "width 0.2s ease-out, opacity 0.3s ease 0.2s" : "width 0.4s ease-out",
        opacity: width === 100 ? 0 : 1,
        borderRadius: "0 2px 2px 0",
        boxShadow: "0 0 8px oklch(0.65 0.18 145 / 0.6)",
        pointerEvents: "none",
      }}
    />
  );
}

function PageLoader() {
  return <RouteProgressBar />;
}

function Router() {
  return (
    <>
    {/* Skip to main content — accessibility */}
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[9999] focus:px-4 focus:py-2 focus:bg-[#4D6940] focus:text-white focus:rounded-lg focus:text-sm focus:font-semibold focus:shadow-lg"
    >
      Skip to main content
    </a>
    <main id="main-content">
    <Suspense fallback={<PageLoader />}>
      <Switch>
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
        <Route path={"/tournament/:id/clock"} component={ChessClock} />
        <Route path={"/clock"} component={ChessClock} />
        <Route path={"/profile"} component={ProfilePage} />
        <Route path={"/clubs"} component={MyClubs} />
        <Route path={"/clubs/leaderboard"} component={ClubLeaderboard} />
        <Route path={"/clubs/:id/manage"} component={ClubManage} />
        <Route path={"/clubs/:id/home"} component={ClubDashboard} />
        <Route path={"/clubs/:clubId/meetup/:eventId"} component={MeetupEventPage} />
        <Route path={"/checkin/:eventId"} component={CheckInPage} />
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
        <Route path={"/pro/success"} component={ProSuccess} />
        <Route path={"/admin/staff"} component={AdminStaff} />
        <Route path={"/blog/:slug"} component={BlogPost} />
        <Route path={"/blog"} component={Blog} />
        <Route path={"/recap/:slug"} component={TournamentRecap} />
        <Route path={"/admin/openings"} component={OpeningsAdmin} />
        <Route path={"/dashboard/tools/chessnut-bluetooth-test-lab"} component={ChessnutTestLab} />
        {/* /create — redirect to home with wizard open */}
        <Route path={"/create"} component={() => { if (typeof window !== "undefined") { window.location.replace("/?action=create"); } return null; }} />
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
            <Router />
            <InstallBanner />
          </TooltipProvider>
        </ThemeProvider>
      </ErrorBoundary>
    </AuthProvider>
  );
}

export default App;
