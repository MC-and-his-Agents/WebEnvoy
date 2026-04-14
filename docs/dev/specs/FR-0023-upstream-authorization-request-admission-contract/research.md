# FR-0023 研究与取舍

## 研究问题 1：为什么外部主协议不用 `live_read_limited / live_read_high_risk`

结论：

- 这些 mode 是 WebEnvoy 内部运行时语义，不是上游审批主语义。
- 若上游直接以这些 mode 建模授权，会把 `FR-0010/0011/0014` 的内部 gate、risk_state、session rhythm 细节泄漏成外部主模型。
- 这会让上游系统被迫理解 WebEnvoy 的内部策略分层，而不是表达“允许哪个资源做什么动作”。

因此本 FR 选择：

- 外部主协议以 `action_request + resource_binding + authorization_grant + runtime_target` 为骨架。
- 内部 mode 仍由 WebEnvoy 在 request-time admission 阶段决定。

## 研究问题 2：为什么第一版资源主体只冻结 `anonymous_context / profile_session`

结论：

- `#470` 已冻结第一版资源主体为 `anonymous_context` 与 `profile_session`。
- 这两类主体已经足以表达“匿名视角执行”和“会话依赖执行”两种当前必须区分的资源边界。
- 继续引入更多主体会把 formal spec 提前扩写成账号运营产品设计。

因此本 FR 选择：

- 第一版正式主体只冻结 `anonymous_context` 与 `profile_session`。
- 上游仍可附带治理引用，但不增加新的主执行主体。

## 研究问题 3：为什么 `account_ref` 只做治理引用

结论：

- `account_ref` 更适合表达“上游如何把 WebEnvoy 使用的执行主体映射回自身治理对象”。
- 但 WebEnvoy 当前产品边界不是账号矩阵或长期账号运营系统。
- 若让 `account_ref` 直接成为主执行主体，会导致 WebEnvoy 被迫承担账号主体建模、资源状态与运营语义。

因此本 FR 选择：

- `account_ref` / `subject_ref` 只保留为治理引用。
- 第一版请求若只给 `account_ref` 而不给合法 `resource_binding`，必须阻断，不能让 WebEnvoy 自行猜测主体。

## 研究问题 4：为什么 `active / cool_down / paused` 留在上游

结论：

- 这些语义描述的是资源策略状态与长期运营决策，更适合由上游系统持有。
- WebEnvoy 仍需要保留请求期 admission、即时保护、风险信号和执行证据回传。
- 若 WebEnvoy 成为这类状态的长期真相源，会与产品边界冲突，并与 `FR-0014` 的内部节律控制混淆。

因此本 FR 选择：

- grant 可以携带资源状态快照 / 声明。
- WebEnvoy 只把它当输入事实，并返回请求级判断结果。
- WebEnvoy 不拥有这类状态的长期运营权威。

## 研究问题 5：为什么 `FR-0014` 节律状态不直接暴露成上游运营状态

结论：

- `FR-0014.session_rhythm_*` 描述的是 WebEnvoy 内部执行链路的节律、恢复探针与 cooldown 控制。
- 这些对象与 `FR-0010/0011` 的 gate、approval、audit 强耦合，属于内部运行时事实。
- 若直接暴露为上游运营状态，会造成“内部节律状态”和“上游资源策略状态”的双真相源。

因此本 FR 选择：

- `FR-0014` 继续保持内部 ownership。
- 其 `allowed / blocked / deferred` 结果只影响 request-time admission / execution_audit。
- 上游只看到请求级事实与风险信号，不把内部节律状态误写成长期资源状态。

## 迁移表

| 现有 formal 对象 | 在 FR-0023 中的角色 | 迁移结论 |
| --- | --- | --- |
| `FR-0010.gate_input` | 内部 gate 输入 | 由 4 个外部对象归一化生成 |
| `FR-0010.approval_record` | gate 后 persisted trail | 保留，不承担上游授权输入本体 |
| `FR-0010.audit_record` | gate 后 persisted trail | 保留，不承担上游授权输入本体 |
| `FR-0011.approval_admission_evidence` | 第一版 grant 兼容输入 | 继续作为 pre-gate evidence |
| `FR-0011.audit_admission_evidence` | 第一版 grant 兼容输入 | 继续作为 pre-gate evidence |
| `FR-0014.session_rhythm_*` | 内部节律与恢复控制 | 继续内部 ownership，不升级为上游运营状态 |

## 未决但已明确不在本 FR 内处理的问题

- 后续实现如何选择具体 mapping 层模块与命令入口。
- `#468` 的实现修复如何与新 mapping 层对齐。
- `#445` 在实现完成后的 next fresh rerun 计划。
- 若未来需要把 `account_ref` 升级为正式执行主体，应另开独立 formal spec。
