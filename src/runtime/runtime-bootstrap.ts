import { createHash } from "node:crypto";

export const buildRuntimeBootstrapContextId = (profile: string, runId: string): string =>
  `runtime-context-${createHash("sha256")
    .update(`${profile}:${runId}`)
    .digest("hex")
    .slice(0, 16)}`;
