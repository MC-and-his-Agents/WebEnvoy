# daijro/camoufox 深度调研报告

> 本报告综合两次调研内容：初版（架构选型分析）与深化版（指纹注入机制拆解），2026年03月17日整合

## 1. 宏观信息
- **仓库地址**: [daijro/camoufox](https://github.com/daijro/camoufox)
- **Stars**: ~6.1k
- **定位**: 底层防关联浏览器 (Anti-detect browser)，专为自动化突破严格的反爬虫检测（如 Cloudflare, Datadome）打造。
- **核心技术栈**: C++ (Firefox 源内核魔改), Python (Playwright 封装桥梁)。

---

## 2. 核心架构与底层机制 (C++ 级伪装)

不同于市面上常用的 `puppeteer-extra-plugin-stealth`（JS 注入级别的伪装极易被探测到 `Proxy` 的 `toString` 异常或运行期竞态泄漏），Camoufox 走了一条维护成本最高、但也最硬核的路：**直接修改 Firefox 的 C++ 源码并重新编译**。

```
Python 启动层（launch_options()）
    │ 生成指纹配置 JSON（联动 BrowserForge 真实硬件画像库）
    │ 序列化为环境变量（CAMOU_CONFIG_1, CAMOU_CONFIG_2, ...）
    ↓
Firefox C++ 核心层
    └── MaskConfig（启动时读取环境变量，解析 JSON）
        └── ~100 个注入点（nsScreen, nsGlobalWindowInner, AudioContext, WebGL, ...）
```

### 2.1 为什么 C++ 层注入优于 JS Hook

JavaScript 层的 hook（如 `Object.defineProperty` 覆盖 `navigator.userAgent`）存在三个根本性缺陷：

1. **被原型链检测**：`navigator.__proto__.userAgent` 的 descriptor 与原生不一致
2. **无法影响 Worker 线程**：JS hook 只在主线程有效，ServiceWorker 和 WebWorker 中的 `navigator` 仍是原始值
3. **C++ 渲染特征无法伪造**：字体的亚像素渲染差异、GPU WebGL 哈希等原生特征完全不受 JS hook 影响

### 2.2 MaskConfig 核心注入引擎

`MaskConfig` 是系统内部的中央配置单例：
- 通过超长环境变量接收来自外部 Python 启动器的真实设备指纹 JSON 数据，在 C++ 层缓存解析
- **WebGL 劫持**: 在 Firefox 渲染管线 `ClientWebGLContext.cpp` 内部，所有 `GetParameter` 或 `GetContextAttributes` 方法都先走 `MaskConfig::GLParam()`；不命中才回调原生实现
- 提供类型安全的访问接口，全局约 **100 个注入点**：

```cpp
MaskConfig::GetString("navigator:userAgent")
MaskConfig::GetInt32("screen:width")
MaskConfig::GetDouble("AudioContext:outputLatency")
MaskConfig::GetUint32("AudioContext:maxChannelCount")
```

### 2.3 字体间距：确定性随机注入（最精妙的设计）

**字体白名单与哈希间距 (Font Spacing Seed System)**：专门针对 Canvas 字体大小测量指纹。它不只是随机扰动 Canvas 像素，而是深层修改了底层的 **HarfBuzz 文本整形器 (`gfxHarfBuzzShaper::ShapeText()`)**：

```cpp
// 线性同余生成器（LCG）从种子生成确定性随机数
seed = (seed * 1103515245 + 12345) & 0x7fffffff;
float offset = ((float)seed / 0x7fffffff) * maxOffset;
// offset 叠加到字母间距上，使字体 metrics 产生微小偏差
```

通过 `FontSpacingSeedManager` 为每个 Context（以 `userContextId` 为 Key）埋入一个确定的噪音 Seed，在排版时微调字形偏移度，使得**浏览器指纹绝对唯一且同一设备内稳定**。

若无种子则回退到固定常量 `0x6D2B79F5u`（而非时间戳），避免每次渲染结果不同。

### 2.4 防护体系扩展

**隔离的 Juggler 通道**：引入 `Juggler.js` 并通过补丁大幅修改了 Firefox 以原生支持 Playwright 自动化管线。更重要的是修改了 `Navigator.cpp`（使其始终伪装 WebDriver 为 false）并把 Playwright 的 Page Agent 框架隔离在不可见的底层沙盒中，避免网站 JS 通过枚举原型链检测到 Playwright 特征。

### 2.5 指纹覆盖范围完整清单

| 类别 | 具体属性 |
|------|----------|
| **Navigator** | userAgent, platform, hardwareConcurrency, deviceMemory, languages |
| **Screen** | width, height, colorDepth, availWidth, availHeight, pixelDepth |
| **Window** | innerWidth, innerHeight, outerWidth, outerHeight, devicePixelRatio |
| **WebGL** | RENDERER, VENDOR, 全部 getParameter() 值, 扩展列表, 着色器精度格式 |
| **WebGL2** | 同上，WebGL 2.0 专属参数 |
| **Audio** | sampleRate, maxChannelCount, outputLatency |
| **Canvas** | aaOffset（抗锯齿偏移）, aaCapOffset（大写字母偏移） |
| **字体** | 可用字体列表, 字母间距噪音（fonts:spacing_seed 驱动） |
| **网络 Headers** | User-Agent, Accept-Language, Accept-Encoding |
| **地理位置** | latitude, longitude, accuracy |
| **系统** | 时区, 语言区域（Locale）, CSP 绕过 |

---

## 3. Python 层的动态联动与集成方式

Camoufox 对用户暴露的 Python 包不只是一个启动器，它内部包装了 `Playwright` 的核心逻辑：
- 调用 `launchServer` 借用 Playwright 的未公开 API 偷偷拉起 C++ 服务
- 与著名的伪装库 **BrowserForge** 动态联动：启动时自动从池中抽取一台真实 Windows/Mac 的极其详尽的硬件画像（包含 User-Agent、分辨率、WebGL 驱动版号），将其灌入环境变量，最后启动被魔改过的 Firefox 二进制文件

### 3.1 指纹种子的生命周期

```
Python launch_options(fingerprint=None)
    │
    ├── fingerprint 未传入 → generate_fingerprint(os, screen)  ← 随机生成
    └── fingerprint 已传入 → from_browserforge(fingerprint)     ← 使用自定义指纹
    │
    ↓ 合并为完整配置 JSON（含 audioNoiseSeed, fonts:spacing_seed 等）
    ↓ 序列化为环境变量（按 OS 大小限制分块）
    ↓ Firefox 启动 → MaskConfig 读取 → 注入全部 ~100 个属性点
```

传入自定义指纹需要 `i_know_what_im_doing=True`，否则 Camoufox 会警告指纹参数组合可能不真实。

### 3.2 持久化 Profile 集成方式

通过 `AsyncNewBrowser` / `NewBrowser` 的 `persistent_context=True` 参数启用持久化上下文：

```python
browser_context = await AsyncNewBrowser(
    p, persistent_context=True, user_data_dir="./my_profile_dir"
)
```

---

## 4. 重大架构约束：Profile 持久化存在已知缺陷

> ⚠️ **这是影响架构选型的关键限制，必须重点关注。**

通过深度调研源码得到以下关键发现：

- **`user_data_dir` 状态无法在重启后自动恢复**：Camoufox 源码中的测试用例 `test_should_restore_state_from_userDataDir` 被明确标记为 `skip`，注释写明 **"Not supported by Camoufox"**。
- **实际含义**：即使在 `user_data_dir` 里保存了之前的登录 Cookie，浏览器重新启动后**不会自动加载恢复这些状态**，仍然需要重新登录。
- **Docker/CI 下的影响**：在无人值守的云端自动化场景中，每次容器重启后都需要重新完成登录流程，无法实现账号热保活。
- **变通方案**：需要在 Python 业务层通过 CDP `Network.getAllCookies` 导出 Cookie，下次启动后通过 `Network.setCookies` 手动注入。

### 单实例多账号隔离

Camoufox 使用 Firefox 原生的 `userContextId`（Multi-Account Containers 底层机制）在**单浏览器实例内**隔离多个账号，种子以 `userContextId` 为 Key 存储，确保不同账号之间的指纹完全独立。

| 特性 | Camoufox | 标准 Playwright（Chromium） |
|---|---|---|
| 高防指纹伪装强度 | ⭐⭐⭐⭐⭐（C++ 内核级） | ⭐⭐⭐（JS 注入级） |
| Profile 持久化（重启复活） | ❌ 不支持 | ✅ 完整支持（userDataDir） |
| 账号保活能力 | ❌ 每次重启需重新登录（或手动 CDP 注入 Cookie） | ✅ Named Profile 冷热复活 |
| Worker 线程指纹一致性 | ✅ C++ 层天然覆盖全线程 | ⚠️ JS Hook 只覆盖主线程 |
| 字体 metrics 伪装 | ✅ HarfBuzz 源码级修改 | ❌ 无法伪造 |

---

## 5. 总结与借鉴价值

Camoufox 证明了 **"要想彻底伪装，必须下探到 C++ 源码层"** 的终极法则。

作为旨在辅助 AI Agent 的自动化工具，未必有精力常态化地维护一个被 C++ 补丁重重包裹的 Firefox 发行版，但如果目标站点是那种防御等级拉满的航司抢票或电商抢购页面，直接将 Camoufox 的 Python 库替换掉标准的 Playwright `chromium.launch()` 驱动器，是大幅提升生存率的"捷径"。

**核心取舍**：Camoufox 适合当"一次性超级隐身容器"，处理单次高难度任务；**不适合**作为需要长期持有多个账号登录态的"账号资产托管平台"。账号保活需配合带 `userDataDir` 支持的标准 Chromium Profile 方案；高强度反爬则配合 Camoufox。两者互补，不可互相替代。

**关键借鉴**：`fonts:spacing_seed` 等指纹种子的「固定且唯一」设计哲学——多账号防风控的核心不是「每次都变」，而是「每个账号拥有一个固定且独特的人设」。
