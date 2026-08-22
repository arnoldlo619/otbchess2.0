import { readFileSync, readdirSync } from "node:fs";
import { relative, resolve } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const clientRoot = resolve(import.meta.dirname, "..");
const primitiveTableFile = resolve(clientRoot, "components/ui/table.tsx");

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

function stringAttribute(node: ts.JsxElement | ts.JsxSelfClosingElement, name: string): string | null {
  const attribute = attributes(node).properties.find(
    (property): property is ts.JsxAttribute => ts.isJsxAttribute(property) && property.name.getText() === name,
  );
  return attribute?.initializer && ts.isStringLiteral(attribute.initializer) ? attribute.initializer.text : null;
}

function auditTables(filePath: string): string[] {
  if (filePath === primitiveTableFile) return [];

  const sourceText = readFileSync(filePath, "utf8");
  const source = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const findings: string[] = [];

  function visit(node: ts.Node): void {
    if ((ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) && tagName(node) === "table") {
      const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
      const location = `${relative(clientRoot, filePath)}:${line}`;
      if (stringAttribute(node, "role") === "presentation") return;

      const descendants: Array<ts.JsxElement | ts.JsxSelfClosingElement> = [];
      const collect = (child: ts.Node): void => {
        if (child !== node && (ts.isJsxElement(child) || ts.isJsxSelfClosingElement(child))) descendants.push(child);
        ts.forEachChild(child, collect);
      };
      ts.forEachChild(node, collect);

      const names = descendants.map(tagName);
      if (!names.includes("caption")) findings.push(`${location} missing caption`);
      if (!names.includes("thead")) findings.push(`${location} missing thead`);
      if (!names.includes("tbody")) findings.push(`${location} missing tbody`);

      const headers = descendants.filter((descendant) => tagName(descendant) === "th");
      headers.forEach((header) => {
        const headerLine = source.getLineAndCharacterOfPosition(header.getStart(source)).line + 1;
        const scope = stringAttribute(header, "scope");
        if (scope !== "col" && scope !== "row") {
          findings.push(`${relative(clientRoot, filePath)}:${headerLine} th missing scope`);
        }
      });
      if (!headers.some((header) => stringAttribute(header, "scope") === "row")) {
        findings.push(`${location} missing row header`);
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(source);
  return findings;
}

describe("repository table semantics", () => {
  it("gives every data table a caption, sections, and scoped row and column headers", () => {
    const findings = tsxFiles(clientRoot).flatMap(auditTables);
    expect(findings, findings.join("\n")).toEqual([]);
  });
});
