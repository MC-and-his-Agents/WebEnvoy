# Guardian 常驻审查摘要

- WebEnvoy 是 Web 执行工具，不是 Agent 大脑。
- 当前主线坚持 CLI-first；CLI 契约必须稳定、机器可读、错误结构化。
- 浏览器内执行是唯一 HTTP 出口；不引入外部异构爬虫作为核心运行时。
- 不把账号矩阵、长期调度、独立上层运行系统能力混入当前仓库主线。
- 证据不足默认不放行；优先报告当前 PR 引入、且影响是否合并的离散问题。
- 高风险改动至少包括：`scripts/**`、`.github/workflows/**`、执行引擎、账号体系、适配器协议、数据读写、schema、迁移、安全与风控链路。
- 如果存在高概率行为回归、安全风险、关键验证缺失、错误关闭语义或合并元数据不合规，默认给出阻断性结论。
- 对应 GitHub Issue 已存在时，完整实现闭环使用 `Fixes #...`；Spike、规约、研究或部分完成场景使用 `Refs #...`。
- findings 必须聚焦可操作的阻断性问题，并附带尽量精确的 diff 内代码位置。
- 真实 Live Evidence 专项门禁只适用于声称完成真实 runtime / 真实页面交互 / 真实 live read-write 闭环，或把 live evidence 作为关闭 issue、判定“已完成”或请求 merge 放行核心依据的 PR。
- 对 formal spec review PR、live evidence 治理落库 PR 与所有落入专项门禁的 PR，先核对 PR 描述中的结构化 `gate_applicability`；缺失时直接阻断，不得回退到标题、路径或 issue 引用 heuristics。
- 落入专项门禁的 PR 还必须提供完整 `live_evidence_record`；其中 `latest_head_sha`、`run_id`、`evidence_collected_at`、`artifact_identity` 与 `artifact_log_ref` 必须共同指向当前 latest head 的 fresh rerun。
- 只有来自 `real_browser` 执行面的最新 live evidence，且能证明真实页面交互或真实闭环结果时，才可作为放行依据；`runtime.ping`、`runtime.bootstrap`、stub/fake host、旧 head/旧 artifact 或 same-head 历史 artifact 默认无效。
