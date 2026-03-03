import { lazy, Suspense } from "react";
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
        <Route path={"/404"} component={NotFound} />
        {/* Final fallback route */}
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
          defaultTheme="light"
          switchable
        >
          <TooltipProvider>
            <Toaster />
            <Router />
            <InstallBanner />
          </TooltipProvider>
        </ThemeProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
