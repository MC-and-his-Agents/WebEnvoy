## 摘要

- 变更目的：
- 主要改动：

## 关联事项

- Issue: {{ISSUE}}
- Closing: {{CLOSING}}

## 风险级别

- `{{RISK_LEVEL}}`
- 判断依据：{{RISK_REASON}}

## 验证

- 已执行：
- 未执行：

## gate_applicability（对 formal spec review PR、live evidence 治理落库 PR，以及所有落入真实 live evidence 专项门禁的 PR 必填）

- review_lane（`general_pr` / `formal_spec_review_pr` / `governance_landing_pr`）:
- governance_scope_targets（仅 `review_lane=governance_landing_pr` 时填写冻结目标文件数组；其他场景写 `[]`）:
- in_scope（`true` / `false`）:
- trigger_reasons（命中触发原因时填写数组；不适用写 `[]`）:
- n_a_allowed（`true` / `false`）:

## live_evidence_record（仅当 `gate_applicability.in_scope=true` 时必填；若 `in_scope=false && n_a_allowed=true`，整块可写 `N/A` 或 `null`）

- latest_head_sha:
- profile:
- browser_channel:
- execution_surface（`real_browser` / `stub` / `fake_host` / `other`）:
- page_url:
- target_tab_id:
- run_id:
- evidence_collected_at（当前 latest head 这次 fresh rerun 的 RFC 3339 UTC 时间）:
- artifact_identity:
- relay_path:
- interaction_locator（或等价交互/观测定位）:
- success_signals:
- minimum_replay:
- artifact_log_ref:
- failure_reason（成功填 `N/A`）:
- blocker_level（成功填 `N/A`）:

## 作者执行现场自述（供 review 参考）

- 本次执行现场：
- worktree / clone 路径：
- 是否保持单 worktree 单 issue/PR：
- PR 创建后是否扩 scope（如有，拆分到哪一个 PR）：
- 纯度预检门禁执行记录（命令与结果）：

## 回滚

- 回滚方式：{{ROLLBACK}}

## 检查清单

- [ ] 已确认本 PR 不直接推送主分支
- [ ] 已确认标题和提交信息符合中文 Conventional Commits 约束
- [ ] 已补充与风险相匹配的验证证据
- [ ] 如有对应 Issue，已在 PR 描述中显式写出正确的关闭语义（`Fixes #...` 或 `Refs #...`）
- [ ] 若本 PR 属于 formal spec review PR、live evidence 治理落库 PR 或落入真实 live evidence 专项门禁，已补齐 `gate_applicability`
- [ ] 若本 PR 落入真实 live evidence 专项门禁，已补齐 latest head 的有效 `live_evidence_record`，且未把 stub/fake host、`runtime.ping` 或 `runtime.bootstrap` 误写为真实闭环证据
- [ ] 如涉及 FR / 架构 / 高风险目录，已补充必要上下文与影响说明
- [ ] 如涉及正式 spec / 架构规约，已先完成 spec review，且未与实现代码混在同一 PR
- [ ] 如本 PR 是正式套件起草 / 修订，已补齐 GWT、异常场景、测试策略与 TDD 范围
- [ ] 作者已填写“执行现场自述”，并提供可复核的纯度预检记录
