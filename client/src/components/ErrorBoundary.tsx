/**
 * ErrorBoundary — catches all React render errors.
 *
 * Special handling for ChunkLoadError / dynamic import failures:
 *   - These happen when a new deployment replaces asset hashes while a user
 *     still has the old index.html in memory (or cached).
 *   - On first detection: auto-reload once (sessionStorage flag prevents loops).
 *   - If reload doesn't fix it: show a friendly "New version available" prompt.
 *
 * All other errors: show the standard error screen with a manual reload button.
 */
import { cn } from "@/lib/utils";
import { AlertTriangle, RefreshCw, Zap } from "lucide-react";
import { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
}
interface State {
  hasError: boolean;
  error: Error | null;
  isChunkError: boolean;
}

const CHUNK_RELOAD_KEY = "otb_chunk_reload_attempted";

function isChunkLoadError(error: Error): boolean {
  const msg = error?.message ?? "";
  const name = error?.name ?? "";
  return (
    name === "ChunkLoadError" ||
    msg.includes("Failed to fetch dynamically imported module") ||
    msg.includes("Importing a module script failed") ||
    msg.includes("Unable to preload CSS for") ||
    /Loading chunk \d+ failed/.test(msg) ||
    /Loading CSS chunk \d+ failed/.test(msg)
  );
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, isChunkError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    const chunkError = isChunkLoadError(error);

    // Auto-reload once on chunk errors — clears stale cached chunks
    if (chunkError) {
      const alreadyTried = sessionStorage.getItem(CHUNK_RELOAD_KEY);
      if (!alreadyTried) {
        sessionStorage.setItem(CHUNK_RELOAD_KEY, "1");
        // Hard reload bypasses service worker and browser cache
        window.location.reload();
        // Return a non-error state while reload is in progress
        return { hasError: false, error: null, isChunkError: true };
      }
    }

    return { hasError: true, error, isChunkError: chunkError };
  }

  componentDidCatch() {
    // Clear the reload flag after a successful mount so future deploys can
    // trigger another auto-reload if needed.
    sessionStorage.removeItem(CHUNK_RELOAD_KEY);
  }

  handleManualReload = () => {
    sessionStorage.removeItem(CHUNK_RELOAD_KEY);
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    // ── Chunk load error (stale deploy) ────────────────────────────────────────
    if (this.state.isChunkError) {
      return (
        <div className="flex items-center justify-center min-h-screen p-8 bg-background">
          <div className="flex flex-col items-center w-full max-w-sm text-center gap-5">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{ background: "oklch(0.22 0.06 145)", border: "1px solid oklch(0.35 0.10 145)" }}
            >
              <Zap className="w-8 h-8" style={{ color: "#4CAF50" }} />
            </div>
            <div>
              <h2 className="text-lg font-bold mb-1" style={{ color: "oklch(0.95 0.02 145)" }}>
                New version available
              </h2>
              <p className="text-sm" style={{ color: "oklch(0.60 0.05 145)" }}>
                ChessOTB was updated. Reload to get the latest version.
              </p>
            </div>
            <button
              onClick={this.handleManualReload}
              className={cn(
                "flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all active:scale-95",
              )}
              style={{ background: "#4CAF50", color: "white" }}
            >
              <RefreshCw className="w-4 h-4" />
              Reload Now
            </button>
          </div>
        </div>
      );
    }

    // ── Generic error ───────────────────────────────────────────────────────────────────
    return (
      <div className="flex items-center justify-center min-h-screen p-8 bg-background">
        <div className="flex flex-col items-center w-full max-w-2xl p-8">
          <AlertTriangle size={48} className="text-destructive mb-6 flex-shrink-0" />
          <h2 className="text-xl mb-4">An unexpected error occurred.</h2>
          <div className="p-4 w-full rounded bg-muted overflow-auto mb-6">
            <pre className="text-sm text-muted-foreground whitespace-break-spaces">
              {this.state.error?.stack}
            </pre>
          </div>
          <button
            onClick={this.handleManualReload}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg",
              "bg-primary text-primary-foreground",
              "hover:opacity-90 cursor-pointer"
            )}
          >
            <RefreshCw size={16} />
            Reload Page
          </button>
        </div>
      </div>
    );
  }
}
export default ErrorBoundary;
