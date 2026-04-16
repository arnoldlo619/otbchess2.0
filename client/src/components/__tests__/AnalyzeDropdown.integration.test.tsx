import { describe, it, expect } from "vitest";
import { AnalyzeDropdown } from "../AnalyzeDropdown";

describe("AnalyzeDropdown Integration", () => {
  it("exports a valid React component", () => {
    expect(AnalyzeDropdown).toBeDefined();
    expect(typeof AnalyzeDropdown).toBe("function");
  });

  it("component renders without errors", () => {
    // Verify the component is a valid React component that can be rendered
    const component = AnalyzeDropdown();
    expect(component).toBeDefined();
    expect(component.type).toBe("div");
  });

  it("renders dropdown with correct structure", () => {
    const component = AnalyzeDropdown();
    
    // Verify the component returns a div with the expected classes
    expect(component.props.className).toContain("rounded-lg");
    expect(component.props.className).toContain("shadow-lg");
  });

  it("has four children: Analysis link, Matchup Prep link, divider, and Openings link", () => {
    const component = AnalyzeDropdown();
    const children = component.props.children;
    // Analysis Link, Matchup Prep Link, divider div, Openings Link
    expect(Array.isArray(children)).toBe(true);
    expect(children.length).toBe(4);
  });

  it("first link navigates to /games (Analysis)", () => {
    const component = AnalyzeDropdown();
    const analysisLink = component.props.children[0];
    expect(analysisLink.props.href).toBe("/games");
  });

  it("second link navigates to /prep (Matchup Prep)", () => {
    const component = AnalyzeDropdown();
    const matchupLink = component.props.children[1];
    expect(matchupLink.props.href).toBe("/prep");
  });

  it("fourth child navigates to /openings (Openings Library)", () => {
    const component = AnalyzeDropdown();
    const openingsLink = component.props.children[3];
    expect(openingsLink.props.href).toBe("/openings");
  });
});
