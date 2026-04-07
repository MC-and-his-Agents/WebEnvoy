import { describe, expect, it } from "vitest";

import { createPortPair } from "../loopback-port.js";

describe("native messaging loopback port primitive", () => {
  it("delivers messages across a paired in-memory port", async () => {
    const [left, right] = createPortPair<{ kind: string; value: number }>();
    const received: Array<{ kind: string; value: number }> = [];

    right.onMessage((message) => {
      received.push(message);
    });

    left.postMessage({ kind: "ping", value: 1 });

    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });

    expect(received).toEqual([{ kind: "ping", value: 1 }]);
  });
});
