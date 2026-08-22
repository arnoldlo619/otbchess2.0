import { readdirSync, readFileSync } from "node:fs";
import { resolve, relative } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const clientRoot = resolve(import.meta.dirname, "..");
const interactiveNames = new Set(["a", "button", "input", "select", "textarea", "Link", "Button"]);

function tsxFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = resolve(directory, entry.name);
    if (entry.isDirectory()) return tsxFiles(fullPath);
    return entry.name.endsWith(".tsx") ? [fullPath] : [];
  });
}

function jsxTagName(node: ts.JsxElement | ts.JsxSelfClosingElement): string {
  return (ts.isJsxElement(node) ? node.openingElement.tagName : node.tagName).getText();
}

function findNestedInteractives(filePath: string): string[] {
  const sourceText = readFileSync(filePath, "utf8");
  const source = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const findings: string[] = [];

  function visit(node: ts.Node, ancestors: string[] = []): void {
    let nextAncestors = ancestors;
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
      const name = jsxTagName(node);
      if (interactiveNames.has(name)) {
        if (ancestors.length > 0) {
          const { line } = source.getLineAndCharacterOfPosition(node.getStart(source));
          findings.push(`${relative(clientRoot, filePath)}:${line + 1} ${ancestors.at(-1)} > ${name}`);
        }
        nextAncestors = [...ancestors, name];
      }
    }
    ts.forEachChild(node, (child) => visit(child, nextAncestors));
  }

  visit(source);
  return findings;
}

describe("semantic interaction structure", () => {
  it("does not nest links, anchors, buttons, or form controls", () => {
    const findings = tsxFiles(clientRoot).flatMap(findNestedInteractives);
    expect(findings, findings.join("\n")).toEqual([]);
  });
});
