import { release } from "node:os";
import { buildFingerprintRuntimeContext, normalizeArch, normalizePlatform } from "../../shared/fingerprint-profile.js";
const resolveTimezone = () => {
    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    }
    catch {
        return "UTC";
    }
};
export const resolveCurrentFingerprintEnvironment = () => ({
    os_family: normalizePlatform(process.platform),
    os_version: release(),
    arch: normalizeArch(process.arch)
});
export const buildFingerprintContextForMeta = (profile, meta, options) => buildFingerprintRuntimeContext({
    profile,
    metaPresent: meta !== null,
    fingerprintSeeds: meta?.fingerprintSeeds ?? null,
    existingBundle: meta?.fingerprintProfileBundle ?? null,
    actualEnvironment: resolveCurrentFingerprintEnvironment(),
    requestedExecutionMode: options?.requestedExecutionMode ?? null,
    timezone: resolveTimezone()
});
export const appendFingerprintContext = (params, fingerprintContext) => ({
    ...params,
    fingerprint_context: fingerprintContext
});
