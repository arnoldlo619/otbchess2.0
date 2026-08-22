import { describe, expect, it } from "vitest";
import { buildPreservedRedirect, buildTournamentCreateRedirect, stripCreateAction } from "./routeRedirects";

describe("canonical route redirects", () => {
  it("preserves query parameters and hashes across legacy redirects", () => {
    expect(buildPreservedRedirect("/tournaments/new", "?utm_source=footer&format=quads", "#choose"))
      .toBe("/tournaments/new?utm_source=footer&format=quads#choose");
    expect(buildPreservedRedirect("/training", "source=nav", "tools"))
      .toBe("/training?source=nav#tools");
  });

  it("adds the internal tournament-create action without dropping source context", () => {
    expect(buildTournamentCreateRedirect("?utm_source=footer&format=quads", "#choose"))
      .toBe("/?utm_source=footer&format=quads&action=create#choose");
  });

  it("removes only the internal create action after the wizard opens", () => {
    expect(stripCreateAction("?utm_source=footer&action=create&format=quads", "#choose"))
      .toBe("/?utm_source=footer&format=quads#choose");
  });
});
