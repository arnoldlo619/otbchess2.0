// @vitest-environment jsdom
/**
 * MiniChessBoard + InsightCard board integration tests
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { MiniChessBoard } from "./MiniChessBoard";
import { InsightCard } from "./InsightCard";
import type { Insight } from "../../../../shared/prepTypes";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeInsight(overrides: Partial<Insight> = {}): Insight {
  return {
    id: "test-1",
    kind: "opening_tendency",
    color: "white",
    role: "plays",
    claim: "Frequently plays the Ruy Lopez",
    evidence: {
      stat: "68% of white games (17/25)",
      games: [],
      window: { from: "2024-01-01", to: "2024-12-31", timeClasses: ["rapid"], ratedOnly: true },
    },
    interpretation: "Strong preference for 1.e4 e5 2.Nf3 Nc6 3.Bb5",
    recommendation: {
      action: "Prepare the Berlin Defence",
      line: { san: "e4 e5 Nf3 Nc6 Bb5 Nf6", eco: "C65", validated: true },
    },
    confidence: "high",
    sampleSize: 25,
    ...overrides,
  };
}

// ── MiniChessBoard — rendering tests ──────────────────────────────────────────

describe("MiniChessBoard — rendering", () => {
  it("renders without crashing for a valid SAN line", () => {
    expect(() =>
      render(<MiniChessBoard sanLine="e4 e5 Nf3 Nc6 Bb5" isDark={true} />)
    ).not.toThrow();
  });

  it("renders an SVG board element", () => {
    const { container } = render(
      <MiniChessBoard sanLine="e4 e5 Nf3" isDark={true} />
    );
    expect(container.querySelector("svg")).toBeTruthy();
  });

  it("has role=application for keyboard interaction", () => {
    render(<MiniChessBoard sanLine="e4 e5" isDark={true} />);
    expect(screen.getByRole("application")).toBeTruthy();
  });

  it("renders 64 squares (rect elements)", () => {
    const { container } = render(
      <MiniChessBoard sanLine="e4 e5 Nf3" isDark={true} />
    );
    const rects = container.querySelectorAll("svg rect");
    expect(rects.length).toBe(64);
  });

  it("renders piece glyphs as text elements (≥32 for starting position)", () => {
    const { container } = render(
      <MiniChessBoard sanLine="" isDark={true} />
    );
    const texts = container.querySelectorAll("svg text");
    expect(texts.length).toBeGreaterThanOrEqual(32);
  });

  it("renders in light mode without crashing", () => {
    expect(() =>
      render(<MiniChessBoard sanLine="d4 d5 c4" isDark={false} />)
    ).not.toThrow();
  });

  it("renders with playerColor=black (flipped by default)", () => {
    expect(() =>
      render(<MiniChessBoard sanLine="e4 c5" isDark={true} playerColor="black" />)
    ).not.toThrow();
  });

  it("handles empty SAN line gracefully", () => {
    expect(() =>
      render(<MiniChessBoard sanLine="" isDark={true} />)
    ).not.toThrow();
  });

  it("handles SAN with move numbers (e.g. '1.e4 e5 2.Nf3')", () => {
    expect(() =>
      render(<MiniChessBoard sanLine="1.e4 e5 2.Nf3 Nc6 3.Bb5" isDark={true} />)
    ).not.toThrow();
  });

  it("shows a progress bar element", () => {
    render(<MiniChessBoard sanLine="e4 e5 Nf3" isDark={true} />);
    expect(screen.getByRole("progressbar")).toBeTruthy();
  });
});

// ── MiniChessBoard — navigation buttons ───────────────────────────────────────

describe("MiniChessBoard — navigation", () => {
  it("shows Previous, Next, Reset, Flip, Play, Speed, Loop buttons", () => {
    render(<MiniChessBoard sanLine="e4 e5 Nf3" isDark={true} />);
    expect(screen.getByLabelText("Previous move")).toBeTruthy();
    expect(screen.getByLabelText("Next move")).toBeTruthy();
    expect(screen.getByLabelText("Go to start")).toBeTruthy();
    expect(screen.getByLabelText("Flip board")).toBeTruthy();
    expect(screen.getByLabelText("Start auto-play")).toBeTruthy();
    expect(screen.getByLabelText(/Playback speed/)).toBeTruthy();
    expect(screen.getByLabelText(/Loop/)).toBeTruthy();
  });

  it("Previous button is disabled at start position", () => {
    render(<MiniChessBoard sanLine="e4 e5 Nf3" isDark={true} />);
    fireEvent.click(screen.getByLabelText("Go to start"));
    const prevBtn = screen.getByLabelText("Previous move") as HTMLButtonElement;
    expect(prevBtn.disabled).toBe(true);
  });

  it("Next button is disabled at end of line (default state)", () => {
    render(<MiniChessBoard sanLine="e4 e5 Nf3" isDark={true} />);
    const nextBtn = screen.getByLabelText("Next move") as HTMLButtonElement;
    expect(nextBtn.disabled).toBe(true);
  });

  it("clicking Previous enables Next button", () => {
    render(<MiniChessBoard sanLine="e4 e5 Nf3" isDark={true} />);
    fireEvent.click(screen.getByLabelText("Previous move"));
    const nextBtn = screen.getByLabelText("Next move") as HTMLButtonElement;
    expect(nextBtn.disabled).toBe(false);
  });

  it("clicking Flip board does not throw", () => {
    render(<MiniChessBoard sanLine="e4" isDark={true} playerColor="white" />);
    expect(() => fireEvent.click(screen.getByLabelText("Flip board"))).not.toThrow();
  });

  it("keyboard ArrowLeft steps back", () => {
    render(<MiniChessBoard sanLine="e4 e5 Nf3" isDark={true} />);
    const board = screen.getByRole("application");
    fireEvent.keyDown(board, { key: "ArrowLeft" });
    // Next button should now be enabled
    const nextBtn = screen.getByLabelText("Next move") as HTMLButtonElement;
    expect(nextBtn.disabled).toBe(false);
  });

  it("keyboard ArrowRight steps forward from start", () => {
    render(<MiniChessBoard sanLine="e4 e5 Nf3" isDark={true} />);
    const board = screen.getByRole("application");
    fireEvent.click(screen.getByLabelText("Go to start"));
    fireEvent.keyDown(board, { key: "ArrowRight" });
    // Previous button should now be enabled
    const prevBtn = screen.getByLabelText("Previous move") as HTMLButtonElement;
    expect(prevBtn.disabled).toBe(false);
  });
});

// ── MiniChessBoard — auto-play ─────────────────────────────────────────────────

describe("MiniChessBoard — auto-play", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("clicking Play shows Pause button", () => {
    render(<MiniChessBoard sanLine="e4 e5 Nf3 Nc6" isDark={true} />);
    // Reset to start first so there are moves to play
    fireEvent.click(screen.getByLabelText("Go to start"));
    fireEvent.click(screen.getByLabelText("Start auto-play"));
    expect(screen.getByLabelText("Pause auto-play")).toBeTruthy();
  });

  it("clicking Pause stops playback and shows Play button", () => {
    render(<MiniChessBoard sanLine="e4 e5 Nf3 Nc6" isDark={true} />);
    fireEvent.click(screen.getByLabelText("Go to start"));
    fireEvent.click(screen.getByLabelText("Start auto-play"));
    fireEvent.click(screen.getByLabelText("Pause auto-play"));
    expect(screen.getByLabelText("Start auto-play")).toBeTruthy();
  });

  it("Space key toggles play/pause", () => {
    render(<MiniChessBoard sanLine="e4 e5 Nf3 Nc6" isDark={true} />);
    const board = screen.getByRole("application");
    fireEvent.click(screen.getByLabelText("Go to start"));
    fireEvent.keyDown(board, { key: " " });
    expect(screen.getByLabelText("Pause auto-play")).toBeTruthy();
    fireEvent.keyDown(board, { key: " " });
    expect(screen.getByLabelText("Start auto-play")).toBeTruthy();
  });

  it("auto-play advances move index over time (normal speed = 900ms)", () => {
    render(<MiniChessBoard sanLine="e4 e5 Nf3 Nc6" isDark={true} />);
    fireEvent.click(screen.getByLabelText("Go to start"));
    fireEvent.click(screen.getByLabelText("Start auto-play"));

    // After 900ms the first move should have played
    act(() => { vi.advanceTimersByTime(900); });
    // Previous button should be enabled (we're no longer at start)
    const prevBtn = screen.getByLabelText("Previous move") as HTMLButtonElement;
    expect(prevBtn.disabled).toBe(false);
  });

  it("auto-play stops at end of line (no loop)", () => {
    render(<MiniChessBoard sanLine="e4 e5" isDark={true} />);
    fireEvent.click(screen.getByLabelText("Go to start"));
    fireEvent.click(screen.getByLabelText("Start auto-play"));

    // Advance past both moves (2 × 900ms + buffer)
    act(() => { vi.advanceTimersByTime(900 * 3); });
    // Should have reverted to Play button
    expect(screen.getByLabelText("Start auto-play")).toBeTruthy();
  });

  it("speed button cycles through labels (0.7×, 1×, 2×)", () => {
    render(<MiniChessBoard sanLine="e4 e5" isDark={true} />);
    const speedBtn = screen.getByLabelText(/Playback speed/);
    expect(speedBtn.textContent).toBe("1×");
    fireEvent.click(speedBtn);
    expect(speedBtn.textContent).toBe("2×");
    fireEvent.click(speedBtn);
    expect(speedBtn.textContent).toBe("0.7×");
    fireEvent.click(speedBtn);
    expect(speedBtn.textContent).toBe("1×");
  });

  it("loop button toggles aria-pressed", () => {
    render(<MiniChessBoard sanLine="e4 e5" isDark={true} />);
    const loopBtn = screen.getByLabelText(/Loop/);
    expect(loopBtn.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(loopBtn);
    expect(loopBtn.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(loopBtn);
    expect(loopBtn.getAttribute("aria-pressed")).toBe("false");
  });

  it("playing indicator pulse appears during playback", () => {
    const { container } = render(
      <MiniChessBoard sanLine="e4 e5 Nf3 Nc6" isDark={true} />
    );
    fireEvent.click(screen.getByLabelText("Go to start"));
    fireEvent.click(screen.getByLabelText("Start auto-play"));
    // The pulse dot has animate-pulse class
    expect(container.querySelector(".animate-pulse")).toBeTruthy();
  });

  it("clicking Reset while playing stops playback", () => {
    render(<MiniChessBoard sanLine="e4 e5 Nf3" isDark={true} />);
    fireEvent.click(screen.getByLabelText("Go to start"));
    fireEvent.click(screen.getByLabelText("Start auto-play"));
    fireEvent.click(screen.getByLabelText("Go to start"));
    expect(screen.getByLabelText("Start auto-play")).toBeTruthy();
  });

  it("clicking Previous while playing stops playback", () => {
    render(<MiniChessBoard sanLine="e4 e5 Nf3" isDark={true} />);
    fireEvent.click(screen.getByLabelText("Go to start"));
    fireEvent.click(screen.getByLabelText("Start auto-play"));
    act(() => { vi.advanceTimersByTime(900); }); // advance one move
    fireEvent.click(screen.getByLabelText("Previous move"));
    expect(screen.getByLabelText("Start auto-play")).toBeTruthy();
  });
});

// ── InsightCard board integration ─────────────────────────────────────────────

describe("InsightCard — board integration", () => {
  it("shows ♟ Board badge when insight has a recommendation line", () => {
    render(<InsightCard insight={makeInsight()} index={0} isDark={true} />);
    expect(screen.getByTitle("Has board visualization")).toBeTruthy();
  });

  it("does NOT show board badge when insight has no line", () => {
    const insight = makeInsight({
      recommendation: { action: "Study the endgame" },
    });
    render(<InsightCard insight={insight} index={0} isDark={true} />);
    expect(screen.queryByTitle("Has board visualization")).toBeNull();
  });

  it("shows Board toggle button in expanded state", () => {
    render(<InsightCard insight={makeInsight()} index={0} isDark={true} />);
    expect(screen.getByLabelText("Show chessboard")).toBeTruthy();
  });

  it("clicking Board toggle reveals the MiniChessBoard", () => {
    render(<InsightCard insight={makeInsight()} index={0} isDark={true} />);
    fireEvent.click(screen.getByLabelText("Show chessboard"));
    expect(screen.getByRole("application")).toBeTruthy();
  });

  it("clicking Board toggle again hides the MiniChessBoard", () => {
    render(<InsightCard insight={makeInsight()} index={0} isDark={true} />);
    fireEvent.click(screen.getByLabelText("Show chessboard"));
    fireEvent.click(screen.getByLabelText("Hide chessboard"));
    expect(screen.queryByRole("application")).toBeNull();
  });

  it("shows ECO code when present", () => {
    render(<InsightCard insight={makeInsight()} index={0} isDark={true} />);
    expect(screen.getByText("C65")).toBeTruthy();
  });

  it("shows move count hint after board is opened", () => {
    render(<InsightCard insight={makeInsight()} index={0} isDark={true} />);
    fireEvent.click(screen.getByLabelText("Show chessboard"));
    expect(screen.getByText(/Showing \d+ moves/)).toBeTruthy();
  });

  it("deviation_point insight shows ply info in move count hint", () => {
    const insight = makeInsight({ kind: "deviation_point", ply: 4 });
    render(<InsightCard insight={insight} index={0} isDark={true} />);
    fireEvent.click(screen.getByLabelText("Show chessboard"));
    expect(screen.getByText(/deviation at ply 5/)).toBeTruthy();
  });

  it("collapsed InsightCard (index >= 3) does not show board", () => {
    render(<InsightCard insight={makeInsight()} index={5} isDark={true} />);
    expect(screen.queryByLabelText("Show chessboard")).toBeNull();
  });

  it("expanding a collapsed card reveals the Board toggle", () => {
    render(<InsightCard insight={makeInsight()} index={5} isDark={true} />);
    const header = screen.getByRole("button", { name: /Ruy Lopez/i });
    fireEvent.click(header);
    expect(screen.getByLabelText("Show chessboard")).toBeTruthy();
  });

  it("board inside InsightCard has Play button", () => {
    render(<InsightCard insight={makeInsight()} index={0} isDark={true} />);
    fireEvent.click(screen.getByLabelText("Show chessboard"));
    expect(screen.getByLabelText("Start auto-play")).toBeTruthy();
  });
});
