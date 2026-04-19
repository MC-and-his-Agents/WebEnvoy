export const SEARCH_ENDPOINT = "/api/sns/web/v1/search/notes";
export const DETAIL_ENDPOINT = "/api/sns/web/v1/feed";
export const USER_HOME_ENDPOINT = "/api/sns/web/v1/user/otherinfo";
export const CAPTURED_REQUEST_CONTEXT_PATHS = [
    SEARCH_ENDPOINT,
    DETAIL_ENDPOINT,
    USER_HOME_ENDPOINT
];
export const WEBENVOY_SYNTHETIC_REQUEST_HEADER = "x-webenvoy-synthetic-request";
export const createPageContextNamespace = (href) => {
    const normalized = href.trim();
    return normalized.length > 0 ? normalized : "about:blank";
};
