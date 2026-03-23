# FR-0011 风险与回滚

## 风险 1：门禁仍停留在文档，未形成执行约束

- 触发条件：实现阶段绕过 FR-0011 契约对象，继续口头放行 live。
- 影响：`#208/#209` 恢复路径失真，账号风险继续放大。
- 缓解：
  - 以 `contracts/anti-detection-execution.md` 作为实现前置。
  - 在进入实现前条件中要求状态机与模式规则可测试。
- 回滚：
  - 恢复默认 `dry_run/recon`。
  - 阻断任何高风险 live 开关。

## 风险 2：插件层门禁责任不清导致实现漂移

- 触发条件：把核心门禁下沉到 CLI 参数层或散落在多个模块。
- 影响：审计不可追踪，执行行为不可控。
- 缓解：
  - 明确 background/content-script/main world 责任边界。
  - 禁止 “CLI 主判定” 语义。
- 回滚：
  - 回到 `plugin_gate_ownership` 契约重审后再进实现。

## 风险 3：状态机定义过粗导致误放行

- 触发条件：仅有状态名，没有迁移条件和硬阻断对象。
- 影响：`paused` 状态仍可能执行高风险动作。
- 缓解：
  - 冻结最小迁移规则与 `hard_block_when_paused`。
  - 将缩减阻断项视为 spec review 阻断。
- 回滚：
  - 强制恢复到 `paused` 并仅允许 `recon`。

## 风险 4：`#208/#209` 阻断矩阵分叉导致治理失效

- 触发条件：两条链路分别维护阻断规则，状态机名义一致但动作边界不一致。
- 影响：同一风险状态下出现不同放行结论，审查与审计口径失真。
- 缓解：
  - 在契约层冻结 `issue_action_matrix`，统一三态并显式定义差异化动作边界。
  - 将 “绕过统一矩阵直接放行” 设为阻断项。
- 回滚：
  - 立即停用分叉规则，恢复共享矩阵版本。
  - 将状态统一降到 `paused`，只允许 `dry_run/recon`。

## 风险 5：状态变更缺失审计导致不可追责

- 触发条件：状态迁移没有完整审计字段，或记录与 run/session 不可关联。
- 影响：无法确认恢复是否合法，误放行后无法回溯与快速止损。
- 缓解：
  - 冻结 `risk_transition_audit` 必填字段。
  - 审计缺失默认执行 `force_pause_and_block_live`。
- 回滚：
  - 将当前会话状态回退到 `paused`。
  - 禁止 live 放行，直至补齐审计链路并复审。

## 风险 6：公开模式与阻断语义不一致导致上层误判

- 触发条件：`live_read_limited` 被公开为正式模式，但审批证据、审计约束或 `effective_execution_mode` 语义未冻结一致。
- 影响：CLI、background、loopback 与 runtime.audit 对同一请求返回不一致口径，上层会把未实际执行的模式误判为已执行模式。
- 缓解：
  - 在 FR-0011 中冻结 `live_read_limited` 的公开模式语义、审批前置与审计字段。
  - 明确 `gate_decision=blocked` 时 `effective_execution_mode` 只能表示真实未继续 live 的降级模式。
- 回滚：
  - 撤回公开枚举扩张，恢复到 `dry_run|recon` + 已冻结 live 模式口径。
  - 重新进入 spec review，禁止实现分支继续扩写。

## Stop-Ship 条件

- FR-0011 spec review 未通过却启动实现 PR。
- `paused` 状态仍允许高风险 live 写动作。
- `#208` 在未接入 FR-0011 前置前恢复 live 正式验证。
- 未完成统一矩阵接入却放行 `#208/#209` live 扩展。
- 状态迁移审计缺失但系统仍允许 live 放行。
- `live_read_limited` 已公开到正式入口，但审批证据或 `effective_execution_mode` 语义仍存在分叉。
