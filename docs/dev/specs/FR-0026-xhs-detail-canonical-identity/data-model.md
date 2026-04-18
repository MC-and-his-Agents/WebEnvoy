# FR-0026 数据模型边界

## 结论

本 FR 不新增 SQLite 表、迁移或新的持久化真相源。它只冻结 current v1 `xhs.detail` identity 与 exclusion boundary；observed request/artifact 字段继续保持未冻结状态。

## 共享对象

### 1. canonical identity

| 对象 | 角色 | 持久化要求 |
| --- | --- | --- |
| `XhsDetailCanonicalIdentityV1` | current v1 detail identity 真相源 | 不持久化 |

字段：

| 字段 | 角色 |
| --- | --- |
| `note_id` | current v1 唯一 canonical identity 字段 |

### 2. observed request/artifact field

| 对象 | 当前 formal 状态 |
| --- | --- |
| `/api/sns/web/v1/feed` request body `source_note_id` | observed-only request-side field; not-in-identity baseline; no alias/derivation semantics frozen |

约束：

- 当前 formal 不把它冻结为 transport alias、artifact-side derivation input、placement 或 route 规则
- 不新增第二个 identity 字段
- 不扩写为更广 verified transport truth 或其他 normalization 语义

### 3. exclusion boundary

| 候选字段 | 当前 formal 状态 |
| --- | --- |
| `image_scenes` | not-in-identity |

约束：

- 本 FR 只冻结这些候选字段当前不得进入 current v1 identity
- 本 FR 不冻结这些字段的 placement、输出位置或其他非 identity shape
- 不得参与 current v1 formal identity derivation

## 不属于本 FR 的对象

- detail command surface
- target-page baseline
- 四对象输入 ownership
- detail/user_home request-context baseline
- `source_note_id` 的 transport alias、artifact-side derivation、placement 与 normalization 规则
- compatibility、rejected-source matching、template reuse 等 request-context 行为

这些对象属于 `#504`，不在本 FR 重新定义。
