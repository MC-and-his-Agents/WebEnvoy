import { release } from "node:os";

import type { JsonObject } from "../core/types.js";
import type { ProfileMeta } from "./profile-store.js";
import {
  buildFingerprintRuntimeContext,
  normalizeArch,
  normalizePlatform,
  type FingerprintEnvironment,
  type FingerprintRuntimeContext
} from "../../shared/fingerprint-profile.js";

const resolveTimezone = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
};

export const resolveCurrentFingerprintEnvironment = (): FingerprintEnvironment => ({
  os_family: normalizePlatform(process.platform),
  os_version: release(),
  arch: normalizeArch(process.arch)
});

export const buildFingerprintContextForMeta = (
  profile: string,
  meta: Pick<ProfileMeta, "fingerprintSeeds" | "fingerprintProfileBundle"> | null,
  options?: { requestedExecutionMode?: string | null }
): FingerprintRuntimeContext =>
  buildFingerprintRuntimeContext({
    profile,
    metaPresent: meta !== null,
    fingerprintSeeds: meta?.fingerprintSeeds ?? null,
    existingBundle: meta?.fingerprintProfileBundle ?? null,
    actualEnvironment: resolveCurrentFingerprintEnvironment(),
    requestedExecutionMode: options?.requestedExecutionMode ?? null,
    timezone: resolveTimezone()
  });

export const appendFingerprintContext = (
  params: JsonObject,
  fingerprintContext: FingerprintRuntimeContext
): JsonObject => ({
  ...params,
  fingerprint_context: fingerprintContext
});
