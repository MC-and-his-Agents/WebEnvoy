# FR-0015 TODO

> GitHub Issue / PR / Project 是进度真相源。
> 本文件只保留 FR-0015 formal blocker、进入实现前条件和实现停点，不承载本地 closeout 状态账本。

## Review 阶段待办

- [ ] 若继续修订 FR-0015 formal 文档，先确认本 FR 只承接 implementation-prep 的冻结输入，不把 formal TODO 扩写为完整实现闭环。
- [ ] 若需要调整 scope 或 closeout 描述，先核对 `spec.md`、`plan.md`、`implementation-prep.md` 的角色边界，避免把流程性结论或收口语义写回 `TODO.md`。
- [ ] 若需要回写 formal 边界，先对齐 `contracts/` 与 `risks.md` 的冻结内容，避免在 `TODO.md` 重定义 shared contract、风险口径或恢复规则。

## 进入实现前条件

- [ ] 如后续实现需要新增 persistent identity 字段、bootstrap 持久事实或新的 profile 元数据，先补实现级 spec review、字段约束与回滚说明。
- [ ] 如后续实现继续改 `runtime.status` 或 `runtime_bootstrap_envelope`，先核对 `contracts/` 中已冻结的状态语义与错误分类，避免通过 TODO 临时改口径。
- [ ] 如进入实现阶段需要推进恢复链路、健康矩阵或 stop-ship 规则，先确认对应验证入口、失败回退与证据产物已在 formal 文档中冻结，而不是通过 `TODO.md` 临时补约束。

## 实现停点

- [ ] implementation-prep 阶段的 formal 输入、健康矩阵、恢复路径与 stop-ship 规则，恢复入口分别以 `spec.md`、`plan.md`、`implementation-prep.md`、`contracts/`、`risks.md` 为准。
- [ ] candidate 安装/分发路径、最终安装器、CWS 合规与 `#239` 验证体系仍属于后续事项，不在 FR-0015 当前收口范围内完成。
- [ ] identity mismatch、stale bootstrap ack、多信号冲突、陈旧 ready marker 与幂等恢复边界的 formal 定义继续以 `risks.md` 为准；本文件只保留未决 formal 停点，不维护完成态账本。
