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
    const added: Array<{ type: string; listener: MockEventListener }> = [];
    const removed: Array<{ type: string; listener: MockEventListener }> = [];
    const mockWindow = {
      addEventListener: (type: string, listener: MockEventListener) => {
        added.push({ type, listener });
      },
      removeEventListener: (type: string, listener: MockEventListener) => {
        removed.push({ type, listener });
      },
      dispatchEvent: () => true
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

    const hook = (
      mockWindow as unknown as Record<string, (requestEvent: string, resultEvent: string) => boolean>
    ).__webenvoy_attachMainWorldEventChannel__;
    expect(typeof hook).toBe("function");

    expect(hook("__mw_req__secret_a", "__mw_res__secret_a")).toBe(true);
    expect(hook("__mw_req__secret_b", "__mw_res__secret_b")).toBe(true);

    expect(added.map((entry) => entry.type)).toEqual([
      "__mw_req__secret_a",
      "__mw_req__secret_b"
    ]);
    expect(removed).toHaveLength(1);
    expect(removed[0]?.type).toBe("__mw_req__secret_a");
    expect(removed[0]?.listener).toBe(added[0]?.listener);
  });
});
