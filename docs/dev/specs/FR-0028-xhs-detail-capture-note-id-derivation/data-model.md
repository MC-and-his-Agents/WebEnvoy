# FR-0028 数据模型边界

## 结论

本 FR 不新增 SQLite 表、迁移或新的持久化真相源。它只冻结 current v1 `xhs.detail` capture admission 在导出 canonical `note_id` 时可接受与不可接受的 derivation source 边界。

## 共享对象

### 1. admitted derivation source

| 对象 | 角色 | 持久化要求 |
| --- | --- | --- |
| `XhsDetailAdmittedCanonicalNoteIdSourceV1` | detail admitted template 的唯一 formal derivation source | 不持久化 |

字段：

| 字段 | 角色 |
| --- | --- |
| `source_kind` | 固定为 `response_candidate_record` |
| `identifier_field` | 当前只允许 `note_id` / `noteId` / `id` |
| `derived_note_id` | trim 后非空 canonical `note_id` |

matcher boundary：

- response root 只允许 `body.data`，且仅在 response `body` 不存在对象形态的 `data` 时才允许回退到对象形态的 `body`。
- `self_when_detail_shape_present` 只允许在选中的 response root 至少具备 `title`、`desc`、`user`、`interact_info`、`image_list`、`video_info`、`note_card`、`note_card_list` 之一时把该 root 本身纳入 admitted candidate self root。
- direct roots 只允许 `.note`、`.note_card`、`.note_card_list[*]`、`.current_note`、`.item`、`.items[*]`、`.notes[*]`。
- 只允许从这些已接受 candidate record 继续递归进入 `.note`、`.note_card`、`.current_note`、`.item`。
- `body.data.items[*].note_card` 已属于 formal 冻结的 admitted wrapped payload 边界。
- `body.note`、`body.note_card`、`body.items[*]` 等 bare-body detail roots，在缺少顶层 `data` 包裹且命中同一 matcher 规则时，也属于 formal 冻结的 admitted payload 边界。

### 2. candidate-only observation

| 对象 | 当前 formal 状态 |
| --- | --- |
| request-side `source_note_id` | candidate-only |
| `referrer` | candidate-only |
| response metadata，以及 current matcher 未接受的 wrapper / record 上的 note-id-like field | candidate-only |

约束：

- 它们可以保留为 rejected / incompatible observation 的说明性证据。
- 它们不构成 admitted canonical `note_id` truth。
- matcher 已接受的 wrapper-shaped response candidate record 不落入这条 candidate-only 行；它们是否 admitted 仍只由“是否位于已冻结 matcher boundary 内，且是否在该 candidate record 上命中 admitted identifier field”决定。
- 它们与 slotting、miss-state、reuse 的正式关系不在本 FR 冻结。

## 不属于本 FR 的对象

- `xhs.detail` canonical identity 本体
- detail request-shape / shape_key / route bucket / lookup slotting
- exact-match / stale / rejected-source / reuse semantics
- candidate observation 的持久化 schema、生命周期与状态机

其中第一项由 `FR-0026` 冻结，其余由 `#508` 承接。
