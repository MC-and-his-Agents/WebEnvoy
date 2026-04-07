import { createPortPair } from "./loopback-port.js";
import { RELAY_PATH } from "./loopback-gate.js";
import { InMemoryContentScriptRuntime } from "./loopback-content-runtime.js";
import { InMemoryBackgroundRelay } from "./loopback-relay.js";
import { InMemoryHostTransport } from "./loopback-host-transport.js";
export const createLoopbackNativeBridgeTransport = () => {
    const [hostPort, backgroundHostPort] = createPortPair();
    const [backgroundContentPort, contentPort] = createPortPair();
    new InMemoryContentScriptRuntime(contentPort);
    new InMemoryBackgroundRelay(backgroundHostPort, backgroundContentPort);
    return new InMemoryHostTransport(hostPort);
};
export const loopbackRelayPath = () => RELAY_PATH;
