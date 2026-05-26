/**
 * Tests for ChessnutWebBluetoothAdapter auto-reconnect with exponential backoff.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock navigator.bluetooth
const mockGattConnect = vi.fn();
const mockGattDisconnect = vi.fn();
const mockGetPrimaryServices = vi.fn().mockResolvedValue([]);

const mockDevice = {
  name: "Chessnut Pro",
  id: "test-device-123",
  gatt: {
    connect: mockGattConnect,
    connected: true,
  },
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
};

const mockRequestDevice = vi.fn().mockResolvedValue(mockDevice);

vi.stubGlobal("navigator", {
  bluetooth: {
    requestDevice: mockRequestDevice,
  },
});

// Import after mocking
import { ChessnutWebBluetoothAdapter } from "../client/src/lib/ChessnutWebBluetoothAdapter";

describe("ChessnutWebBluetoothAdapter — Auto-Reconnect", () => {
  let adapter: ChessnutWebBluetoothAdapter;
  let disconnectHandler: (() => void) | null = null;

  beforeEach(() => {
    vi.useFakeTimers();
    adapter = new ChessnutWebBluetoothAdapter("broadcast-123", "", false);

    // Capture the gattserverdisconnected listener
    mockDevice.addEventListener.mockImplementation((event: string, handler: () => void) => {
      if (event === "gattserverdisconnected") {
        disconnectHandler = handler;
      }
    });

    // Mock successful GATT connect — returns a server-like object
    mockGattConnect.mockResolvedValue({
      connected: true,
      disconnect: mockGattDisconnect,
      getPrimaryServices: mockGetPrimaryServices,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    disconnectHandler = null;
  });

  it("should include reconnect fields in AdapterState", () => {
    const state = adapter.getStatus();
    expect(state).toHaveProperty("reconnectAttempt", 0);
    expect(state).toHaveProperty("reconnectMaxAttempts", 3);
    expect(state).toHaveProperty("reconnectNextRetryMs", null);
  });

  it("should set status to 'reconnecting' on unexpected disconnect", async () => {
    await adapter.connect();
    expect(disconnectHandler).not.toBeNull();

    // Simulate unexpected disconnect
    disconnectHandler!();

    const state = adapter.getStatus();
    expect(state.status).toBe("reconnecting");
    expect(state.reconnectAttempt).toBe(1);
    expect(state.reconnectNextRetryMs).toBe(1000);
  });

  it("should use exponential backoff: 1s, 2s, 4s", async () => {
    await adapter.connect();

    // First disconnect → 1s backoff
    disconnectHandler!();
    expect(adapter.getStatus().reconnectNextRetryMs).toBe(1000);
    expect(adapter.getStatus().reconnectAttempt).toBe(1);

    // Simulate failed reconnect (GATT connect throws)
    mockGattConnect.mockRejectedValueOnce(new Error("Connection failed"));
    await vi.advanceTimersByTimeAsync(1000);

    // Second attempt → 2s backoff
    const state2 = adapter.getStatus();
    expect(state2.reconnectAttempt).toBe(2);
    expect(state2.reconnectNextRetryMs).toBe(2000);

    // Simulate another failed reconnect
    mockGattConnect.mockRejectedValueOnce(new Error("Connection failed"));
    await vi.advanceTimersByTimeAsync(2000);

    // Third attempt → 4s backoff
    const state3 = adapter.getStatus();
    expect(state3.reconnectAttempt).toBe(3);
    expect(state3.reconnectNextRetryMs).toBe(4000);
  });

  it("should give up after max attempts and emit error", async () => {
    await adapter.connect();

    // Fail all reconnect attempts
    mockGattConnect.mockRejectedValue(new Error("Connection failed"));

    disconnectHandler!(); // starts attempt 1 (1s timer)
    await vi.advanceTimersByTimeAsync(1000); // fires attempt 1 → fails → starts attempt 2 (2s timer)
    await vi.advanceTimersByTimeAsync(2000); // fires attempt 2 → fails → starts attempt 3 (4s timer)
    await vi.advanceTimersByTimeAsync(4000); // fires attempt 3 → fails → gives up

    const state = adapter.getStatus();
    // After giving up, _emitError sets status to "error" (via _emitError path)
    // and the error message should mention auto-reconnect failure
    expect(state.errorMessage).toContain("Auto-reconnect failed");
    expect(state.reconnectAttempt).toBe(0); // reset after giving up
  });

  it("should not auto-reconnect on intentional disconnect", async () => {
    await adapter.connect();

    // Intentional disconnect
    adapter.disconnect();

    // Even if the disconnect handler fires, it should not reconnect
    if (disconnectHandler) disconnectHandler();

    const state = adapter.getStatus();
    expect(state.status).toBe("disconnected");
    expect(state.reconnectAttempt).toBe(0);
  });

  it("should cancel reconnect when disconnect() is called during reconnect", async () => {
    await adapter.connect();

    // Trigger unexpected disconnect
    disconnectHandler!();
    expect(adapter.getStatus().status).toBe("reconnecting");

    // Now intentionally disconnect (cancel)
    adapter.disconnect();

    const state = adapter.getStatus();
    expect(state.status).toBe("disconnected");
    expect(state.reconnectAttempt).toBe(0);
    expect(state.reconnectNextRetryMs).toBeNull();
  });

  it("should reset reconnect counter on successful reconnect", async () => {
    await adapter.connect();

    // Trigger unexpected disconnect
    disconnectHandler!();
    expect(adapter.getStatus().reconnectAttempt).toBe(1);

    // Simulate successful reconnect
    mockGattConnect.mockResolvedValueOnce({
      connected: true,
      disconnect: mockGattDisconnect,
      getPrimaryServices: mockGetPrimaryServices,
    });

    await vi.advanceTimersByTimeAsync(1000);

    const state = adapter.getStatus();
    expect(state.reconnectAttempt).toBe(0);
    expect(state.reconnectNextRetryMs).toBeNull();
  });

  it("should respect setAutoReconnect(false)", async () => {
    await adapter.connect();

    adapter.setAutoReconnect(false);
    disconnectHandler!();

    const state = adapter.getStatus();
    // When auto-reconnect is disabled, _attemptReconnect calls _emitError
    expect(state.errorMessage).toContain("Auto-reconnect disabled");
    expect(state.reconnectAttempt).toBe(0);
  });
});
