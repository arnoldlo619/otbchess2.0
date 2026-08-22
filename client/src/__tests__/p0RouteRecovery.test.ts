import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const clientRoot = resolve(import.meta.dirname, "..");
const appSource = readFileSync(resolve(clientRoot, "App.tsx"), "utf8");
const homeSource = readFileSync(resolve(clientRoot, "pages/Home.tsx"), "utf8");
const archiveSource = readFileSync(resolve(clientRoot, "pages/Archive.tsx"), "utf8");

describe("P0 canonical route recovery", () => {
  it("routes create and tools aliases through visible, query-preserving redirects", () => {
    expect(appSource).toContain('<Route path={"/tournaments/new"} component={() => <HardRedirect to="/" tournamentCreate />} />');
    expect(appSource).toContain('<Route path={"/create"} component={() => <HardRedirect to="/tournaments/new" />} />');
    expect(appSource).toContain('<Route path={"/tools"} component={() => <HardRedirect to="/training" />} />');
    expect(appSource).not.toContain('window.location.replace("/tournaments/new")');
    expect(appSource).not.toContain('window.location.replace("/training")');
  });

  it("opens the Home tournament wizard while retaining non-action query context", () => {
    expect(homeSource).toContain('params.get("action") === "create"');
    expect(homeSource).toContain("stripCreateAction(window.location.search, window.location.hash)");
  });

  it("keeps the public tournament Archive free of the former password gate", () => {
    expect(archiveSource).not.toContain("VITE_ARCHIVE_ADMIN_PASSWORD");
    expect(archiveSource).not.toMatch(/admin\s*password/i);
    expect(archiveSource).not.toMatch(/password\s*gate/i);
  });
});
