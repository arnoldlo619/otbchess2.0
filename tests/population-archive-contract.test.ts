import { describe, expect, it } from "vitest";
import { discoverOfficialArchiveCatalog, ingestionGate } from "../server/population/archive";

describe("population archive operations contract", () => {
  const filename = "lichess_db_standard_rated_2026-07.pgn.zst";
  const archiveUrl = `https://database.lichess.org/standard/${filename}`;
  const checksum = "b".repeat(64);

  it("discovers only the strict official list/checksum intersection", async () => {
    const seen: string[] = [];
    const catalog = await discoverOfficialArchiveCatalog(async (url) => {
      seen.push(url);
      return new Response(url.endsWith("list.txt") ? `${archiveUrl}\nhttps://evil.example/${filename}` : `${checksum}  ${filename}\n`);
    });
    expect(seen).toEqual([
      "https://database.lichess.org/standard/list.txt",
      "https://database.lichess.org/standard/sha256sums.txt",
    ]);
    expect(catalog).toEqual([{ filename, month: "2026-07", url: archiveUrl, expectedSha256: checksum }]);
  });

  it("refuses any full import unless an explicitly approved batch runtime has a bounded archive budget", () => {
    expect(ingestionGate({ POPULATION_INGESTION_APPROVED: "1", POPULATION_INGESTION_ENV: "autoscale", POPULATION_INGESTION_MAX_ARCHIVE_BYTES: "999999999" }, 10)).toMatchObject({ allowed: false });
    expect(ingestionGate({ POPULATION_INGESTION_APPROVED: "0", POPULATION_INGESTION_ENV: "batch", POPULATION_INGESTION_MAX_ARCHIVE_BYTES: "999999999" }, 10)).toMatchObject({ allowed: false });
    expect(ingestionGate({ POPULATION_INGESTION_APPROVED: "1", POPULATION_INGESTION_ENV: "batch", POPULATION_INGESTION_MAX_ARCHIVE_BYTES: "9" }, 10)).toMatchObject({ allowed: false });
    expect(ingestionGate({ POPULATION_INGESTION_APPROVED: "1", POPULATION_INGESTION_ENV: "batch", POPULATION_INGESTION_MAX_ARCHIVE_BYTES: "10" }, 10)).toEqual({ allowed: true });
  });
});
