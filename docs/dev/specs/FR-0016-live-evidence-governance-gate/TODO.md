# FR-0016 TODO

> GitHub Issue / PR / Project 是进度真相源。
> 本文件只保留 FR-0016 formal blocker、拆分要求和进入治理落库前条件，不维护本地完成态账本。

## Review 阶段待办

- [ ] 若继续修订 FR-0016 formal 文档，先确认本 FR 只承接 `#310` 的治理输入冻结，不把 TODO 扩写为治理落库执行清单。
- [ ] 若需要调整专项门禁触发条件，先同时核对 `spec.md`、`contracts/live-evidence-gate.md` 与 `risks.md`，避免再次出现文档间口径漂移。
- [ ] 若需要修订 `N/A`、`Fixes` / `Refs` 或 `merge-ready` 语义，先确认 reviewer / guardian / PR 模板三者是否仍引用同一套前提。

## 进入治理落库前条件

- [ ] FR-0016 的 spec review 已通过，且 reviewer 明确认可“formal spec PR 与治理落库 PR 分离”。
- [ ] `contracts/live-evidence-gate.md` 已冻结最低字段、适用范围与无效 evidence 集合，不再依赖口头补充。
- [ ] 当前 `#311` 已根据 formal 结论做出后续动作：关闭、转 Draft，或拆成新的治理落库 PR；不得继续以“缺 formal 输入”的状态申报可合并。
- [ ] 后续治理落库 PR 已明确只承接 `.github/PULL_REQUEST_TEMPLATE.md`、`AGENTS.md`、`code_review.md`、`docs/dev/AGENTS.md`、`docs/dev/review/guardian-review-addendum.md` 五处同类回写，不混入其他治理事项。
- [ ] 后续治理落库 PR 的 closing semantics 已按实际闭环程度选择：未完整满足 `#310` 关闭条件时使用 `Refs #310`；若已完整落库五处治理文案并满足关闭条件，则使用 `Fixes #310`。

## 实现停点

- [ ] formal spec review 未通过前，停在 FR-0016 套件，不继续扩写 live evidence 门禁实现文案。
- [ ] 若 reviewer 认为 `#310` 仍缺更上位架构输入，先回到 formal 规约链路，不在 `#311` 中继续补门禁措辞。
- [ ] 若后续治理落库 PR 再次混入 spec-only 以外的 scope，必须拆 PR，而不是在 TODO 中继续记录例外。

## Handoff（2026-04-04）

### 停点

- #322 spec PR 当前停在 FR-0016 套件规约线，不切 #311 落库线。
- #322 PR 仍是 Draft：<https://github.com/mcontheway/WebEnvoy/pull/322>
- #322 spec worktree：`/Users/mc/dev/worktrees/WebEnvoy-FR-0016-live-evidence-governance-gate`
- 当前 HEAD：`ea11a6a3f75f077ec20a3b92aa589b5be4f9f09c`
- 当前工作区干净：`git status --short --branch` 仅显示当前分支跟踪信息，无未提交文件。
- 已按用户要求 kill 掉后台 guardian：原 `scripts/pr-guardian.sh review 322 --post-review` 进程组 `56398` 已 `kill -TERM -56398`，复查 `ps -axo pid=,ppid=,pgid=,command= | rg 'pr-guardian\\.sh|webenvoy-pr-guardian'` 无残留审查进程。

### 最近已完成的规约修正

- 补齐 `docs/dev/review/guardian-review-addendum.md` 为后续治理落库 PR 的同步对象。
- 冻结 `live_evidence_record` 最低字段全集，避免只保护 `latest_head_sha` / `execution_surface`。
- 对齐 `spec.md` 与 `contracts/live-evidence-gate.md` 的字段名、成功态 `failure_reason/blocker_level=N/A` 规则。
- 补齐 `gate_applicability.in_scope=false` 时 `n_a_allowed=true` 的约束，以及 `live_evidence_record` 可省略或置 `null` 的 `N/A` 路径。
- 明确 `spec_review_not_completed` 在 `in_scope=false` 时仍必须产出 `status=blocked`。
- 放开 `status=not_applicable` 下按普通 Issue 闭环语义选择 `n_a` / `refs_only` / `fixes_allowed`。
- 重构 `risks.md` 的“最小门禁矩阵”为 `contracts/live-evidence-gate.md` 的状态镜像摘要，避免继续维护弱化版第三套状态机。
- 补齐 `status=ready` 下 `closing_semantics` 可选择 `refs_only` 或 `fixes_allowed`，并在 `spec.md` 写清“证据已齐但阶段性引用 issue 时仍可 Refs，不得被专项门禁强制改 Fixes”。

### 最近一次门禁与 review 状态

- 本地门禁已过：
  - `git diff --check`
  - `SPEC_GUARD_BASE_REF=origin/main bash scripts/spec-guard.sh`
  - `bash scripts/docs-guard.sh`
- #322 远端 checks 已全绿，且对应当前 HEAD `ea11a6a3f75f077ec20a3b92aa589b5be4f9f09c`：
  - `Validate Commit Messages` = SUCCESS
  - `Validate Docs And Scripts` = SUCCESS
  - `Validate Spec Review Boundaries` = SUCCESS
  - `Run Tests` = SUCCESS
- 最近一次已完成 guardian verdict 是在 `4efeb8c4657c718179ea73fc51fed98a24862dbb` 上的 `REQUEST_CHANGES`：
  - blocker：`contracts/live-evidence-gate.md` 未表达合法的 `status=ready + closing_semantics=refs_only` 组合
  - 该问题已由当前 HEAD `ea11a6a3f75f077ec20a3b92aa589b5be4f9f09c` 修正，但尚未跑完一轮新的 guardian verdict
- 针对 `ea11a6a3f75f077ec20a3b92aa589b5be4f9f09c` 的 guardian 审查曾启动，但在用户要求 handoff 前被人工终止，因此没有可用的新 verdict。

### 恢复后第一步

- 先复查现场是否仍与本 handoff 一致：
  - `git status --short --branch`
  - `git rev-parse HEAD`
  - `gh pr view 322 --json isDraft,headRefOid,mergeStateStatus,reviewDecision,statusCheckRollup`
  - `ps -axo pid=,ppid=,pgid=,command= | rg 'pr-guardian\\.sh|webenvoy-pr-guardian'`
- 若 HEAD 仍是 `ea11a6a3f75f077ec20a3b92aa589b5be4f9f09c` 且 checks 仍全绿，则直接重新跑：
  - `bash scripts/pr-guardian.sh review 322 --post-review`
- 若 guardian 返回 `APPROVE`，再把 #322 从 Draft 转 Ready，随后按受控流程合并，不要裸 `gh pr merge`：
  - `bash scripts/merge-pr.sh 322 --delete-branch`

### 恢复约束

- 恢复后仍必须先只推进 #322，不切 #311。
- 不要把新的 spec 讨论塞回 #311；#311 只能在 #322 合并后，按已冻结 FR-0016 结论做五处治理文案落库。
- 如果 guardian 继续返回 REQUEST_CHANGES，优先判断是不是 `contracts/live-evidence-gate.md` 这个单一状态机真源还有组合态未建模，再同步镜像到 `spec.md` / `data-model.md` / `risks.md`；不要回到“只修最新一条自然语言描述”的碎片化路径。
