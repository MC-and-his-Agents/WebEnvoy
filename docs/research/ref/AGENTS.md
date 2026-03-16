#  AGENTS.md

> 本文档对 `docs/research/ref/` 目录下所有调研报告按照与 WebEnvoy 核心能力的相关度进行分级，帮助快速聚焦研读重点，避免在边界价值项目上浪费调研资源。

---

## 🔴 第一梯队：必须深度研究（直接对标核心能力）

这些项目直接影响底层执行引擎的架构设计，跳过任何一个都将是战略失误。

| 项目 | 调研报告 | 直接价值 | 关键约束（深度调研新发现） |
|---|---|---|---|
| **`pinchtab`** | [pinchtab_analysis.md](./pinchtab_analysis.md) | 定义了"面向 Agent 执行器"的工业标准。A11y Tree 提取、RefCache、Stealth、Named Profile 账号隔离，全部是 L1 Fallback 层的架构蓝图。**是唯一同时支持账号保活 + 多 Agent 并发的完整方案。** | Tab 锁定通过 `POST /tab/lock` 实现，并发竞态需显式处理；SMCP Plugin 的 `cli.py` 范式与 WebEnvoy CLI 入口理念高度吻合。 |
| **`bb-browser`** | [bb-browser_analysis.md](./bb-browser_analysis.md) | "寄生模式"复用用户 Chrome 登录态、Tier 3 内存窃取前端 State（`window.__INITIAL_STATE__`），直接指导 L2/L3 逆向方案的低成本实现路径。 | **Tier 切换不自动降级**，必须由 PlatformAdapter 手动实现探针逻辑；凭证提取（Token/Cookie replay）需 AI 显式编码。 |
| **`scrapling`** | [scrapling_analysis.md](./scrapling_analysis.md) | 三层抓取引擎 + TLS 指纹伪造 + 自适应选择器，是 L2 半定制脚本的"防碎裂"蓝图。 | 自适应选择器的模糊匹配基于字符相似度（`difflib.SequenceMatcher`），页面结构大改时匹配可能退化。 |
| **`camoufox`** | [camoufox_analysis.md](./camoufox_analysis.md) | 专注于修改浏览器内核的"深宫级匿名"，C++ 级 WebGL/Canvas 指纹伪装，是底层浏览器容器拥有最高防御级别的参考教材。 | ⚠️ **`user_data_dir` 持久化不支持**：浏览器重启后无法自动恢复登录态。**不适合用于账号长期保活**，仅适合"一次性超级隐身容器"；账号保活职责应交由 Pinchtab 承担。 |
| **`ghost-cursor`** | [ghost-cursor_analysis.md](./ghost-cursor_analysis.md) | 贝塞尔曲线鼠标轨迹 + Fitts 定律 + 过冲模拟，是打通"行为生物识别"防线的关键，是高防写操作成功率的命门。支持拟人化滚动，可直接用于无限下拉场景。 | ⚠️ **不支持 TouchEvent**（仅鼠标事件）；**无原生 Playwright 接口**，需手动封装 CDP Session 桥接使用。 |
| **`browser-use`** | [browser-use_analysis.md](./browser-use_analysis.md) | 最成熟的开源 AI 驱动浏览器操控库，5 阶段 DOM 感知管线（Paint Order 过滤、AX Tree 融合）是 L1 兜底漫游层的直接技术参考。 | ⚠️ **`CaptchaWatchdog` 仅在 Cloud 服务可用**，本地 Playwright 不发出专有 CDP 事件，自托管场景需自行处理验证码；多 Tab 切换时必须强制清除 DOM 缓存。 |

---

## 🟡 第二梯队：重点关注（提供关键局部能力）

这些项目解决 WebEnvoy 某一个重要的垂直子问题。

| 项目 | 调研报告 | 价值定位 | 关键约束（深度调研新发现） |
|---|---|---|---|
| **`page-agent`** | [page-agent_analysis.md](./page-agent_analysis.md) | 页内注入执行（零延迟寄生）+ 数字索引 selectorMap 映射机制，直接解决大模型"如何精确指哪打哪"的核心难题。天然绕过 CORS 限制。 | 对**跨域 Iframe** 无法穿透（try-catch 后跳过）；Closed Shadow DOM 可通过 JS 引用遍历，但依赖同源上下文。 |
| **`MultiPost-Extension`** | [MultiPost-Extension_analysis.md](./MultiPost-Extension_analysis.md) | "写"操作方向的顶级参考。已解决各大社媒后台的富文本编辑器适配、DataTransfer 媒体上传等脏活，是 L2 写端适配器的知识库。 | `DataTransfer` 方案在 `isTrusted=false` 严格校验站点（高防支付类）存在失效风险；发布采用**顺序队列**，无并发，速率控制依赖各平台硬编码的 setTimeout 延迟。 |
| **`nanobrowser`** | [nanobrowser_analysis.md](./nanobrowser_analysis.md) | Planner+Navigator 双轴协作架构的完整实现参考，影响 WebEnvoy 未来处理复杂多步任务的整体架构。ShadowDOM 强拆（改写 `attachShadow` 原型）是顶级 Trick。 | **无全局 Token 预算管理**（仅 128k 上限截断）；Planner 审图为 Base64 **原图直传**，无预处理，Token 消耗较高；`useVisionForPlanner` 可关闭以节流。 |
| **`maxun`** | [maxun_analysis.md](./maxun_analysis.md) | 无代码可视化 + LLM 辅助生成 `WhereWhatPair` JSON DSL，"录制 -> 回放"机制可启发 WebEnvoy L2 适配器的生成/固化工作流。 | rrweb 默认 `maskAllInputs: false`（录制不自动脱敏）；但 `WorkflowEnricher` 处理 `type` 动作时对输入值**存储期加密**；无限滚动以"内容增量+页面高度+迭代次数"三重条件停止。 |
| **`ui-tars`** | [ui-tars_analysis.md](./ui-tars_analysis.md) | 字节跳动出品的 VLM 视觉定位框架，"只看像素不摸 DOM"。对 WebGL Canvas、iframe 嵌套、Cloudflare 滑块等 DOM 盲区场景是终极兜底。**在技术组合图中归于 L1 辅助层。** | `hybrid` 模式下坐标到 DOM 节点的映射依赖 `getBoundingClientRect()` 碰撞检测，无精确反向索引；纯视觉模式依赖**5 帧滑动窗口**稳定动态 UI 识别。 |
| **`steel-browser`** | [steel-browser_analysis.md](./steel-browser_analysis.md) | 云端"随用随起"浏览器实例的 API 化服务，Request Interception 将页面加载从 3s 压缩至 0.2s，是 WebEnvoy 云端形态的架构参考。支持 SessionStorage 的跨实例提取与注入。 | **WebSocket 连接状态和 ServiceWorker 运行时状态**无法快照和恢复，依赖实时协议的 PWA 应用须在应用层重新握手；Chrome 版本兼容性由用户自行保障。 |

---

## ⚪ 第三梯队：了解即可（边界价值，间接启发）

这些项目对 WebEnvoy 有一定参考价值，但不在核心能力链路上，不需要花大量时间深挖。

| 项目 | 调研报告 | 价值简述 |
|---|---|---|
| `automa` | [automa_analysis.md](./automa_analysis.md) | 低代码 Chrome 扩展自动化，可参考其流程设计器的 UX 思路。 |
| `RSSHub` | [RSSHub_analysis.md](./RSSHub_analysis.md) | 内容聚合路由模式，启发"标准化数据源接口"的设计哲学。 |
| `aipex` | [aipex_analysis.md](./aipex_analysis.md) | AI 驱动的浏览器辅助，参考其 Prompt -> 操作的交互协议设计。 |
| `lightpanda` | [lightpanda_analysis.md](./lightpanda_analysis.md) | 极轻量级无头浏览器（无 V8），探索超低成本静态页面嗅探引擎的可能性。 |
| `cat-catch` | [cat-catch_analysis.md](./cat-catch_analysis.md) | 媒体嗅探下载逻辑，对"内容读取"侧的资源拦截有局部参考价值。 |
| `res-downloader` | [res-downloader_analysis.md](./res-downloader_analysis.md) | 同上，资源嗅探与下载方向的补充参考。 |
| `single-file` | [single-file_analysis.md](./single-file_analysis.md) | 内容归档与存储方向，启发数据落地和格式化层的设计。 |
| `web-clipper` | [web-clipper_analysis.md](./web-clipper_analysis.md) | 内容裁剪落地，启发数据结构化输出格式。 |
| `joplin` | [joplin_analysis.md](./joplin_analysis.md) | 跨平台知识存储，启发数据持久化和索引层的设计。 |
| `agent-browser` | [agent-browser_analysis.md](./agent-browser_analysis.md) | 各自代表某种特化思路，参考其中某一点即可。 |
| `browseros` | [browseros_analysis.md](./browseros_analysis.md) | 同上。 |
| `donutbrowser` | [camoufox_donut_analysis.md](./camoufox_donut_analysis.md) | 同上。 |
| `nut.js` | [nut.js_analysis.md](./nut.js_analysis.md) | 系统级桌面自动化，在跨 App 操作场景有参考价值。 |
| `we-mp-rss` | [we-mp-rss_analysis.md](./we-mp-rss_analysis.md) | 微信公众号内容抓取，启发特定封闭平台的读取策略。 |

---

## 技术组合结论

> 深度调研后的架构选型要点：**Camoufox（超强匿名） + Pinchtab（账号保活）组合不可互相替代**；**CaptchaWatchdog 在自托管部署无效**；**ghost-cursor 需手动适配 Playwright**。

```
L1 Fallback 兜底层
  └─ pinchtab        (A11y Tree 感知 + RefCache + Named Profile 账号保活)
  └─ browser-use     (AI 驱动漫游，本地部署需自建验证码处理逻辑)
  └─ ghost-cursor    (拟人化鼠标/滚动，需手动 CDP 桥接 Playwright，不支持 TouchEvent)
  └─ ui-tars         (VLM 视觉大脑，仅在 DOM 手段失效时的终极兜底)

L2 半定制脚本层
  └─ scrapling       (自适应选择器 + TLS 指纹伪造)
  └─ bb-browser      (内存窃取 + 寄生登录态，Tier 切换需手动实现)
  └─ MultiPost-Extension (写端适配知识库，注意 isTrusted 风险)

L3 专用逆向引擎层
  └─ camoufox        (C++ 内核级指纹修改，仅适合一次性高防任务，不做账号保活)
  └─ scrapling       (HTTP/3 + TLS 指纹)
```
