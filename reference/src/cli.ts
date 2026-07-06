// src/cli.ts — usage:
//   npx tsx src/cli.ts --provider chesscom --user hikaru                 (live, needs internet)
//   npx tsx src/cli.ts --provider lichess  --user someuser               (live, needs internet)
//   npx tsx src/cli.ts --user jobavabot --fixture fixtures/chesscom_jobavabot.json
import { writeFileSync } from "node:fs";
import { DEFAULT_OPTS, getGames } from "./providers.ts";
import { buildReport } from "./engine.ts";
import { renderMarkdown } from "./render.ts";
import type { Provider } from "./types.ts";

const arg = (k: string, d?: string) => { const i = process.argv.indexOf(`--${k}`); return i > -1 ? process.argv[i + 1] : d; };
const provider = (arg("provider", "chesscom") as Provider);
const user = arg("user"); const fixture = arg("fixture");
const tc = (arg("tc", "rapid,blitz")!).split(",");
if (!user) { console.error("--user required"); process.exit(1); }

const opts = { ...DEFAULT_OPTS, timeClasses: tc, maxGames: Number(arg("games", "100")) };
const raw = await getGames(fixture ? (fixture.endsWith(".ndjson") ? "lichess" : "chesscom") : provider, user, opts, fixture);
const report = buildReport(fixture?.endsWith(".ndjson") ? "lichess" : provider, user, raw, opts);
const base = `examples/${user}_${report.provider}`;
writeFileSync(`${base}.json`, JSON.stringify(report, null, 1));
writeFileSync(`${base}.md`, renderMarkdown(report));
console.log(`OK ${user} [${report.provider}] usable=${report.dataQuality.parsed}/${report.dataQuality.fetched} grade=${report.dataQuality.grade} insights=${report.insights.length} dropped=${report.guardLog.droppedInsights} → ${base}.md`);
