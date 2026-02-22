import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import TournamentPage from "./pages/Tournament";
import Director from "./pages/Director";
import PrintPage from "./pages/Print";
import JoinPage from "./pages/Join";
import Archive from "./pages/Archive";


function Router() {
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/tournament/:id"} component={TournamentPage} />
      <Route path={"/tournament/:id/manage"} component={Director} />
      <Route path={"/tournament/:id/print"} component={PrintPage} />
      <Route path={"/join/:code"} component={JoinPage} />
      <Route path={"/join"} component={JoinPage} />
      <Route path={"/tournaments"} component={Archive} />
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="light"
        switchable
      >
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
