# Selenoid 容器化浏览器隔离机制调研报告

> 调研日期：2026年03月17日  
> 仓库：[aerokube/selenoid](https://github.com/aerokube/selenoid)  
> 调研焦点：Docker 容器生命周期管理、每会话代理隔离、Profile 持久化、资源管控策略

---

## 一、项目定位

Selenoid 是 Aerokube 出品的高性能 Selenium/WebDriver Hub，其核心设计是**将每一个浏览器会话运行在独立的 Docker 容器中**。与传统的 Selenium Grid（在同一宿主机上并发启动多个浏览器进程）相比，容器级隔离带来了三个关键优势：

1. **文件系统完全隔离**：每个容器有独立的 `tmpfs` 或文件层，Profile 数据不会交叉污染
2. **网络栈独立**：每个容器可配置独立的代理 IP，实现网络身份隔离
3. **进程空间隔离**：一个浏览器崩溃不影响其他会话

```
客户端 (Playwright / Selenium)
    │ WebDriver 协议 POST /wd/hub/session
    ↓
Selenoid Hub（Go 进程）
    ├── capabilities 解析 → 匹配 browsers.json 配置
    ├── docker.StartWithCancel() → 拉起浏览器容器
    │   ├── Browser Container（Chrome/Firefox/等）
    │   ├── Video Container（可选，独立容器录屏）
    │   └── VNC Container（可选）
    └── 会话结束 → Cancel() → removeContainer()
```

---

## 二、容器生命周期管理

### 2.1 启动流程（`Docker.StartWithCancel()`）

```go
// 1. 根据 capabilities 找到匹配的镜像
// 2. 拉起浏览器容器，配置：
//    - CPU/Memory 限制
//    - 网络配置（默认 bridge 或自定义 network）
//    - 环境变量（含代理配置）
//    - Volume 挂载（可选持久化）
// 3. 可选：拉起 video 录屏容器
// 4. 等待浏览器服务就绪（健康检查）
// 5. 返回 Cancel 函数（会话结束时调用）
```

### 2.2 销毁流程（`Cancel()` → `removeContainer()`）

```go
// 1. 停止 video 容器（如果存在）
// 2. 调用 removeContainer()：
//    - docker.ContainerRemove(ctx, containerID, force=true)
//    - 同时删除 anonymous volumes（防止磁盘泄漏）
// 3. 保存日志（如果配置了日志收集）
```

**关键设计**：使用 `force=true` 强制删除，确保即使容器内进程挂起也能被清理。Volume 默认也一起删除（`RemoveVolumes: true`），保证没有数据残留。

### 2.3 会话超时自动清理

Selenoid 内置超时机制，若会话在 `sessionDeleteTimeout`（默认 1 分钟）内没有收到新请求，自动触发 `Cancel()`。这防止了客户端异常断开后容器资源的无限占用。

---

## 三、每会话代理配置

### 3.1 通过环境变量传递代理

Selenoid 的 capabilities 支持 `env` 字段，允许向容器注入任意环境变量。浏览器进程会尊重标准的 `HTTP_PROXY`/`HTTPS_PROXY` 环境变量：

```json
{
    "browserName": "chrome",
    "version": "latest",
    "selenoid:options": {
        "env": [
            "HTTP_PROXY=http://user:pass@proxy-server:8080",
            "HTTPS_PROXY=http://user:pass@proxy-server:8080",
            "NO_PROXY=localhost,127.0.0.1"
        ]
    }
}
```

### 3.2 通过 `browsers.json` 预配置代理

```json
{
    "chrome": {
        "default": "latest",
        "versions": {
            "latest": {
                "image": "selenoid/chrome:latest",
                "env": ["HTTPS_PROXY=http://company-proxy:8080"]
            }
        }
    }
}
```

### 3.3 代理隔离的实现原理

由于每个会话运行在独立容器中，不同会话的 `HTTP_PROXY` 环境变量完全隔离——无需额外机制，**Docker 的容器隔离天然保证了网络身份的独立性**。这是相比「同进程多 Profile」方案的根本优势：无法通过进程间共享状态泄漏代理配置。

### 3.4 高级网络隔离（自定义 Docker 网络）

通过 `capabilities` 中的 `network` 字段，每个容器可以连接到预先创建的特定 Docker 网络，实现更精细的网络拓扑控制（例如，将特定浏览器会话路由到特定的出口 IP）：

```json
{
    "selenoid:options": {
        "network": "my-isolated-network"
    }
}
```

---

## 四、Profile（会话状态）持久化

### 4.1 默认行为：无状态，每次全新

Selenoid 默认为**无状态模式**：每个容器基于干净的基础镜像启动，没有任何历史 Cookie 或 Profile 数据。容器销毁时所有数据随之消失。

这是浏览器自动化测试场景的最佳实践（每次测试从零开始，互不干扰），但不满足「账号养号」或「Cookie 持久化复用」的业务需求。

### 4.2 持久化方案：Volume 挂载

通过 `capabilities` 中的 `applicationContainers` 或直接使用 Volume 挂载，可以将宿主机目录挂载到容器内的 Chrome/Firefox Profile 目录：

```json
{
    "selenoid:options": {
        "applicationContainers": ["sidecar-container"],
        "hostsEntries": ["my-host:192.168.1.1"]
    }
}
```

更实用的做法是在 `browsers.json` 中配置 Volume：

```json
{
    "chrome": {
        "versions": {
            "latest": {
                "image": "selenoid/chrome:latest",
                "volumes": [
                    "/host/profiles/account-A:/home/user/.config/google-chrome"
                ]
            }
        }
    }
}
```

**注意**：Volume 持久化需要业务层管理「哪个账号挂载哪个宿主机目录」的映射关系，Selenoid 本身不提供账号池管理能力。

---

## 五、资源管控策略

### 5.1 并发限制（`-limit` 参数）

Selenoid 通过内置队列系统限制并发会话数，超出上限的请求排队等待：

```bash
selenoid -limit 10  # 最多同时运行 10 个浏览器容器
```

该限制是全局的，不区分浏览器类型。

### 5.2 单容器资源限制

在 `browsers.json` 中可以为每个浏览器版本配置 CPU 和内存上限：

```json
{
    "chrome": {
        "versions": {
            "latest": {
                "image": "selenoid/chrome:latest",
                "mem": "512m",
                "cpu": "1.0"
            }
        }
    }
}
```

容器内存默认不限制（受宿主机物理内存约束），生产环境建议显式配置上限以防 OOM。

### 5.3 典型资源占用参考

| 浏览器 | 单容器内存（空闲） | 单容器内存（活跃） |
|--------|-------------------|-------------------|
| Chrome (headless) | ~80MB | ~200-400MB |
| Firefox (headless) | ~100MB | ~200-500MB |

---

## 六、capabilities 完整 API

```json
{
    "browserName": "chrome",
    "version": "latest",
    "selenoid:options": {
        "screenResolution": "1920x1080x24",
        "enableVNC": true,          // 开启 VNC 查看（调试用）
        "enableVideo": true,         // 开启录屏
        "videoName": "my-session",
        "timeZone": "Asia/Shanghai",
        "env": ["HTTP_PROXY=..."],   // 容器内环境变量（含代理）
        "network": "my-network",     // 自定义 Docker 网络
        "volumes": ["/host:/container"],  // Volume 挂载
        "hostsEntries": ["host:ip"],  // 自定义 hosts
        "labels": {"purpose": "account-A"},  // 元数据标签（用于监控）
        "sessionTimeout": "5m"        // 会话超时（默认1分钟）
    }
}
```

---

## 七、Selenoid 与 Moon（Kubernetes 版）

Aerokube 还提供 **Moon**，是 Selenoid 的 Kubernetes 原生版本：

| 维度 | Selenoid | Moon |
|------|----------|------|
| 运行环境 | 单机 Docker | Kubernetes 集群 |
| 扩展方式 | 垂直扩展（-limit 增大） | 水平扩展（Pod 弹性伸缩） |
| 授权 | 开源（Apache 2.0） | 商业授权（4 并发免费） |
| 会话隔离 | Docker 容器 | Kubernetes Pod |
| 网络隔离 | Docker 网络 | K8s NetworkPolicy |
| 适用规模 | 单机 10-100 并发 | 集群 100-10000 并发 |

---

## 八、关键设计总结

| 维度 | Selenoid 的方案 |
|------|----------------|
| 隔离粒度 | Docker 容器（进程 + 文件系统 + 网络栈三重隔离） |
| 代理隔离 | 每容器独立环境变量，天然隔离 |
| Profile 持久化 | 默认无状态；需手动 Volume 挂载实现持久化 |
| 资源控制 | 全局并发数（-limit）+ 单容器 CPU/MEM 限制 |
| 会话清理 | 强制删除容器 + Volume（无数据残留） |
| 超时机制 | sessionTimeout 自动回收悬挂会话 |
| 协议兼容 | 标准 WebDriver / W3C（Playwright/Selenium 均可直连） |
| 大规模扩展 | 需配合 Moon（K8s 版）或多 Selenoid 实例负载均衡 |
