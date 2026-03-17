# MediaCrawlerPro 深度调研报告

> 调研日期：2026年03月16日
> 仓库地址（私有组织）：github.com/MediaCrawlerPro
> 本地参考路径：`reference/MediaCrawlerPro/`
> 子项目：`Python-main`（主爬虫）、`SignSrv`（签名服务）

---

## 1. 宏观信息

- **定位**：针对国内主流社媒平台（小红书、抖音、B站、快手、微博、知乎、贴吧）的**生产级 API 直调爬虫框架**
- **核心技术栈**：Python（asyncio + httpx）、Playwright、execjs（Node.js 运行时）、Tornado（签名服务）、SQLite/MySQL
- **架构特征**：将"平台 API 签名生成"从主爬虫中彻底解耦，以独立微服务（SignSrv）提供。主爬虫直接构造 HTTP 请求发包，不依赖任何浏览器界面交互

---

## 2. 整体架构：三服务协同

```
                                        ┌─ Chrome Profile A (Extension) ─┐
                                        │  账号: 小红薯用户A              │
                                        └───── WebSocket ────────────────┘
                                                    │
MediaCrawlerPro-Python ── HTTP RPC ──> SignSrv(:8888)     CookieBridge(:8274) ← Chrome Extension
     (httpx 直接发包)         ↑                    │
                         获取签名           Playwright 浏览器
                      (x-s / a_bogus)      （加载平台页面，调用
                                            平台自己的 JS 签名函数）
```

**三个子服务的职责分工：**

| 服务 | 端口 | 职责 | 是否必须 |
|---|---|---|---|
| `MediaCrawlerPro-Python` | — | 主爬虫：构造请求体、获取签名、发送 httpx 请求、存储数据 | 必须 |
| `MediaCrawlerPro-SignSrv` | 8888 | 签名服务：为各平台生成认证参数（x-s、a_bogus 等） | 必须 |
| `MediaCrawlerPro-CookieBridge` | 8274 | Cookie 自动同步：Chrome 插件实时提取登录 Cookie 到服务 | 可选 |

---

## 3. 核心机制深度拆解：签名服务（SignSrv）

SignSrv 是整个框架最关键的技术突破点，它解决了"如何在没有完整逆向加密算法的情况下获得合法签名参数"的问题。

### 3.1 两种签名模式

每个平台均实现了**工厂模式**，提供两种可切换的签名实现：

**模式 A：Playwright 浏览器签名（推荐）**

```python
# 小红书：xhs_logic.py → XhsPlaywrightSign
encrypt_params = await page_obj.evaluate(
    "([url, data]) => window._webmsxyw(url, data)", [req.uri, req.data]
)

# 抖音：douyin_logic.py → DouyinPlaywrightSign
a_bogus = await page_obj.evaluate(
    "([params, post_data, ua]) => window.bdms.init._v[2].p[42].apply(null, [0, 1, 14, params, post_data, ua])",
    [req.query_params, "", req.user_agent]
)
```

> **核心洞察**：这两个调用的本质是——**在浏览器内调用平台自己的 JS 签名函数**，完全不需要"破解"算法。
> - 小红书签名函数：`window._webmsxyw(uri, data)`
> - 抖音签名函数：`window.bdms.init._v[2].p[42].apply(...)`

**模式 B：JS 补环境签名（离线，`execjs` 驱动）**

```python
# 预提取平台 JS 代码，通过 execjs 在 Node.js 中离线运行
# 小红书：加载 pkg/js/xhs/xhs_xs_new.js 和 xhs_xmns.js
self.xhs_xs_sign_obj = execjs.compile(xs_js_code)
sign_result = self.xhs_xs_sign_obj.call('sign', req.uri, req.data, req.cookies)

# 抖音：加载 pkg/js/douyin.js
self.douyin_sign_obj = execjs.compile(script_content)
a_bogus = self.douyin_sign_obj.call("get_abogus", req.query_params, "", req.user_agent)
```

> 这种方式需要将平台 JS 的运行环境手动补全（即"补环境"），维护成本较高，平台 JS 更新后需重新提取。

### 3.2 Playwright 浏览器管理（XhsPlaywrightManager）

SignSrv 在启动时会初始化并持久化一个 Playwright 浏览器实例，专门用于签名调用：

1. 启动时注入固定 Cookie（`add_fixed_cookies`），使浏览器处于"已登录"状态
2. 导航至平台首页（`const.XHS_INDEX_URL`），确保平台 JS 完整加载
3. 检测验证码（`check_slider_captcha_exist`），如存在则等待人工介入
4. 后续每次签名请求直接调用 `page.evaluate()` 执行平台 JS

```python
# 签名服务启动后，该浏览器实例持续存活，复用同一个 Page 对象
context_page: Optional[Page]  # 全局唯一页面对象
```

> ⚠️ **重要约束**：SignSrv 的 Playwright 浏览器与主爬虫的 Cookie **必须保持同步**。若爬虫侧 Cookie 更新（如账号轮换），需通过 `POST /xhs/update_cookies` 接口同步至 SignSrv 的浏览器 context，否则签名 `a1` 参数不一致会导致签名失效。

---

## 4. 平台接口拆解：小红书（XHS）

### 4.1 已逆向的核心 API 端点

| 功能 | 方法 | 端点 |
|---|---|---|
| 搜索笔记 | POST | `/api/sns/web/v1/search/notes` |
| 笔记详情 | POST | `/api/sns/web/v1/feed` |
| 评论列表（一级） | GET | `/api/sns/web/v2/comment/page` |
| 子评论（回复） | GET | `/api/sns/web/v2/comment/sub/page` |
| 用户信息 | GET | `/api/sns/web/v1/user/otherinfo` |
| 首页推荐流 | POST | `/api/sns/web/v3/homefeed` |
| 自身账号信息 | GET | `/api/sns/web/v1/user/selfinfo` |

### 4.2 签名参数

每次请求需在 Header 中携带以下签名字段（均由 `window._webmsxyw` 生成）：

| Header | 说明 |
|---|---|
| `X-s` | 主签名参数 |
| `X-t` | 时间戳相关参数 |
| `x-s-common` | 通用签名参数（含设备/环境信息） |
| `X-B3-Traceid` | 链路追踪 ID |

### 4.3 搜索接口请求体

```python
data = {
    "keyword": keyword,
    "page": page,
    "page_size": page_size,       # 每页最多 20 条
    "search_id": get_search_id(), # 本地生成的 UUID-like 搜索 ID
    "sort": sort.value,           # "general"/"popularity_descending"/"time_descending"
    "note_type": note_type.value, # 0=全部 / 1=视频 / 2=普通
}
```

### 4.4 数据提取：双路径（API + HTML）

- **API 路径**（主路径）：直接调用 JSON 接口，从响应体提取结构化数据
- **HTML 路径**（备用）：访问笔记页面 HTML，从 `window.__INITIAL_STATE__` 中提取数据

```python
# extractor.py：从 HTML 中提取 window.__INITIAL_STATE__
state = re.findall(r"window.__INITIAL_STATE__=({.*})</script>", html)[0].replace("undefined", '""')
note_dict = humps.decamelize(json.loads(state))
note_data = note_dict["note"]["note_detail_map"][note_id]["note"]
```

> 这与 bb-browser 的 Tier 3（内存窃取）路线本质相同——直接读取前端已渲染好的全局状态对象。

### 4.5 风控错误码体系

| HTTP 状态码 / 业务码 | 含义 | 处理策略 |
|---|---|---|
| 471 / 461 | 触发滑块验证码 | `NeedVerifyError`，打印 `Verifytype` 和 `Verifyuuid`，等待人工介入 |
| 300012 | IP 被封锁 | `IPBlockError`，切换账号+IP 重试 |
| 300015 | 签名失败 | `SignError`，重新初始化签名浏览器后重试 |
| 300013 | 访问频次异常 | `AccessFrequencyError`，随机延时 2-10s 后重试 |
| -100 | 登录已过期 | `SESSION_EXPIRED`，触发账号重新登录流程 |

---

## 5. 平台接口拆解：抖音（Douyin）

### 5.1 签名参数

抖音签名核心参数为 `a_bogus`，通过调用 `window.bdms.init._v[2].p[42].apply()` 生成，参数为：
- `query_params`：URL 查询参数字符串
- `post_data`：POST 请求体（如为 GET 请求则为空字符串）
- `user_agent`：浏览器 UA 字符串

> 注意：评论接口（`/reply`）使用参数 `8`，其他接口使用参数 `14`，说明不同接口调用同一个函数的不同分支。

---

## 6. 账号池与 IP 代理管理

### 6.1 账号管理三种模式

```python
# pool.py：AccountPoolManager 支持三种账号来源
if self._account_save_type == EXCEL_ACCOUNT_SAVE:
    self.load_accounts_from_xlsx()    # Excel 文件，手动维护
elif self._account_save_type == MYSQL_ACCOUNT_SAVE:
    await self.load_accounts_from_mysql()  # 数据库，适合大规模
elif self._account_save_type == COOKIE_BRIDGE_ACCOUNT_SAVE:
    await self.load_accounts_from_cookie_bridge()  # 自动同步（推荐）
```

**CookieBridge 方案**（最自动化）：

```
多个 Chrome Profile（每个 Profile 登录不同账号）
    ↓（WebSocket 实时同步）
CookieBridge Server（:8274）
    ↓（HTTP API）
主爬虫从 /api/cookies/{platform} 获取 Cookie
```

### 6.2 账号轮换与失效处理

```python
# 账号失效后的降级重试策略（xhs/client.py）
async def update_account_info(self):
    """循环获取有效账号，直到找到为止"""
    have_account = False
    while not have_account:
        # 从池中取账号 → pong 检测登录状态 → 失效则标记并换下一个

async def mark_account_invalid(self, account_info):
    """标记账号为失效，下次不再从池中分配"""
```

### 6.3 IP 代理池

```python
# 支持快代理（kuaidaili）等商业代理服务
proxy_ip_pool = await create_ip_pool(
    config.IP_PROXY_POOL_COUNT, enable_validate_ip=True
)
# 每个账号与 IP 配对 (AccountWithIpModel)，IP 失效时自动换新
```

---

## 7. 断点续爬（Checkpoint）系统

这是 Pro 版本相比基础版最重要的工程增强：

```python
# core.py 中，checkpoint_manager 贯穿全流程
self.checkpoint_manager: CheckpointRepoManager = create_checkpoint_manager()

# 搜索时，每一批次记录 checkpoint
# 重新启动后，从上次断点处继续，而非从头开始
```

支持三种 Checkpoint 存储后端（本地文件 / SQLite / MySQL）。

---

## 8. 异步并发控制

```python
# 通过 asyncio.Semaphore 限制并发数，防止风控
self.crawler_note_task_semaphore = asyncio.Semaphore(config.MAX_CONCURRENCY_NUM)
self.crawler_note_comment_semaphore = asyncio.Semaphore(config.MAX_CONCURRENCY_NUM)
```

---

## 9. 技术短板分析

### 9.1 架构复杂度高，部署门槛高

需要同时维护 2-3 个独立 Python 服务：
- SignSrv 启动时需要 Playwright 浏览器（有一定初始化耗时）
- SignSrv 与主爬虫的 Cookie 状态需手动同步，极易产生不一致
- CookieBridge 依赖用户安装 Chrome Extension + 额外启动 Server

### 9.2 账号管理缺乏隔离

- Cookie 以明文字符串存储（Excel / MySQL）
- 多账号以"轮换"而非"并行"模式工作——同一时刻只有一个账号活跃
- 无 Named Profile 机制，账号状态不持久化在浏览器 UserDataDir 中

### 9.3 Playwright 签名浏览器是单点瓶颈

- SignSrv 的 Playwright 实例全局唯一，单线程串行调用
- 高并发场景下签名会成为瓶颈

### 9.4 反检测能力有限

- 主爬虫使用 httpx 直接发包，无法伪造浏览器 TLS 指纹（JA3/ALPN）
- User-Agent 和请求头是静态硬编码，未使用真实浏览器指纹
- 无 Canvas/WebGL 指纹混淆，行为模型完全依赖 IP 轮换兜底

---

## 10. 核心 API 端点汇总（WebEnvoy 直接可用）

以下 API 端点均通过代码确认，WebEnvoy 实现 Content Script 内发包时可直接引用：

### 小红书（基础域：`https://edith.xiaohongshu.com`）

| 功能 | 方法 | 端点 | 关键参数 |
|---|---|---|---|
| 搜索笔记 | POST | `/api/sns/web/v1/search/notes` | `keyword`, `page`, `page_size`, `search_id`, `sort`, `note_type` |
| 笔记详情 | POST | `/api/sns/web/v1/feed` | `source_note_id`, `image_formats`, `extra` |
| 评论列表 | GET | `/api/sns/web/v2/comment/page` | `note_id`, `cursor` |
| 子评论 | GET | `/api/sns/web/v2/comment/sub/page` | `note_id`, `root_comment_id`, `cursor` |
| 用户信息 | GET | `/api/sns/web/v1/user/otherinfo` | `target_user_id` |
| 首页推荐 | POST | `/api/sns/web/v3/homefeed` | `category`, `cursor_score` |

**签名方式**：在 Content Script 内调用 `window._webmsxyw(uri, data)`，得到 `{X-s, X-t}`，并组合 `x-s-common`（由辅助 JS 生成）加入请求 Header。

### 抖音

**签名方式**：在 Content Script 内调用 `window.bdms.init._v[2].p[42].apply(null, [0, 1, type, params, post_data, ua])`，得到 `a_bogus`，作为 URL Query Parameter 附加。

---

## 11. 总结与 WebEnvoy 借鉴价值

### 11.1 最大价值：已验证的平台 API + 签名机制

MediaCrawlerPro 的最大贡献是**已经验证了所有核心平台 API 端点的可用性**，并揭示了签名参数的生成方式。这省去了 WebEnvoy 从零 Spike 逆向的工作量。

### 11.2 关键架构洞察：WebEnvoy 可以更优雅

| 问题 | MediaCrawlerPro 解法 | WebEnvoy 更优解法 |
|---|---|---|
| 如何获得平台签名？ | 独立 SignSrv + Playwright 浏览器调用平台 JS | Content Script 运行在平台页内，**直接调用** `window._webmsxyw()` |
| 如何管理账号 Cookie？ | CookieBridge 插件 → HTTP API → 主爬虫 | Content Script 与平台同源，**Cookie 天然可用** |
| 如何发起 API 请求？ | Python httpx 外部发包（需处理 CORS、TLS 指纹） | Content Script 内 `fetch()`，**同源无 CORS**、使用真实浏览器 TLS 指纹 |
| 账号隔离？ | Excel/MySQL 存储 Cookie 字符串 | **Named Profile（UserDataDir）**，浏览器级别物理隔离 |

**结论：WebEnvoy 的 Chrome Extension 架构天然消解了 SignSrv 存在的必要性。** MediaCrawlerPro 需要 3 个独立服务才能完成的事，WebEnvoy 在 Extension Content Script 内一步搞定，且天然具备更高的安全性（真实 TLS、真实浏览器环境、同源 Cookie）。

### 11.3 可直接复用的知识资产（知识转化，不复用代码）

1. **XHS 核心 API 端点列表**（搜索/详情/评论/用户）— 直接用于 WebEnvoy Spec 编写
2. **XHS 风控错误码体系**（471/461 验证码、300012 IP封、300013 频次）— 直接用于 WebEnvoy 错误处理设计
3. **`window.__INITIAL_STATE__` 提取模式**（Tier 3 内存读取）— 作为读取笔记详情的备用路径
4. **账号失效降级重试模式**（标记失效 → 切换账号 → 重试）— 参考 WebEnvoy 账号状态机设计
5. **断点续爬的 Checkpoint 设计思路** — 参考 WebEnvoy 批量任务的中断恢复设计
