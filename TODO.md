# #445 latest-head fresh rerun 停点

## 基本信息

- latest head: `c9ba10a9772006119bfd29f6c15f93d04eebc22a`
- 执行现场:
  - worktree: `/Users/mc/dev/WebEnvoy-445-fresh-rerun`
  - branch: `docs/445-latest-head-fresh-rerun`
  - runtime cwd: `/Users/mc/dev/WebEnvoy`
- artifact root: `/tmp/webenvoy-445/c9ba10a9772006119bfd29f6c15f93d04eebc22a/2026-04-16T05:29:07Z`

## 已完成

- 已在 canonical root 执行 `git fetch origin`，确认 `origin/main` 与本地 `main` 同步到 `c9ba10a9772006119bfd29f6c15f93d04eebc22a`
- 已创建新专用 worktree，并在新现场执行 `bash scripts/setup-git-hooks.sh`
- 已完成只读 preflight，`status.json` 确认以下条件成立：
  - `profileDir=/Users/mc/dev/WebEnvoy/.webenvoy/profiles/xhs_001`
  - `identityBindingState=bound`
  - `identityPreflight.failureReason=IDENTITY_PREFLIGHT_PASSED`
  - `installDiagnostics.profileRootMatches=true`
  - `installDiagnostics.launcherExists=true`
  - `installDiagnostics.bundleRuntimeExists=true`
  - `fingerprint_runtime.execution.live_allowed=true`
- 已完成 latest-head fresh rerun 的 runtime 基线：
  - `runtime.start` 成功：`issue445-c9ba10a-start-003`、`issue445-c9ba10a-start-004`
  - `runtime.ping` 成功：`issue445-c9ba10a-ping-002`、`issue445-c9ba10a-ping-003`
  - fresh detail/profile 链接已在真实 `xhs_001` 窗口打开，并拿到实际 `target_tab_id`

## 当前 current-head 结论

- latest-head fresh rerun 已完成，但 `#445` 仍不能 closeout；当前 formal 结论继续保持 `No-Go/paused`，issue 状态维持 `OPEN`
- 本轮 fresh 结果已证明：
  - `xhs.search`、`xhs.detail`、`xhs.user_home` 公开 CLI 命令面都存在
  - `xhs.search dry_run` 成功
  - `xhs.detail dry_run` 成功，真实 `target_tab_id=1230419134`
  - `xhs.user_home dry_run` 成功，真实 `target_tab_id=1230419136`
- 当前 latest-head 的 live blocker 已分化为两类：
  - `xhs.search live`：
    - `run_id=issue445-c9ba10a-search-live-002`
    - `error.code=ERR_EXECUTION_FAILED`
    - `error.details.reason=GATEWAY_INVOKER_FAILED`
    - `request_admission_result.admission_decision=allowed`
    - `execution_audit` 已进入错误详情，`risk_signals=["NO_ADDITIONAL_RISK_SIGNALS"]`
    - 说明 formal admission / execution_audit 接线已生效，但真实请求执行上下文仍不足以完成 `/api/sns/web/v1/search/notes`
  - `xhs.detail live` / `xhs.user_home live`：
    - `run_id=issue445-c9ba10a-detail-live-001`
    - `run_id=issue445-c9ba10a-user-home-live-001`
    - 两者都返回 `ERR_PROFILE_LOCKED`
    - 失败详情一致指向：`runtime_readiness=recoverable`、`transport_state=disconnected`、`lock_held=false`
    - 但失败后 `runtime.ping` 仍可恢复成功，说明真实 blocker 在 live read 执行前后的 runtime transport ownership / attach 稳定性，而不是 detail/profile tab 本身缺失
- 已淘汰的旧表述：
  - `detail/user_home` 无公开 CLI 命令入口：已不再成立
  - `runtime.tabs` 是当前主 blocker：已不再成立
  - `e7adc48` 那轮 `xhs.search dry_run timeout` 是 current latest-head 结论：已不再成立

## 当前 artifact

- `start-003.json`
- `ping-002.json`
- `search-dry.json`
- `search-live.json`
- `detail-dry-params.json`
- `detail-dry.json`
- `detail-live-params.json`
- `detail-live.json`
- `user-home-dry-params.json`
- `user-home-dry.json`
- `user-home-live-params.json`
- `user-home-live.json`
- `start-004.json`
- `ping-003.json`
- `ping-after-detail-live-001.json`（见 CLI stdout 记录）
- `stop-recover-001.json`
- `stop-004.json`

## 下一步

- `#445` 继续保持 open；当前 latest-head fresh rerun 不能判定 closeout
- 下一步不再讨论 formal spec 或 shared truth，而是分别收口两类 runtime blocker：
  - `xhs.search live` 的 `GATEWAY_INVOKER_FAILED`
  - `xhs.detail live` / `xhs.user_home live` 的 runtime transport disconnect / `ERR_PROFILE_LOCKED`
- 只有在三条命令都拿到 latest-head fresh live evidence 后，才允许把 `#445` 改成 closeout
- 当前这轮 `c9ba10a` artifact 应作为 issue `#445` 的最新 blocker 证据回写，不再沿用 `e7adc48` 的旧停点描述
