import { createHash } from "node:crypto";
export const buildRuntimeBootstrapContextId = (profile, runId) => `runtime-context-${createHash("sha256")
    .update(`${profile}:${runId}`)
    .digest("hex")
    .slice(0, 16)}`;
