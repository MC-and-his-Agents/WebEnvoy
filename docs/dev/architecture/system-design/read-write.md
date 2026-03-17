# 读写机制与 Content Script 上下文

> 所属文档：[系统设计（战术层）](../system-design.md) › 第四至六章
> 覆盖章节：§四 读操作机制 · §五 写操作机制 · §六 Content Script 执行上下文

---

## 四、读操作机制（两路并存）

### 4.1 主路径：Content Script 主动发包（L3）

**适用场景**：已知平台 API 端点和请求结构（通过前期 Spike 确认）。

**执行链**：

```
CLI 指令 → Extension Background → Content Script
    → chrome.scripting.executeScript({ world: "MAIN" })
       → window._webmsxyw(url, data)          ← 调用平台自有签名函数
    → fetch('/api/sns/web/v1/search/notes', {
          credentials: 'include',             ← 自动携带同源 Cookie
          headers: { 'X-sign': signResult }
      })
    → JSON 响应 → Background → CLI → SQLite
```

**关键技术点**：

1. **MAIN 世界执行**：Content Script 默认运行在 Chrome 的 Isolated World，无法访问页面 JS 中定义的 `window._webmsxyw` 等平台签名函数。必须通过 `chrome.scripting.executeScript({ world: "MAIN" })` 切换到 MAIN 世界执行签名调用，然后通过 `window.postMessage` 或 DOM 自定义事件将签名结果传回 Isolated World 的 Content Script。

2. **CORS 天然消失**：Content Script 在 `xiaohongshu.com` 页面内发起的 `fetch()` 是同源请求，不存在 CORS 问题。

3. **无需 Cookie 提取**：不需要 CookieBridge，Cookie 由浏览器自动附加。

**与 MediaCrawlerPro 的对比**：

| 能力 | MediaCrawlerPro（3个服务） | WebEnvoy（单浏览器进程） |
|---|---|---|
| 签名获取 | SignSrv → Playwright → `window._webmsxyw` | Content Script → `chrome.scripting` → `window._webmsxyw` |
| Cookie 获取 | CookieBridge 插件同步 | 浏览器天然携带，无需额外步骤 |
| API 发包 | Python httpx（进程外） | Content Script fetch()（进程内） |

### 4.2 辅路径：webRequest 被动拦截（L3 辅 / L2）

**适用场景**：
- 用户自然浏览产生的数据（如刷新首页时拦截推荐流）
- 写操作附带的读取（如发布成功后拦截平台返回的笔记 ID）
- API 结构尚未确认的新平台（侦察阶段）

**MV3 响应体拦截的架构约束**：Chrome MV3 的 Background Service Worker **无法读取任何 Response Body**（`declarativeNetRequest` 只能重写请求头，无响应体访问权限；`webRequest` 在 MV3 中已移除 `blocking` 模式）。因此，被动拦截响应体的唯一可行路径是在 **Content Script 的 MAIN 世界**中劫持原生 API：

```typescript
// 注入到 MAIN 世界（document_start），劫持 fetch 和 XHR
const originalFetch = window.fetch
window.fetch = async function(input, init) {
  const response = await originalFetch(input, init)
  const url = typeof input === 'string' ? input : input.url

  if (shouldIntercept(url)) {
    // 克隆响应（原始响应只能读一次）
    const clone = response.clone()
    clone.json().then(payload => {
      // 传回 ISOLATED 世界
      window.postMessage({ __webenvoy_intercept__: true, url, payload }, '*')
    })
  }
  return response
}

// XMLHttpRequest 同理（部分平台仍使用 XHR）
const originalOpen = XMLHttpRequest.prototype.open
XMLHttpRequest.prototype.open = function(method, url, ...args) {
  this.__webenvoy_url__ = url
  return originalOpen.call(this, method, url, ...args)
}
const originalSend = XMLHttpRequest.prototype.send
XMLHttpRequest.prototype.send = function(...args) {
  this.addEventListener('load', function() {
    if (shouldIntercept(this.__webenvoy_url__)) {
      window.postMessage({
        __webenvoy_intercept__: true,
        url: this.__webenvoy_url__,
        payload: JSON.parse(this.responseText),
      }, '*')
    }
  })
  return originalSend.apply(this, args)
}
```

ISOLATED 世界的 Content Script 监听 `window.message` 事件，过滤 `__webenvoy_intercept__` 标记后，通过 `chrome.runtime.sendMessage` 转发给 Background，再由 Background 经 Native Messaging 发给 CLI。

> **Spike C**（被动拦截方案验证）的具体验证目标即为此链路在小红书/抖音生产环境的可行性。

### 4.3 AX Tree 感知（L2 基础设施）

用于 L2 操作时理解页面结构，不直接服务于读数据，服务于 L2 写操作的元素定位：

```
CDP: Accessibility.getFullAXTree
     ↓
过滤 ignored / generic / none 节点
     ↓
为可交互节点分配短 ID（e0, e1...） → RefCache
     ↓
LLM 收到精简语义树 → 返回 { "action": "click", "target": "e1" }
     ↓
从 RefCache 查 BackendDOMNodeID → CDP 原生点击
```

---

## 四½、操作后状态收敛等待（通用基础设施）

通过 CDP 发出的物理点击（或合成事件链）执行后，前端框架的状态更新并非同步完成。React/Vue 的 Virtual DOM diff、异步网络请求、DOM 二次渲染，通常需要 50ms-1000ms 才能收敛。如果 Extension 在操作后立即读取 DOM，拿到的可能是旧状态。

**所有操作指令执行后，必须经过状态收敛等待，才能返回结果给 CLI。**

```typescript
interface WaitStrategy {
  mutation: boolean     // 是否等待 DOM 变化
  network: boolean      // 是否等待网络请求完成
  timeout: number       // 最大等待时间（ms）
  settled: number       // DOM 静止多久视为收敛（ms）
}

const waitForSettled = (strategy: WaitStrategy): Promise<void> => {
  return new Promise((resolve) => {
    let timer: ReturnType<typeof setTimeout>
    let resolved = false

    const done = () => {
      if (!resolved) { resolved = true; resolve() }
    }

    // 硬超时兜底
    setTimeout(done, strategy.timeout)

    if (strategy.mutation) {
      // 监听 DOM 变化，每次变化重置「静止计时器」
      const observer = new MutationObserver(() => {
        clearTimeout(timer)
        timer = setTimeout(done, strategy.settled)
      })
      observer.observe(document.body, {
        childList: true, subtree: true, attributes: true
      })
      // 首次启动静止计时
      timer = setTimeout(done, strategy.settled)
    }

    if (strategy.network) {
      // 等待所有 pending 的 fetch/XHR 完成（通过劫持层计数）
      const checkNetwork = () => {
        if (window.__webenvoy_pending_requests__ === 0) {
          setTimeout(done, strategy.settled)
        } else {
          setTimeout(checkNetwork, 50)
        }
      }
      checkNetwork()
    }
  })
}
```

**各操作类型的默认等待策略**：

| 操作 | mutation | network | timeout | settled | 说明 |
|---|---|---|---|---|---|
| click（导航类） | ✅ | ✅ | 10000ms | 500ms | 点击可能触发页面跳转或大量 DOM 重绘 |
| click（交互类） | ✅ | ❌ | 3000ms | 200ms | 下拉菜单、Tab 切换等轻量交互 |
| input / type | ✅ | ❌ | 2000ms | 100ms | 输入后等待框架状态同步 |
| submit（发布类） | ✅ | ✅ | 15000ms | 1000ms | 提交后等待 API 响应和 UI 反馈 |
| L3 fetch | ❌ | ❌ | 30000ms | — | 直接网络请求，无需等 DOM |

> 等待策略可在 `rules.yaml` 中按平台按操作覆盖默认值。

---

## 五、写操作机制（三类场景）

### 5.1 富文本编辑器输入

现代社媒（小红书、抖音）编辑器为自研 React/Vue 组件，标准 `.value` 赋值无效。

**必须使用完整合成事件链**：

```typescript
// 针对 contenteditable 或自定义编辑器的完整事件链
const dispatchChain = async (el: Element, text: string) => {
  el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
  el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
  el.dispatchEvent(new FocusEvent('focus', { bubbles: true }))
  // 中文输入（或需触发输入法监听器的文本）
  el.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }))
  el.dispatchEvent(new CompositionEvent('compositionupdate', { data: text, bubbles: true }))
  el.dispatchEvent(new CompositionEvent('compositionend', { data: text, bubbles: true }))
  el.dispatchEvent(new InputEvent('input', { data: text, bubbles: true }))
  // React 受控组件只监听 change（不是 input），Vue v-model 同时监听两者
  // 必须补全这两个事件，否则「输入框有字但提交时报空」
  el.dispatchEvent(new Event('change', { bubbles: true }))
  el.dispatchEvent(new FocusEvent('blur', { bubbles: true }))
}
```

**风险点**：`CompositionEvent` / `InputEvent` 无法通过 CDP `Input` 域合成（CDP Input 域不支持输入法事件），只能在 JS 层 `dispatchEvent`，因此 `isTrusted = false`，高防平台可能校验此属性。

**isTrusted 真假混合缓解方案**：在发送合成事件链之前，先通过 CDP（Playwright `page.click()`）对输入框执行一次**真实的物理点击**，产生 `isTrusted = true` 的 `mousedown / mouseup / click / focus` 事件序列，将输入框置于真实 Focus 状态。随后再追加合成的 `CompositionEvent` / `InputEvent` 链。这样风控探针捕获的事件序列为「真实 Focus → 合成输入」，与人类「点击输入框 → 开始打字」的行为模式一致，大幅降低被识别概率：

```typescript
// 步骤 1：CDP 真实点击（isTrusted = true）
await page.click(selector)  // 通过 CDP Input.dispatchMouseEvent 发送

// 步骤 2：合成事件链（isTrusted = false，但前置了真实 Focus）
await page.evaluate((text) => {
  const el = document.activeElement  // 已被真实 Focus
  el.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }))
  el.dispatchEvent(new CompositionEvent('compositionupdate', { data: text, bubbles: true }))
  el.dispatchEvent(new CompositionEvent('compositionend', { data: text, bubbles: true }))
  el.dispatchEvent(new InputEvent('input', { data: text, bubbles: true }))
  el.dispatchEvent(new Event('change', { bubbles: true }))
  el.dispatchEvent(new FocusEvent('blur', { bubbles: true }))
}, text)
```

**注意**：普通的点击和键盘输入应优先用 Playwright `page.click()` / `page.type()`（通过 CDP `Input.dispatchMouseEvent` / `Input.dispatchKeyEvent`，`isTrusted = true`）；只有富文本编辑器需要 `CompositionEvent` 时才回退到此 JS 路径。

**降级方案**：转为 L3 直调草稿保存 API（bypass 前端编辑器）。

### 5.2 媒体文件上传

**DataTransfer 注入方案**（适用于 `<input type="file">`）：

```typescript
const injectFile = async (inputEl: HTMLInputElement, imageUrl: string) => {
  const blob = await fetch(imageUrl).then(r => r.blob())
  const file = new File([blob], 'image.jpg', { type: 'image/jpeg' })
  const dt = new DataTransfer()
  dt.items.add(file)
  inputEl.files = dt.files
  inputEl.dispatchEvent(new Event('change', { bubbles: true }))
  inputEl.dispatchEvent(new InputEvent('input', { bubbles: true }))
}
```

**局限性**：
- `isTrusted = false` 的平台会拦截
- 平台改用 File System Access API 后失效
- Bilibili 等使用 `window.postMessage` 内部协议的平台需单独适配

**降级方案（L3）**：直接逆向平台的 OSS 预签名上传接口，绕过前端 UI 直接上传。

### 5.3 拟人化鼠标操作（高防场景必选）

在对抗 Datadome、Akamai 等行为生物识别系统时，必须替换瞬间转移式 click。

**实现参考 ghost-cursor 数学模型**：
1. **贝塞尔曲线插值**：起点到终点之间生成双随机控制锚点，产生自然弧线
2. **菲茨定律控速**：距离越远速度越快；接近目标则减速对准
3. **过冲模拟**：超过阈值距离时刻意越过目标再回拉

**集成方式（默认档）**：通过 `page.context().newCDPSession(page)` 桥接 CDP，手动发送 `Input.dispatchMouseEvent`（ghost-cursor 无原生 Playwright 接口）。

**集成方式（最高安全档）**：CDP 通道不可用时，改用 OS 级输入引擎。鼠标轨迹算法不变（贝塞尔 + 菲茨定律），但通过 `nut.js`（macOS `CGEvent` / Windows `SendInput`）发送，事件由操作系统内核产生，`isTrusted = true`，无 CDP 路径痕迹。

**L1 点击前的坐标校准（必做）**：物理点击极度依赖坐标准确性。高 DPR 屏幕（Retina）、浏览器缩放、以及动态加载导致的 Layout Shift 都会使历史坐标失效。执行 L1 点击前必须：

```typescript
const getClickTarget = async (session: CDPSession, backendNodeId: number) => {
  // 1. 实时获取元素最新位置（不依赖缓存坐标）
  const { model } = await session.send('DOM.getBoxModel', { backendNodeId })
  const [x, y] = model.content  // 返回的是 CSS 像素坐标

  // 2. 校正 devicePixelRatio（Retina 屏下 CSS px ≠ 物理 px）
  const dpr = await page.evaluate(() => window.devicePixelRatio)

  // 3. 校正滚动偏移（页面未滚动到顶部时）
  const { scrollX, scrollY } = await page.evaluate(() => ({
    scrollX: window.scrollX,
    scrollY: window.scrollY,
  }))

  return {
    x: (x - scrollX) * dpr,
    y: (y - scrollY) * dpr,
  }
}
```

> 永远在发送 `Input.dispatchMouseEvent` 前调用此函数，不要复用上一次快照中记录的坐标。

**约束**：ghost-cursor 仅支持鼠标事件，不支持 TouchEvent（移动端适配另行方案）。

---

## 六、Content Script 执行上下文

这是整个架构中最容易踩坑的设计决策，需要明确规范。

### 6.1 两个执行世界

| 世界 | 访问平台 JS（`window._webmsxyw`） | 访问 Chrome Extension API | 适合做什么 |
|---|---|---|---|
| **MAIN 世界** | ✅ 可以 | ❌ 不能 | 调用平台签名函数、注入 Stealth 补丁 |
| **ISOLATED 世界**（默认） | ❌ 不能 | ✅ 可以 | 消息路由、数据结构化、调用 chrome.runtime |

### 6.2 签名函数调用的正确姿势

```typescript
// 在 Isolated World 的 Content Script 中：
const callPlatformSign = async (url: string, data: string): Promise<string> => {
  return new Promise((resolve) => {
    // 1. 监听来自 MAIN 世界的回调
    window.addEventListener('__webenvoy_sign_result__', (e) => {
      resolve((e as CustomEvent).detail.result)
    }, { once: true })

    // 2. 向 MAIN 世界发出计算请求
    window.dispatchEvent(new CustomEvent('__webenvoy_sign_request__', {
      detail: { url, data }
    }))
  })
}

// 通过 chrome.scripting.executeScript({ world: "MAIN" }) 注入到 MAIN 世界的代码：
window.addEventListener('__webenvoy_sign_request__', (e) => {
  const { url, data } = (e as CustomEvent).detail
  const result = window._webmsxyw(url, data)   // 调用 XHS 自有签名函数
  window.dispatchEvent(new CustomEvent('__webenvoy_sign_result__', {
    detail: { result }
  }))
})
```

### 6.3 Stealth 层注入（MAIN 世界，页面加载前）

8 维反检测补丁需要在 MAIN 世界、`document_start` 阶段注入（否则页面 JS 先于补丁执行，指纹已泄露）：

```jsonc
// manifest.json
{
  "content_scripts": [{
    "matches": ["*://*.xiaohongshu.com/*", "*://*.douyin.com/*"],
    "js": ["stealth-patch.js"],
    "run_at": "document_start",
    "world": "MAIN"   // Chrome 111+ 支持
  }]
}
```

**8 维 Stealth 补丁覆盖范围**：

| 检测维度 | 泄漏点 | 修复方案 |
|---|---|---|
| WebDriver 标志 | `navigator.webdriver = true` | 强制重写为 `undefined` |
| Chrome 上下文 | `window.chrome` 为空 | 注入 `window.chrome = { runtime: {} }` |
| Canvas 指纹 | Canvas 像素哈希唯一 | 注入细微随机噪声 |
| 字体度量指纹 | `TextMetrics` 字宽稳定可追踪 | 注入字体度量随机扰动 |
| WebGL 供应商 | 暴露真实 GPU 型号 | 伪造为通用 "Intel Inc." |
| WebRTC | 泄露真实 IP | CDP `Emulation.setUserAgentOverride` 或禁用 WebRTC |
| 时区不一致 | 系统时区与 UA 地区不符 | CDP `Emulation.setTimezoneOverride` |
| ShadowDOM 封闭 | Closed ShadowDOM 无法遍历 | `Element.prototype.attachShadow` 强制 open 模式 |

> **指纹一致性约束**：同一配置空间每次启动时的随机噪声种子必须固定（存储在配置空间元数据中），确保同一账号每次访问的指纹特征一致，不随机变化（随机变化反而更易被识别为自动化）。

> **深度展开**：完整的反检测技术架构（Layer 0-5、行为节律引擎、Profile 播种）详见 [`anti-detection.md`](../anti-detection.md)。
