import type { JsonObject } from "../core/types.js";

export type AccountSafetyState = "clear" | "account_risk_blocked";
export type AccountSafetyPlatform = "xhs";
export type AccountSafetyReason =
  | "SESSION_EXPIRED"
  | "XHS_LOGIN_REQUIRED"
  | "ACCOUNT_ABNORMAL"
  | "XHS_ACCOUNT_RISK_PAGE"
  | "CAPTCHA_REQUIRED"
  | "BROWSER_ENV_ABNORMAL";

export interface AccountSafetyRecord {
  state: AccountSafetyState;
  platform: AccountSafetyPlatform | null;
  reason: AccountSafetyReason | null;
  observedAt: string | null;
  cooldownUntil: string | null;
  sourceRunId: string | null;
  sourceCommand: string | null;
  targetDomain: string | null;
  targetTabId: number | null;
  pageUrl: string | null;
  statusCode: number | null;
  platformCode: number | null;
}

export interface AccountSafetyBlockedInput {
  reason: AccountSafetyReason;
  observedAt: string;
  sourceRunId: string | null;
  sourceCommand: string | null;
  targetDomain: string | null;
  targetTabId: number | null;
  pageUrl: string | null;
  statusCode: number | null;
  platformCode: number | null;
  cooldownMs?: number;
}

export const ACCOUNT_SAFETY_DEFAULT_COOLDOWN_MS = 30 * 60 * 1000;

export const ACCOUNT_SAFETY_REASONS: readonly AccountSafetyReason[] = [
  "SESSION_EXPIRED",
  "XHS_LOGIN_REQUIRED",
  "ACCOUNT_ABNORMAL",
  "XHS_ACCOUNT_RISK_PAGE",
  "CAPTCHA_REQUIRED",
  "BROWSER_ENV_ABNORMAL"
];

const ACCOUNT_SAFETY_STATES: readonly AccountSafetyState[] = ["clear", "account_risk_blocked"];

export const isAccountSafetyReason = (value: unknown): value is AccountSafetyReason =>
  typeof value === "string" && ACCOUNT_SAFETY_REASONS.includes(value as AccountSafetyReason);

const isAccountSafetyState = (value: unknown): value is AccountSafetyState =>
  typeof value === "string" && ACCOUNT_SAFETY_STATES.includes(value as AccountSafetyState);

const isIsoTimestampOrNull = (value: unknown): value is string | null =>
  value === null || (typeof value === "string" && !Number.isNaN(Date.parse(value)));

const isIntegerOrNull = (value: unknown): value is number | null =>
  value === null || (typeof value === "number" && Number.isInteger(value));

const isStringOrNull = (value: unknown): value is string | null =>
  value === null || typeof value === "string";

const asObjectRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

export const buildClearAccountSafetyRecord = (): AccountSafetyRecord => ({
  state: "clear",
  platform: null,
  reason: null,
  observedAt: null,
  cooldownUntil: null,
  sourceRunId: null,
  sourceCommand: null,
  targetDomain: null,
  targetTabId: null,
  pageUrl: null,
  statusCode: null,
  platformCode: null
});

export const buildBlockedAccountSafetyRecord = (input: AccountSafetyBlockedInput): AccountSafetyRecord => {
  const cooldownUntil = new Date(
    Date.parse(input.observedAt) + (input.cooldownMs ?? ACCOUNT_SAFETY_DEFAULT_COOLDOWN_MS)
  ).toISOString();
  return {
    state: "account_risk_blocked",
    platform: "xhs",
    reason: input.reason,
    observedAt: input.observedAt,
    cooldownUntil,
    sourceRunId: input.sourceRunId,
    sourceCommand: input.sourceCommand,
    targetDomain: input.targetDomain,
    targetTabId: input.targetTabId,
    pageUrl: input.pageUrl,
    statusCode: input.statusCode,
    platformCode: input.platformCode
  };
};

export function assertAccountSafetyRecordShape(value: unknown): asserts value is AccountSafetyRecord {
  const record = asObjectRecord(value);
  if (!record) {
    throw new Error("Invalid profile meta structure: accountSafety");
  }
  if (!isAccountSafetyState(record.state)) {
    throw new Error("Invalid profile meta structure: accountSafety.state");
  }
  if (record.platform !== null && record.platform !== "xhs") {
    throw new Error("Invalid profile meta structure: accountSafety.platform");
  }
  if (record.reason !== null && !isAccountSafetyReason(record.reason)) {
    throw new Error("Invalid profile meta structure: accountSafety.reason");
  }
  if (!isIsoTimestampOrNull(record.observedAt) || !isIsoTimestampOrNull(record.cooldownUntil)) {
    throw new Error("Invalid profile meta structure: accountSafety timestamps");
  }
  if (
    !isStringOrNull(record.sourceRunId) ||
    !isStringOrNull(record.sourceCommand) ||
    !isStringOrNull(record.targetDomain) ||
    !isStringOrNull(record.pageUrl)
  ) {
    throw new Error("Invalid profile meta structure: accountSafety string fields");
  }
  if (
    !isIntegerOrNull(record.targetTabId) ||
    !isIntegerOrNull(record.statusCode) ||
    !isIntegerOrNull(record.platformCode)
  ) {
    throw new Error("Invalid profile meta structure: accountSafety numeric fields");
  }
}

export const normalizeAccountSafetyRecord = (value: unknown): AccountSafetyRecord => {
  if (value === undefined || value === null) {
    return buildClearAccountSafetyRecord();
  }
  assertAccountSafetyRecordShape(value);
  return { ...(value as AccountSafetyRecord) };
};

export const toAccountSafetyStatus = (value: unknown): JsonObject => {
  const record = normalizeAccountSafetyRecord(value);
  return {
    state: record.state,
    platform: record.platform,
    reason: record.reason,
    observed_at: record.observedAt,
    cooldown_until: record.cooldownUntil,
    source_run_id: record.sourceRunId,
    source_command: record.sourceCommand,
    target_domain: record.targetDomain,
    target_tab_id: record.targetTabId,
    page_url: record.pageUrl,
    status_code: record.statusCode,
    platform_code: record.platformCode,
    live_commands_blocked: record.state === "account_risk_blocked"
  };
};
