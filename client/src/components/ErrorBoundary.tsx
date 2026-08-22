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
import { reportClientError } from "@/lib/clientErrorReporter";
import { AlertTriangle, ExternalLink, Home, RefreshCw, Zap } from "lucide-react";
import { Component, type ErrorInfo, ReactNode } from "react";

const SUPPORT_URL = "https://help.manus.im"; // swap for your own feedback URL if needed

function buildReportUrl(error: Error | null, referenceId: string): string {
  const body = encodeURIComponent(
    `**Page:** ${window.location.href}\n\n**Reference:** ${referenceId}\n\n**Error:**\n\`\`\`\n${error?.stack ?? error?.message ?? "Unknown error"}\n\`\`\`\n\n**Steps to reproduce:**\n1. `
  );
  return `${SUPPORT_URL}?subject=${encodeURIComponent("Bug report — ChessOTB")}&body=${body}`;
}

interface Props {
  children: ReactNode;
}
interface State {
  hasError: boolean;
  error: Error | null;
  isChunkError: boolean;
  referenceId: string;
}

const CHUNK_RELOAD_KEY = "otb_chunk_reload_attempted";

export function createClientErrorReference(): string {
  const time = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `UI-${time}-${random}`;
}

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
    this.state = { hasError: false, error: null, isChunkError: false, referenceId: "" };
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
        return { hasError: false, error: null, isChunkError: true, referenceId: "" };
      }
    }

    return { hasError: true, error, isChunkError: chunkError, referenceId: createClientErrorReference() };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Clear the reload flag after a successful mount so future deploys can
    // trigger another auto-reload if needed.
    sessionStorage.removeItem(CHUNK_RELOAD_KEY);
    reportClientError({
      eventType: "render_error",
      error,
      componentStack: info.componentStack ?? undefined,
      referenceId: this.state.referenceId,
    });
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
        <div
          className="flex items-center justify-center min-h-screen p-6"
          style={{ background: "oklch(0.15 0.05 145)" }}
        >
          {/* Subtle chess-board dot grid */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: "radial-gradient(circle, oklch(0.30 0.06 145 / 0.35) 1px, transparent 1px)",
              backgroundSize: "28px 28px",
            }}
          />

          <div
            className="relative flex flex-col items-center w-full max-w-sm text-center gap-6 px-8 py-10 rounded-3xl"
            style={{
              background: "oklch(0.18 0.06 145 / 0.95)",
              border: "1px solid oklch(0.32 0.08 145)",
              boxShadow: "0 0 60px oklch(0.35 0.12 145 / 0.25), 0 2px 8px oklch(0.10 0.04 145 / 0.60)",
            }}
          >
            {/* Icon */}
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{
                background: "linear-gradient(135deg, oklch(0.28 0.10 145), oklch(0.22 0.07 145))",
                border: "1px solid oklch(0.40 0.12 145)",
                boxShadow: "0 0 20px oklch(0.45 0.18 145 / 0.30)",
              }}
            >
              <Zap className="w-8 h-8" style={{ color: "#4CAF50" }} />
            </div>

            {/* Wordmark */}
            <div
              className="text-xs font-black tracking-[0.25em] uppercase"
              style={{ color: "oklch(0.55 0.10 145)" }}
            >
              OTB!!
            </div>

            {/* Copy */}
            <div className="-mt-2">
              <h2 className="text-xl font-black mb-2" style={{ color: "oklch(0.96 0.02 145)" }}>
                New version available
              </h2>
              <p className="text-sm leading-relaxed" style={{ color: "oklch(0.58 0.06 145)" }}>
                ChessOTB was just updated. Reload to get the latest version.
              </p>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-2.5 w-full">
              <button
                onClick={this.handleManualReload}
                className="flex items-center justify-center gap-2 w-full py-3 rounded-xl font-bold text-sm transition-all active:scale-[0.97] hover:brightness-110"
                style={{ background: "#4CAF50", color: "white", boxShadow: "0 4px 16px oklch(0.50 0.18 145 / 0.35)" }}
              >
                <RefreshCw className="w-4 h-4" />
                Reload Now
              </button>
              <a
                href={SUPPORT_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full py-3 rounded-xl font-semibold text-sm transition-all active:scale-[0.97] hover:brightness-110"
                style={{
                  background: "oklch(0.22 0.06 145)",
                  color: "oklch(0.65 0.08 145)",
                  border: "1px solid oklch(0.32 0.08 145)",
                }}
              >
                <ExternalLink className="w-4 h-4" />
                Report Issue
              </a>
            </div>
          </div>
        </div>
      );
    }

    // ── Generic error ───────────────────────────────────────────────────────────────────
    return (
      <div
        className="flex items-center justify-center min-h-screen p-6"
        style={{ background: "oklch(0.15 0.05 145)" }}
      >
        {/* Subtle dot grid */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: "radial-gradient(circle, oklch(0.30 0.06 145 / 0.35) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />

        <div
          className="relative flex flex-col w-full max-w-xl gap-6 px-8 py-10 rounded-3xl"
          style={{
            background: "oklch(0.18 0.06 145 / 0.95)",
            border: "1px solid oklch(0.32 0.08 145)",
            boxShadow: "0 0 60px oklch(0.35 0.12 145 / 0.20), 0 2px 8px oklch(0.10 0.04 145 / 0.60)",
          }}
        >
          {/* Header */}
          <div className="flex items-start gap-4">
            <div
              className="w-12 h-12 rounded-xl flex-shrink-0 flex items-center justify-center mt-0.5"
              style={{
                background: "oklch(0.22 0.08 20)",
                border: "1px solid oklch(0.35 0.12 20)",
              }}
            >
              <AlertTriangle className="w-6 h-6" style={{ color: "#ef4444" }} />
            </div>
            <div>
              <div
                className="text-[10px] font-black tracking-[0.25em] uppercase mb-1"
                style={{ color: "oklch(0.50 0.08 145)" }}
              >
                OTB!! · Error
              </div>
              <h2 className="text-lg font-black" style={{ color: "oklch(0.96 0.02 145)" }}>
                Something went wrong
              </h2>
              <p className="text-sm mt-1 leading-relaxed" style={{ color: "oklch(0.66 0.05 145)" }}>
                The page hit an unexpected problem. Reload to continue, or return home if the issue persists.
              </p>
            </div>
          </div>

          {/* User-safe support reference. Technical details stay in the report URL. */}
          <div
            className="rounded-xl px-4 py-3"
            style={{ background: "oklch(0.13 0.04 145)", border: "1px solid oklch(0.25 0.06 145)" }}
          >
            <p className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: "oklch(0.48 0.05 145)" }}>
              Support reference
            </p>
            <p className="mt-1 text-xs font-semibold" style={{ color: "oklch(0.72 0.06 145)", fontFamily: "'JetBrains Mono', 'Fira Code', monospace" }}>
              {this.state.referenceId}
            </p>
          </div>

          {/* Actions */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <button
              onClick={this.handleManualReload}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all active:scale-[0.97] hover:brightness-110"
              )}
              style={{ background: "#4CAF50", color: "white", boxShadow: "0 4px 16px oklch(0.50 0.18 145 / 0.30)" }}
            >
              <RefreshCw className="w-4 h-4" />
              Reload Page
            </button>
            <a
              href="/"
              className="flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-all active:scale-[0.97] hover:brightness-110"
              style={{
                background: "oklch(0.22 0.06 145)",
                color: "oklch(0.78 0.06 145)",
                border: "1px solid oklch(0.32 0.08 145)",
              }}
            >
              <Home className="w-4 h-4" />
              Go Home
            </a>
            <a
              href={buildReportUrl(this.state.error, this.state.referenceId)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-all active:scale-[0.97] hover:brightness-110"
              style={{
                background: "oklch(0.22 0.06 145)",
                color: "oklch(0.65 0.08 145)",
                border: "1px solid oklch(0.32 0.08 145)",
              }}
            >
              <ExternalLink className="w-4 h-4" />
              Report Issue
            </a>
          </div>

          {/* Footer note */}
          <p className="text-center text-xs" style={{ color: "oklch(0.40 0.05 145)" }}>
            If this keeps happening, please report the issue so we can fix it quickly.
          </p>
        </div>
      </div>
    );
  }
}
export default ErrorBoundary;
