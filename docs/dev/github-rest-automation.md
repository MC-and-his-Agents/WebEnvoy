# GitHub REST-First Automation Notes

本说明用于日常 GitHub 自动化操作，目标是减少对 GitHub GraphQL 配额的隐式依赖。

## 默认命令

- 认证检查：`gh api user --jq .login`
- latest main SHA：`gh api repos/MC-and-his-Agents/WebEnvoy/branches/main --jq .commit.sha`
- 读取 issue：`gh api repos/MC-and-his-Agents/WebEnvoy/issues/<number>`
- 追加 issue comment：`gh api --method POST repos/MC-and-his-Agents/WebEnvoy/issues/<number>/comments -f body='<body>'`
- 读取 PR：`gh api repos/MC-and-his-Agents/WebEnvoy/pulls/<number>`
- 读取 PR reviews：`gh api --paginate --slurp repos/MC-and-his-Agents/WebEnvoy/pulls/<number>/reviews`
- 读取 head checks：`gh api --paginate --slurp repos/MC-and-his-Agents/WebEnvoy/commits/<sha>/check-runs`
- 读取 legacy commit statuses：`gh api repos/MC-and-his-Agents/WebEnvoy/commits/<sha>/status`

## 约束

- 不用 `gh pr view/checks/list/create/review/merge` 作为自动化脚本的默认实现路径。
- 不用 `gh issue view/edit` 或 `gh repo view` 作为自动化脚本的默认实现路径。
- 如果 REST 无法提供某个字段，脚本必须显式记录例外，不得静默回退到 GraphQL-backed helper。
- guardian 与 merge gate 必须继续 fail closed；GraphQL 配额优化不能降低 review、checks、head SHA 或 mergeability 校验。
