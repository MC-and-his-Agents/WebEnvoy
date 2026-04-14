# FR-0023 风险与回滚

## 风险 1：匿名请求误用登录态，造成目标站点风险污染

- 表现：`anonymous_context` 请求被静默落到已登录现场，导致读取结果、风控轨迹和资源预算被登录态污染
- 缓解：冻结“匿名请求不得落入目标站点已登录上下文”的正式约束，并要求 `request_admission_result` 显式返回阻断与风险信号
- 回滚：若后续实现未遵守此约束，回退该实现并恢复到阻断匿名污染的保守策略

## 风险 2：上游 grant 与 WebEnvoy request-time admission 语义漂移

- 表现：上游认为 grant 只在表达授权范围，WebEnvoy 却把它误当成内部 execution mode 指令或长期状态真相源
- 缓解：明确 grant 只表达上游范围与约束，内部 mode 归 WebEnvoy 自行映射
- 回滚：删除越界字段或实现，恢复到“grant 只做上游输入”的正式边界

## 风险 3：旧 admission evidence 与新 grant 边界重叠，导致 contract drift

- 表现：`approval_admission_evidence` / `audit_admission_evidence` 被同时当作上游授权对象与 gate 后 persisted trail
- 缓解：明确它们只作为第一版 grant 的兼容 pre-gate 输入，`approval_record / audit_record` 继续承担 gate 后 trail
- 回滚：若后续实现把 evidence 用成 persisted trail，必须拆回 `FR-0010/0011` 的既有边界

## 风险 4：reviewer 把资源策略状态误解为 WebEnvoy 真相源

- 表现：`active / cool_down / paused` 被误读为本 FR 要求 WebEnvoy 接管长期资源运营状态
- 缓解：在 `spec.md`、`contracts/`、`research.md` 中重复明确这些状态归上游持有，WebEnvoy 只返回请求级事实
- 回滚：删除任何把这类状态升级为 WebEnvoy 长期权威的描述

## 风险 5：后续实现跳过 mapping 层直接消费旧对象，导致 formal / implementation 失配

- 表现：实现继续只围绕 `gate_input`、`approval_record`、`session_rhythm_decision` 编程，而没有落新的外部 4 对象 mapping 层
- 缓解：在 `plan.md` 明确后续实现切片必须先做 contract mapping，再做 runtime admission mapping 与 legacy compatibility
- 回滚：拒绝将绕过 mapping 层的实现视为 `#472` 的正式闭环，必要时拆出独立修正 PR

## 风险 6：`account_ref` 漂移为第一版主执行主体

- 表现：后续实现或文档把 `account_ref` 当成可直接执行的主体，迫使 WebEnvoy 接管账号主体建模
- 缓解：冻结 `account_ref` / `subject_ref` 仅为治理引用，若要升级必须重新进入独立 spec review
- 回滚：删除越界主体定义，恢复到 `anonymous_context / profile_session` 双主体边界

## 风险 7：请求级结果对象被扩写成长期资源状态视图

- 表现：`request_admission_result` 或 `execution_audit` 开始持有长期 `active / cool_down / paused` 流转与运营判定
- 缓解：明确两者只返回请求级事实、风险信号与兼容追溯引用
- 回滚：撤销长期状态字段，保留请求级结果最小集
