# FR-0009 研究记录（读写路径风险审查）

## Spike Charter

- Decision question：在出现平台风险预警后，XHS 读写路径应如何建立统一门禁，才能在不扩张风险的前提下继续推进 `#208` 与后续读写事项。
- Timebox：FR-0009 spec review 前完成规约收口；live 恢复判断留待后续门禁实现与复核。
- Primary unknowns：
  - U1：`#209` 已落地读路径当前是否存在可复核的高风险自动化特征
  - U2：`#208` 写路径最小验证在何种前置下才可恢复 live
  - U3：读域/写域分离后，哪些门禁是共性，哪些必须分域处理
  - U4：如何定义“默认停高风险 live”的恢复条件，避免口头放行
- Candidate options：
  - O1：暂停所有高风险 live，默认 dry-run/侦察，仅做规约与证据归档
  - O2：读路径有限放行、写路径继续暂停
  - O3：继续按既有节奏推进 `#208` live 验证
- Non-goals：
  - 不设计风控绕过策略
  - 不把本研究升级为实现代码

## 当前基线

- `#209` 已闭环并合并：读路径具备可用性，但不代表 live 风险可忽略。
- `#208` 仍未闭环：最小页面交互验证尚未完成。
- 风险事实：已出现平台侧账号风险预警样本。
- 架构基线：`anti-detection.md` 强调账号安全与行为层风险，不支持“只看功能跑通”。

## 证据矩阵

| ID | Claim/Unknown | Evidence Artifact | Method | Maturity | Confidence | Notes |
|---|---|---|---|---|---|---|
| U1 | 读路径也在风险审查对象内，不能豁免 | `#209` + 风险预警事实 | 事项交叉审查 | M2 | 85% | 已落地不等于可无限 live 扩展 |
| U2 | `#208` live 正式验证应先被门禁阻断 | `#208` + `#213` | 依赖关系审查 | M2 | 90% | 需写入正式前置条件 |
| U3 | 读域/写域必须分离审查 | 域名事实 + 现有讨论结论 | 边界审查 | M2 | 95% | `www` 与 `creator` 不能混推 |
| U4 | 默认停高风险 live 更安全 | 风险预警 + 账号安全原则 | 风险优先决策 | M1 | 75% | 仍需后续证据支持恢复条件 |

## Gate Status

- Fallback viability：PASS
  - 可在不执行高风险 live 的前提下推进规约、证据归档与门禁设计。
- Implementation readiness：BLOCKED
  - 门禁实现尚未开始，恢复 live 的证据闭环尚未完成。

## 决策

- Outcome：Continue spike at spec layer
- Rationale：
  - 当前最优先是风险收敛与门禁冻结，而非继续扩 live 实验。
  - `#208` 与后续读写事项都需要先接入本 FR 的安全前置。
- Effective date：2026-03-22

