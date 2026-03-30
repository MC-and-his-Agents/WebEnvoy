# #208 最小页面交互动作收口说明

> 类型：中等事项设计说明
> 关联 Issue：#208
> 工作现场：`/Users/mc/dev/worktrees/WebEnvoy-208`
> 分支：`feat/208-phase1-min-page-interaction-verification`

## 背景

`#208` 的职责不是补完整写能力，而是把 Phase 1 剩余的“至少一种最小页面交互动作已可验证”收成一个最小、可审查、可关闭的正式闭环。

截至 2026-03-30，Sprint 2 / Sprint 3 已把风险门禁、统一状态机、交互分级、session 节律与审计链路接入主干。本次链路在此基础上补齐了 `editor_input` 的真实执行闭环与正式验证证据。

## 目标

- 冻结 `#208` 的唯一正式候选动作。
- 明确该动作的范围、非范围、前置条件与成功/失败判定边界。
- 明确本次实现为什么已足以把 `#208` 推进到可收口状态。

## 非目标

- 不交付完整小红书发布闭环。
- 不把图片上传、富文本编辑、多步骤提交混入同一事项。
- 不扩张到能力封装、L2 通用层、下载能力或 `#155/#156/#157`。
- 不把 FR-0008 的 Spike 候选直接当成 `#208` 已完成。

## 范围

- 受影响事项：`#208`
- 受影响页面：`creator.xiaohongshu.com/publish`
- 受影响动作：`editor_input`
- 受影响约束：FR-0008、FR-0009、FR-0010、FR-0011 已冻结的候选输入、统一门禁对象与状态机边界

## 方案摘要

- 选定动作：`editor_input`
  - 含义：在发布页富文本编辑器上执行“聚焦并输入少量文本”的最小可逆交互。
- 不选 `image_attach`
  - 原因：上传路径在 FR-0008 中仍是 candidate/fallback 输入，且 FR-0011 明确把上传注入默认设为阻断。
- 不选 `submit/publish`
  - 原因：属于不可逆写动作，超出 Phase 1 与 `#208` 的边界。
- 本次补齐的是真实动作闭环，而不是继续停留在 gate-only
  - `xhs.editor_input` CLI 命令已接通到 `xhs.interact` / `editor_input`
  - content-script 已在发布页执行真实“聚焦并输入少量文本”交互
  - loopback、CLI contract、extension relay contract 已补齐对应验证证据

## 影响面与风险

- 该说明不会修改上位架构、正式 FR 套件或共享契约，只用于冻结 `#208` 的收口边界。
- 当前最大风险不再是“没真实动作”，而是发布页 DOM 漂移会导致编辑器定位变化。
- 若后续实现扩张到上传、提交、完整写链路或 L2/L1，应立即停止在 `#208` 中推进并拆到新分支。

## 验证方式

- GitHub 真相源核对：
  - `#218/#219/#221/#223/#224/#225/#226/#227` 已关闭
  - `#217` 已关闭
  - `#208` 仍打开，等待实现 PR 合并后再关闭
- 代码与测试核对：
  - `xhs.editor_input` 已返回结构化 `interaction_result`
  - `consumer_gate_result` 与 `observability.page_state` 已在成功路径保留
  - 已通过：
    - `pnpm build`
    - `pnpm exec vitest run src/commands/__tests__/xhs.test.ts tests/cli.contract.test.ts tests/extension.relay.contract.test.ts --testNamePattern='xhs.editor_input|editor_input|issue_208'`
    - `pnpm test`
- 本地命令：
  - `pnpm install`
  - `pnpm test`

## 回滚方式

- 若该说明与后续正式规约冲突，直接删除本文件，并以正式 FR 或实现 PR 中的新说明替代。

## 升级信号

出现以下情况时，应停止按当前说明继续扩写并升级为正式 FR 或新分支：

- 需要引入稳定机器接口或新的共享 payload
- 需要落地真实编辑器输入实现并修改 background/content-script/CLI 共享行为
- 需要把上传、提交、发布确认纳入同一链路
- 需要修改 FR-0008/0009/0010/0011 的正式契约表达
