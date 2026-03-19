import net from "node:net";

import {
  DEFAULT_TRANSPORT_TIMEOUT_MS,
  ensureBridgeRequestEnvelope,
  type BridgeRequestEnvelope,
  type BridgeResponseEnvelope
} from "./protocol.js";
import type { NativeBridgeTransport } from "./transport.js";

type TransportCodedError = Error & {
  transportCode?:
    | "ERR_TRANSPORT_HANDSHAKE_FAILED"
    | "ERR_TRANSPORT_TIMEOUT"
    | "ERR_TRANSPORT_DISCONNECTED"
    | "ERR_TRANSPORT_FORWARD_FAILED";
};

const withTransportCode = (
  error: Error,
  code: TransportCodedError["transportCode"]
): TransportCodedError => Object.assign(error, { transportCode: code });

const readSocketPath = (): string | null => {
  const value = process.env.WEBENVOY_NATIVE_BRIDGE_SOCKET;
  if (!value || value.trim().length === 0) {
    return null;
  }
  return value;
};

const parseResponse = (line: string): BridgeResponseEnvelope => {
  const parsed = JSON.parse(line) as BridgeResponseEnvelope;
  return parsed;
};

type TransportPhase = "open" | "forward" | "heartbeat";

const sendEnvelope = (
  socketPath: string,
  request: BridgeRequestEnvelope,
  phase: TransportPhase
): Promise<BridgeResponseEnvelope> =>
  new Promise((resolve, reject) => {
    const timeoutMs = request.timeout_ms ?? DEFAULT_TRANSPORT_TIMEOUT_MS;
    const socket = net.createConnection({ path: socketPath });
    let settled = false;
    let connected = false;
    let buffer = "";

    const done = (fn: () => void): void => {
      if (settled) {
        return;
      }
      settled = true;
      socket.removeAllListeners();
      socket.destroy();
      fn();
    };

    socket.setTimeout(timeoutMs, () => {
      const timeoutCode =
        !connected && phase === "open" ? "ERR_TRANSPORT_HANDSHAKE_FAILED" : "ERR_TRANSPORT_TIMEOUT";
      done(() => reject(withTransportCode(new Error("native bridge socket timeout"), timeoutCode)));
    });

    socket.on("error", (error) => {
      const connectStage = !connected;
      const code =
        connectStage && phase === "open"
          ? "ERR_TRANSPORT_HANDSHAKE_FAILED"
          : "ERR_TRANSPORT_DISCONNECTED";
      done(() => reject(withTransportCode(error, code)));
    });

    socket.on("connect", () => {
      connected = true;
      socket.write(`${JSON.stringify(request)}\n`);
    });

    socket.on("data", (chunk) => {
      buffer += chunk.toString("utf8");
      let newlineIndex = buffer.indexOf("\n");
      while (newlineIndex >= 0) {
        const line = buffer.slice(0, newlineIndex).trim();
        buffer = buffer.slice(newlineIndex + 1);
        if (line.length > 0) {
          try {
            const response = parseResponse(line);
            if (response.id === request.id) {
              done(() => resolve(response));
              return;
            }
          } catch (error) {
            done(() =>
              reject(
                withTransportCode(error as Error, "ERR_TRANSPORT_FORWARD_FAILED")
              )
            );
            return;
          }
        }
        newlineIndex = buffer.indexOf("\n");
      }
    });

    socket.on("end", () => {
      done(() =>
        reject(
          withTransportCode(
            new Error("native bridge socket closed before response"),
            connected ? "ERR_TRANSPORT_DISCONNECTED" : "ERR_TRANSPORT_HANDSHAKE_FAILED"
          )
        )
      );
    });
  });

export class SocketNativeBridgeTransport implements NativeBridgeTransport {
  readonly #socketPath: string | null;

  constructor(socketPath: string | null = readSocketPath()) {
    this.#socketPath = socketPath;
  }

  open(request: BridgeRequestEnvelope): Promise<BridgeResponseEnvelope> {
    return this.#request("open", request);
  }

  forward(request: BridgeRequestEnvelope): Promise<BridgeResponseEnvelope> {
    return this.#request("forward", request);
  }

  heartbeat(request: BridgeRequestEnvelope): Promise<BridgeResponseEnvelope> {
    return this.#request("heartbeat", request);
  }

  #request(phase: TransportPhase, request: BridgeRequestEnvelope): Promise<BridgeResponseEnvelope> {
    ensureBridgeRequestEnvelope(request);
    if (!this.#socketPath) {
      return Promise.reject(new Error("native bridge socket is not configured"));
    }

    return sendEnvelope(this.#socketPath, request, phase);
  }
}
