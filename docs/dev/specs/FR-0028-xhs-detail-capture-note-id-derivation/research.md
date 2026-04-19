# FR-0028 研究记录

## 研究问题 1：为什么 FR-0026 之后还需要单独的 FR-0028

结论：

- `FR-0026` 只回答 command-side / canonical identity truth：current v1 `xhs.detail` 只有 `note_id` 进入 identity。
- 它刻意没有回答 capture admission 观察到 detail artifact 时，canonical `note_id` 在 admitted path 上究竟从哪里来。
- `#510` 的新增职责正是把这块缺失 truth 独立出来，避免 replacement implementation 自行定义 admitted derivation source。

因此本 FR 选择：

- 不重写 `note_id`-only identity
- 只冻结 capture-side canonical `note_id` derivation

## 研究问题 2：当前仓库里哪些证据能支撑 admitted derivation

结论：

- `extension/xhs-read-execution.ts` 当前在判断 detail 请求是否“返回了目标数据”时，不接受 metadata-only note id。
- 该实现只在 response payload 中找到 detail note candidate record，并在其 `note_id` / `noteId` / `id` 命中目标 `note_id` 时，才认定成功。
- `tests/xhs-read-execution.fallback.test.ts` 明确覆盖了：
  - detail response candidate 命中目标 note id 时成功
  - metadata `current_note_id` 单独存在时失败

因此本 FR 选择：

- 把 response-side detail note candidate record 上的 `note_id` / `noteId` / `id` 冻结为 current v1 唯一 admitted derivation source

## 研究问题 3：为什么 `source_note_id` 不能直接提升为 admitted derivation

结论：

- `FR-0005` 与 `FR-0026` 已稳定表明：`/api/sns/web/v1/feed` 的 request-side `source_note_id` 目前只有 candidate / failed / synthetic 层级证据。
- 这些证据能证明 detail route 可能使用 `source_note_id`，但不能证明 capture admission 在 admitted template 路径上可以只靠 `source_note_id` 建立 canonical `note_id`。
- 如果 formal 在此处直接承认 `source_note_id` admitted mapping，会与 `FR-0026` 明确拒绝的 admitted canonical mapping freeze 冲突。

因此本 FR 选择：

- 保留 `source_note_id` 为 candidate-only observation
- 不把它写成 admitted canonical derivation truth

## 研究问题 4：为什么 referrer 与 metadata-only note field 也只能停留在 candidate-only

结论：

- 当前仓库 formal truth 没有任何已冻结结论表明 detail path 可以用 referrer 直接导出 admitted canonical `note_id`。
- `FR-0024` 中关于 referrer 的 formal truth 只适用于 search exact-hit 后的可复用上下文，不等于 detail derivation truth。
- metadata-only note id 已被现有 tests 明确排除为 detail success evidence。

因此本 FR 选择：

- referrer 与 metadata-only note field 一律只保留为 candidate-only observation
- 不把 search-only 的 referrer 语义越权平移到 detail derivation

## 研究问题 5：为什么 replacement implementation gate 必须消费本 FR

结论：

- replacement implementation 要想进入 admitted template path，必须知道 detail canonical `note_id` 在 capture 侧怎么被正式导出。
- 如果没有本 FR，formal suite 会出现“identity-only 已冻结，但 capture-side admitted derivation 未冻结”的断层。
- 这种断层会迫使实现 PR 自行决定 admitted path，重新制造 GitHub issue truth、formal truth 与 implementation truth 分裂。

因此本 FR 选择：

- 明确把本 FR 加入 detail replacement path 的 formal prerequisite 组合
- 但不越权替代 `#508` 的 shared reuse semantics owner
