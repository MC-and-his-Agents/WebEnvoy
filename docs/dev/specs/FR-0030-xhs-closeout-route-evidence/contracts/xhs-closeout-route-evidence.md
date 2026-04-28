# FR-0030 契约：XHS Closeout Route Evidence

## Route Evidence Class

```ts
type XhsCloseoutRouteEvidenceClassV1 =
  | "humanized_action"
  | "passive_api_capture"
  | "dom_state_extraction"
  | "active_api_fetch_fallback";
```

约束：

- `passive_api_capture` 只表示当前页面自然请求/响应，不包含 WebEnvoy 主动 fetch replay。
- `dom_state_extraction` 只表示从当前页面可见或已加载状态中读到的数据。
- `active_api_fetch_fallback` 必须由独立 gate 放行，不能被 `passive_api_capture` 或 `dom_state_extraction` 代替。

## DOM/state extraction

```ts
type XhsDomStateExtractionLayerV1 =
  | "hydration_state"
  | "script_json"
  | "dom_selector";

type XhsRiskSurfaceClassificationV1 =
  | "none"
  | "XHS_LOGIN_REQUIRED"
  | "CAPTCHA_REQUIRED"
  | "XHS_ACCOUNT_RISK_PAGE"
  | "ACCOUNT_ABNORMAL"
  | "BROWSER_ENV_ABNORMAL"
  | "SECURITY_REDIRECT";

type XhsTargetContinuityV1 = {
  target_url: string | null;
  detail_url?: string | null;
  user_home_url?: string | null;
  xsec_token: string | null;
  xsec_source: string | null;
  token_presence: "present" | "missing" | "empty" | "not_applicable";
  source_route:
    | "xhs.search"
    | "xhs.detail"
    | "xhs.user_home"
    | "unknown";
};

type XhsDomStateExtractionEvidenceV1 = {
  evidence_class: "dom_state_extraction";
  profile_ref: string;
  target_tab_id: number;
  page_url: string;
  run_id: string;
  action_ref: string;
  extraction_layer: XhsDomStateExtractionLayerV1;
  extraction_locator: string;
  extracted_at: string;
  target_continuity: XhsTargetContinuityV1[];
  risk_surface_classification: XhsRiskSurfaceClassificationV1;
};
```

约束：

- `extracted_at` 必须是 ISO-8601 字符串。
- 成功 `dom_state_extraction` 的 `target_continuity` 必须至少包含一条记录，且不得省略。
- `target_continuity=[]` 只允许用于非成功或风险场景。
- `risk_surface_classification !== "none"` 时，该 evidence 不得作为成功 extraction evidence 使用。
- `token_presence="present"` 时，`xsec_token` 必须为 trim 后非空字符串。
- `token_presence="missing" | "empty"` 时，后续 detail/user_home route 不得把裸 id 静默升级为 live fetch target。

## Search card evidence

```ts
type XhsSearchCardDomEvidenceV1 = XhsDomStateExtractionEvidenceV1 & {
  item_kind: "search_card";
  cards: Array<{
    title: string | null;
    detail_url: string | null;
    user_home_url: string | null;
    xsec_token: string | null;
    xsec_source: string | null;
  }>;
};
```

约束：

- `cards` 为空时不得申报 route evidence success。
- 若页面提供 signed URL 或 token，必须保留到 `detail_url` / `user_home_url` / `xsec_token` / `xsec_source`。
- 搜索卡片 evidence 只能证明 search route 的 passive/DOM fallback 成功，不能证明 detail/user_home continuity 已满足。

## Detail page evidence

```ts
type XhsDetailPageDomEvidenceV1 = XhsDomStateExtractionEvidenceV1 & {
  item_kind: "detail_page_state";
  note: {
    note_id: string | null;
    detail_url: string | null;
    title: string | null;
    user_home_url: string | null;
    xsec_token: string | null;
    xsec_source: string | null;
    content_visible: boolean;
  };
};
```

约束：

- `content_visible=true` 只能证明当前 detail 页面渲染出目标内容，不证明 active fetch 可执行。
- `note_id` 缺失时不得申报 detail DOM/state success。
- `xsec_token` 或 signed URL 缺失时，后续 detail active fallback 必须 fail closed，直到 #583 continuity gate 明确允许。
- security redirect / login / captcha / account risk / browser env abnormal 优先于 detail extraction success。

## User home page evidence

```ts
type XhsUserHomeDomEvidenceV1 = XhsDomStateExtractionEvidenceV1 & {
  item_kind: "user_home_page_state";
  user: {
    user_id: string | null;
    user_home_url: string | null;
    nickname: string | null;
    source_url: string | null;
    xsec_token: string | null;
    xsec_source: string | null;
    profile_visible: boolean;
  };
};
```

约束：

- `profile_visible=true` 只能证明当前 user home 页面渲染出 profile 状态，不证明 active fetch 可执行。
- `user_id` 缺失时不得申报 user_home DOM/state success。
- `xsec_token` 或 signed URL 缺失时，后续 user_home active fallback 必须 fail closed，直到 #583 continuity gate 明确允许。
- security redirect / login / captcha / account risk / browser env abnormal 优先于 user_home extraction success。

## Failure separation

```ts
type XhsRouteEvidenceFailureReasonV1 =
  | "ROUTE_EVIDENCE_MISSING"
  | "DOM_EXTRACTION_MISSING"
  | "PASSIVE_CAPTURE_MISSING"
  | "XSEC_TOKEN_MISSING"
  | "XSEC_TOKEN_EMPTY"
  | "XSEC_TOKEN_STALE"
  | "XSEC_SOURCE_MISMATCH"
  | "XHS_LOGIN_REQUIRED"
  | "CAPTCHA_REQUIRED"
  | "XHS_ACCOUNT_RISK_PAGE"
  | "ACCOUNT_ABNORMAL"
  | "BROWSER_ENV_ABNORMAL"
  | "SECURITY_REDIRECT";
```

约束：

- risk/safety reasons 不得降级为 missing evidence。
- `XHS_LOGIN_REQUIRED`、`SECURITY_REDIRECT`、`ACCOUNT_ABNORMAL`、`XHS_ACCOUNT_RISK_PAGE`、`CAPTCHA_REQUIRED`、`BROWSER_ENV_ABNORMAL` 必须阻断后续 live probe。

## Signed continuity for detail/user_home

```ts
type XhsSignedContinuityFailureReasonV1 =
  | "XSEC_TOKEN_MISSING"
  | "XSEC_TOKEN_EMPTY"
  | "XSEC_TOKEN_STALE"
  | "XSEC_SOURCE_MISMATCH"
  | "SECURITY_REDIRECT";

type XhsSignedContinuityV1 = {
  source_url: string | null;
  target_url: string | null;
  detail_url?: string | null;
  user_home_url?: string | null;
  xsec_token: string | null;
  xsec_source: string | null;
  token_presence: "present" | "missing" | "empty";
  source_route:
    | "xhs.search"
    | "xhs.detail"
    | "xhs.user_home"
    | "unknown";
};
```

约束：

- `xhs.detail` 与 `xhs.user_home` 的主动页面内 fetch 前，必须先从当前 captured request-context 的 signed detail/profile URL 中解析 `xsec_token` 与 `xsec_source`。
- `xsec_token` / `xsec_source` 只属于 route continuity / provenance，不得写入 FR-0026 canonical identity。
- 裸 `note_id` / `user_id`、裸 `/explore/<id>` URL 或裸 `/user/profile/<id>` URL 不得静默升级为 live fetch。
- 缺 signed URL、缺 token、空 token、token 已过期、`xsec_source` 缺失或不在允许来源集合时必须 fail closed。
- security redirect 必须优先分类为 `SECURITY_REDIRECT`，不得降级为 `REQUEST_CONTEXT_MISSING`、`DOM_EXTRACTION_MISSING` 或裸 fetch 重试。
- 成功路径必须在 summary/evidence 中保留 signed continuity；但该 continuity 仍不得单独满足 #445 full closeout。
