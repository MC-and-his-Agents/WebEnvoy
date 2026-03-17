# Goldwarden Native Messaging 注册机制调研报告

> 调研日期：2026年03月17日  
> 仓库：[quexten/goldwarden](https://github.com/quexten/goldwarden)  
> 调研版本：main 分支（注意：项目已于近期宣布无限期暂停开发）  
> 调研焦点：跨平台 Native Messaging Host 注册机制

---

## 一、项目背景与定位

Goldwarden 是一个 Bitwarden 兼容的桌面客户端，专注于为 Linux 提供官方工具缺失的功能，包括 SSH Agent、全局自动填充（Autotype）、和**浏览器生物识别解锁（Browser Biometrics）**。

> README 明确说明：**仅在 Linux 上经过完整测试**。macOS 和 Windows 存在功能有限的构建版本，但未经测试，也无 native messaging 注册支持。

---

## 二、平台支持范围（结论先行）

| 平台    | Native Messaging 注册支持 | 说明                                   |
|---------|---------------------------|----------------------------------------|
| Linux   | ✅ 完整支持                | 通过 `setup browserbiometrics` 命令自动完成 |
| macOS   | ❌ 不支持                  | 无 macOS 路径适配，无注册逻辑          |
| Windows | ❌ 不支持                  | 无注册表写入逻辑，无 Windows 路径适配  |

---

## 三、整体架构：命令入口

### 3.1 CLI 命令结构

Goldwarden 提供独立的 `setup` 子命令来完成注册：

```
goldwarden setup browserbiometrics
```

代码位置：`cli/cmd/setup_linux.go`（通过 `//go:build linux || freebsd` 构建标签限定平台）

```go
var browserbiometricsCmd = &cobra.Command{
    Use:   "browserbiometrics",
    Short: "Sets up browser biometrics",
    Run: func(cmd *cobra.Command, args []string) {
        err := browserbiometrics.DetectAndInstallBrowsers()
        // ...
    },
}
```

### 3.2 主进程入口识别机制

`main.go` 中有一个特殊的启动路径判断：当进程被浏览器作为 native messaging host 启动时，浏览器会将 manifest 文件路径或 chrome-extension:// URL 作为第一个参数传入，Goldwarden 借此识别自身的启动身份：

```go
if len(os.Args) > 1 && (
    strings.Contains(os.Args[1], "com.8bit.bitwarden.json") ||
    strings.Contains(os.Args[1], "chrome-extension://")) {
    err = browserbiometrics.Main(&runtimeConfig)
}
```

---

## 四、Linux 注册机制详解

### 4.1 核心函数

所有注册逻辑集中在 `cli/browserbiometrics/main.go` 的 `DetectAndInstallBrowsers()` 函数中。

#### 注册策略：目录扫描而非路径硬编码

Goldwarden **不预先硬编码各浏览器的 manifest 写入路径**，而是：
1. 先检查一组已知的浏览器配置根目录是否存在
2. 再递归扫描这些目录，寻找名为 `NativeMessagingHosts` 或 `native-messaging-hosts` 的子目录
3. 一旦找到，直接在其中写入 manifest 和代理脚本

```go
err := filepath.Walk(home+"/"+startPath, func(path string, info os.FileInfo, err error) error {
    // 深度限制：目录层级不超过 5
    if strings.Count(tempPath, "/") > 5 {
        return nil
    }
    if info.IsDir() && info.Name() == "native-messaging-hosts" {
        // Mozilla 系浏览器
    } else if info.IsDir() && info.Name() == "NativeMessagingHosts" {
        // Chromium 系浏览器
    }
})
```

### 4.2 预扫描根目录列表

```go
var chromiumPaths = []string{
    "~/.config/google-chrome/",
    "~/.config/google-chrome-beta/",
    "~/.config/google-chrome-unstable/",
    "~/.config/chromium/",
    "~/.config/BraveSoftware/Brave-Browser/",
    "~/.config/thorium/",
    "~/.config/microsoft-edge-beta/",
    "~/.config/microsoft-edge-dev/",
}
var mozillaPaths = []string{"~/.mozilla/", "~/.librewolf/", "~/.waterfox/"}
```

> **注意**：这套路径列表**不包含** Snap/Flatpak 安装浏览器的路径（如 Ubuntu 的 `/snap/firefox/...`），因此对这类浏览器**无特殊兼容处理**。

### 4.3 精准路径字典

根据扫描逻辑，最终写入位置为：

| 浏览器类型 | 最终写入目录 |
|------------|--------------|
| Google Chrome（稳定） | `~/.config/google-chrome/NativeMessagingHosts/` |
| Google Chrome Beta | `~/.config/google-chrome-beta/NativeMessagingHosts/` |
| Google Chrome Dev | `~/.config/google-chrome-unstable/NativeMessagingHosts/` |
| Chromium | `~/.config/chromium/NativeMessagingHosts/` |
| Brave | `~/.config/BraveSoftware/Brave-Browser/NativeMessagingHosts/` |
| Thorium | `~/.config/thorium/NativeMessagingHosts/` |
| Microsoft Edge Beta | `~/.config/microsoft-edge-beta/NativeMessagingHosts/` |
| Microsoft Edge Dev | `~/.config/microsoft-edge-dev/NativeMessagingHosts/` |
| Firefox | `~/.mozilla/native-messaging-hosts/` |
| LibreWolf | `~/.librewolf/native-messaging-hosts/` |
| Waterfox | `~/.waterfox/native-messaging-hosts/` |

---

## 五、写入文件清单与内容

### 5.1 写入两个文件

每找到一个目标目录，就写入以下两个文件：

| 文件名 | 权限 | 内容 |
|--------|------|------|
| `com.8bit.bitwarden.json` | `0444`（只读） | Native Messaging Manifest JSON |
| `goldwarden-proxy.sh` | `0755`（可执行） | 代理 Shell 脚本 |

### 5.2 Manifest JSON 内容

#### Chromium 系（`chrome-com.8bit.bitwarden.json`）

```json
{
    "name": "com.8bit.bitwarden",
    "description": "Bitwarden desktop <-> browser bridge",
    "path": "/path/to/native-messaging-hosts/goldwarden-proxy.sh",
    "type": "stdio",
    "allowed_origins": [
        "chrome-extension://nngceckbapebfimnlniiiahkandclblb/",
        "chrome-extension://jbkfoedolllekgbhcbcoahefnbanhhlh/",
        "chrome-extension://ccnckbpmaceehanjmeomladnmlffdjgn/"
    ]
}
```

#### Mozilla 系（`mozilla-com.8bit.bitwarden.json`）

```json
{
    "name": "com.8bit.bitwarden",
    "description": "Bitwarden desktop <-> browser bridge",
    "path": "/path/to/native-messaging-hosts/goldwarden-proxy.sh",
    "type": "stdio",
    "allowed_extensions": [
        "{446900e4-71c2-419f-a6a7-df9c091e268b}"
    ]
}
```

**关键观察**：
- Chromium 系使用 `allowed_origins` 字段，值为 `chrome-extension://<id>/` 格式。Edge 和 Brave 复用同一份 Chromium 系 manifest（因为它们共用相同的 Bitwarden 扩展 ID 策略）
- Firefox 系使用 `allowed_extensions` 字段，值为花括号包裹的 Firefox Add-on ID
- `path` 字段始终指向**同目录下**的 `goldwarden-proxy.sh` 脚本（非直接指向二进制）

### 5.3 代理脚本内容（`goldwarden-proxy.sh`）

```bash
#!/usr/bin/env bash

# Check if the "com.quexten.Goldwarden" Flatpak is installed
if flatpak list | grep -q "com.quexten.Goldwarden"; then
  flatpak run --command=goldwarden com.quexten.Goldwarden "$@"
else
  # If not installed, attempt to run the local version
  goldwarden "$@"
fi
```

**设计要点**：
- 代理脚本优先尝试 Flatpak 版本，若不存在则 fallback 到 `$PATH` 中的 `goldwarden`
- 使用 `"$@"` 传递全部参数（包括浏览器传入的 manifest 路径），保持参数完整性
- 无需在脚本内处理路径空格问题（Shell 的 `"$@"` 已处理），但如果 `goldwarden` 本身路径含空格则需额外处理

---

## 六、权限控制机制

```go
// manifest JSON：写为只读，防止意外修改
err = os.WriteFile(path+"/com.8bit.bitwarden.json", []byte(manifest), 0444)

// 代理脚本：写为可执行
err = os.WriteFile(path+"/goldwarden-proxy.sh", []byte(proxyScript), 0755)
```

**缺少可执行权限的后果**：浏览器尝试启动代理脚本时会收到 `Permission denied` 错误，native messaging 连接完全失败。浏览器 console 通常显示 `Could not connect to the native messaging host`。

---

## 七、更新逻辑（幂等安装）

安装前，代码会先删除已有的旧文件，再重新写入。删除前需先临时赋予写权限：

```go
// 先 chmod 再 remove，避免 0444 文件无法删除
err = os.Chmod(path+"/com.8bit.bitwarden.json", 755)
err = os.Remove(path + "/com.8bit.bitwarden.json")
```

---

## 八、卸载机制

**Goldwarden 没有独立的卸载命令**。

代码中**仅有重新安装时的覆盖逻辑**（先删旧文件再写新文件），不存在只删不写的 uninstall 路径。若要手动清理，需要：

1. 删除各浏览器目录下的 `com.8bit.bitwarden.json`
2. 删除对应的 `goldwarden-proxy.sh`

---

## 九、Windows / macOS 支持状况

### Windows

- 源码中**无任何注册表写入代码**
- `setup_linux.go` 文件通过构建标签 `//go:build linux || freebsd` 明确排除 Windows
- Windows 没有对应的 `setup_windows.go`

### macOS

- 同样**无 macOS native messaging 注册逻辑**
- README 说明"somewhat feature-stripped builds for Mac are available but untested"
- macOS 的 `~/Library/Application Support/` 路径体系未在代码中出现

---

## 十、关键局限性总结

| 维度 | 情况 |
|------|------|
| 多平台支持 | 仅 Linux，Windows/macOS 均无 |
| Snap 浏览器兼容 | 无特殊兼容，Ubuntu Firefox Snap 等无法工作 |
| Flatpak 浏览器兼容 | 代理脚本检测 Flatpak 安装，但目录扫描路径不含 Flatpak 浏览器目录 |
| 卸载机制 | 无，需手动删除文件 |
| 幂等性 | ✅ 重复执行安全（先删后写） |
| 注册模式 | 目录扫描（动态发现），而非路径硬编码（静态配置） |
