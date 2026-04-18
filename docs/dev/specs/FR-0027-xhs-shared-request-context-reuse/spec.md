# FR-0027 冻结 XHS Shared Request-Context Reuse Semantics

Canonical Issue: #508

## 背景

`#503 / FR-0024` 已冻结 `xhs.search` request-shape truth；`#504 / FR-0025` 已冻结 `xhs.detail / xhs.user_home` command surface 与 request-context baseline；`#505 / FR-0026` 负责把 `xhs.detail` canonical identity 收窄为 identity-only formal freeze。

但 replacement implementation 仍缺少一条独立 formal owner，去回答当前已经被代码和 guardian 同时锁定的 shared reuse 语义：

- `shape_key` 如何成为稳定 request identity key
- `page_context_namespace + shape_key` 如何组成实际 slotting identity
- `admitted_template`、`rejected_observation`、`incompatible_observation` 的共享 bucket 行为
- synthetic / failed source 的准入边界
- exact-match / freshness / fail-closed 的复用门禁
- replacement implementation 在进入实现前还必须等待哪些 formal freeze

如果这些规则继续留给 implementation PR 自行决定，`#503/#504/#505` 的 formal truth、GitHub issue truth 与 replacement implementation gate 会再次分离。

## 目标

1. 冻结 XHS read family 的 shared request-context reuse model。
2. 冻结 `page_context_namespace + shape_key` 的 slotting 身份与 lookup 行为。
3. 冻结 admitted / rejected / incompatible 三类 observation 的共享边界。
4. 冻结 `xhs.detail` 与 `xhs.user_home` 在 reuse 模型里的 canonical shape。
5. 冻结 replacement implementation 的 formal gate：必须等待 `#503/#504/#505/#508` 全部完成。

## 非目标

- 不在本 FR 内修改 runtime、extension、CLI 或测试实现代码。
- 不重开 `xhs.search` canonical shape；search-only shape 继续以 `FR-0024` 为准。
- 不重开 `xhs.detail` canonical identity；detail identity 继续以 `#505` 为准。
- 不改写 `FR-0025` 已冻结的 command surface、四对象输入 ownership 或 request-level results ownership。
- 不推进 `#489/#500` 的实现修复、`#445` closeout、latest-main rerun 或 live evidence。
- 不把 page-local request-context artifact 升格为跨 run / 跨页面 / 持久化 replay truth。

## 功能需求

### 1. shared request-shape truth ownership

系统必须冻结：`capture -> slotting -> lookup -> eligibility` 四个阶段共享同一套 canonical `RequestShape` / `shape_key` 规则。

约束：

- `xhs.search` 的 canonical shape 继续完全遵循 `FR-0024`，本 FR 不得重写 search-only 规则。
- `xhs.detail` 与 `xhs.user_home` 必须进入与 `xhs.search` 同构的 shared reuse model，而不是各自走独立启发式。
- `shape_key` 只能由 canonical shape 的稳定序列化生成，不得混入 raw body、header 顺序、trace 或 referrer。
- 不允许在 capture、lookup 或 eligibility 阶段各自定义第二套“同一请求”规则。

### 2. canonical read-family shapes

系统必须冻结以下 read-family canonical shape：

- `xhs.detail`
  - `command`
  - `method`
  - `pathname`
  - `note_id`
- `xhs.user_home`
  - `command`
  - `method`
  - `pathname`
  - `user_id`

补充约束：

- `xhs.detail` 的 `note_id` 继续与 `#505` 的 identity-only formal freeze 对齐。
- `source_note_id`、`image_scenes`、headers、trace、referrer 不进入 `xhs.detail` `shape_key`。
- `xhs.user_home` 最终只保留 canonical `user_id`；`userId` 或 query `user_id` 只允许作为归一来源，不得并列进入 `shape_key`。
- `xhs.search` 的 `keyword/page/page_size/sort/note_type` 继续由 `FR-0024` 负责，不在本 FR 重新列举为新 truth。

### 3. slotting identity

系统必须冻结：实际 request-context slotting identity 是 `page_context_namespace + shape_key`。

约束：

- 不同 namespace 即使 `shape_key` 相同，也不得共享同一 slot。
- 同 namespace 内只有 canonical `shape_key` 相同的候选才允许进入同一 slot。
- `page_context_namespace` 至少必须区分 `xhs.search`、`xhs.detail`、`xhs.user_home`。
- replacement implementation 不得回退到裸 `path`、裸 `shape_key` 或 command-only slotting。

### 4. bucket state model

系统必须冻结每个 slot 允许承载以下状态：

- `admitted_template`
- `rejected_observation`
- `incompatible_observation`

约束：

- `admitted_template` 只代表可复用的 page-local admitted template。
- `rejected_observation` 只代表最近一次被 capture admission 拒绝、但 shape 已可识别的 candidate。
- `incompatible_observation` 只代表同 namespace、同 route family 但 canonical shape 不一致的最近候选。
- 任何 synthetic / failed source 都不得进入 `admitted_template`。

### 5. capture admission

系统必须冻结 admitted template 的共享准入规则：

1. 来源是页面真实请求
2. 不是 WebEnvoy synthetic request
3. 能导出合法 canonical shape
4. 请求成功完成
5. HTTP 状态属于 2xx

因此：

- synthetic request 只能进入 `rejected_observation`
- failed / non-2xx request 只能进入 `rejected_observation`
- capture admission 拒绝不得被等价成 template hit
- rejected observation 也必须按 `page_context_namespace + shape_key` 分槽

### 6. lookup / eligibility / fail-closed

系统必须冻结以下共享 lookup 与 eligibility 规则：

- lookup 只允许在当前 namespace 内进行
- eligibility 只允许 exact shape match
- exact match 后仍必须通过 freshness gate
- miss、mismatch、stale、rejected_source 都必须 fail closed

合法结果类型：

- `hit`
- `miss`
- `incompatible`
- `stale`
- `rejected_source`

最小 miss reason：

- `template_missing`
- `shape_mismatch`
- `template_stale`
- `synthetic_request_rejected`
- `failed_request_rejected`

补充约束：

- 不允许 silent synthetic fallback。
- 不允许“部分字段命中后局部复用、其余字段重算”的混合路径。
- `request_context_missing` / `request_context_incompatible` 的结构化诊断必须继续保留 machine-readable reason。

### 7. replacement implementation formal gate

系统必须冻结：replacement `#501` successor 在进入 implementation-ready 状态前，必须同时满足以下 formal 输入已经冻结：

1. `#503 / FR-0024`
2. `#504 / FR-0025`
3. `#505 / FR-0026`
4. `#508 / FR-0027`

在这些 formal freeze 完成前：

- 不得把 replacement implementation PR 申报为 implementation-ready
- 不得以“formal 未明确禁止”为由在实现 PR 中自定 shared reuse 语义
- `#501` 不得继续作为当前收口主线

## GWT 验收场景

### 场景 1：detail 与 user_home 必须进入 shared slotting model

Given 当前系统同时支持 `xhs.search`、`xhs.detail`、`xhs.user_home`
When request-context reuse 发生
Then 三条命令都必须通过 `page_context_namespace + shape_key` 进行 slotting
And `xhs.detail` / `xhs.user_home` 不得回退到 command-only 或 path-only slotting

### 场景 2：detail canonical shape 只保留 note_id

Given 当前请求是 `xhs.detail`
When 系统生成 canonical shape
Then shape 必须只包含 `command/method/pathname/note_id`
And `source_note_id` 与 `image_scenes` 不得进入 `shape_key`

### 场景 3：user_home canonical shape 只保留 user_id

Given 当前请求是 `xhs.user_home`
When 系统生成 canonical shape
Then shape 必须只包含 `command/method/pathname/user_id`
And `userId` 或 query `user_id` 只能作为归一来源

### 场景 4：synthetic request 只能进入 rejected observation

Given WebEnvoy 发出一条 synthetic XHS read request
When capture admission 观察到该请求
Then 它必须进入 `rejected_observation`
And 不得进入 `admitted_template`

### 场景 5：shape mismatch 必须 fail closed

Given 当前 namespace 下存在同 route family 但不同 canonical shape 的候选记录
When 系统执行 lookup / eligibility
Then 结果必须是 `incompatible`
And `request_context_miss_reason` 必须保留 `shape_mismatch`
And 不得继续进入 synthetic fallback

### 场景 6：replacement implementation 不能跳过 #508

Given `#503/#504/#505` 已完成 formal freeze
And `#508` 尚未完成 formal freeze
When reviewer 检查 replacement implementation PR 是否可进入实现
Then 该 PR 仍不得被视为 implementation-ready
And 不得宣称 formal 输入已经齐备

## 异常与边界场景

- `xhs.search` 的 search-only shape 仍以后 `FR-0024` 为准；本 FR 不得与其冲突。
- `xhs.detail` canonical identity 仍以 `#505` 为准；本 FR 只冻结其 reuse-shape 与 slotting 语义。
- `xhs.user_home` canonical shape 不得被误写成 `body.userId` 与 `query user_id` 并列双主键。
- shape 命中但模板过旧时，结果必须是 `stale`，而不是 `hit`。
- rejected observation 允许保留最近一次可诊断 candidate，但不得升级为 admitted template。

## 验收标准

1. `xhs.detail` / `xhs.user_home` 已进入与 `xhs.search` 同构的 shared request-context reuse model。
2. `page_context_namespace + shape_key` 已冻结为 slotting identity。
3. admitted / rejected / incompatible 三类 bucket 状态已冻结，且 synthetic / failed source 不进入 admitted template。
4. detail/user_home 的 canonical shape 已冻结为 `note_id` / `user_id` only。
5. exact-match / freshness / fail-closed 的共享 reuse 规则已冻结。
6. replacement implementation 的 formal gate 已明确包含 `#508`，不再误写成只等 `#504/#505`。

## 依赖与前置条件

- `vision.md`
- `docs/dev/roadmap.md`
- `docs/dev/architecture/system-design.md`
- `docs/dev/architecture/system-design/read-write.md`
- `docs/dev/specs/FR-0024-xhs-request-shape-truth/spec.md`
- `docs/dev/specs/FR-0025-xhs-detail-user-home-command-surface-baseline/spec.md`
- GitHub issue `#503`
- GitHub issue `#504`
- GitHub issue `#505`
- GitHub issue `#508`
