import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import ts from "typescript";

const sourceRoot = path.resolve("client/src");

function collectTsxFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const absolutePath = path.join(directory, entry);
    if (statSync(absolutePath).isDirectory()) return collectTsxFiles(absolutePath);
    return entry.endsWith(".tsx") ? [absolutePath] : [];
  });
}

function getTagName(node: ts.JsxOpeningLikeElement): string | null {
  return ts.isIdentifier(node.tagName) ? node.tagName.text : null;
}

function hasAccessibleName(node: ts.JsxOpeningLikeElement): boolean {
  return node.attributes.properties.some((property) => {
    if (!ts.isJsxAttribute(property)) return false;
    return property.name.text === "aria-label" || property.name.text === "aria-labelledby";
  });
}

describe("application landmark semantics", () => {
  const landmarks = collectTsxFiles(sourceRoot).flatMap((absolutePath) => {
    const source = readFileSync(absolutePath, "utf8");
    const sourceFile = ts.createSourceFile(absolutePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const found: Array<{ file: string; line: number; tag: string; named: boolean }> = [];

    const visit = (node: ts.Node) => {
      if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
        const tag = getTagName(node);
        if (tag && ["main", "nav", "header", "footer"].includes(tag)) {
          found.push({
            file: path.relative(sourceRoot, absolutePath),
            line: sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1,
            tag,
            named: hasAccessibleName(node),
          });
        }
      }
      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
    return found;
  });

  it("keeps one application-level main landmark and no page-level nested mains", () => {
    expect(landmarks.filter(({ tag }) => tag === "main")).toEqual([
      expect.objectContaining({ file: "App.tsx", tag: "main" }),
    ]);
  });

  it("gives every navigation landmark an explicit accessible name", () => {
    const unnamed = landmarks
      .filter(({ tag, named }) => tag === "nav" && !named)
      .map(({ file, line }) => `${file}:${line}`);
    expect(unnamed).toEqual([]);
  });

  it("retains semantic header and footer regions where pages define them", () => {
    expect(landmarks.some(({ tag }) => tag === "header")).toBe(true);
    expect(landmarks.some(({ tag }) => tag === "footer")).toBe(true);
  });
});
