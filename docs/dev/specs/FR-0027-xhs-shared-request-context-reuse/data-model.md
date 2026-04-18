# FR-0027 数据模型边界

## 结论

本 FR 不新增持久化表或迁移。它只冻结 page-local request-context reuse model 的共享实体与状态边界。

## 共享对象

### 1. request-context slot

| 对象 | 角色 | 持久化要求 |
| --- | --- | --- |
| `RequestContextSlotIdV1` | page-local slotting identity | 不持久化 |

字段：

| 字段 | 角色 |
| --- | --- |
| `page_context_namespace` | 命令族隔离命名空间 |
| `shape_key` | canonical shape 的稳定 key |

### 2. bucket state

| 对象 | 角色 |
| --- | --- |
| `admitted_template` | 可复用 page-local admitted template |
| `rejected_observation` | 最近 rejected source observation |
| `incompatible_observation` | 最近 incompatible observation |

约束：

- 三类状态都只存在于同一 `RequestContextSlotIdV1` 下。
- synthetic / failed source 不得进入 `admitted_template`。
- `available_shape_keys` 只反映当前 namespace 内可诊断 shape，不构成跨 namespace 共享键。

### 3. read-family canonical shape

| 对象 | 当前 formal 状态 |
| --- | --- |
| `xhs.detail` reuse-shape | `note_id` only |
| `xhs.user_home` reuse-shape | `user_id` only |

约束：

- search-only canonical shape 继续由 `FR-0024` 承载。
- detail identity 继续由 `#505` 承载；本 FR 只冻结其 reuse-shape 和 slotting 语义。
