import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { applyClubFeedTextFormat, ClubFeedRichText, sanitizeClubFeedUrl } from "./ClubFeedRichText";

describe("ClubFeedRichText", () => {
  it("writes a compact, persistent syntax for all supported formatting actions", () => {
    expect(applyClubFeedTextFormat("club update", 0, 4, "bold").value).toBe("**club** update");
    expect(applyClubFeedTextFormat("club update", 0, 4, "italic").value).toBe("*club* update");
    expect(applyClubFeedTextFormat("club update", 0, 4, "underline").value).toBe("__club__ update");
    expect(applyClubFeedTextFormat("First\nSecond", 0, 12, "bulletList").value).toBe("- First\n- Second");
    expect(applyClubFeedTextFormat("First\nSecond", 0, 12, "numberList").value).toBe("1. First\n2. Second");
    expect(applyClubFeedTextFormat("club update", 0, 4, "quote").value).toBe("> club update");
    expect(applyClubFeedTextFormat("club update", 0, 4, "code").value).toBe("`club` update");
    expect(applyClubFeedTextFormat("club update", 0, 4, "link", "https://chessotb.club").value).toBe("[club](https://chessotb.club/) update");
  });

  it("clears selected syntax without changing the selected message copy", () => {
    expect(applyClubFeedTextFormat("**Club** *update*", 0, 17, "clear").value).toBe("Club update");
  });

  it("accepts only HTTP(S) links and renders formatted announcements through React nodes", () => {
    expect(sanitizeClubFeedUrl("javascript:alert(1)")).toBeNull();
    expect(sanitizeClubFeedUrl("https://chessotb.club/news")).toBe("https://chessotb.club/news");

    const html = renderToStaticMarkup(
      <ClubFeedRichText
        value={"**Club update**\n- Bring clocks\n- [Register](https://chessotb.club/register)"}
        accent="#4CAF50"
      />,
    );
    expect(html).toContain("<strong");
    expect(html).toContain("<ul");
    expect(html).toContain('href="https://chessotb.club/register"');
    expect(html).toContain('rel="noreferrer"');
  });
});
