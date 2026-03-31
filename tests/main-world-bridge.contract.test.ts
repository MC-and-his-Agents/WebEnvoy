import { afterEach, describe, expect, it, vi } from "vitest";

type MockEventListener = (event: Event) => void;

describe("main-world bridge contract", () => {
  afterEach(() => {
    vi.resetModules();
    delete (globalThis as { window?: unknown }).window;
    delete (globalThis as { document?: unknown }).document;
    delete (globalThis as { CustomEvent?: unknown }).CustomEvent;
  });

  it("rebinds the active channel when runtime.bootstrap rotates the secret", async () => {
    const controlMessageScope = "webenvoy.main_world.bridge.control.v1";
    const added: Array<{ type: string; listener: MockEventListener }> = [];
    const removed: Array<{ type: string; listener: MockEventListener }> = [];
    const listeners = new Map<string, MockEventListener[]>();
    const mockWindow = {
      addEventListener: (type: string, listener: MockEventListener) => {
        added.push({ type, listener });
        listeners.set(type, [...(listeners.get(type) ?? []), listener]);
      },
      removeEventListener: (type: string, listener: MockEventListener) => {
        removed.push({ type, listener });
        listeners.set(
          type,
          (listeners.get(type) ?? []).filter((candidate) => candidate !== listener)
        );
      },
      dispatchEvent: (event: Event) => {
        for (const listener of listeners.get(event.type) ?? []) {
          listener(event);
        }
        return true;
      }
    };
    const mockDocument = {
      createElement: () => ({ textContent: "", remove: () => {} }),
      documentElement: {
        appendChild: (node: unknown) => node
      }
    };

    (globalThis as { window?: unknown }).window = mockWindow;
    (globalThis as { document?: unknown }).document = mockDocument;
    (globalThis as { CustomEvent?: unknown }).CustomEvent = class MockCustomEvent<T> {
      readonly type: string;
      readonly detail: T;

      constructor(type: string, init: { detail: T }) {
        this.type = type;
        this.detail = init.detail;
      }
    };

    await import("../extension/main-world-bridge.js");

    const firstPort = {
      postMessage: vi.fn(),
      close: vi.fn()
    };
    const secondPort = {
      postMessage: vi.fn(),
      close: vi.fn()
    };
    const firstControlRequest = {
      type: "message",
      source: mockWindow,
      data: {
        scope: controlMessageScope,
        kind: "attach-channel",
        requestEvent: "__mw_req__secret_a",
        resultEvent: "__mw_res__secret_a"
      },
      ports: [firstPort]
    } as unknown as Event;
    const secondControlRequest = {
      type: "message",
      source: mockWindow,
      data: {
        scope: controlMessageScope,
        kind: "attach-channel",
        requestEvent: "__mw_req__secret_b",
        resultEvent: "__mw_res__secret_b"
      },
      ports: [secondPort]
    } as unknown as Event;

    mockWindow.dispatchEvent(firstControlRequest);
    mockWindow.dispatchEvent(secondControlRequest);

    expect(firstPort.postMessage).toHaveBeenCalledWith({
      ok: true,
      attached: true
    });
    expect(secondPort.postMessage).toHaveBeenCalledWith({
      ok: true,
      attached: true
    });
    expect(firstPort.close).toHaveBeenCalledTimes(1);
    expect(secondPort.close).toHaveBeenCalledTimes(1);

    expect(added.map((entry) => entry.type)).toEqual([
      "message",
      "__mw_req__secret_a",
      "__mw_req__secret_b"
    ]);
    expect(removed).toHaveLength(1);
    expect(removed[0]?.type).toBe("__mw_req__secret_a");
    expect(removed[0]?.listener).toBe(added[1]?.listener);
  });
});
