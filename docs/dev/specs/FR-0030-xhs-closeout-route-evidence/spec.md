# FR-0030 冻结 XHS Closeout Route Evidence

Canonical Issue: #581

## 背景

`#579` 已成为当前 XHS closeout route-contract owner。`#563` 已完成 account recovery、`dry_run` 与 recon recovery probe，但下一步不得直接进入 live active fetch，也不得重启 `#445` 六轮 closeout bundle。

当前缺口是：仓库已有 request-context、被动请求捕获、页面状态读取和 account-safety 分类能力，但还没有一个正式 evidence taxonomy 来区分：

- 页面动作本身是否由 WebEnvoy 受控触发
- 自然请求/响应是否来自当前页面动作
- DOM 或页面状态提取是否有足够 provenance
- active fetch fallback 是否被单独识别并受更严格 gate 约束

如果这一层继续只存在于 issue comment 或实现侧约定，后续 `xhs.search` passive route、detail/user_home signed continuity 与 active fallback gate 会再次漂移成“默认 active fetch”。

## 目标

1. 冻结 XHS closeout route evidence 的最小分类。
2. 冻结 `dom_state_extraction` 的 provenance 字段与 extraction layer 枚举。
3. 明确 `dom_state_extraction` 与 `passive_api_capture`、`active_api_fetch_fallback` 的边界。
4. 明确登录墙、安全页、验证码、账号异常、浏览器环境异常不得被混成 extraction absence 或 request-context miss。
5. 为 `#580/#583/#582/#579/#563` 提供后续实现与恢复验证的正式输入。

## 非目标

- 不修改 `FR-0005` 文档，不改变 `#445` close condition。
- 不运行 `#445` 六轮 closeout bundle，不运行 live active fetch probe。
- 不新增 public CLI command。
- 不定义新的持久化真相源或第二套 runtime status object family。
- 不把 DOM/state evidence 单独升级为 `#445` full closeout 通过条件。
- 不把 `xsec_token` 写入 `FR-0026` canonical identity；它属于 route continuity / provenance。

## 功能需求

### 1. route evidence class

系统必须冻结以下 route evidence class：

- `humanized_action`
- `passive_api_capture`
- `dom_state_extraction`
- `active_api_fetch_fallback`

约束：

- `humanized_action` 表示由 WebEnvoy 受控、受 `FR-0013/FR-0014` 约束的页面动作，例如 focus、input、click、light scroll、打开结果卡片或进入 profile。
- `passive_api_capture` 表示当前页面自然 XHR/fetch 产生的请求/响应证据，必须绑定当前 profile、tab、run、page URL 与 action。
- `dom_state_extraction` 表示从当前页面状态、script JSON 或 DOM selector 中提取的结构化 evidence。
- `active_api_fetch_fallback` 表示 WebEnvoy 主动发起的页面内 API fetch，只能作为后续 `#582` 单独 gate 后的 fallback，不得默认进入 XHS closeout route。

### 2. DOM/state extraction layer

系统必须冻结 `dom_state_extraction.extraction_layer`：

- `hydration_state`
- `script_json`
- `dom_selector`

约束：

- `hydration_state` 优先读取 `window.__INITIAL_STATE__` 或等价 app hydration state。
- `script_json` 用于 hydration state 不可用时的 inline / serialized script JSON。
- `dom_selector` 只作为前两层不可用时的可见 DOM 提取。
- 实现必须按上述顺序尝试，不得直接跳到脆弱 selector 并声称已覆盖页面状态证据。

### 3. DOM/state provenance

系统必须冻结 `dom_state_extraction` 的最小 provenance 字段：

- `profile_ref`
- `target_tab_id`
- `page_url`
- `run_id`
- `action_ref`
- `extraction_layer`
- `extraction_locator`
- `extracted_at`
- `target_continuity`
- `risk_surface_classification`

约束：

- `profile_ref`、`target_tab_id`、`page_url`、`run_id` 必须与当前执行现场一致。
- `action_ref` 必须指向使数据可见的 `humanized_action` 或等价 read action，不得为空泛写成 `manual`.
- `extraction_locator` 在 `hydration_state` 下是 state path，在 `script_json` 下是 script locator / JSON path，在 `dom_selector` 下是 selector 与容器 scope。
- 成功 `dom_state_extraction` 的 `target_continuity` 必须至少包含一条记录，保存当前 evidence 可见的 URL、detail/user link、`xsec_token`、`xsec_source` 或等价连续性字段；缺失时必须显式记录为缺失。
- 只有非成功或风险场景才允许 `target_continuity=[]`。
- `risk_surface_classification` 必须独立记录 login/security/captcha/account-risk/browser-env-abnormal 等页面风险面。

### 4. search card extraction

`xhs.search` 的 DOM/state evidence 必须支持搜索卡片最小字段：

- `title`
- `detail_url`
- `author_url` 或 `user_home_url`
- `xsec_token`
- `xsec_source`

约束：

- `detail_url` / `author_url` 不得只保留裸 id；如果页面提供 signed URL 或 token，必须保留。
- `xsec_token` / `xsec_source` 缺失不得被实现层静默补成裸 fetch 依据。
- 若没有 passive API capture 也没有可见 cards，必须 fail closed 为 route evidence missing。

### 5. detail page state extraction

`xhs.detail` 的 DOM/state evidence 必须支持 detail page state 最小字段：

- `note_id`
- `detail_url`
- `title`
- `author_url` 或 `user_home_url`
- `xsec_token`
- `xsec_source`
- `content_visible`

约束：

- detail route 必须优先消费当前 search/profile context 产生的 signed URL 或 token continuity。
- 当页面状态只能提供裸 `note_id`，但缺少 signed URL / token continuity 时，必须显式标记 `token_presence=missing`，不得静默升级为 active fetch。
- detail page state 只能证明当前 detail 页面已渲染目标内容；若目标 continuity 不满足 #583 后续 signed-continuity 要求，不得继续进入 detail active fallback。
- 安全 redirect、登录墙、验证码、账号异常与浏览器环境异常必须优先于 detail extraction success。

### 6. user home state extraction

`xhs.user_home` 的 DOM/state evidence 必须支持 user home page state 最小字段：

- `user_id`
- `user_home_url`
- `nickname`
- `profile_visible`
- `source_url`
- `xsec_token`
- `xsec_source`

约束：

- user_home route 必须保留来源页面提供的 profile URL 与 token/source continuity。
- 裸 `user_id` 只能作为页面状态中的目标标识，不得作为缺 token live fetch 的自动升级依据。
- 若 user_home 页面出现 security redirect、登录墙、验证码、账号异常或浏览器环境异常，必须返回对应风险分类，而不是 `DOM_EXTRACTION_MISSING`。

### 6A. detail/user_home signed continuity

`xhs.detail` 与 `xhs.user_home` 在进入任何页面内主动 API fetch 前，必须先证明当前 captured request-context 绑定了 signed continuity。

最小 signed continuity 字段：

- `source_url`
- `target_url`
- `detail_url` 或 `user_home_url`
- `xsec_token`
- `xsec_source`
- `token_presence`
- `observed_at`
- `source_route`

约束：

- `xsec_token` / `xsec_source` 是 route continuity / provenance，不是 FR-0026 canonical identity。
- 裸 `note_id` / `user_id` 只允许作为 identity shape，用于匹配当前目标；不得作为缺 token live fetch 的放行依据。
- 裸 detail/profile URL 不得静默升级为 live fetch；必须 fail closed 为 `XSEC_TOKEN_MISSING`。
- `xsec_token=""` 必须 fail closed 为 `XSEC_TOKEN_EMPTY`。
- stale 判定必须使用当前 captured request-context artifact 的 `observed_at`；若缺失则使用 `captured_at`。两者都缺失时视为 `XSEC_TOKEN_STALE`。
- freshness window 固定复用 request-context freshness window：5 分钟。`now - (observed_at ?? captured_at) > 5 * 60_000` 时必须 fail closed 为 `XSEC_TOKEN_STALE`，不得复用历史 token。
- `xsec_source` 允许集合固定为 `pc_search | pc_feed | pc_note | pc_profile | pc_user`；缺失、空值或集合外取值必须 fail closed 为 `XSEC_SOURCE_MISMATCH`。
- security redirect 必须优先 fail closed 为 `SECURITY_REDIRECT`。
- 成功路径必须在 summary/evidence 中保留 signed continuity，但不得把 token 写入 canonical data_ref。

### 7. route-specific sufficiency

系统必须冻结：

- `dom_state_extraction` 可以满足 `#563` 恢复后的 passive capture probe 中 route-specific search evidence 的 fallback 条件。
- `dom_state_extraction` 不能单独替代 `#445` full closeout success bar。

约束：

- `#563` 下一步只能恢复到 `dry_run -> recon -> passive capture probe`。
- 在 `#579` merged-main verify 前，不得把 `dom_state_extraction` 当成允许重跑 `#445` bundle 的证据。
- `active_api_fetch_fallback` 未经 `#582` gate 前，不得参与 `#563` 或 `#445` 恢复路径。

`xhs.detail` 与 `xhs.user_home` 的 DOM/state evidence 只能作为后续 route continuity 与页面状态证明；在 #583 signed continuity 冻结并通过前，不得被用作裸 id active fetch 的放行条件。

### 8. failure classification

系统必须把以下页面/账号风险面与 evidence 缺失分开：

- `XHS_LOGIN_REQUIRED`
- `CAPTCHA_REQUIRED`
- `XHS_ACCOUNT_RISK_PAGE`
- `ACCOUNT_ABNORMAL`
- `BROWSER_ENV_ABNORMAL`
- `SECURITY_REDIRECT`
- `XSEC_TOKEN_MISSING`
- `XSEC_TOKEN_EMPTY`
- `XSEC_TOKEN_STALE`
- `XSEC_SOURCE_MISMATCH`

约束：

- 这些风险面不得被归类为 `REQUEST_CONTEXT_MISSING`、`DOM_EXTRACTION_MISSING` 或通用 page changed。
- 任一登录、安全重定向、验证码、账号异常、账号风险页或浏览器环境异常信号出现时，后续 closeout route 必须 hard stop，并由 `#563` 或对应 issue 记录 truth。
- signed continuity 失败不得回退为裸 ID active fetch；必须在签名与 fetch 前 fail closed。

## 异常与边界场景

### 1. passive capture 与 DOM/state 同时存在

若当前 action 同时产生 `passive_api_capture` 与 `dom_state_extraction`，实现必须优先把自然请求/响应标记为 primary route evidence，并把 DOM/state evidence 作为同 run 的补充 provenance；不得把两者合并成单一 evidence class。

### 2. DOM/state 数据可见但 continuity 缺失

若 search card 可见但 detail/user URL、`xsec_token` 或 `xsec_source` 缺失，实现可以返回 `dom_state_extraction` search evidence，但必须在至少一条 `target_continuity` 记录中显式标记 token 缺失；后续 detail/user_home route 不得用裸 id 静默发起 live fetch。

### 3. 页面内容未出现且无风险信号

若条件等待结束时既没有 passive capture，也没有可提取 DOM/state content，且没有登录、安全、验证码、账号异常或浏览器环境异常信号，必须 fail closed 为 `ROUTE_EVIDENCE_MISSING` 或 `DOM_EXTRACTION_MISSING`，不得进入 active fetch fallback。

### 4. 风险信号晚于内容出现

若页面先出现内容后出现登录墙、安全重定向、验证码、账号风险、账号异常或浏览器环境异常信号，风险信号优先，当前 run 不得继续作为成功 route evidence 使用，并必须按风险分类阻断后续 probe。

### 5. 非当前 tab/profile/run 的 evidence

任何来自其他 tab、其他 profile、历史 run 或旧页面 URL 的 evidence 都不得满足本 FR。实现必须保留当前 `profile_ref / target_tab_id / page_url / run_id / action_ref` 绑定，缺失或不一致时 fail closed。

## 验收标准

- `contracts/xhs-closeout-route-evidence.md` 已冻结四类 route evidence class，并明确 active fetch fallback 不属于默认路径。
- `dom_state_extraction` 已冻结 extraction layer、locator、run/action/page/profile/tab 绑定、target continuity 与 risk surface classification。
- `xhs.search` search card DOM/state evidence 已明确要求保留 detail/user URL、`xsec_token` 与 `xsec_source`。
- `xhs.detail` detail page state evidence 已明确要求保留 note、author/user URL、signed continuity 与风险分类。
- `xhs.user_home` user home state evidence 已明确要求保留 profile URL、用户标识、signed continuity 与风险分类。
- 登录墙、安全页、验证码、账号异常、浏览器环境异常与 security redirect 已从 missing evidence 中分离。
- 登录墙、安全重定向、验证码、账号异常、账号风险页与浏览器环境异常都会 hard stop 后续 probe。
- 成功 DOM/state evidence 必须至少包含一条 `target_continuity` 记录。
- 本 FR 未修改 `FR-0005`，未改变 `#445` close condition，未运行 live probe 或 closeout bundle。
- 后续 #580/#583/#582 能分别消费本 FR：#580 实现 passive/DOM route，#583 冻结 signed continuity，#582 单独 gate active fallback。

## GWT 验收场景

### 场景 1：DOM/state evidence 具备 provenance

Given `xhs.search` 在当前 managed profile 和目标 tab 中完成一次受控页面动作
When 系统从页面状态或 DOM 中提取搜索卡片
Then evidence 必须包含 `profile_ref / target_tab_id / page_url / run_id / action_ref / extraction_layer / extraction_locator / extracted_at`
And `extraction_layer` 必须是 `hydration_state | script_json | dom_selector` 之一
And `target_continuity` 必须记录 detail/user URL 与可见 token 状态

### 场景 2：DOM/state evidence 与 passive capture 不混淆

Given 当前页面没有自然 XHR/fetch response capture
And 搜索卡片已经渲染可见
When 系统回传 route evidence
Then evidence class 必须是 `dom_state_extraction`
And 不得标记为 `passive_api_capture`
And 不得触发 active fetch fallback

### 场景 3：风险页面独立分类

Given 页面出现登录墙、安全页、验证码、账号异常或浏览器环境异常
When 系统等待 route evidence
Then 必须返回对应风险分类
And 不得返回 `REQUEST_CONTEXT_MISSING` 或 `DOM_EXTRACTION_MISSING`
And 账号风险信号必须阻断后续 probe

### 场景 4：DOM/state 不替代 #445 full closeout

Given `dom_state_extraction` 成功提取了 search cards
When 系统判断是否可以关闭或重启 `#445` 六轮 closeout bundle
Then 该 evidence 不得单独满足 `#445` full closeout 条件
And 只能作为 `#579/#563` route-specific passive probe 的输入之一

### 场景 5：active fetch fallback 必须单独 gate

Given passive capture 缺失
And DOM/state extraction 缺失
When 系统评估下一步 route
Then 不得默认进入 active fetch
And 必须等待 `#582` 定义的 `active_api_fetch_fallback` gate

### 场景 6：detail/user_home DOM 状态不能绕过 signed continuity

Given `xhs.detail` 或 `xhs.user_home` 页面已经渲染目标内容
And DOM/state extraction 只能得到裸 `note_id` 或 `user_id`
But 缺少 signed URL、`xsec_token` 或 `xsec_source`
When 系统评估后续 detail/user_home route
Then 可以记录 `dom_state_extraction` provenance
And 必须把 continuity 标记为缺失
And 不得执行页面内主动 API fetch

### 场景 7：detail/user_home signed continuity fail closed

Given `xhs.detail` 或 `xhs.user_home` 只拿到裸目标 ID 或裸目标 URL
When 系统准备执行页面内主动 API fetch
Then 必须在签名前返回 `XSEC_TOKEN_MISSING`
And 不得把裸 `note_id` / `user_id` 静默升级为 live fetch

### 场景 8：xsec_source 不匹配

Given captured request-context 的 signed URL 包含非空 `xsec_token`
But `xsec_source` 缺失或不属于当前允许来源集合
When 系统准备执行 detail/user_home route
Then 必须返回 `XSEC_SOURCE_MISMATCH`
And 不得调用签名入口或 API fetch
And 不得静默进入 active fetch fallback
