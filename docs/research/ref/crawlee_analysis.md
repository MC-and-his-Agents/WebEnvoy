# Crawlee SessionPool 机制调研报告

> 调研日期：2026年03月17日  
> 仓库：[apify/crawlee](https://github.com/apify/crawlee)  
> 调研版本：v3.x（核心 SessionPool 逻辑自 v3.10 至 v3.16 保持稳定）  
> 调研焦点：Session 健康度评分、轮转调度、Cookie 持久化、与代理绑定的联动机制

---

## 一、SessionPool 整体架构

Crawlee 的 `SessionPool` 是一个**带健康感知能力的身份池**，核心抽象是将「一个浏览器身份（Cookie + 代理 IP）」封装为一个 `Session` 对象，由 Pool 统一管理其生命周期。

```
BasicCrawler
├── SessionPool（身份管理）
│   └── Session[]（每个 Session = Cookie Jar + 健康分 + 代理绑定 ID）
└── ProxyConfiguration（代理管理）
    └── sessionId → proxyUrl 映射（实现代理黏性）
```

---

## 二、Session 健康度评分系统

### 2.1 核心数据结构

每个 `Session` 对象内部维护一个 `errorScore` 浮点数（初始值为 `0`）。

| 字段 | 含义 | 默认值 |
|------|------|--------|
| `errorScore` | 当前错误分（越高越不健康） | `0` |
| `maxErrorScore` | 退场阈值 | `3` |
| `errorScoreDecrement` | 每次成功操作的分数奖励 | `0.5` |
| `maxUsageCount` | 强制退场的使用次数上限 | `50` |
| `maxAgeSecs` | Session 最长存活时间（秒） | `3000`（约 50 分钟） |

### 2.2 分数增减触发器

```
触发 markBad()   → errorScore += 1, usageCount += 1
触发 retire()    → errorScore += maxErrorScore（直接打满，立即退场）
触发 markGood()  → errorScore -= errorScoreDecrement（减 0.5）
```

**语义对应关系**：

| 业务事件 | 调用方法 | 分数变化 |
|----------|----------|----------|
| 请求超时 | `markBad()` | +1 |
| 收到 401/403/429 | `retire()` | +maxErrorScore（打满） |
| 遭遇验证码 | 业务层调用 `retire()` | +maxErrorScore |
| 请求成功 | `markGood()` | -0.5 |

`blockedStatusCodes` 默认配置为 `[401, 403, 429]`，框架在检测到这些状态码时自动调用 `retire()`。

### 2.3 衰减（恢复）机制

健康恢复是**线性递减**模型，而非指数衰减：每次成功请求固定减 `0.5`。这意味着：
- 一次 `markBad()`（+1）需要**2 次成功请求**才能完全抵消
- 一次 `retire()`（+3，等于 maxErrorScore）等价于立即废弃，无法通过成功恢复

### 2.4 退场条件（三选一）

```
errorScore >= maxErrorScore   → 因错误次数超阈值退场
usageCount >= maxUsageCount   → 因使用次数超上限强制退场（防止长期使用同一身份）
age > maxAgeSecs              → 因 Session 年龄超限退场
```

---

## 三、Session 调度（`_pickSession()` 算法）

### 3.1 调度策略

Session 的选取逻辑是**带淘汰的随机选取**，而非基于健康分的优先级队列：

```
1. 若池未满（当前 Session 总数 < maxPoolSize）
   → 创建新 Session 并返回
2. 若池已满
   → 从 sessions 数组中随机抽取一个
   → 若抽到的 Session 已被标记为 blocked
     → 清除池中所有 blocked Session
     → 创建新 Session 返回
```

**关键结论**：`_pickSession()` 使用**纯随机**，不计算健康分优先级。健康分的唯一作用是判断 Session 是否"可用"（blocked = errorScore >= maxErrorScore），可用的 Session 被等概率选取。

### 3.2 池的默认容量

`maxPoolSize` 默认为 `1000`，实际项目中通常设为与并发数相近的值（如并发 10 则设 `50~100`）。

---

## 四、Cookie 持久化机制

### 4.1 底层存储

Crawlee 使用 `tough-cookie` 库的 `CookieJar` 存储每个 Session 的 Cookie，并将整个 SessionPool 状态序列化为 JSON 存入 **KeyValueStore**（抽象存储层，在本地运行时对应磁盘文件，在 Apify Platform 上对应云存储）。

### 4.2 持久化触发时机

SessionPool 监听 `EventType.PERSIST_STATE` 事件，**在每次爬虫检查点时将当前所有 Session 的状态写入 KeyValueStore**：

```typescript
// 配置示例
const sessionPool = await SessionPool.open({
    persistStateKeyValueStoreId: 'my-session-store',  // KV Store 名称
    persistStateKey: 'MY_SESSION_POOL',                // KV Store 内的 Key
    maxPoolSize: 100,
});
```

### 4.3 Cookie 序列化格式

Cookie 以 `tough-cookie` 的内部格式序列化为 JSON，包含完整的 `domain`、`path`、`expires`、`httpOnly`、`secure` 等属性。

当 `persistCookiesPerSession: true` 时，每次响应的 `Set-Cookie` Header 会通过 `session.setCookiesFromResponse(response)` 自动存入对应 Session 的 CookieJar：

```typescript
// 跨格式转换工具
// packages/core/src/cookie_utils.ts
// 提供 tough-cookie ↔ Playwright/Puppeteer Cookie 格式互转
```

### 4.4 重启恢复

下次启动时，`SessionPool.open()` 会自动从 KeyValueStore 加载上次保存的状态，还原所有 Session 及其 Cookie，实现**无感知的会话续用**。

---

## 五、Session 与代理的黏性绑定

### 5.1 绑定机制

`ProxyConfiguration` 通过 `sessionId` 实现代理黏性（Proxy Stickiness）——同一个 `sessionId` 在整个生命周期内始终映射到同一个代理 URL：

```typescript
// 每次请求时，Crawler 传入 session.id 获取代理
const proxyInfo = await proxyConfiguration.newProxyInfo(session.id);
// 首次调用：随机分配一个代理，记录 sessionId → proxyUrl 映射
// 后续调用：始终返回同一个 proxyUrl
```

### 5.2 联动数据流

```
Crawler._runTaskFunction()
  ├── sessionPool.getSession()       → 获取 Session（含 Cookie Jar）
  ├── proxyConfiguration.newProxyInfo(session.id)  → 获取绑定代理
  ├── fetch(url, { cookies, proxyUrl })             → 执行请求
  ├── session.setCookiesFromResponse(response)      → 更新 Cookie
  └── 根据响应结果：
        ├── 成功 → session.markGood()
        └── 失败 → session.retire() / markBad()
```

### 5.3 Session 退场时的代理释放

当 Session 因健康分耗尽而退场时，`ProxyConfiguration` 中对应的 `sessionId → proxyUrl` 映射**随之失效**。新创建的替代 Session 会获得一个新的随机代理绑定。

---

## 六、完整配置 API 参考

```typescript
const sessionPool = await SessionPool.open({
    // 池容量
    maxPoolSize: 100,

    // 单个 Session 的参数
    sessionOptions: {
        maxAgeSecs: 3600,          // 1小时后强制轮换
        maxUsageCount: 50,         // 使用50次后强制轮换
        maxErrorScore: 3,          // 错误分达到3时退场
        errorScoreDecrement: 0.5,  // 每次成功减少的错误分
    },

    // 持久化配置
    persistStateKeyValueStoreId: 'sessions',
    persistStateKey: 'SESSION_POOL',

    // 自定义触发退场的 HTTP 状态码
    blockedStatusCodes: [401, 403, 429, 503],

    // 自定义 Session 创建逻辑
    createSessionFunction: async (pool) => {
        const session = await Session.create({ sessionPool: pool });
        // 在此注入初始 Cookie、自定义 headers 等
        return session;
    },
});
```

---

## 七、关键设计模式总结

| 设计维度 | Crawlee 的方案 |
|----------|----------------|
| 评分模型 | 线性 errorScore，无优先级排序 |
| 调度策略 | 随机选取（可用 Session 等概率） |
| 退场条件 | 错误分超阈值 OR 使用次数超限 OR 年龄超限（三选一） |
| Cookie 存储 | tough-cookie CookieJar（内存） + KeyValueStore（持久化） |
| 代理绑定 | sessionId 黏性映射，Session 退场时自动解绑 |
| 恢复机制 | 重启后从 KV Store 自动加载，无感知续用 |
| 验证码处理 | 业务层调用 `retire()`（框架不自动识别验证码） |
