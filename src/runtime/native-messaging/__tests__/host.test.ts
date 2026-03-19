import { describe, expect, it } from "vitest";

import {
  createBridgeForwardRequest,
  createBridgeOpenRequest
} from "../protocol.js";
import { SocketNativeBridgeTransport } from "../host.js";

const invalidSocketPath = `/tmp/webenvoy-invalid-${process.pid}.sock`;

describe("socket native bridge transport classification", () => {
  it("classifies open/connect failure as handshake failed", async () => {
    const transport = new SocketNativeBridgeTransport(invalidSocketPath);

    await expect(
      transport.open(
        createBridgeOpenRequest({
          id: "open-invalid-001",
          profile: "profile-a",
          timeoutMs: 100
        })
      )
    ).rejects.toMatchObject({
      transportCode: "ERR_TRANSPORT_HANDSHAKE_FAILED"
    });
  });

  it("classifies forward connect failure as disconnected", async () => {
    const transport = new SocketNativeBridgeTransport(invalidSocketPath);

    await expect(
      transport.forward(
        createBridgeForwardRequest({
          id: "forward-invalid-001",
          profile: "profile-a",
          sessionId: "nm-session-001",
          runId: "run-forward-invalid-001",
          command: "runtime.ping",
          commandParams: {},
          cwd: "/tmp",
          timeoutMs: 100
        })
      )
    ).rejects.toMatchObject({
      transportCode: "ERR_TRANSPORT_DISCONNECTED"
    });
  });
});
