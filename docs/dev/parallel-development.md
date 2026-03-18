# 并行开发与 Worktree 约定

本文档定义 WebEnvoy 在本地并行推进多个 FR / Issue / PR 时的默认操作方式。

## 核心原则

1. `main` 常驻仓库主目录。
2. 每个活跃分支都必须有自己的独立 worktree。
3. 一个 worktree 只服务一个主题，不在同一 worktree 内并行推进多个 FR。
4. `FR` 管范围，`PR` 管变更，`worktree` 管执行现场，不要混用它们的职责。
5. backlog、Sprint、状态流转仍以 GitHub Issues / Projects / Milestones 为准，本地不维护进度真相源。

## 默认映射关系

- 一个核心 FR 通常对应一个主分支、一个主 PR、一个主 worktree。
- 如果一个 FR 需要先做 `spec review` 再做实现，优先沿用同一分支和同一 worktree 连续推进，不额外拆第二个 worktree。
- 如果多个 Issue 明显属于同一主题且必须同审同合，可以共用一个分支 / PR / worktree，但需要在 PR 描述中明确关联全部 Issue。
- 无关主题禁止共用同一个 worktree。

## 命名约定

- 设计 / 规约分支：`docs/FR-XXXX-<slug>`
- 功能分支：`feat/FR-XXXX-<slug>`
- 修复分支：`fix/<scope>-<slug>`
- worktree 路径建议：`$HOME/.codex/worktrees/<repo>/<branch-slug>`

示例：

```text
main                                 -> /Users/.../WebEnvoy
docs/FR-0001-runtime-contract        -> ~/.codex/worktrees/WebEnvoy/docs-FR-0001-runtime-contract
feat/FR-0001-runtime-chain           -> ~/.codex/worktrees/WebEnvoy/feat-FR-0001-runtime-chain
feat/FR-0003-xhs-recon               -> ~/.codex/worktrees/WebEnvoy/feat-FR-0003-xhs-recon
```

## 推荐流程

1. 在 GitHub 中确认当前 Issue / FR 已进入正确的 backlog 或 Sprint。
2. 用 [fr-worktree-open.sh](/Users/mc/Desktop/同步空间/coding/WebEnvoy/scripts/fr-worktree-open.sh) 为目标分支创建独立 worktree。
3. 在该 worktree 内完成文档或代码修改。
4. 用 [fr-pr-open.sh](/Users/mc/Desktop/同步空间/coding/WebEnvoy/scripts/fr-pr-open.sh) 创建或更新 Draft PR，并显式带上 `Fixes #...`。
5. 需要了解并行状态时，用 [dev-status.sh](/Users/mc/Desktop/同步空间/coding/WebEnvoy/scripts/dev-status.sh) 查看活跃 worktree、PR 和清理候选项。
6. PR 合并后，用 [worktree-prune.sh](/Users/mc/Desktop/同步空间/coding/WebEnvoy/scripts/worktree-prune.sh) 清理已完成分支的 worktree。

## Draft PR 顺序

1. FR / 规约分支默认先开 Draft PR。
2. spec review 通过后，再继续实现或转入非 Draft。
3. 实现类 PR 合并前必须经过 [local-pr-review.md](/Users/mc/Desktop/同步空间/coding/WebEnvoy/docs/dev/local-pr-review.md) 规定的本机 review 流程。

## 并行边界

允许并行：

- 运行时主链路与低耦合文档治理项
- 平台读链路侦察与写链路侦察
- 已明确无依赖关系的两个独立 FR

必须串行：

- 同一 FR 的 `spec` 与实现发生边界变更时
- 会同时修改 `.github/workflows/`、`scripts/`、账号、安全、数据读写等高风险区域的改动
- 依赖上游接口、schema 或错误码定义的实现项

## 日常纪律

- 不要在仓库主目录直接切到另一个活跃分支做并行开发。
- 不要在一个 worktree 里顺手修另一个 FR 的问题。
- PR 描述必须带 `Fixes #<issue-number>`，否则 Issue 与分支的关系会失真。
- 已关闭或已合并的 PR 对应 worktree 应尽快清理，避免“看起来还在做”的假象。
- detached worktree 默认视为临时审查现场，不纳入常规开发 worktree 管理。
