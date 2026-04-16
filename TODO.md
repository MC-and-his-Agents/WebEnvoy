# #445 latest-head fresh rerun 准备停点

## 基本信息

- latest head: `e7adc486c7720e406acb21a68ccd9d493b546424`
- 执行现场:
  - worktree: `/Users/mc/dev/WebEnvoy-445-fresh-rerun`
  - branch: `docs/445-latest-head-fresh-rerun`
  - runtime cwd: `/Users/mc/dev/WebEnvoy`
- artifact root: `/tmp/webenvoy-445/e7adc486c7720e406acb21a68ccd9d493b546424/2026-04-16T01:56:26Z`

## 已完成

- 已在 canonical root 执行 `git fetch origin`，确认 `origin/main` 与本地 `main` 同步到 `e7adc486c7720e406acb21a68ccd9d493b546424`
- 已创建新专用 worktree，并在新现场执行 `bash scripts/setup-git-hooks.sh`
- 已完成只读 preflight，`status.json` 确认以下条件成立：
  - `profileDir=/Users/mc/dev/WebEnvoy/.webenvoy/profiles/xhs_001`
  - `identityBindingState=bound`
  - `identityPreflight.failureReason=IDENTITY_PREFLIGHT_PASSED`
  - `installDiagnostics.profileRootMatches=true`
  - `installDiagnostics.launcherExists=true`
  - `installDiagnostics.bundleRuntimeExists=true`
  - `fingerprint_runtime.execution.live_allowed=true`
- 已执行一次 visible `runtime.start` / `runtime.ping` / `runtime.stop` 验证，输出已落到 artifact root

## 当前 current-head 结论

- `runtime.tabs` 已不再是当前 blocker
  - 手写 launcher stdio `bridge.forward(runtime.tabs)` 仍会命中 `unsupported extension request: bridge.forward`，这是 current head 的 transport 历史事实，不是 rerun 当前阻断点
  - 使用仓库现成 `NativeMessagingBridge.runCommand("runtime.tabs")` 的 profile-socket 路径已打通，并拿到当前 search 页 `target_tab_id=1230418194`
- 当前真实 blocker 已转成“CLI-shaped `xhs.search dry_run` 超时”
  - 显式 target-tab `runtime.ping` 成功，说明 search 页 content-script 仍可达，见 `ping-search-tab.json`
  - 显式 target-tab `runtime.main_world_probe` 成功，说明同一 tab 的 main world 也可达，见 `probe-search-main-world.json`
  - 直接 bridge 发送“最小化、未按 CLI 整形”的 `xhs.search` 会立即返回 gate blocked，原因为 `ACTION_TYPE_NOT_EXPLICIT`，见 `direct-search-dry-minimal.json`
  - 直接 bridge 发送“按 `xhs-runtime` 同款整形后的 FR-0023 canonical commandParams”的 `xhs.search` 仍返回 `ERR_TRANSPORT_TIMEOUT`，见 `direct-search-dry-cli-shaped.json`
  - 公共 CLI `./bin/webenvoy xhs.search ...` 在同一 canonical 输入上也返回 `ERR_RUNTIME_UNAVAILABLE / ERR_TRANSPORT_TIMEOUT`，见 `search-dry.json`
  - 这说明阻断点不在 `runtime.tabs`、不在 target tab 缺失，也不在 CLI 输入形状校验；它更像是“进入 FR-0023 canonical `xhs.search` 执行链后，background 已经 pending，但 content-script/handler 没有把结果送回 background”
- ownership 与 cleanup 事实
  - 首次 `xhs.search dry_run` 已把 live runtime ownership 接管到 `issue445-e7adc48-search-dry-001`
  - 同一 owner run_id 下的 `runtime.status` 能读到 `runtimeReadiness=ready`，说明 timeout 发生在 attach 之后，不是因为 runtime 未持锁或 target tab 不可见
  - `runtime.stop --run-id issue445-e7adc48-search-dry-001` 已成功，现场已清回 `profileState=stopped`，见 `stop-blocker-cleanup.json` 与 `status-after-cleanup.json`
- 仍需保留但已降格的历史事实
  - `runtime.stop` 需要复用 owner run_id，这点仍成立，但不再是本轮 rerun 的主 blocker
  - 早期手写 stdio/socket `bridge.forward(runtime.tabs)` 的失败样本只保留为 transport 历史对照，不再作为当前停点描述主线

## 当前 artifact

- `prep-meta.json`
- `launcher-check.json`
- `status.json`
- `start.json`
- `ping.json`
- `tabs-search.json`
- `status-after-start.json`
- `stop.json`
- `ping-search-tab.json`
- `probe-search-main-world.json`
- `direct-search-dry-minimal.json`
- `direct-search-dry-cli-shaped.json`
- `search-dry.json`
- `stop-blocker-cleanup.json`
- `status-after-cleanup.json`

## 下一步

- `#445` 继续保持 open；当前 latest-head fresh rerun 不能判定 closeout
- 下一步不是继续盲跑 `detail/user_home`，而是先收口为什么“按 `xhs-runtime` 同款整形后的 FR-0023 canonical `xhs.search dry_run`”会在 background pending 上超时
- 只有这个 blocker 解除后，才重新从 latest head 重新跑 `search -> detail -> user_home` 的 fresh evidence；本轮已采样的 timeout artifact 只作为 blocker 证据，不作为 closeout evidence
- blocker 清掉后，再决定是否把这次 latest-head rerun 结果回写 formal docs / issue comment
