# FR-0001 TODO

## Expanded Suite Review 对齐

- [x] 补齐 `spec.md` 的 GWT 验收场景
- [x] 补齐 `spec.md` 的异常 / 边界场景
- [x] 冻结最小 CLI argv 调用约定
- [x] 补齐 `ERR_EXECUTION_FAILED` 的 GWT 与验证口径
- [x] 升级 `plan.md` 到最新 7 节结构
- [x] 补齐最小 CLI 契约文档 `contracts/cli-entry.md`
- [x] 补齐共享契约基座风险文档 `risks.md`
- [x] 本地运行文档相关最小校验
- [x] 在 GitHub Issue `#141` 中绑定 `FR-0001`
- [x] 创建仅包含规约文档的 Draft PR
- [x] 完成当前 expanded suite formal review，并收敛所有 findings / blockers
- [x] `data-model.md` 已纳入当前 expanded suite formal review 的审查范围

## 门禁定义

### 原始实现 gate（历史上下文）

- 获得 `APPROVE`
- 获得 `ready_for_implementation = true`
- 确认 FR-0001 的实现 PR 与 spec PR 分离

### Expanded Suite `implementation-ready` 状态 gate（当前对齐目标）

- 完成当前 expanded suite formal review，并收敛所有 findings / blockers
- `contracts/cli-entry.md`、`risks.md` 与 `data-model.md` 都已纳入正式套件审查并完成 formal review
- 在 expanded suite 口径下形成 `APPROVE`
- 在 expanded suite 口径下形成 `ready_for_implementation = true`

原始实现 gate 对应 `#162` 的历史进入实现条件，不在当前对齐 PR 中被追溯性改写；expanded suite 状态 gate 仅约束 expanded suite 口径下的 `implementation-ready` / final close-out 状态重新声明；当前 PR 基于 `#369` 已合入的 formal review alignment 回写最终 close-out 结论。

## Expanded Suite 现状记录

- [x] `#160` 已给出原始 FR-0001 正式套件（当时不含 `data-model.md`）的 `APPROVE`
- [x] `#160` 已给出原始 FR-0001 正式套件（当时不含 `data-model.md`）的 `ready_for_implementation = true`
- [x] `#162` 已作为原始 FR-0001 套件的独立实现 PR 合入，说明当时的 spec PR 与实现 PR 分离已实际成立
- [x] `data-model.md` 已在后续修订中加入正式套件，且其 expanded suite formal review coverage 已通过 `#369` 对齐并落地
- [x] `#369` 已合入，说明当前 expanded suite formal review 已完成并收敛 findings / blockers
- [x] 基于 `#369` 合入后的 latest guardian `APPROVE` 与已落地的 expanded suite 状态 gate，FR-0001 现可在 expanded suite 口径下正式记录为 `APPROVE`
- [x] 基于 `#369` 合入后已齐备的正式套件审查范围与状态 gate，FR-0001 现可在 expanded suite 口径下正式记录为 `ready_for_implementation = true`

## Spec Review 通过后进入实现

- [ ] 初始化 Node / TypeScript CLI 最小工程骨架
- [ ] 建立 `webenvoy` 入口与可执行方式
- [ ] 建立命令上下文标准化层
- [ ] 建立统一成功 / 错误响应格式化器
- [ ] 建立稳定退出码与错误码常量
- [ ] 建立命令注册表与路由层
- [ ] 落地最小已实现运行时命令
- [ ] 为已注册但未实现命令提供占位处理器
- [ ] 为后续 `#142`、`#143`、`#145` 预留命名空间承载
- [ ] 补齐 CLI 契约测试、退出码断言与 `stdout` 污染断言
