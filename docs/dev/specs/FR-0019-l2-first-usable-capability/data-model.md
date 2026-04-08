# FR-0019 数据模型

## 1. `first_usable_trace`

用途：

- 记录首次成功路径的最小步骤序列，供后续候选能力整理使用

最小字段：

- `step_id`
- `action`
- `target_hint`
- `result`

## 2. `interaction_trace`

用途：

- 记录本次 L2 首次可用过程中的最小交互序列

最小字段：

- `action`
- `target_ref`
- `settled`

## 3. `candidate_shell_seed`

用途：

- 为 `FR-0017` 提供最小 handoff 输入

最小字段：

- `entrypoint_hint`
- `input_shape_hint`
- `result_shape_hint`
- `capture_origin="l2_first_usable_sample"`

## 4. 与既有对象的关系

- 与 `FR-0017`：
  - `candidate_shell_seed` 只作为 handoff 输入
- 与 `FR-0004`：
  - 失败大类可以引用最小诊断，但不扩展诊断 schema
- 与 `FR-0010/0011`：
  - 风险门禁与审批/审计对象继续沿用既有定义
