// @vitest-environment jsdom
/**
 * MiniChessBoard + InsightCard board integration tests
 */
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
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

// ── MiniChessBoard tests ───────────────────────────────────────────────────────

describe("MiniChessBoard", () => {
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

  it("renders piece glyphs as text elements", () => {
    const { container } = render(
      <MiniChessBoard sanLine="" isDark={true} />
    );
    // Starting position has 32 pieces
    const texts = container.querySelectorAll("svg text");
    // 32 pieces + 8 rank labels + 8 file labels = 48
    expect(texts.length).toBeGreaterThanOrEqual(32);
  });

  it("shows Previous and Next buttons", () => {
    render(<MiniChessBoard sanLine="e4 e5 Nf3" isDark={true} />);
    expect(screen.getByLabelText("Previous move")).toBeTruthy();
    expect(screen.getByLabelText("Next move")).toBeTruthy();
  });

  it("shows Flip board button", () => {
    render(<MiniChessBoard sanLine="e4 e5" isDark={true} />);
    expect(screen.getByLabelText("Flip board")).toBeTruthy();
  });

  it("shows Go to start button", () => {
    render(<MiniChessBoard sanLine="e4 e5" isDark={true} />);
    expect(screen.getByLabelText("Go to start")).toBeTruthy();
  });

  it("Previous button is disabled at start position", () => {
    render(<MiniChessBoard sanLine="e4 e5 Nf3" isDark={true} />);
    const prevBtn = screen.getByLabelText("Previous move") as HTMLButtonElement;
    // Click back to start
    fireEvent.click(screen.getByLabelText("Go to start"));
    expect(prevBtn.disabled).toBe(true);
  });

  it("Next button is disabled at end of line", () => {
    render(<MiniChessBoard sanLine="e4 e5 Nf3" isDark={true} />);
    const nextBtn = screen.getByLabelText("Next move") as HTMLButtonElement;
    expect(nextBtn.disabled).toBe(true); // starts at end
  });

  it("clicking Previous enables Next button", () => {
    render(<MiniChessBoard sanLine="e4 e5 Nf3" isDark={true} />);
    const prevBtn = screen.getByLabelText("Previous move");
    const nextBtn = screen.getByLabelText("Next move") as HTMLButtonElement;
    fireEvent.click(prevBtn);
    expect(nextBtn.disabled).toBe(false);
  });

  it("clicking Flip board toggles orientation", () => {
    render(<MiniChessBoard sanLine="e4" isDark={true} playerColor="white" />);
    const flipBtn = screen.getByLabelText("Flip board");
    // Just confirm it doesn't throw
    expect(() => fireEvent.click(flipBtn)).not.toThrow();
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
});

// ── InsightCard board integration tests ───────────────────────────────────────

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
    // index=0 starts expanded
    expect(screen.getByLabelText("Show chessboard")).toBeTruthy();
  });

  it("clicking Board toggle reveals the MiniChessBoard", () => {
    render(<InsightCard insight={makeInsight()} index={0} isDark={true} />);
    const toggleBtn = screen.getByLabelText("Show chessboard");
    fireEvent.click(toggleBtn);
    // MiniChessBoard has role=application
    expect(screen.getByRole("application")).toBeTruthy();
  });

  it("clicking Board toggle again hides the MiniChessBoard", () => {
    render(<InsightCard insight={makeInsight()} index={0} isDark={true} />);
    const toggleBtn = screen.getByLabelText("Show chessboard");
    fireEvent.click(toggleBtn); // show
    fireEvent.click(screen.getByLabelText("Hide chessboard")); // hide
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
    const insight = makeInsight({
      kind: "deviation_point",
      ply: 4,
    });
    render(<InsightCard insight={insight} index={0} isDark={true} />);
    fireEvent.click(screen.getByLabelText("Show chessboard"));
    expect(screen.getByText(/deviation at ply 5/)).toBeTruthy();
  });

  it("collapsed InsightCard (index >= 3) does not show board", () => {
    render(<InsightCard insight={makeInsight()} index={5} isDark={true} />);
    // Board toggle is inside the expanded body — not visible when collapsed
    expect(screen.queryByLabelText("Show chessboard")).toBeNull();
  });

  it("expanding a collapsed card reveals the Board toggle", () => {
    render(<InsightCard insight={makeInsight()} index={5} isDark={true} />);
    // Click the header to expand
    const header = screen.getByRole("button", { name: /Ruy Lopez/i });
    fireEvent.click(header);
    expect(screen.getByLabelText("Show chessboard")).toBeTruthy();
  });
});
