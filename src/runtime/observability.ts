const DEFAULT_MAX_REQUESTS = 10;
const DEFAULT_MAX_TITLE_LENGTH = 120;
const DEFAULT_MAX_FAILURE_SUMMARY_LENGTH = 160;
const DEFAULT_MAX_REQUEST_REASON_LENGTH = 120;

export interface PageStateInput {
  page_kind?: string | null;
  url?: string | null;
  title?: string | null;
  ready_state?: string | null;
}

export interface KeyRequestInput {
  request_id?: string | null;
  stage?: string | null;
  method?: string | null;
  url?: string | null;
  outcome?: string | null;
  status_code?: number | null;
  failure_reason?: string | null;
  request_class?: string | null;
}

export interface FailureSiteInput {
  stage?: string | null;
  component?: string | null;
  target?: string | null;
  summary?: string | null;
}

export interface ObservabilityInput {
  page_state?: PageStateInput | null;
  key_requests?: KeyRequestInput[] | null;
  failure_site?: FailureSiteInput | null;
}

export interface PageState {
  page_kind: string;
  url: string;
  title: string;
  ready_state: string;
}

export interface KeyRequest {
  request_id: string;
  stage: string;
  method: string;
  url: string;
  outcome: string;
  status_code?: number;
  failure_reason?: string;
  request_class?: string;
}

export interface FailureSite {
  stage: string;
  component: string;
  target: string;
  summary: string;
}

export interface ObservabilityPayload {
  page_state: PageState;
  key_requests: KeyRequest[];
  failure_site: FailureSite | null;
}

export interface ObservabilityOptions {
  maxRequests?: number;
  maxTitleLength?: number;
  maxFailureSummaryLength?: number;
  maxRequestReasonLength?: number;
}

const nonEmpty = (value: string | null | undefined, fallback: string): string => {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized.length > 0 ? normalized : fallback;
};

const truncate = (value: string, maxLength: number): string => {
  if (maxLength <= 0) {
    return "";
  }
  if (value.length <= maxLength) {
    return value;
  }
  return value.slice(0, maxLength);
};

const stripQueryAndFragment = (value: string): string => {
  const noFragment = value.split("#", 1)[0];
  return noFragment.split("?", 1)[0];
};

export const sanitizeUrl = (url: string | null | undefined): string => {
  const normalized = nonEmpty(url ?? "", "");
  if (normalized.length === 0) {
    return "";
  }

  const isAbsolute = /^[a-zA-Z][a-zA-Z\d+.-]*:\/\//.test(normalized);
  if (!isAbsolute) {
    return stripQueryAndFragment(normalized);
  }

  try {
    const parsed = new URL(normalized);
    return `${parsed.protocol}//${parsed.host}${parsed.pathname}`;
  } catch {
    return stripQueryAndFragment(normalized);
  }
};

export const normalizePageState = (
  input: PageStateInput | null | undefined,
  options?: ObservabilityOptions
): PageState => {
  const maxTitleLength = options?.maxTitleLength ?? DEFAULT_MAX_TITLE_LENGTH;
  return {
    page_kind: nonEmpty(input?.page_kind, "unknown"),
    url: sanitizeUrl(input?.url) || "about:blank",
    title: truncate(nonEmpty(input?.title, "unknown"), maxTitleLength),
    ready_state: nonEmpty(input?.ready_state, "unknown")
  };
};

const normalizeKeyRequest = (
  input: KeyRequestInput,
  options?: ObservabilityOptions
): KeyRequest => {
  const maxReasonLength = options?.maxRequestReasonLength ?? DEFAULT_MAX_REQUEST_REASON_LENGTH;
  const output: KeyRequest = {
    request_id: nonEmpty(input.request_id, "unknown"),
    stage: nonEmpty(input.stage, "unknown"),
    method: nonEmpty(input.method, "UNKNOWN").toUpperCase(),
    url: sanitizeUrl(input.url) || "/",
    outcome: nonEmpty(input.outcome, "unknown")
  };

  if (typeof input.status_code === "number") {
    output.status_code = input.status_code;
  }

  const failureReason = nonEmpty(input.failure_reason, "");
  if (failureReason.length > 0) {
    output.failure_reason = truncate(failureReason, maxReasonLength);
  }

  const requestClass = nonEmpty(input.request_class, "");
  if (requestClass.length > 0) {
    output.request_class = requestClass;
  }

  return output;
};

export const normalizeKeyRequests = (
  input: KeyRequestInput[] | null | undefined,
  options?: ObservabilityOptions
): KeyRequest[] => {
  const maxRequests = options?.maxRequests ?? DEFAULT_MAX_REQUESTS;
  const list = Array.isArray(input) ? input : [];
  return list.slice(0, Math.max(0, maxRequests)).map((item) => normalizeKeyRequest(item, options));
};

export const normalizeFailureSite = (
  input: FailureSiteInput | null | undefined,
  options?: ObservabilityOptions
): FailureSite | null => {
  if (input === null || input === undefined) {
    return null;
  }

  const maxSummaryLength = options?.maxFailureSummaryLength ?? DEFAULT_MAX_FAILURE_SUMMARY_LENGTH;
  return {
    stage: nonEmpty(input.stage, "unknown"),
    component: nonEmpty(input.component, "unknown"),
    target: nonEmpty(input.target, "unknown"),
    summary: truncate(nonEmpty(input.summary, "unknown"), maxSummaryLength)
  };
};

export const buildObservabilityPayload = (
  input: ObservabilityInput,
  options?: ObservabilityOptions
): ObservabilityPayload => ({
  page_state: normalizePageState(input.page_state, options),
  key_requests: normalizeKeyRequests(input.key_requests, options),
  failure_site: normalizeFailureSite(input.failure_site, options)
});
