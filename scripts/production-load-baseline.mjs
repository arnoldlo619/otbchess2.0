import { writeFile } from "node:fs/promises";
import process from "node:process";

const TARGET = "https://chessotb.club";
const ROUTES = ["/", "/clubs", "/tournament/otb-open-2026", "/api/clubs"];
const PHASES = [
  { name: "warm-up", users: 5, durationMs: 30_000 },
  { name: "baseline", users: 15, durationMs: 60_000 },
  { name: "peak", users: 30, durationMs: 60_000 },
];
const STOP = { errorRate: 0.01, p95Ms: 1_500, minSamples: 20 };
const REQUEST_TIMEOUT_MS = 10_000;
const SSE_SAMPLE_CONNECTIONS = 5;

function percentile(values, point) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * point) - 1)];
}

function summarize(samples) {
  const latencies = samples.map((sample) => sample.durationMs);
  const failures = samples.filter((sample) => !sample.ok);
  const statusCounts = Object.fromEntries(
    [...new Set(samples.map((sample) => String(sample.status)))].map((status) => [
      status,
      samples.filter((sample) => String(sample.status) === status).length,
    ]),
  );
  return {
    requests: samples.length,
    failures: failures.length,
    errorRate: samples.length === 0 ? 0 : failures.length / samples.length,
    p50Ms: percentile(latencies, 0.5),
    p95Ms: percentile(latencies, 0.95),
    maxMs: Math.max(0, ...latencies),
    statusCounts,
  };
}

async function fetchSample(path) {
  const started = performance.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${TARGET}${path}`, {
      headers: { "user-agent": "ChessOTB-authorized-load-baseline/1.0" },
      signal: controller.signal,
    });
    await response.arrayBuffer();
    return { path, status: response.status, ok: response.ok, durationMs: Math.round(performance.now() - started) };
  } catch (error) {
    return { path, status: "network_error", ok: false, durationMs: Math.round(performance.now() - started), error: error instanceof Error ? error.name : "unknown" };
  } finally {
    clearTimeout(timeout);
  }
}

async function sampleSse(clubId) {
  const started = performance.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3_000);
  try {
    const response = await fetch(`${TARGET}/api/clubs/${encodeURIComponent(clubId)}/stream`, {
      headers: { accept: "text/event-stream", "user-agent": "ChessOTB-authorized-load-baseline/1.0" },
      signal: controller.signal,
    });
    const contentType = response.headers.get("content-type") ?? "";
    const reader = response.body?.getReader();
    const first = reader ? await reader.read() : { value: undefined };
    reader?.cancel();
    const bodyStart = first.value ? new TextDecoder().decode(first.value) : "";
    return {
      status: response.status,
      ok: response.ok && contentType.includes("text/event-stream") && bodyStart.includes(": connected"),
      durationMs: Math.round(performance.now() - started),
      contentType,
    };
  } catch (error) {
    return { status: "network_error", ok: false, durationMs: Math.round(performance.now() - started), error: error instanceof Error ? error.name : "unknown" };
  } finally {
    clearTimeout(timeout);
  }
}

async function resolveClubId() {
  const response = await fetch(`${TARGET}/api/clubs`, { headers: { "user-agent": "ChessOTB-authorized-load-baseline/1.0" } });
  const payload = await response.json();
  const clubs = Array.isArray(payload) ? payload : payload?.clubs;
  const club = Array.isArray(clubs) ? clubs.find((candidate) => typeof candidate?.id === "string") : null;
  if (!club?.id) throw new Error("No public club identifier available for SSE baseline");
  return club.id;
}

async function runPhase(phase, clubId) {
  const samples = [];
  const deadline = Date.now() + phase.durationMs;
  let stopReason = null;
  let routeCursor = 0;
  const nextRoute = () => {
    const route = ROUTES[routeCursor % ROUTES.length];
    routeCursor += 1;
    return route;
  };

  const sseSamples = await Promise.all(
    Array.from({ length: Math.min(SSE_SAMPLE_CONNECTIONS, phase.users) }, () => sampleSse(clubId)),
  );

  async function worker() {
    while (Date.now() < deadline && !stopReason) {
      const sample = await fetchSample(nextRoute());
      samples.push(sample);
      if (samples.length >= STOP.minSamples) {
        const summary = summarize(samples);
        if (summary.errorRate > STOP.errorRate) stopReason = `error rate ${(summary.errorRate * 100).toFixed(2)}% exceeded 1.00%`;
        if (summary.p95Ms > STOP.p95Ms) stopReason = `p95 ${summary.p95Ms}ms exceeded ${STOP.p95Ms}ms`;
      }
    }
  }

  await Promise.all(Array.from({ length: phase.users }, worker));
  return { phase, http: summarize(samples), sse: summarize(sseSamples), stopReason };
}

const startedAt = new Date().toISOString();
const clubId = await resolveClubId();
const phases = [];
for (const phase of PHASES) {
  const result = await runPhase(phase, clubId);
  phases.push(result);
  process.stdout.write(`${phase.name}: ${JSON.stringify(result)}\n`);
  if (result.stopReason) break;
}

const report = { target: TARGET, startedAt, finishedAt: new Date().toISOString(), stopThresholds: STOP, clubId, routes: ROUTES, phases };
const output = `/tmp/chessotb-load-baseline-${Date.now()}.json`;
await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`report=${output}\n`);
