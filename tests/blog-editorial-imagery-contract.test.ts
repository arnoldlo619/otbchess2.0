import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const blogPost = readFileSync(resolve(process.cwd(), "client/src/pages/BlogPost.tsx"), "utf8");

describe("BlogPost premium editorial imagery", () => {
  it("replaces generic Unsplash post images with managed editorial assets", () => {
    const postImageSources = [...blogPost.matchAll(/^\s+image: "([^"]+)"/gm)].map((match) => match[1]);
    expect(postImageSources.filter((src) => src.includes("images.unsplash.com"))).toEqual([]);
    expect(postImageSources.filter((src) => src.includes("blog-editorial-"))).toHaveLength(6);
  });

  it("gives related article cards an editorial image overlay and category treatment", () => {
    expect(blogPost).toContain("bg-gradient-to-t from-[#082217]/65");
    expect(blogPost).toContain("Journal · {rel.category}");
    expect(blogPost).toContain("group-hover:scale-[1.07]");
  });
});
