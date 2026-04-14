# FR-0023 数据模型边界

## 结论

本 FR 不新增 SQLite 表、迁移或新的持久化真相源，但为了满足 formal suite 对共享对象 / 引用边界的冻结要求，需要明确本事项涉及的“对象层数据模型”边界。

本文件只定义：

- 哪些对象是上游输入对象
- 哪些对象是请求级结果对象
- 哪些对象继续复用 `FR-0010`、`FR-0011`、`FR-0014` 的既有真相源

本文件不定义：

- 新表
- 新索引
- 新迁移
- 新的长期资源状态持久化模型

## 对象分层

### 1. 上游输入对象

以下对象由上游提供，并在 request-time admission 前被 WebEnvoy 消费：

| 对象 | 角色 | 持久化要求 |
| --- | --- | --- |
| `action_request` | 动作请求输入 | 不要求作为新的仓库真相源持久化 |
| `resource_binding` | 资源主体绑定输入 | 不要求作为新的仓库真相源持久化 |
| `authorization_grant` | 上游授权范围与约束输入 | 不要求作为新的仓库真相源持久化 |
| `runtime_target` | 运行时现场输入 | 不要求作为新的仓库真相源持久化 |

约束：

1. 这四个对象的正式字段边界由 `contracts/` 冻结。
2. 本 FR 不要求为这四个对象新增独立表或持久化实体。
3. 后续实现若需要缓存、日志化或持久化它们，必须在对应实现 FR 中重新冻结存储边界。

### 2. 请求级结果对象

以下对象是本 FR 新增冻结的请求级结果视图：

| 对象 | 角色 | 持久化要求 |
| --- | --- | --- |
| `request_admission_result` | 当前请求是否允许进入执行的结果视图 | 当前不要求新增独立持久化真相源 |
| `execution_audit` | 当前请求实际消费输入、判断与风险信号的请求级证据 | 当前不要求新增独立持久化真相源 |

约束：

1. 这两个对象是 formal contract 级视图，不自动等于新表或新实体。
2. 若后续实现要把它们持久化，必须先明确与 `FR-0010.approval_record / audit_record`、`FR-0014.session_rhythm_*` 的关系，避免形成第二真相源。

### 3. 继续复用的既有真相源

本 FR 明确继续复用以下 formal 真相源对象：

| 来源 FR | 对象 | 在 FR-0023 中的角色 |
| --- | --- | --- |
| `FR-0010` | `gate_input` | 由四个上游输入对象归一化后生成的内部 gate 输入 |
| `FR-0010` | `approval_record` | gate 后 persisted trail |
| `FR-0010` | `audit_record` | gate 后 persisted trail |
| `FR-0011` | `approval_admission_evidence` | 第一版 grant 的兼容 pre-gate evidence |
| `FR-0011` | `audit_admission_evidence` | 第一版 grant 的兼容 pre-gate evidence |
| `FR-0014` | `session_rhythm_window_state` / `session_rhythm_decision` / `session_rhythm_status_view` | 内部节律、恢复探针与 cooldown 控制真相源 |

约束：

1. `FR-0023` 不重定义这些对象的持久化 ownership。
2. `FR-0023` 不新增并行 `*_v2` 真相源对象。
3. 若后续实现需要新增持久化字段或实体，必须在实现 FR 中单独评审。

## 生命周期与边界

1. 上游输入对象生命周期以“单次请求”为边界，不被本 FR 提升为长期资源实体。
2. `request_admission_result` 与 `execution_audit` 生命周期也以“单次请求”为边界。
3. `active / cool_down / paused` 等资源策略状态仍是上游长期状态语义，本 FR 不为其建立新的本地持久化真相源。
4. `anonymous_context` 与 `profile_session` 是执行主体边界，不等于新的持久化账号实体模型。

## 数据模型风险提醒

- 若后续实现直接把 grant 或 request result 写成新的长期表，可能与 `FR-0010/0011/0014` 形成双真相源。
- 若后续实现把 `account_ref` 升格为本地持久化主体，则会越过本 FR 当前边界。
- 若后续实现把 `request_admission_result` 当成长期资源状态表，则会把上游运营状态错误内化进 WebEnvoy。
