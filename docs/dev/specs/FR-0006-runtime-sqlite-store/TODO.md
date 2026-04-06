# FR-0006 TODO

> 本文件记录 FR-0006 formal closeout 结论，不追溯外部 Draft PR 载体事实。

## Formal Closeout Snapshot

- [x] 确认 `spec.md` 只覆盖 Phase 1 最小运行记录基座，不扩张到完整业务仓库
- [x] 确认 SQLite 角色边界明确：证据层，不是实时会话真相源，也不是能力真相源
- [x] 确认 `data-model.md` 字段与约束可直接支撑实现与测试
- [x] 确认 `contracts/runtime-store.md` 输入输出、错误码与兼容策略完整
- [x] 确认 `risks.md` 覆盖并发写入、敏感字段泄露、迁移失败与能力边界误用风险
- [x] 当前 formal 承接 issue 已冻结为 `#359`
- [x] 与 `#356` 的 `run_id/session_id/profile` 复用边界已冻结
- [x] 与 `#357` 的诊断字段映射边界已冻结
- [x] 与 `#360` 的能力证据字段映射边界已冻结
- [x] formal spec review findings / blockers 已收口
- [x] formal 结论：`APPROVE`
- [x] formal 结论：`ready_for_implementation = true`

## Implementation Backlog

- [ ] 实现 SQLite 初始化、WAL 启用与 schema 版本校验
- [ ] 实现运行主记录幂等写入
- [ ] 实现运行事件追加写入与主记录关联约束
- [ ] 实现按 `run_id` 的最小查询接口
- [ ] 实现诊断字段落库的脱敏与截断
- [ ] 补齐单元、契约、集成测试并收集验证证据
