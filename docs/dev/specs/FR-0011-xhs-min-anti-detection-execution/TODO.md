# FR-0011 TODO（最小反风控执行能力 closeout note）

> 本文件只记录 FR-0011 formal closeout 后仍会影响正式契约解释和后续实现入口的要点，不作为 GitHub issue、Project、里程碑或关闭状态的本地真相源。

## Formal Closeout Note（#365）

- [x] `spec.md`、`plan.md`、`contracts/anti-detection-execution.md`、`research.md`、`risks.md`、`data-model.md` 已构成完整 formal review 输入，本轮 closeout 不再改动其正式契约语义。
- [x] FR-0011 已冻结 Sprint 3 的核心边界：插件层门禁主落点、读路径执行模式收敛、写路径交互分级、最小 session 节律/冷却/恢复、以及 `paused/limited/allowed` 风险状态机。
- [x] FR-0011 已冻结 `#208/#209` 共享的状态机、审批/审计边界、`live_read_limited` 正式公开模式语义、`limited_read_rollout_ready_true` 条件载体，以及 `gate_decision=blocked` 时 `effective_execution_mode` 的正式解释。
- [x] FR-0011 已冻结 `#208` 的 gate-only `page_state` / `key_requests=[]` / `failure_site` 语义，以及 `editor_input` 作为唯一正式验证对象时的验证范围、成功/失败信号、最小 replay 与关闭语义。
- [x] `#365` 在仓库内的职责是回写上述 formal review 结论和解释边界，不替代 `#231` 作为 open FR 锚点的职责，也不把本文件改造成 GitHub 状态快照。

## 时间边界澄清

- [x] `2026-03-23`：`#216` 完成 Sprint / milestone 治理重排；FR-0011 在后续 closeout 中只引用这一既有治理结果，不重复承载排期真相。
- [x] `2026-03-30`：`PR #298` 合入后，FR-0011 冻结了 `#208` 的正式验证边界；“验证前置已冻结、不等于正式验证已完成”的表述只适用于这一阶段。
- [x] `2026-04-02`：`#208` 后续真实验证闭环已完成；因此，FR-0011 closeout 不再把 2026-03-30 的阶段性表述当作当前状态继续复写。
- [x] `2026-04-07`：`#362`、`#363` 已满足前置关系，`#365` 只补 formal closeout truth sync，不把 live evidence 自身作为本 PR 放行依据。

## 关闭后仍需保持的引用关系

- [x] 后续任何 `#209` 范围的 live 扩展或 follow-up 修复，仍应继续引用 FR-0011 已冻结的 Sprint 3 前置。
- [x] 后续任何 `#208` 邻近事项若再次引用 `editor_input`，都必须沿用 FR-0011 已冻结的唯一正式验证边界，而不能回退到 2026-03-30 的阶段性未完成表述。
- [x] `#231` 继续承接 FR-0011 的 open FR 锚点职责；`#217` 仅保留历史起草语义，不再承担 open anchor 语义。

## 后续实现入口

- [ ] 实现插件层门禁主落点（background/content-script/main world）。
- [ ] 实现读路径执行模式收敛（默认 `dry_run/recon` + 受控 live）。
- [ ] 实现写路径交互分级判定与默认阻断。
- [ ] 实现最小 risk 状态机（`paused/limited/allowed`）。
- [ ] 实现 `#208/#209` 三态差异化阻断矩阵（统一判定入口）。
- [ ] 实现 session 节律/冷却/恢复最小约束。
- [ ] 实现状态变更审计落盘与缺失审计回退 `paused` 逻辑。
- [ ] 如需正式引入 `xhs.editor_input` 或 `xhs.interact`，先单独起 command contract 规约 PR。
- [ ] 补齐对应契约测试与状态迁移测试。
