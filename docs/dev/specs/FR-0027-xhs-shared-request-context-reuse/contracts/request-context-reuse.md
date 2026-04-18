# FR-0027 契约：XHS Shared Request-Context Reuse

## 1. Slotting identity

```ts
type RequestContextSlotIdV1 = {
  page_context_namespace: "xhs.search" | "xhs.detail" | "xhs.user_home";
  shape_key: string;
};
```

约束：

- `shape_key` 只能来自 canonical shape 的稳定序列化。
- `page_context_namespace + shape_key` 共同组成 slotting identity。

## 2. Read-family canonical shape

```ts
type XhsDetailReuseShapeV1 = {
  command: "xhs.detail";
  method: "POST";
  pathname: "/api/sns/web/v1/feed";
  note_id: string;
};

type XhsUserHomeReuseShapeV1 = {
  command: "xhs.user_home";
  method: "GET";
  pathname: "/api/sns/web/v1/user/otherinfo";
  user_id: string;
};
```

约束：

- `xhs.detail` reuse-shape 不包含 `source_note_id` 或 `image_scenes`。
- `xhs.user_home` reuse-shape 最终只保留 canonical `user_id`。

## 3. Bucket state

```ts
type CapturedRequestContextLookupResultV1 = {
  page_context_namespace: RequestContextSlotIdV1["page_context_namespace"];
  shape_key: string;
  admitted_template: Record<string, unknown> | null;
  rejected_observation: Record<string, unknown> | null;
  incompatible_observation: Record<string, unknown> | null;
  available_shape_keys: string[];
};
```

约束：

- `admitted_template` 只承载 admitted page request。
- `rejected_observation` 只承载 synthetic / failed / rejected candidate。
- `incompatible_observation` 只承载同 namespace 下最近一次 shape mismatch candidate。

## 4. Gate rule

replacement implementation 只有在 `#503/#504/#505/#508` formal freeze 全部完成后，才允许进入 implementation-ready 状态。
