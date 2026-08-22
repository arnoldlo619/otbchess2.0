import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { selectDirectorLifecycleStatus } from "@/lib/tournamentUtils";
import { DirectorLifecycleBand } from "./DirectorLifecycleBand";

const base = {
  status: "in_progress",
  playerCount: 8,
  canStart: false,
  currentRound: 2,
  totalRounds: 4,
  allResultsIn: false,
  canGenerateNext: false,
} as const;

describe("selectDirectorLifecycleStatus", () => {
  it("covers draft, registration, ready, live, paused, between-round, and cancelled states", () => {
    expect(selectDirectorLifecycleStatus({ ...base, status: "registration", playerCount: 0 }).label).toBe("Draft");
    expect(selectDirectorLifecycleStatus({ ...base, status: "registration" }).label).toBe("Registration Open");
    expect(selectDirectorLifecycleStatus({ ...base, status: "registration", canStart: true }).label).toBe("Ready to Start");
    expect(selectDirectorLifecycleStatus(base).label).toBe("Live");
    expect(selectDirectorLifecycleStatus({ ...base, status: "paused" }).label).toBe("Paused");
    expect(selectDirectorLifecycleStatus({ ...base, allResultsIn: true, canGenerateNext: true }).label).toBe("Between Rounds");
    expect(selectDirectorLifecycleStatus({ ...base, status: "cancelled" }).label).toBe("Cancelled");
  });

  it("gives finalization pending, error, retry recovery, and completed states terminal precedence", () => {
    expect(selectDirectorLifecycleStatus({ ...base, allResultsIn: true, currentRound: 4 }).label).toBe("Awaiting Finalization");
    expect(selectDirectorLifecycleStatus({ ...base, finalizationStatus: "pending" }).label).toBe("Finalizing");
    expect(selectDirectorLifecycleStatus({ ...base, status: "completed", finalizationStatus: "error" }).label).toBe("Finalization failed");
    expect(selectDirectorLifecycleStatus({ ...base, status: "completed", finalizationStatus: "pending" }).label).toBe("Finalizing");
    expect(selectDirectorLifecycleStatus({ ...base, finalizationStatus: "success" }).label).toBe("Completed");
  });
});

describe("DirectorLifecycleBand", () => {
  it("renders lifecycle and save state as separate accessible signals", () => {
    const html = renderToStaticMarkup(
      <DirectorLifecycleBand
        lifecycle={selectDirectorLifecycleStatus({ ...base, allResultsIn: true, canGenerateNext: true })}
        lastSaved="2026-08-22T12:30:00.000Z"
        isDark
      />,
    );
    expect(html).toContain('aria-label="Tournament status"');
    expect(html).toContain("Between Rounds");
    expect(html).toContain("Saved 12:30 PM");
  });

  it("renders an assertive, 44px retry control only for failed finalization", () => {
    const retry = vi.fn();
    const errorHtml = renderToStaticMarkup(
      <DirectorLifecycleBand
        lifecycle={selectDirectorLifecycleStatus({ ...base, finalizationStatus: "error" })}
        lastSaved={null}
        isDark={false}
        onRetryFinalization={retry}
      />,
    );
    const liveHtml = renderToStaticMarkup(
      <DirectorLifecycleBand lifecycle={selectDirectorLifecycleStatus(base)} lastSaved={null} isDark={false} onRetryFinalization={retry} />,
    );
    expect(errorHtml).toContain('aria-live="assertive"');
    expect(errorHtml).toContain("Retry finalization");
    expect(errorHtml).toContain("min-h-11");
    expect(liveHtml).not.toContain("Retry finalization");
  });
});

describe("Director lifecycle integration", () => {
  const directorSource = readFileSync(resolve(import.meta.dirname, "../../pages/Director.tsx"), "utf8");

  it("routes automatic and manual completion through one retryable publishing path", () => {
    expect(directorSource).toContain('const [finalizationStatus, setFinalizationStatus] = useState<"idle" | "pending" | "success" | "error">');
    expect(directorSource).toContain("const publishFinalTournamentState = useCallback(async () =>");
    expect(directorSource).toContain('setFinalizationStatus("pending")');
    expect(directorSource).toContain('setFinalizationStatus("error")');
    expect(directorSource).toContain('setFinalizationStatus("success")');
    expect(directorSource.match(/publishFinalTournamentState\(\)/g)?.length ?? 0).toBeGreaterThanOrEqual(6);
    expect(directorSource).toContain("autoCompletedRef.current = false");
    expect(directorSource).toContain("autoCompletedSwissRef.current = false");
    expect(directorSource).toContain("autoCompletedQuadsRef.current = false");
  });

  it("does not expose future rounds as clickable controls", () => {
    const start = directorSource.indexOf("Mobile Round Navigator");
    const end = directorSource.indexOf("Page Title + Tab Bar", start);
    const navigator = directorSource.slice(start, end);
    expect(navigator).toContain("Array.from({ length: state.totalRounds }");
    expect(navigator).toContain("<div key={r}");
    expect(navigator).not.toContain("onClick");
  });

  it("mounts the lifecycle band with independent last-saved data", () => {
    expect(directorSource).toContain("<DirectorLifecycleBand");
    expect(directorSource).toContain("lastSaved={lastSaved}");
    expect(directorSource).toContain("lifecycle={directorLifecycle}");
  });

  it("keeps critical Director actions visible without hover-only disclosure", () => {
    expect(directorSource).not.toMatch(/opacity-0[^"\n]*group-hover:opacity-100/);
    expect(directorSource).toContain("aria-label={`Edit ${player.name}`}");
    expect(directorSource).toContain("aria-label={`Remove ${player.name} and regenerate Round 1 pairings`}");
    expect(directorSource).toContain("aria-label={`Assign a bye to ${p.name}`}");
  });
});
