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

### 2. in-tree tests 只把 note_id 当作 detail 输入与匹配锚点

- `tests/content-script-handler.xhs-read.contract.test.ts`
- `tests/extension.service-worker.gate-approval.suite.ts`
- `tests/xhs-read-execution.fallback.test.ts`
- `src/commands/__tests__/xhs-input.test.ts`
- `tests/extension.contract.test.ts`

这些测试都稳定围绕 `note_id` 展开，没有把 `image_scenes` 作为 identity 前提。

补充观测：

- `tests/xhs-read-execution.fallback.test.ts` 已出现 `source_note_id`
- current in-tree detail path 仍把这类 artifact 收敛回同一个 canonical `note_id`

### 3. 仓库内缺少 image_scenes admission-ready 证据

在 current repo 中检索：

- `image_scenes`
- `CRD_PRV_WEBP`

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
- `CRD_PRV_WEBP` 必须进入 identity
- detail current identity 需要多字段组合

当前仓库内还能支持一个附加的归一化结论：

- 当 detail artifact 暴露 `source_note_id` 而未直接暴露 `note_id` 时，current v1 仍应把 `source_note_id` 归一化为 canonical `note_id`

因此，本 FR 应冻结“当前不纳入”，而不是继续悬空。
