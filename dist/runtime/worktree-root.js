import { spawnSync } from "node:child_process";
import { realpathSync } from "node:fs";
import { join, resolve } from "node:path";
const PROFILE_ROOT_SEGMENTS = [".webenvoy", "profiles"];
const normalizeRuntimePath = (input) => input.startsWith("/private/var/") ? input.slice("/private".length) : input;
const resolveExistingPath = (input) => {
    const normalized = resolve(input);
    try {
        return normalizeRuntimePath(realpathSync.native(normalized));
    }
    catch {
        return normalizeRuntimePath(normalized);
    }
};
export const resolveRuntimeWorktreeRoot = (cwd) => {
    const normalizedCwd = resolveExistingPath(cwd);
    const result = spawnSync("git", ["rev-parse", "--path-format=absolute", "--show-toplevel"], {
        cwd: normalizedCwd,
        encoding: "utf8"
    });
    if (result.status !== 0) {
        return normalizedCwd;
    }
    const output = result.stdout.trim();
    return output.length > 0 ? resolveExistingPath(output) : normalizedCwd;
};
export const resolveRuntimeProfileRoot = (cwd) => join(resolveRuntimeWorktreeRoot(cwd), ...PROFILE_ROOT_SEGMENTS);
