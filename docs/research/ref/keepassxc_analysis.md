# KeePassXC Native Messaging 注册机制调研报告

> 调研日期：2026年03月17日  
> 仓库：[keepassxreboot/keepassxc](https://github.com/keepassxreboot/keepassxc)（主应用，C++/Qt）、[keepassxreboot/keepassxc-browser](https://github.com/keepassxreboot/keepassxc-browser)（浏览器扩展）  
> 调研焦点：跨平台 Native Messaging Host 注册机制

---

## 一、架构概述

KeePassXC 的浏览器集成分为三层：

```
浏览器扩展（keepassxc-browser）
    ↕ Native Messaging 协议（stdio）
keepassxc-proxy（独立代理进程，随主程序安装包一起分发）
    ↕ Unix Domain Socket / Named Pipe
KeePassXC 主进程
```

**注册机制的实现位置**：在 **KeePassXC 主应用**（C++）内部的 `NativeMessageInstaller` 类中（`src/browser/NativeMessageInstaller.cpp`），**不在浏览器扩展仓库中**。用户在 KeePassXC 的设置界面勾选浏览器支持复选框时，即触发注册。

---

## 二、平台支持范围

| 平台 | Native Messaging 注册 | Windows 注册表写入 | 说明 |
|------|-----------------------|-------------------|------|
| Windows | ✅ 完整支持 | ✅ 写入 HKCU | 免管理员权限 |
| macOS | ✅ 完整支持 | 不适用 | 写入用户目录 |
| Linux（原生包） | ✅ 完整支持 | 不适用 | 写入 `~/.config/` |
| Linux（Flatpak） | ✅ 特殊兼容 | 不适用 | 硬编码宿主路径 |
| Linux（Snap） | ✅ 特殊兼容 | 不适用 | 使用 `SNAP_REAL_HOME` |
| Linux（AppImage） | ✅ 支持 | 不适用 | 使用 `$APPIMAGE` 变量 |

---

## 三、Windows：注册表写入机制（最核心难点）

### 3.1 注册表权限级别

**使用 HKCU（HKEY_CURRENT_USER），不使用 HKLM**。

这是关键设计决策：写入当前用户的注册表分支**无需 UAC 提权弹窗**，普通用户权限即可完成。

> 特殊情况：企业 IT 可能通过组策略将 `NativeMessagingUserLevelHosts` 设为 0（禁止用户级别的 Native Messaging Hosts），此时需要 HKLM 写入（需管理员），KeePassXC 本身不处理这种 enterprise policy 场景。

### 3.2 各浏览器精确注册表路径

源码中 `NativeMessageInstaller.cpp` 的常量定义（Windows 分支）：

| 浏览器 | 完整注册表键路径 |
|--------|-----------------|
| Chrome | `HKEY_CURRENT_USER\Software\Google\Chrome\NativeMessagingHosts\org.keepassxc.keepassxc_browser` |
| Chromium | `HKEY_CURRENT_USER\Software\Chromium\NativeMessagingHosts\org.keepassxc.keepassxc_browser` |
| Firefox | `HKEY_CURRENT_USER\Software\Mozilla\NativeMessagingHosts\org.keepassxc.keepassxc_browser` |
| Vivaldi | （与 Chrome 共用）`HKEY_CURRENT_USER\Software\Google\Chrome\NativeMessagingHosts\org.keepassxc.keepassxc_browser` |
| Brave | （与 Chrome 共用）`HKEY_CURRENT_USER\Software\Google\Chrome\NativeMessagingHosts\org.keepassxc.keepassxc_browser` |
| Tor Browser | （与 Firefox 共用）`HKEY_CURRENT_USER\Software\Mozilla\NativeMessagingHosts\org.keepassxc.keepassxc_browser` |
| Edge | `HKEY_CURRENT_USER\Software\Microsoft\Edge\NativeMessagingHosts\org.keepassxc.keepassxc_browser` |

**注册表结构**：每个键下有一个 `(Default)` 默认值，内容为 JSON 文件的绝对路径。

```
HKCU\Software\Google\Chrome\NativeMessagingHosts\
  └── org.keepassxc.keepassxc_browser\
        └── (Default) = "C:\Users\user\AppData\Local\KeePassXC\org.keepassxc.keepassxc_browser_chrome.json"
```

### 3.3 Windows JSON 文件存储位置

| 安装方式 | JSON 文件存储目录 |
|----------|-------------------|
| 标准安装 | `%LOCALAPPDATA%\KeePassXC\`（即 `%AppData%\..\Local\KeePassXC\`） |
| 便携版（Portable） | KeePassXC 程序所在目录 |

文件命名规则（每个浏览器单独一个 JSON 文件）：

```
org.keepassxc.keepassxc_browser_chrome.json
org.keepassxc.keepassxc_browser_chromium.json
org.keepassxc.keepassxc_browser_firefox.json
org.keepassxc.keepassxc_browser_edge.json
...
```

### 3.4 Windows 可执行体（`path` 字段）

Manifest 的 `path` 字段在 Windows 上指向：

```
<KeePassXC 程序目录>\keepassxc-proxy.exe
```

即 `keepassxc-proxy.exe` 与 `KeePassXC.exe` 位于同一目录，**直接指向 .exe，不通过 .bat 或 .ps1 包装**。

源码实现（正常安装路径）：
```cpp
path = QCoreApplication::applicationDirPath() + QStringLiteral("/keepassxc-proxy");
#ifdef Q_OS_WIN
    path.append(QStringLiteral(".exe"));
#endif
```

### 3.5 注册表写入代码（Qt QSettings）

KeePassXC 使用 Qt 的 `QSettings` 以 `NativeFormat` 写入 Windows 注册表：

```cpp
// 启用浏览器时写入
QSettings settings(getTargetPath(browser), QSettings::NativeFormat);
settings.setValue("Default", getNativeMessagePath(browser));

// 禁用浏览器时删除
QSettings settings(getTargetPath(browser), QSettings::NativeFormat);
settings.remove("Default");
```

`QSettings::NativeFormat` 在 Windows 下自动映射为注册表操作，路径格式 `HKEY_CURRENT_USER\...` 被 Qt 正确解析为注册表路径。

---

## 四、macOS：目录路径字典

所有路径均以 `~/Library/Application Support` 为前缀（用户级目录，免管理员权限）：

| 浏览器 | macOS 写入目录 |
|--------|----------------|
| Chrome | `~/Library/Application Support/Google/Chrome/NativeMessagingHosts` |
| Chromium | `~/Library/Application Support/Chromium/NativeMessagingHosts` |
| Firefox | `~/Library/Application Support/Mozilla/NativeMessagingHosts` |
| Vivaldi | `~/Library/Application Support/Vivaldi/NativeMessagingHosts` |
| Tor Browser | `~/Library/Application Support/TorBrowser-Data/Browser/Mozilla/NativeMessagingHosts` |
| Brave | `~/Library/Application Support/BraveSoftware/Brave-Browser/NativeMessagingHosts` |
| Edge | `~/Library/Application Support/Microsoft Edge/NativeMessagingHosts` |

**补充（来自 Troubleshooting Guide）**：
- **Arc 浏览器** 可使用 Chrome 的存储位置（`~/Library/Application Support/Arc/User Data/NativeMessagingHosts`）
- Brave 在 macOS 上也支持使用 Chrome 的路径（因为 Brave 使用 Chrome Store 的扩展 ID）

macOS 上 `path` 字段指向：

```
/Applications/KeePassXC.app/Contents/MacOS/keepassxc-proxy
```

---

## 五、Linux：目录路径字典

### 5.1 标准安装（原生包）

Linux 路径以 `~/.config` 或 `~/` 为前缀，由 Qt 的 `QStandardPaths` 返回：

| 浏览器 | Linux 写入目录 |
|--------|----------------|
| Chrome | `~/.config/google-chrome/NativeMessagingHosts` |
| Chromium | `~/.config/chromium/NativeMessagingHosts` |
| Firefox | `~/.mozilla/native-messaging-hosts` |
| Vivaldi | `~/.config/vivaldi/NativeMessagingHosts` |
| Brave | `~/.config/BraveSoftware/Brave-Browser/NativeMessagingHosts` |
| Edge | `~/.config/microsoft-edge/NativeMessagingHosts` |
| Tor Browser | `~/.local/share/torbrowser/tbb/x86_64/tor-browser/Browser/TorBrowser/Data/Browser/.mozilla/native-messaging-hosts` |

### 5.2 Flatpak 安装的 KeePassXC（特殊兼容）

当 KeePassXC 以 Flatpak 运行时，其沙箱内的 `XDG_DATA_HOME`、`XDG_CONFIG_HOME` 变量指向 Flatpak 沙箱内部路径，与宿主机路径不同。KeePassXC **硬编码**宿主机路径来规避这个问题：

```cpp
#elif defined(KEEPASSXC_DIST_FLATPAK)
    if (browser == SupportedBrowsers::TOR_BROWSER) {
        basePath = QDir::homePath() + "/.local/share";
    } else if (browser == SupportedBrowsers::FIREFOX) {
        basePath = QDir::homePath();  // => ~/.mozilla/...
    } else {
        basePath = QDir::homePath() + "/.config";  // => ~/.config/...
    }
```

Flatpak 版 KeePassXC 的代理可执行体路径，通过读取 `/.flatpak-info` 动态构建：

```cpp
QString constructFlatpakPath() {
    QSettings settings("/.flatpak-info", QSettings::IniFormat);
    settings.beginGroup("Instance");
    QString appPath = settings.value("app-path").toString();
    // 从 app-path 反推 flatpak exports 路径
    // 结果形如：/var/lib/flatpak/exports/bin/org.keepassxc.KeePassXC
}
```

Fallback 路径为：`/var/lib/flatpak/exports/bin/org.keepassxc.KeePassXC`

### 5.3 Snap 安装的 KeePassXC（特殊兼容）

Snap 同样重定义了 `$HOME`，KeePassXC 使用 `SNAP_REAL_HOME` 环境变量获取真实的用户主目录：

```cpp
#elif defined(KEEPASSXC_DIST_SNAP)
    if (browser == SupportedBrowsers::FIREFOX) {
        basePath = qEnvironmentVariable("SNAP_REAL_HOME");
    } else {
        basePath = qEnvironmentVariable("SNAP_REAL_HOME") + "/.config";
    }
```

Snap 版代理路径固定为：`/snap/bin/keepassxc.proxy`

### 5.4 关于 Snap/Flatpak **浏览器**的支持情况

上述兼容处理仅针对 **KeePassXC 本身** 以 Snap/Flatpak 运行的情况。对于用户通过 Snap/Flatpak 安装的**浏览器**（如 Ubuntu 的 Firefox Snap），情况更为复杂：

- **Firefox Snap**（Ubuntu 22.04+）：通过 `flatpak permission-set webextensions` 命令配置权限后可用
- **Chromium Snap**（Ubuntu 旧版）：不支持（沙箱隔离太严）
- 官方 Troubleshooting Guide 明确指出：**"in general Flatpak and Snap based browsers are not supported, Ubuntu's Firefox Snap being an exception"**

---

## 六、Manifest 文件内容与 `allowed_origins` 策略

### 6.1 文件名

所有平台（除 Windows 外）统一使用：`org.keepassxc.keepassxc_browser.json`

Windows 每个浏览器单独命名（见第三节）。

### 6.2 Chromium 系 Manifest（`allowed_origins`）

```json
{
    "name": "org.keepassxc.keepassxc_browser",
    "description": "KeePassXC integration with native messaging support",
    "path": "/path/to/keepassxc-proxy",
    "type": "stdio",
    "allowed_origins": [
        "chrome-extension://pdffhmdngciaglkoonimfcmckehcpafo/",
        "chrome-extension://oboonakemofpalcgghocfoadofidjkkk/"
    ]
}
```

| 扩展 ID | 来源 |
|---------|------|
| `pdffhmdngciaglkoonimfcmckehcpafo` | Edge 商店版扩展 |
| `oboonakemofpalcgghocfoadofidjkkk` | Chrome 商店版扩展 |

**关键结论**：Edge、Brave、Vivaldi 和 Chrome 使用**完全相同格式**的 `chrome-extension://<id>/`，区别仅在于扩展 ID 不同。只要 ID 对应，它们共用同一份 Chromium 系 manifest 即可。

### 6.3 Firefox 系 Manifest（`allowed_extensions`）

```json
{
    "name": "org.keepassxc.keepassxc_browser",
    "description": "KeePassXC integration with native messaging support",
    "path": "/path/to/keepassxc-proxy",
    "type": "stdio",
    "allowed_extensions": [
        "keepassxc-browser@keepassxc.org"
    ]
}
```

Firefox 使用 Add-on ID（通常为 `name@domain.org` 格式），而非 extension hash ID。

---

## 七、权限控制机制

### 7.1 代理可执行文件的权限

`keepassxc-proxy`/`keepassxc-proxy.exe` 的执行权限由**系统包管理器在安装时设置**，KeePassXC 的注册代码不处理代理文件本身的权限。

### 7.2 JSON 文件的权限

KeePassXC 使用 Qt `QFile::write()` 创建 JSON 文件，使用**系统默认 umask**（通常为 `0644`），不额外执行 `chmod`。

### 7.3 macOS 特殊情况

macOS Sequoia（15.x）及更新版本可能要求浏览器（如 Firefox）获得「本地网络访问权限」（Local Network Access）才能与代理通信，需在 `系统设置 → 隐私与安全 → 本地网络` 中手动允许。

---

## 八、卸载机制（完整支持）

KeePassXC 拥有完整的卸载（反注册）机制，通过 UI 取消勾选浏览器支持复选框即可触发。

### 8.1 实现代码

```cpp
void NativeMessageInstaller::setBrowserEnabled(SupportedBrowsers browser, bool enabled) {
    if (enabled) {
        // 注册：写注册表键 + 写 JSON 文件
#ifdef Q_OS_WIN
        QSettings settings(getTargetPath(browser), QSettings::NativeFormat);
        settings.setValue("Default", getNativeMessagePath(browser));
#endif
        createNativeMessageFile(browser);
    } else {
        // 反注册：删 JSON 文件 + 删注册表键
        QFile::remove(getNativeMessagePath(browser));
#ifdef Q_OS_WIN
        QSettings settings(getTargetPath(browser), QSettings::NativeFormat);
        settings.remove("Default");
#endif
    }
}
```

### 8.2 清理内容

| 内容 | Windows | macOS/Linux |
|------|---------|-------------|
| JSON manifest 文件 | ✅ 删除 | ✅ 删除 |
| 注册表键值 | ✅ 删除 `Default` 值 | 不适用 |
| 注册表键本身 | ⚠️ 保留父键（仅删值） | 不适用 |
| keepassxc-proxy 文件 | ❌ 不删除（属于主程序） | ❌ 不删除 |

> **注意**：Windows 上仅删除注册表键下的 `Default` 值，父键 `org.keepassxc.keepassxc_browser` 本身会保留为空键。浏览器读不到有效路径，功能即失效，但残留的空键不会造成问题。

---

## 九、路径更新机制

当 KeePassXC 升级到新版本、可执行文件路径发生变化时，`updateBinaryPaths()` 方法会遍历所有已启用的浏览器，重新调用 `setBrowserEnabled(browser, true)` 更新 JSON 文件中的 `path` 字段以及 Windows 注册表中的路径值：

```cpp
void NativeMessageInstaller::updateBinaryPaths() {
    for (int i = 0; i < SupportedBrowsers::MAX_SUPPORTED; ++i) {
        if (isBrowserEnabled(static_cast<SupportedBrowsers>(i))) {
            setBrowserEnabled(static_cast<SupportedBrowsers>(i), true);
        }
    }
}
```

---

## 十、机制设计总结

| 维度 | KeePassXC 的方案 |
|------|-----------------|
| Windows 注册表级别 | HKCU（无需 UAC，用户级权限） |
| Windows 可执行体类型 | 直接指向 `.exe`，无批处理/PowerShell 包装 |
| macOS 路径来源 | 静态硬编码，基于 `~/Library/Application Support/` |
| Linux 路径来源 | Qt `QStandardPaths` 动态获取（结合编译时标志区分 Flatpak/Snap） |
| Flatpak/Snap 浏览器兼容 | 对 KeePassXC 本身的 Snap/Flatpak 发行版有专项适配 |
| manifest `path` 字段 | 直接指向 `keepassxc-proxy`（或 `.exe`），无中间层脚本 |
| 卸载机制 | ✅ 完整，通过 UI 取消勾选即可清理文件和注册表 |
| 注册触发方式 | GUI 设置界面（用户主动操作），不在安装时自动注册 |
| 多浏览器策略 | 每个浏览器独立写入（Windows 每个浏览器独立 JSON 文件）|
| Brave/Vivaldi 处理 | 复用 Chrome 注册表路径（共享 `HKCU\...\Google\Chrome\...`） |
