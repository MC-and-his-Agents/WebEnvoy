import { createPortPair } from "./loopback-port.js";
import { RELAY_PATH } from "./loopback-gate.js";
import { InMemoryContentScriptRuntime } from "./loopback-content-runtime.js";
import { InMemoryBackgroundRelay } from "./loopback-relay.js";
import { InMemoryHostTransport } from "./loopback-host-transport.js";
import type { ContentMessage, HostMessage } from "./loopback-messages.js";
import type { NativeBridgeTransport } from "./transport.js";

export const createLoopbackNativeBridgeTransport = (): NativeBridgeTransport => {
  const [hostPort, backgroundHostPort] = createPortPair<HostMessage>();
  const [backgroundContentPort, contentPort] = createPortPair<ContentMessage>();

  new InMemoryContentScriptRuntime(contentPort);
  new InMemoryBackgroundRelay(backgroundHostPort, backgroundContentPort);

  return new InMemoryHostTransport(hostPort);
};

export const loopbackRelayPath = (): string => RELAY_PATH;
