import { readFileSync, readdirSync } from "node:fs";
import { relative, resolve } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const clientRoot = resolve(import.meta.dirname, "..");
const formTags = new Set(["input", "select", "textarea"]);

function tsxFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = resolve(directory, entry.name);
    if (entry.isDirectory()) return tsxFiles(fullPath);
    return entry.name.endsWith(".tsx") ? [fullPath] : [];
  });
}

function tagName(node: ts.JsxElement | ts.JsxSelfClosingElement): string {
  return (ts.isJsxElement(node) ? node.openingElement.tagName : node.tagName).getText();
}

function attributes(node: ts.JsxElement | ts.JsxSelfClosingElement): ts.JsxAttributes {
  return ts.isJsxElement(node) ? node.openingElement.attributes : node.attributes;
}

function attribute(node: ts.JsxElement | ts.JsxSelfClosingElement, name: string): ts.JsxAttribute | undefined {
  return attributes(node).properties.find(
    (property): property is ts.JsxAttribute => ts.isJsxAttribute(property) && property.name.getText() === name,
  );
}

function attributeValue(node: ts.JsxElement | ts.JsxSelfClosingElement, name: string): string | null {
  const value = attribute(node, name)?.initializer;
  if (!value) return null;
  if (ts.isStringLiteral(value)) return value.text;
  if (ts.isJsxExpression(value) && value.expression) return value.expression.getText();
  return null;
}

function hasAttribute(node: ts.JsxElement | ts.JsxSelfClosingElement, name: string): boolean {
  return Boolean(attribute(node, name));
}

function isWrappedByLabel(node: ts.Node): boolean {
  let parent = node.parent;
  while (parent) {
    if (ts.isJsxElement(parent) && parent.openingElement.tagName.getText() === "label") return true;
    parent = parent.parent;
  }
  return false;
}

function auditFormLabels(filePath: string): string[] {
  const sourceText = readFileSync(filePath, "utf8");
  const source = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const findings: string[] = [];
  const labelTargets = new Set<string>();

  function collectLabels(node: ts.Node): void {
    if (ts.isJsxElement(node) && node.openingElement.tagName.getText() === "label") {
      const target = attributeValue(node, "htmlFor");
      if (target) labelTargets.add(target);
    }
    ts.forEachChild(node, collectLabels);
  }

  function visit(node: ts.Node): void {
    if (ts.isJsxText(node) && /aria-label\s*=/.test(node.getText(source))) {
      const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
      findings.push(`${relative(clientRoot, filePath)}:${line} aria-label rendered as text`);
    }

    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
      const name = tagName(node);
      if (formTags.has(name)) {
        const type = attributeValue(node, "type");
        const id = attributeValue(node, "id");
        const hasSpread = attributes(node).properties.some(ts.isJsxSpreadAttribute);
        const hasExplicitName = ["aria-label", "aria-labelledby", "title"].some((key) => hasAttribute(node, key));
        const hasAssociatedLabel = Boolean(id && labelTargets.has(id));

        if (type !== "hidden" && !hasExplicitName && !hasAssociatedLabel && !isWrappedByLabel(node) && !hasSpread) {
          const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
          findings.push(`${relative(clientRoot, filePath)}:${line} ${name} missing associated label`);
        }
      }
    }
    ts.forEachChild(node, visit);
  }

  collectLabels(source);
  visit(source);
  return findings;
}

describe("repository native form labels", () => {
  it("gives every visible native input, select, and textarea an accessible label", () => {
    const findings = tsxFiles(clientRoot).flatMap(auditFormLabels);
    expect(findings, findings.join("\n")).toEqual([]);
  });
});
