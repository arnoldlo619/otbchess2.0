// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

class FakeEventSource extends EventTarget {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSED = 2;
  readonly CONNECTING = 0;
  readonly OPEN = 1;
  readonly CLOSED = 2;
  readonly url: string;
  readonly withCredentials: boolean;
  readyState = FakeEventSource.CONNECTING;
  onopen: ((this: EventSource, ev: Event) => unknown) | null = null;
  onmessage: ((this: EventSource, ev: MessageEvent) => unknown) | null = null;
  onerror: ((this: EventSource, ev: Event) => unknown) | null = null;

  constructor(url: string | URL, init?: EventSourceInit) {
    super();
    this.url = String(url);
    this.withCredentials = init?.withCredentials ?? false;
  }

  close() {
    this.readyState = FakeEventSource.CLOSED;
  }
}

describe("EventSource operational telemetry", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-25T12:00:00.000Z"));
    Object.defineProperty(window, "EventSource", {
      configurable: true,
      writable: true,
      value: FakeEventSource,
    });
    Object.defineProperty(globalThis, "EventSource", {
      configurable: true,
      writable: true,
      value: FakeEventSource,
    });
    globalThis.fetch = vi.fn().mockResolvedValue(new Response(null, { status: 202 }));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("reports connection loss and recovery without sending the stream URL", async () => {
    const { installEventSourceTelemetry } = await import("./operationalTelemetry");
    installEventSourceTelemetry();

    const source = new EventSource("/api/tournament/private-event-name/stream") as unknown as FakeEventSource;
    source.dispatchEvent(new Event("open"));
    source.dispatchEvent(new Event("error"));
    source.dispatchEvent(new Event("error"));
    vi.advanceTimersByTime(2_500);
    source.dispatchEvent(new Event("open"));

    const requests = vi.mocked(fetch).mock.calls.map(([, init]) => (
      JSON.parse(String(init?.body)) as Record<string, unknown>
    ));
    expect(requests.map((request) => request.eventType)).toEqual([
      "sse_connected",
      "sse_disconnected",
      "sse_reconnected",
    ]);
    expect(requests[2]).toMatchObject({
      stream: "tournament_live",
      attempts: 2,
      disconnectedMs: 2_500,
    });
    expect(JSON.stringify(requests)).not.toContain("private-event-name");
  });
});
