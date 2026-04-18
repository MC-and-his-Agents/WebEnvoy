# FR-0026 研究记录

## 研究问题

`#505` 要回答的是：current v1 `xhs.detail` canonical identity 是否必须包含 `image_scenes`。

## 当前仓库证据

### 1. current implementation 的稳定锚点只有 note_id

- `src/commands/xhs-input.ts`
  - `parseDetailInputForContract()` 只要求 `note_id`
- `src/commands/xhs-runtime.ts`
  - `xhs.detail` 命令当前也只围绕 `note_id` 进入 detail path
- `src/runtime/native-messaging/loopback-runtime.ts`
  - detail loopback 也只以 `note_id` 作为 data-ref 锚点
- `extension/xhs-read-execution.ts`
  - detail 请求当前会组装 `source_note_id` 请求侧字段

### 2. in-tree tests 只把 note_id 当作 detail 输入与匹配锚点

- `tests/content-script-handler.xhs-read.contract.test.ts`
- `tests/extension.service-worker.gate-approval.suite.ts`
- `tests/xhs-read-execution.fallback.test.ts`
- `src/commands/__tests__/xhs-input.test.ts`
- `tests/extension.contract.test.ts`

这些测试都稳定围绕 `note_id` 展开，没有把 `image_scenes` 作为 identity 前提。

补充观测：

- `tests/xhs-read-execution.fallback.test.ts` 已验证 `/api/sns/web/v1/feed` POST body 使用 `source_note_id`
- `FR-0005` 研究中的 `detail-primary-01` / `detail-primary-02` 进一步证明 `/api/sns/web/v1/feed` 在 repo baseline / browser first hand 中都观测到 `source_note_id`
- 但这些证据分别停留在 synthetic、candidate 或 failed 层级；当前仓库仍缺少足够证据去把它冻结成 admitted canonical mapping、verified request transport truth、跨路由 transport alias、route admission 规则、其他 placement 或其他路由的一般化 normalization 规则
- formal 也不应把未验证的其他字段、未验证路由或未验证 mapping relation 写成 identity truth

### 3. 仓库内缺少 image_scenes admission-ready 证据

在 current repo 中检索：

- `image_scenes`

未发现 runtime / extension / tests / formal contract 中的稳定 identity 使用证据。

### 4. 来自 #503 的 formal review 结论

`#503` 的 guardian 多轮 finding 已稳定指出：

- 当前证据不足以前，不应把 `image_scenes` 冻结为 detail canonical identity
- formal suite 应把该问题显式拆到独立 follow-up，而不是在 search-only FR 中顺手写死

## 结论

当前仓库内可被 formal 消费的最小稳定结论只有一个：

- current v1 `xhs.detail` canonical identity 只包含 `note_id`

当前仓库内还不能支持以下结论：

- `image_scenes` 必须进入 identity
- detail current identity 需要多字段组合

当前仓库内还只能支持一个更窄的 artifact-side 结论：

- 在当前已观测到的 `/api/sns/web/v1/feed` request artifact 上，`source_note_id` 只是一条 synthetic / candidate / failed 层级的 request-side 观测事实
- 它仍不足以被 formalize 为 admitted canonical mapping、verified transport truth、跨路由 transport alias、第二个 identity 字段或其他 route 的通用 normalization 规则

因此，本 FR 应冻结“current v1 canonical identity = note_id only；image_scenes 当前不进入 identity；`source_note_id` 仍停留在 observed/candidate 层，不进入 admitted canonical mapping formal freeze”，而不是继续扩 scope。
