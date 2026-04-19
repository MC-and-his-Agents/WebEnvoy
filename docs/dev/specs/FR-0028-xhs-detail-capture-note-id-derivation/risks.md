# FR-0028 风险与回滚

## 风险 1：把 candidate source 误写成 admitted truth

- 表现：
  - 后续 review 或实现 PR 把 `source_note_id`、referrer、metadata-only note field 直接写成 admitted canonical `note_id` derivation
- 后果：
  - 与 `FR-0026` 的 identity-only freeze 冲突
  - detail admitted template 的 formal 输入再次失真
- 缓解：
  - 在 `spec.md`、`contracts/`、`TODO.md` 中重复声明 candidate-only 边界

## 风险 2：把 FR-0028 越权扩写成 shared reuse semantics

- 表现：
  - 在本 FR 中顺手冻结 `shape_key`、slotting、exact-match、rejected-source 或 freshness
- 后果：
  - 与 `#508` 的职责重叠
  - formal owner 再次混线
- 缓解：
  - 明确本 FR 只回答 capture-side canonical `note_id` derivation
  - 所有 reuse / eligibility / miss-state 语义继续回指 `#508`

## 风险 3：把 response candidate 的完整 schema 误报为 formal truth

- 表现：
  - 因为当前实现会扫描多个 response scope，就把完整 response shape 写成 rigid schema
- 后果：
  - formal 契约超出当前证据
  - 后续实现被不必要地锁死
- 缓解：
  - 只冻结 note-id derivation 所需的最小 scope 与 identifier field
  - 不冻结额外 payload 字段

## 回滚策略

- 若 reviewer 认为 current admitted source 仍证据不足，应阻断本 FR 合入，而不是让实现 PR 临时决定 admitted derivation source。
- 若未来出现 admission-ready 新证据，需要通过新 spec 修订扩 admitted source，而不是回滚 `FR-0028` 去容纳未验证 truth。
