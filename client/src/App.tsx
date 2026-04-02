import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { InstallBanner } from "./components/InstallBanner";
import { ActiveTournamentBanner } from "./components/ActiveTournamentBanner";
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
const GameRecorder = lazy(() => import("./pages/GameRecorder"));
const GameAnalysis = lazy(() => import("./pages/GameAnalysis"));
const VideoRecorder = lazy(() => import("./pages/VideoRecorder"));
const Battle = lazy(() => import("./pages/Battle"));
const BattleHistory = lazy(() => import("./pages/BattleHistory"));
const ClubMessages = lazy(() => import("./pages/ClubMessages"));
const ClubLeaderboard = lazy(() => import("./pages/ClubLeaderboard"));
const InviteAccept = lazy(() => import("./pages/InviteAccept"));
const GamesHistory = lazy(() => import("./pages/GamesHistory"));
const LeagueDashboard = lazy(() => import("./pages/LeagueDashboard"));
const LeagueHistory = lazy(() => import("./pages/LeagueHistory"));
const MatchupPrep = lazy(() => import("./pages/MatchupPrep"));
const PublicTournament = lazy(() => import("./pages/PublicTournament"));
const TournamentAnalytics = lazy(() => import("./pages/TournamentAnalytics"));

// ── Minimal full-screen loading fallback ─────────────────────────────────────
function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-[#0d1a0f]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-[#3D6B47] border-t-transparent animate-spin" />
        <span className="text-sm text-gray-400 font-medium">Loading…</span>
      </div>
    </div>
  );
}

function Router() {
  return (
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
        <Route path={"/clubs/:id/home"} component={ClubDashboard} />
        <Route path={"/clubs/:id/messages"} component={ClubMessages} />
        <Route path={"/clubs/:id"} component={ClubProfile} />
        <Route path={"/leagues/:leagueId/history"} component={LeagueHistory} />
        <Route path={"/leagues/:leagueId"} component={LeagueDashboard} />
        <Route path={"/prep/:username"} component={MatchupPrep} />
        <Route path={"/prep"} component={MatchupPrep} />
        <Route path={"/games"} component={GamesHistory} />
        <Route path={"/record"} component={GameRecorder} />
        <Route path={"/record/camera"} component={VideoRecorder} />
        <Route path={"/game/:gameId/analysis"} component={GameAnalysis} />
        <Route path={"/battle"} component={Battle} />
        <Route path={"/battle/history"} component={BattleHistory} />
        <Route path={"/invite/:token"} component={InviteAccept} />
        <Route path={"/live/:slug"} component={PublicTournament} />
        <Route path={"/tournament/:id/analytics"} component={TournamentAnalytics} />
        <Route path={"/404"} component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <ThemeProvider
          defaultTheme="dark"
          switchable
        >
          <TooltipProvider>
            <Toaster />
            <Router />
            <ActiveTournamentBanner />
            <InstallBanner />
          </TooltipProvider>
        </ThemeProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
