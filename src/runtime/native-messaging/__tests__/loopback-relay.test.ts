import { describe, expect, it } from "vitest";

import type { ContentMessage, HostMessage } from "../loopback-messages.js";
import { createPortPair } from "../loopback-port.js";
import { InMemoryBackgroundRelay } from "../loopback-relay.js";

describe("native messaging loopback relay", () => {
  it("opens the bridge with the loopback relay path", async () => {
    const [hostPort, backgroundHostPort] = createPortPair<HostMessage>();
    const [backgroundContentPort] = createPortPair<ContentMessage>();

    new InMemoryBackgroundRelay(backgroundHostPort, backgroundContentPort);

    const open = new Promise<Record<string, unknown>>((resolve) => {
      const off = hostPort.onMessage((message) => {
        if (message.kind === "response") {
          off();
          resolve(message.envelope as Record<string, unknown>);
        }
      });
    });

    hostPort.postMessage({
      kind: "request",
      envelope: {
        id: "open-001",
        method: "bridge.open",
        profile: "profile-a",
        params: {
          protocol: "webenvoy.native-bridge.v1",
          capabilities: ["relay", "heartbeat"]
        }
      }
    });

    await expect(open).resolves.toMatchObject({
      status: "success",
      summary: {
        relay_path: "host>background>content-script>background>host"
      }
    });
  });
});
