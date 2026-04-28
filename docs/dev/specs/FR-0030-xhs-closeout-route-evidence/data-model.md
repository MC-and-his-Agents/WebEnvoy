# FR-0030 数据模型

本 FR 不新增 SQLite 表、迁移、索引或新的持久化真相源。它只冻结运行时 evidence payload 的最小字段。

## 复用对象

- `FR-0003` / `FR-0020` 的 `profile_ref`
- `FR-0013` 的 humanized action 约束
- `FR-0014` 的 session rhythm / action 节律约束
- `FR-0024` 的 `xhs.search` request shape
- `FR-0027` 的 captured request-context reuse
- `FR-0029` 的 recovery admission scope

## Evidence lifecycle

1. `humanized_action` 使页面数据可见或触发自然请求。
2. `passive_api_capture` 消费当前页面自然请求/响应。
3. `dom_state_extraction` 在 passive capture 不可用时消费页面状态或 DOM。
4. `active_api_fetch_fallback` 只能在 #582 gate 放行后消费 fresh passive-captured template。

## DOM/state payload

`dom_state_extraction` payload 必须保留：

- 执行绑定：`profile_ref`、`target_tab_id`、`page_url`、`run_id`、`action_ref`
- 提取绑定：`extraction_layer`、`extraction_locator`、`extracted_at`
- 连续性：成功 evidence 必须包含非空 `target_continuity[]`
- 风险分类：`risk_surface_classification`

## Route-specific payload

- `xhs.search`：保存 search cards、detail/user URL 与 `xsec_token` / `xsec_source`。
- `xhs.detail`：保存 detail page state、`note_id`、detail URL、author/user URL、content visible 状态与 continuity。
- `xhs.user_home`：保存 user home page state、`user_id`、profile URL、nickname/profile visible 状态与 continuity。

上述 payload 都必须共享同一组 provenance 字段；缺少 route-specific target id、visibility signal 或至少一条 target continuity record 时不得申报成功。

## Signed continuity payload

`xhs.detail` / `xhs.user_home` 的页面内主动 fetch 前必须携带非持久化 signed continuity：

- `source_url`
- `target_url`
- `detail_url` 或 `user_home_url`
- `xsec_token`
- `xsec_source`
- `token_presence`
- `source_route`

该 payload 只能出现在当前 run 的 summary/evidence 中，用于证明 signed URL 与 token continuity；不得写入 canonical identity、profile meta、SQLite 表或长期账号状态。

## 不持久化的内容

- 不持久化 raw page HTML。
- 不持久化完整 cookie、完整 header 或账号敏感内容。
- 不持久化 Browser Computer Use evidence。
- 不把 `xsec_token` 升级为 canonical identity；它只作为当前 route continuity 字段。
