# FR-0029 研究记录

## 研究问题

1. 当前仓库是否已经存在一条 XHS-specific formal owner，负责定义 `#445` 的 rerun admission。
2. 当前 runtime / command contract 中，恢复探针、account safety、rhythm gate、validation view 的最小已冻结 surface 是什么。
3. `#238` 当前是否已经被正式升级为 `#445` 恢复的最小硬前置。

## 当前事实

### 1. `#445` 仍是 closeout-only

- `#445` 当前职责仍是 latest-main XHS closeout。
- `#445` 的 close condition 没有变化。
- 当前最新 truth 已经改成：`#445` blocked until anti-detection readiness baseline is implemented and merged-main verified。
- 但在 `FR-0029` 之前，仓库里还没有一条正式 FR 专门 owning “如何从恢复链重新回到 `#445`”。

### 2. 当前已有恢复 surface

当前 repo 已经存在、且本 FR 只能复用不能重定义的 surface：

- `runtime.status.account_safety`
- `runtime.status.xhs_closeout_rhythm`
- `runtime.audit.anti_detection_validation_view`
- `xhs.search`
- `xhs.detail`
- `xhs.user_home`
- `options.xhs_recovery_probe=true`

其中一个关键 current-main 实现事实是：

- `options.xhs_recovery_probe=true` 当前只允许 `xhs.search + requested_execution_mode=recon`
- 它不是 live admission probe
- 因此恢复路径必须使用“两阶段恢复”，而不是静默改写现有语义

### 3. 当前 anti-detection 主树与恢复依赖

当前最小恢复前置已经在 GitHub truth 中固定为：

- `#265 / FR-0012`
- `#267 / FR-0013`
- `#266 / FR-0014`
- `#239 / FR-0020`
- `#552 / FR-0029`

这些 issue 里，`FR-0012/0013/0014` 各自拥有 layer 能力，`FR-0020` 拥有 validation baseline 对象家族，但它们都不直接拥有 `#445` rerun admission 的最终聚合语义。

### 4. `#238` 当前状态

- `#238 / FR-0022` 当前仍然 open。
- `#445` 和 `#552` 的 GitHub truth 都已经明确：`#238` 当前不是最小恢复硬前置。
- 但它不能被遗忘，后续若事实要求，必须通过显式 truth-sync 升级。

### 5. 为什么不能把具体 profile 名写进 contract

- 仓库 formal 体系普遍使用 canonical `profile_ref` namespace。
- `FR-0020`、`FR-0022` 都已把 `profile_ref` 作为作用域键，而不是把某个具体 profile 名冻结成 formal constant。
- `xhs_001` 当前只是执行现场事实，不应升级为 `FR-0029` 的契约字段。
