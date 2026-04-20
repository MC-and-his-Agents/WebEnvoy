export const SEARCH_ENDPOINT = "/api/sns/web/v1/search/notes";
export const DETAIL_ENDPOINT = "/api/sns/web/v1/feed";
export const USER_HOME_ENDPOINT = "/api/sns/web/v1/user/otherinfo";
export const CAPTURED_REQUEST_CONTEXT_PATHS = [
    SEARCH_ENDPOINT,
    DETAIL_ENDPOINT,
    USER_HOME_ENDPOINT
];
export const WEBENVOY_SYNTHETIC_REQUEST_HEADER = "x-webenvoy-synthetic-request";
export const MAIN_WORLD_PAGE_CONTEXT_NAMESPACE_EVENT = "__webenvoy_page_context_namespace__";
const MAIN_WORLD_EVENT_NAMESPACE = "webenvoy.main_world.bridge.v1";
const MAIN_WORLD_PAGE_CONTEXT_NAMESPACE_EVENT_PREFIX = "__mw_ns__";
const hashMainWorldEventChannel = (value) => {
    let hash = 0x811c9dc5;
    for (let index = 0; index < value.length; index += 1) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(36);
};
export const resolveMainWorldPageContextNamespaceEventName = (secret) => `${MAIN_WORLD_PAGE_CONTEXT_NAMESPACE_EVENT_PREFIX}${hashMainWorldEventChannel(`${MAIN_WORLD_EVENT_NAMESPACE}|namespace|${secret.trim()}`)}`;
export const createPageContextNamespace = (href) => {
    const normalized = href.trim();
    if (normalized.length === 0) {
        return "about:blank";
    }
    try {
        const parsed = new URL(normalized, "https://www.xiaohongshu.com/");
        const pathname = parsed.pathname.length > 0 ? parsed.pathname : "/";
        const queryIdentity = parsed.search.length > 0 ? `${pathname}${parsed.search}` : pathname;
        const documentTimeOrigin = typeof globalThis.performance?.timeOrigin === "number" &&
            Number.isFinite(globalThis.performance.timeOrigin)
            ? Math.trunc(globalThis.performance.timeOrigin)
            : null;
        return documentTimeOrigin === null
            ? `${parsed.origin}${queryIdentity}`
            : `${parsed.origin}${queryIdentity}#doc=${documentTimeOrigin}`;
    }
    catch {
        return normalized;
    }
};
export const createVisitedPageContextNamespace = (href, visitSequence) => {
    const baseNamespace = createPageContextNamespace(href);
    return visitSequence > 0 ? `${baseNamespace}|visit=${visitSequence}` : baseNamespace;
};
