# Guardian Spec Review 摘要

- 仅在规约、架构、正式契约类 PR 中默认进入本摘要。
- `spec_review.md` 仍是正式准入标准；本摘要只负责提醒 review 执行时的最低关注点。
- 先判断事项是否属于当前阶段目标，是否把后续 Phase 内容提前混入当前 FR。
- `spec.md`、`plan.md`、`TODO.md` 是正式套件最小入口；只有命中契约、数据模型、风险边界时，才继续展开相关补充文档。
- 如果事项仍处于 `spike` 或证据边界未冻结，不得误写成 implementation-ready。
- 如果规约与 `vision.md`、`roadmap.md`、相关架构文档或正式 FR 基线冲突，应直接阻断。
- 如果正式 spec / architecture PR 混入实现代码，或关闭语义越过成熟度边界，默认阻断。
