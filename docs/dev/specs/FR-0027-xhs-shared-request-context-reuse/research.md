# FR-0027 研究记录

## 研究问题 1：为什么 slot identity 必须拆成两层，而不是写成一套并列公式

结论：

- `FR-0024` 已冻结：request-context 的实际 shape slot identity 是 `page_context_namespace + shape_key`。
- 但 shared reuse 又要求 lookup 先在当前 namespace 内选定同 route family 的候选 bucket，再在 bucket 内做 exact-shape 命中。
- 因此这里存在两层身份：
  - route bucket identity：`page_context_namespace + route_scope`
  - shape slot identity：`page_context_namespace + shape_key`
- 若把 `route_scope` 再并列写进 shape slot identity，就会形成第二套 slot 公式，重新破坏 `FR-0024` 已冻结的单一 shape-slot truth。

仓库内依据：

- `docs/dev/specs/FR-0024-xhs-request-shape-truth/spec.md`
  - 先按 route family 解析当前页面现场候选 bucket，再按 `shape_key` / `shape` 判定 exact hit
  - 有效缓存身份必须显式包含 `page_context_namespace + shape_key`
- `docs/dev/specs/FR-0024-xhs-request-shape-truth/contracts/request-context-shape.md`
  - lookup 先选 route bucket，再做 shape 级判定
  - shape slot / rejected observation 的有效保留键仍是 `page_context_namespace + shape_key`

因此本 FR 选择：

- 明确把 route bucket identity 与 shape slot identity 拆开冻结
- 不允许再把 `route_scope` 写成与 `shape_key` 并列的第二套 shape slot identity

## 研究问题 2：为什么当前还不能冻结 detail referrer / transport 派生 `note_id`

结论：

- `#504 / FR-0025` 已冻结：`xhs.detail` 的唯一 target-page baseline 是 `explore_detail_tab`。
- 但 current repo main 上仍缺少 admission-ready 的仓库内证据，去证明 `/explore/<note_id>` referrer 恢复规则已经可以被 formalize 为 admitted canonical derivation truth。
- 当前仓库更没有证据支持把 `source_note_id`、其他 transport alias 或其他页面路径升格为 formal truth。

仓库内依据：

### 1. target-page baseline 已经收窄到 detail 页现场

- `docs/dev/specs/FR-0025-xhs-detail-user-home-command-surface-baseline/spec.md`
  - `xhs.detail` 的 current target-page baseline 是 `explore_detail_tab`
  - target-page 不为 `explore_detail_tab` 时必须按 invalid-args / blocked 处理
- `src/commands/xhs-input.ts`
  - `xhs.detail` 在非 `explore_detail_tab` 时直接拒绝

### 2. 当前 repo main 上缺少 admission-ready derivation evidence

- `extension/xhs-read-execution.ts`
  - detail 请求仍以 canonical `note_id` 作为命令输入与 runtime data-ref 锚点
  - 但现有代码与测试没有形成足够的 formal 证据，证明 referrer 恢复规则已经可以升格为 admitted derivation truth
- `tests/xhs-read-execution.fallback.test.ts`
  - 能证明 detail current request transport 仍围绕 `source_note_id`
  - 但不能证明 `/explore/<note_id>` referrer 恢复已经成为 admission-ready formal rule

### 3. 当前仓库仍缺少 derivation formal 化所需证据

- 没有证据支持把 `source_note_id` 冻结为 admitted canonical derivation input
- 没有证据支持把 `/explore/<note_id>` referrer 恢复冻结为 current formal truth
- 没有证据支持把任意其他 referrer、pathname 或跨页面 transport alias 冻结为 formal truth

因此本 FR 选择：

- 当前 formal contract 只承认 canonical `note_id`
- detail referrer / transport derivation 继续保持 deferred
- 如未来要把 `/explore/<note_id>` referrer 恢复规则升格为 formal truth，必须先补足仓库内 latest-main runtime / test 证据，再单独修订
