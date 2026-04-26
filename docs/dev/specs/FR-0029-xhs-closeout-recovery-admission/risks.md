# FR-0029 风险记录

## 风险 1：把 `#445` 重新当作 live probe harness

- 触发条件：在 `FR-0029` 未冻结或前置未完成时，直接重跑 `#445` full bundle。
- 影响：继续把账号风险、登录态异常和 anti-detection 缺口都压回 `#445`，导致 closeout issue 与实现主线重新混写。
- 缓解：
  - `#445` 继续保持 closeout-only
  - `FR-0029` 明确成为唯一 rerun admission owner
  - 在 `#552` 关闭前，不允许重启 `#445` full bundle

## 风险 2：把 recon recovery probe 误写成 live admission

- 触发条件：把 `options.xhs_recovery_probe=true` 的现有 recon 探针直接当成 live 放行证据。
- 影响：绕过 `#543` 当前实现语义，也绕过 XHS-specific live admission 证明。
- 缓解：
  - recon probe 与 live admission probe 在合同中显式拆成两段
  - 两段使用不同 `probe_bundle_ref`
  - recon probe 通过后仍不得直接进入 `#445`

## 风险 3：跨 scope baseline 混用

- 触发条件：不同 `profile_ref`、`execution_surface`、`effective_execution_mode`、`probe_bundle_ref` 的 validation 结果被混用为同一条恢复证据。
- 影响：`#445` 恢复门失去 machine-checkable 约束，low-risk 或非 real-browser 样本被错误放大。
- 缓解：
  - `FR-0029` 复用 `FR-0020` 的完整作用域键
  - 明确禁止跨 bundle / mode / profile / surface 替代

## 风险 4：把 Layer 4 静默升级成最小硬前置

- 触发条件：实现侧因谨慎或证据偏好，直接把 `#238` 加入恢复门。
- 影响：当前恢复主线被无审查扩 scope，`#552` 与 `#445` truth 再次失配。
- 缓解：
  - `#238` 当前只保留条件升级 hook
  - 任何升级都必须先 truth-sync `#552` 与 `#445`

## 风险 5：把执行现场 profile 名固化成 formal truth

- 触发条件：把 `xhs_001` 这类当前现场 profile 名直接写进 contract 字段或 scope 常量。
- 影响：formal contract 与 canonical `profile_ref` namespace 混淆，后续执行现场切换会被误判为契约变更。
- 缓解：
  - formal contract 只承认 canonical `profile_ref`
  - 具体 profile 名只保留为执行现场事实
