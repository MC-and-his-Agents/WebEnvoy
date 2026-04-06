# FR-0015 TODO

> GitHub Issue / PR / Project 是进度真相源。
> 本文件只保留 FR-0015 formal blocker、进入实现前条件和实现停点，不承载本地 closeout 状态账本。

## Review 阶段待办

- 若继续修订 FR-0015 formal 文档，先确认本 FR 只承接 implementation-prep 的冻结输入，不把 formal TODO 扩写为完整实现闭环。
- 若需要调整 scope 或 closeout 描述，先核对 `spec.md`、`plan.md`、`implementation-prep.md` 的角色边界，避免把流程性结论或收口语义写回 `TODO.md`。
- 若需要回写 formal 边界，先对齐 `contracts/` 与 `risks.md` 的冻结内容，避免在 `TODO.md` 重定义 shared contract、风险口径或恢复规则。

## GitHub backlog 承接

- `#361` 是 FR-0015 当前 implementation-prep 第一刀 backlog 的 GitHub 真相源。
- `#361` 承接的第一刀 scope 固定为：identity preflight、`runtime_bootstrap_envelope` contract、`runtime.status` read model，以及 bootstrap 失败后的 stop/retry/recover 边界；不得外扩到安装器产品化、candidate 分发或 `#239` 验证体系。
- `#361` 对应的 stop-ship 触发条件继续以 `risks.md` 为准：identity mismatch、stale bootstrap ack、多信号冲突、陈旧 ready marker、bootstrap 非幂等恢复失败。
- `#361` 对应的验证入口继续以 `implementation-prep.md` 第 5 节与 `plan.md` 的测试/健康矩阵为准：`tests/cli.contract.test.ts` 并发/恢复契约、runtime status contract 回读、bootstrap ack/失败注入、断连恢复与幂等 stop/start 证据。
- 历史实现链路继续以 `#281` 及其已合并 PR 为准；后续任何仍承接 FR-0015 第一刀实现或验证 follow-up 的 issue / PR，都应显式挂接 `#361`。

## 进入实现前条件

- 如后续实现继续改 `runtime.status` 或 `runtime_bootstrap_envelope`，先核对 `contracts/` 中已冻结的状态语义与错误分类，避免通过 `TODO.md` 临时改口径。
- 如进入实现阶段需要推进恢复链路、健康矩阵或 stop-ship 规则，先确认对应验证入口、失败回退与证据产物已在 formal 文档中冻结，而不是通过 `TODO.md` 临时补约束。
- 开始第一刀前，先确认 `#361` 中引用的 stop-ship 与验证入口仍与 `plan.md`、`implementation-prep.md`、`risks.md` 一致；触发 stop-ship 后必须阻断 `runtime.start` 成功路径并产出可复核状态。

## 实现停点

- implementation-prep 阶段的 formal 输入、健康矩阵、恢复路径与 stop-ship 规则，恢复入口分别以 `spec.md`、`plan.md`、`implementation-prep.md`、`contracts/`、`risks.md` 为准。
- candidate 安装/分发路径、最终安装器、CWS 合规与 `#239` 验证体系仍属于后续事项，不在 FR-0015 当前收口范围内完成。
- identity mismatch、stale bootstrap ack、多信号冲突、陈旧 ready marker 与幂等恢复边界的 formal 定义继续以 `risks.md` 为准；本文件只保留 formal 恢复入口，不维护 backlog 或完成态账本。
- 进入实现后若第一刀任一 stop-ship 条件被触发且无法在当前 PR 消解，停在 formal 停点，不以补文案替代恢复/验证证据，不推进 closing 语义。
