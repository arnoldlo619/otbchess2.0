import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const carousel = readFileSync(resolve(process.cwd(), "client/src/components/InstagramCarouselModal.tsx"), "utf8");
const podiumSource = carousel.slice(carousel.indexOf("function Slide2Podium"), carousel.indexOf("// ─── Slide 3"));

describe("Instagram carousel podium player identities", () => {
  it("reserves a two-line name block before rendering the username", () => {
    expect(podiumSource).toContain("const nameBlockHeight = nameSize * 2.08");
    expect(podiumSource).toContain("minHeight: nameBlockHeight");
    expect(podiumSource).toContain("WebkitLineClamp: 2");
    expect(podiumSource).toContain('overflowWrap: "anywhere"');
  });

  it("prevents long usernames from colliding with names or overflowing their column", () => {
    expect(podiumSource).toContain("minHeight: usernameSize * 1.2");
    expect(podiumSource).toContain('textOverflow: "ellipsis"');
    expect(podiumSource).toContain('whiteSpace: "nowrap"');
  });
});
