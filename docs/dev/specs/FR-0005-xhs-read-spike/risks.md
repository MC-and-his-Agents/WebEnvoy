# FR-0005 风险与回滚

## 风险 1：账号风控触发导致样本失真

- 触发条件：高频侦察请求、异常访问节奏、会话环境不稳定
- 影响：端点与签名结论混入风控噪声，后续实现误判
- 缓解：
  - 控制侦察频率，分批采样
  - 对同场景保留多轮样本并交叉比对
  - 将验证码/封禁单独归档为风险样本
- 回滚/降级：
  - 停止当前账号侦察，切换低风险样本窗口
  - 标记该轮结果为“不可作为正式输入”

## 风险 2：签名入口频繁漂移

- 触发条件：页面脚本版本更新、混淆策略变化
- 影响：已记录签名路径快速失效，实施阶段返工
- 缓解：
  - 在契约中记录失效信号与最小排查路径
  - 用“输入输出形态 + 调用位置特征”双重描述签名链路
- 回滚/降级：
  - 先冻结端点与字段结论
  - 将签名链路标记为待复核阻断项，不进入实现

## 风险 3：环境差异导致结论不可迁移

- 触发条件：浏览器版本、扩展注入状态、登录态差异
- 影响：侦察结论在实现环境复现失败
- 缓解：
  - 记录采样环境元信息
  - 对关键结论进行跨会话复现
- 回滚/降级：
  - 将结论降级为“候选结论”，不得进入 hard dependency

## 风险 4：把侦察文档当实现契约直接编码

- 触发条件：未经过 spec review 即进入开发
- 影响：后续 PR 出现范围蔓延和契约不一致
- 缓解：
  - 严格执行 spec review -> implementation 分离
  - 在 TODO 明确“进入实现前条件”
- 回滚/降级：
  - 停止实现分支推进
  - 回到 FR-0005 规约补齐评审阻断项

## 风险 5：WebEnvoy-managed XHS 现场虽已恢复，但准入证据仍不足

- 触发条件：managed-profile official runtime 已可启动，但 `search/detail/user_home` 仍未形成 `route_role=primary + path_kind=api + evidence_status=success + reproduced_multi_round` 的同口径证据闭环
- 影响：formal FR 会错误地把单轮样本、fallback 页面证据或某次运行时失败事实误写成实现准入结论，导致 Go/No-Go 失真
- 缓解：
  - 先保留 managed-profile 准入预检与 2026-04-11 fresh rerun 的历史事实，但不把其直接升级为 formal 准入
  - 继续把正式停点固定为“三场景 API primary 成功与矩阵证据不足”，而不是某一轮运行时缺陷
  - 将单轮 fresh rerun 失败事实保留在 `research.md`，只作为后续复核和实现排障输入
- 口径约束：
  - 作者本机 `.webenvoy/profiles/**` 的恢复状态，不在 formal spec 中写成静态当前事实
  - 即使执行现场已恢复受管 XHS profile，仍需继续完成三场景 managed-profile 同口径复核后，才能更新正式结论
  - 在上述复核结论收口前，formal FR 的当前状态仍保持 blocked
- 回滚/降级：
  - 暂停本轮 issue 的 live 扩展
  - 待后续执行现场补齐 latest-head fresh rerun 与三场景证据矩阵后，再重新执行 `search/detail/user_home` 的同口径复核
