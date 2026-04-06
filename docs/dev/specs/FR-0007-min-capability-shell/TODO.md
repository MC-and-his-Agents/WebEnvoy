# FR-0007 TODO

> 本文件记录 FR-0007 当前 formal review 准备状态。外部 issue / PR / review / guardian 事实仅在可核实时回写，不在此伪造。

## Formal Review Preparation Snapshot

- [x] `spec.md` 的 GWT 验收场景与异常 / 边界场景已补齐并冻结
- [x] 冻结能力壳最小输入结构（`ability` / `input` / `options`）
- [x] 冻结能力壳最小输出结构（`summary.capability_result`）
- [x] 冻结能力错误细节结构（`error.details`）
- [x] `plan.md`、`contracts/ability-shell.md`、`data-model.md`、`risks.md` 已完成 formal 文档收口
- [x] 当前 formal 承接 issue 已冻结为 `#360`
- [x] 历史 issue `#159` 仅保留来源引用，不再作为当前 formal closeout 承接 issue
- [x] FR-0007 不把 FR-0006 作为持久化真相源；能力结果 / 错误落库映射只在实现承接时继续复核
- [x] 确认 FR-0007 的实现链路必须保持 spec / impl 分离
- [x] issue `#360` 当前只校验 FR-0007 本套件的 formal review 输入是否自洽，不新增 FR-0004 / FR-0006 completion gate

## Formal Review 当前状态

- [x] external formal spec review 已完成并收敛 findings / blockers
- [x] formal 结论：`APPROVE`
- [x] formal 结论：`ready_for_implementation = true`

当前状态说明：

- FR-0007 的本地正式套件主体已收口；`#374` 承载 actual formal-review record，当前 `#360-finalize` 仅负责 final writeback-only。
- FR-0007 的 external formal review 已完成，`APPROVE` 与 `ready_for_implementation = true` 的完成态继续锚定在 `#374` 对应的 formal-review 记录上。

## 进入实现前条件（门禁定义）

- 获得 `APPROVE`
- 获得 `ready_for_implementation = true`
- 确认 FR-0007 的实现链路保持 spec / impl 分离
- 确认 FR-0007 的实现不会重定义 FR-0001 / FR-0004 / FR-0006 的职责边界

## Formal 收口说明

- `#354` 已完成 FR-0001 的 formal 收口回写，因此 FR-0007 依赖的 CLI 外层契约基座已不再构成本地文档阻塞。
- `#355` 已完成 FR-0002 的 formal 收口回写，因此 FR-0007 依赖的最小通信闭环 formal 基座已不再构成本地文档阻塞。
- `#374` 是 actual formal-review record，本次 `#360-finalize` 仅负责 final writeback-only，不重开能力壳输入 / 输出 / 错误边界。
- 当前可确认的是“本套件 formal verdict 的完成态由 `#374` 锚定，当前 PR 只把既有 verdict 写回 TODO”；最终审计仍以 `#374` 这条正式评审记录和当前 PR 的 writeback 记录共同对齐。

## Implementation Backlog

- [ ] 建立能力输入壳解析与校验模块
- [ ] 建立能力输出壳映射模块
- [ ] 建立能力错误细节映射模块
- [ ] 为首个 L3 样本接入能力壳输出
- [ ] 补齐能力壳契约测试与回归用例
- [ ] 在实现承接阶段复核相邻诊断套件边界
- [ ] 对齐 FR-0004 的最小诊断与 `run_id` 关联
