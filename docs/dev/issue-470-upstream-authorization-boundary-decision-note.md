# #470 上游授权接缝与资源边界决策纪要

## 基本信息

- 关联 Issue：#470
- 关联 PR：待创建
- 负责人：Codex

## 背景

`#445` 的 latest-head managed-profile fresh rerun 已经把当前 live read 门禁问题暴露得足够清楚：

- `search` 在 `live_read_high_risk` 上仍被 `RISK_STATE_PAUSED + ISSUE_ACTION_MATRIX_BLOCKED` 阻断
- `detail` 与 `user_home` 已具备公开 command surface，但 live 路径在执行阶段仍报内部错误
- 当前 formal 门禁对象把 live 准入与 `run_id / session_id / target_tab_id / target_page / requested_execution_mode` 绑定得很细

这次暴露出来的已不只是单个实现缺陷，而是一个更上游的接缝问题：

- WebEnvoy 目前把“人工批准 / 审计 / admission”建模得过于内置、过于单次运行化
- 但当前产品定位又明确要求 WebEnvoy 不是账号矩阵、审批流或长期运营系统
- 结果是系统容易长期停在 `paused`，却缺少一个清晰、可消费、可由上层注入的恢复入口

`#470` 的职责不是直接修实现，而是先把“上层批准结果如何进入 WebEnvoy、WebEnvoy 自己该保留什么门禁职责”这件事收成决策。

## 目标

- 冻结当前讨论已达成的共识，避免后续再回到口头推演
- 明确 WebEnvoy 与上层系统在授权、批准、审计、风险状态上的职责边界
- 收敛“外部可消费授权协议”应该以什么为中心建模
- 为后续是否立正式 FR 提供清晰输入

## 非目标

- 不在本纪要内直接修改运行时代码
- 不在本纪要内修复 `#445` 的最新阻断
- 不在本纪要内设计上层产品的审批 UI 或运营后台
- 不在本纪要内一次性冻结所有站点、所有动作的完整权限点清单

## 范围

- 受影响模块 / 文件
  - `docs/dev/architecture/system-design/account.md`
  - `docs/dev/architecture/system-design/communication.md`
  - `docs/dev/specs/FR-0010-xhs-risk-gates-hardening/contracts/risk-gate-execution.md`
  - `docs/dev/specs/FR-0011-xhs-min-anti-detection-execution/contracts/anti-detection-execution.md`
  - `docs/dev/specs/FR-0014-layer3-session-rhythm-engine/contracts/session-rhythm-engine.md`
  - `src/commands/xhs-input.ts`
  - `src/commands/xhs-runtime.ts`
- 受影响命令 / 页面 / 流程
  - `runtime.start / runtime.status / runtime.stop`
  - `xhs.search / xhs.detail / xhs.user_home`
  - live read 准入、risk state、admission/approval/audit 进入方式

## 当前事实与已确认共识

### 1. WebEnvoy 的定位不支持把审批产品整体内置

根据 [vision.md](../../vision.md) 与 [account.md](./architecture/system-design/account.md)，WebEnvoy 当前只保留“完成网页执行所必需的最小身份 / 会话能力”，不以账号矩阵、长期运营、审批平台为目标。

这意味着：

- 上层系统负责“谁、在什么策略下、可以用哪个账号/会话去做什么”
- WebEnvoy 负责“在收到授权前提后，这次目标动作是否允许执行，以及如何审计、节律控制、降级和阻断”

### 2. `profile` 是资源承载体，不等于完整账号运营主体

当前架构中的 `profile` 更像“可复用浏览器会话 / 登录态 / 执行隔离容器”，不是完整账号系统。

因此：

- 某些站点或页面可以匿名访问，不应被强行建模成“必须绑定账号”
- 某些站点需要登录，但登录只意味着执行依赖某个 profile/session，不代表 WebEnvoy 应承担账号权限管理平台职责
- 更准确地说，`profile` 是“持久本地浏览器执行环境 + 可选会话状态”的承载体，而不是“账号本体”
- 在本决策中，外部正式资源主体先冻结为 `anonymous_context` 与 `profile_session`
- `profile` 只用于表达本地持久执行容器；匿名任务是否由临时匿名上下文还是专用匿名 profile 落地，属于 WebEnvoy 内部实现选择，不构成外部协议歧义

### 3. `tab` 是运行时绑定，不是长期权限主体

`target_tab_id`、`target_page` 在当前 formal gate 里是重要字段，但它们更适合表达“这次命令要落在哪个现场”，不适合当成长期权限主体。

应区分：

- 权限 / 授权主体：匿名资源、profile 会话、已认证账号资源
- 运行时目标：当前 tab、页面语义、域名、页面 URL

### 4. 当前 paused 状态存在“无上游接缝时的自锁风险”

现有 formal 契约要求 live 读在进入 gate 前携带 `approval_admission_evidence` 与 `audit_admission_evidence`，并在 gate 后再写出 `approval_record` 与 `audit_record`。

但如果没有一个清晰的上游输入接缝：

- 系统会长期停在 `paused`
- live 命令永远因为缺 admission / approval 被阻断
- 被阻断又进一步固化“当前风险状态不允许 live”

这会形成接近死锁的产品体验。

### 5. `dry_run / recon / live_*` 更像 WebEnvoy 内部执行语义，而不是上层审批语义

这些模式对 WebEnvoy 自己仍有价值，因为它们表达了：

- 这次命令是否只做合同校验
- 是否允许侦察
- 是否允许进入真实 live 执行
- live 执行的风险等级与额外限制

但从上层视角看，如果直接把批准模型也建立在这些内部模式上，会带来两个问题：

- 上层被迫理解 WebEnvoy 的内部运行语义，而不是按账号/资源策略表达授权
- 同一动作在不同站点、不同风险状态下会出现大量不稳定映射

### 6. 上游资源策略状态与 WebEnvoy 请求期保护应分层

当前讨论已进一步收敛：

- `active / cool_down / paused` 一类资源策略状态更适合作为上游系统持有和决策的真相
- WebEnvoy 不应成为长期资源运营状态的权威来源
- WebEnvoy 仍需要保留“这一次请求是否允许继续执行”的即时保护能力

也就是：

- 上游负责资源策略状态
- WebEnvoy 负责请求期 admission、运行时安全停止、原始风险信号与执行证据回传

## 当前问题陈述

### 问题 1：现有“单次命令审批”过细

当前 formal 模型把 live 准入过度绑定到：

- 单次 `run_id`
- 单次 `session_id`
- 指定 `target_tab_id`
- 指定 `target_page`
- 指定 `requested_execution_mode`

这有利于审计，但不适合作为上层的人机批准主模型。

### 问题 2：read 风险等级直接外露，可能混淆“授权”与“执行策略”

`authenticated_read`、`limited_live_read`、`high_risk_live_read` 这类命名如果直接成为上层正式授权协议，很容易让外部系统不得不理解 WebEnvoy 的内部风控分层，而不是描述“允许这个资源执行哪些动作”。

### 问题 3：当前 formal 对 paused 恢复的入口描述不足

formal 文档已经定义了 `paused -> limited -> allowed` 的状态迁移，但真正的“谁来触发恢复、通过什么结构化输入触发、WebEnvoy 如何验证”还不够清楚。

### 问题 4：匿名访问缺少资源隔离约束

如果“匿名可访问”只被理解成“这个页面无需登录也能看”，但没有进一步约束执行现场，就会出现两个问题：

- 匿名任务误落到已绑定账号、已登录的 profile 上
- 本来应保持匿名视角的读取，被登录态、账号预算或账号风控污染

因此匿名任务不应只是一句说明，而应成为正式资源约束。

## 讨论中的候选模型

### 模型 A：继续沿用当前 per-run / per-mode 批准模型作为外部主协议

做法：

- 上层直接生成与当前 formal 几乎同构的 admission / approval / audit 对象
- 继续以 `requested_execution_mode=live_read_limited|live_read_high_risk|live_write` 为主要批准粒度

问题：

- 外部系统需要深度理解 WebEnvoy 内部 gate 语义
- `paused` 恢复仍容易变成“没有 admission 就无法恢复，没有恢复就永远无法 live”
- 不符合“上层管理账号/策略，WebEnvoy 专注执行”这个产品边界

当前判断：不推荐作为长期方向。

### 模型 B：外部主协议改成权限点枚举

做法：

- 上层给 WebEnvoy 下发诸如 `public_read`、`authenticated_read`、`limited_live_read`、`high_risk_live_read`、`reversible_interaction`、`irreversible_write` 等权限点

优点：

- 比当前 per-run approval 更接近“上层给权限、WebEnvoy执行”
- 比直接暴露 `run_id + tab_id + execution_mode` 更稳定

问题：

- 其中不少权限点仍然带有强烈的 WebEnvoy 内部执行色彩
- 对用户和上层产品来说，不一定直观映射到真实业务动作
- 仍然容易把“授权”与“内部风险等级”混在一起

当前判断：可作为过渡分析工具，但不建议直接作为最终外部协议。

### 模型 C：外部协议以“动作 + 资源 + 授权范围”为中心，风险等级主要留在 WebEnvoy 内部

做法：

- 上层决定某个资源主体当前允许哪些动作
- WebEnvoy 接收：
  - 动作请求
  - 资源绑定
  - 授权范围 / 约束
- WebEnvoy 再结合当前运行时风险状态、节律、目标域与页面现场，决定是允许、降级还是阻断

建议的语义拆分：

- 外部协议回答：
  - 这次请求要做什么动作
  - 使用什么资源主体执行
  - 上层授予了哪些范围和约束
- WebEnvoy 内部回答：
  - 当前现场是否满足执行前提
  - 需要走 `dry_run / recon / live_*` 中哪种执行语义
  - 当前风险状态是否允许继续
  - 是否需要审计、节律限制、恢复探针或降级

当前判断：这是目前最符合产品边界的主方向。

## 当前推荐方向

### 推荐结论 1：外部授权协议不应以 `live_read_limited / live_read_high_risk` 作为主语义

这些模式可以保留在 WebEnvoy CLI / runtime 内部，继续表达执行级风险语义，但不应要求上层审批系统把它们当成人能理解的主授权单位。

### 推荐结论 2：外部协议应优先围绕“动作”和“资源需求”建模

建议把外部协议先拆成三层：

1. `action_request`
   - 这次要做的动作
   - 例如：读取搜索结果、读取详情、读取用户主页、页面滚动、点击、输入、提交
2. `resource_requirement / resource_binding`
   - 这个动作要求匿名即可，还是必须有 profile/session，还是必须有已认证账号资源
   - 当前实际绑定了哪个 profile 或其他上游引用资源
3. `authorization_grant`
   - 上层授予了这个资源在当前窗口下可执行的动作范围和约束
   - 例如允许范围、频率限制、冷却要求、人工确认结果、来源说明

补充约束：

- 上游不一定需要总是显式管理具体 `profile_id`
- 但上游必须声明这次任务允许使用哪类资源
- WebEnvoy 必须把这个资源要求落成具体可执行上下文，并强制验证不越界

### 推荐结论 3：`tab` 与 `page` 保留为运行时校验字段，不作为权限主体

也就是：

- 授权是授给“某类资源 + 某类动作”
- WebEnvoy 在执行时仍必须验证“当前 tab/page/domain 是否落在允许现场”

这样既保留最小现场校验，也避免把动态 tab 变成长期授权对象。

### 推荐结论 4：paused 恢复要有明确的外部注入口

当前死锁的根因之一，是“恢复需要批准，但批准没有稳定入口”。

推荐后续正式协议里明确：

- `paused` 不是自动恢复
- 恢复必须来自新的上游授权 / 恢复指令 / 运营确认输入
- WebEnvoy 负责验证这份输入是否与当前资源主体、目标动作、现场范围匹配
- 恢复后仍应保留审计链，而不是把“恢复决定”完全丢在内存里

需要进一步修正的是：

- `paused` 更适合作为上游资源策略状态，而不是 WebEnvoy 内部长久持有的运营状态真相
- WebEnvoy 对本次请求的阻断、降级或中止，只表达“这次没有继续执行”，并回传事实原因与证据
- 上游再决定是否把某个资源转入或保持在 `paused / cool_down / active`

### 推荐结论 5：WebEnvoy 仍应保留请求期 gate、执行窗口保护与审计职责

这次纠偏不意味着把所有风控都上抛。

WebEnvoy 内部仍应保留：

- 当前执行窗口内的节流 / 退避保护
- 现场校验
- 这次请求是否真正放行的 admission check
- 本次执行中的即时保护与安全停止
- 审计输出与复盘证据
- 原始风险信号回传

上层给的是“允许你尝试什么”，不是“强迫 WebEnvoy 无条件执行”。

进一步修正：

- WebEnvoy 不应输出“建议把资源改成 cool_down / paused”这类资源运营决策
- WebEnvoy 应输出“本次执行结果、风险信号、阻断原因、证据”
- 上游再根据这些事实管理资源状态

## 一版可执行的决策框架

如果继续往完整决策推进，当前更稳妥的框架是：

1. 外部主协议
   - 以 `action + resource + authorization_grant` 为中心
2. WebEnvoy 内部执行协议
   - 继续保留 `dry_run / recon / live_*`、request-time admission、执行窗口节流/退避保护、runtime safety stop 等运行时语义
3. 映射关系
   - 外部授权只回答“上层允许什么”
   - WebEnvoy 内部再把它映射为“本次是否能进入哪种执行模式”
4. 恢复路径
   - 上游资源策略状态只能由新的上游恢复输入改变，不再假设 WebEnvoy 内部自发完成审批
5. 审计边界
   - 上游的授权事实与 WebEnvoy 的执行审计分别留痕，但要能通过稳定引用关联

## 建议的协议骨架（供后续 FR 采用）

### 1. 外部请求对象建议拆成四块

建议未来正式协议至少能稳定表达以下四类对象：

1. `action_request`
   - 业务上要做什么
   - 例如：`read_search_results`、`read_note_detail`、`read_user_home`、`scroll_page`、`click_element`、`input_text`、`submit_form`
2. `resource_binding`
   - 这次命令使用什么资源主体
   - 例如：`anonymous_context`、某个 `profile_session`、某个上游 `account_ref`
3. `authorization_grant`
   - 上层已经批准了什么范围
   - 例如：允许哪些动作、允许的站点/域、频率限制、额度、人工确认来源、恢复说明
4. `runtime_target`
   - 这次要落在哪个运行时现场
   - 例如：当前域名、页面 URL、`target_tab_id`、页面类型

其中：

- `resource_binding` 与 `authorization_grant` 解决“你有没有资格做”
- `runtime_target` 解决“你现在到底要在哪个现场做”

补充：

- 当资源要求是匿名时，WebEnvoy 应选择或创建一个“不带目标站点登录态”的匿名执行上下文
- 如果上游显式传入某个 `profile`，WebEnvoy 也必须校验它在目标站点上是否符合匿名要求
- 若目标站点已登录，则应直接拒绝，而不是静默复用该上下文

### 2. 动作粒度建议采用“语义动作优先，原语动作受控暴露”

当前更合理的方向不是二选一，而是分层：

- 第一层：面向治理和上层产品的语义动作
  - 如 `read_search_results`
  - 如 `read_note_detail`
  - 如 `read_user_home`
  - 如 `like_note`
  - 如 `comment_note`
- 第二层：面向通用执行层的原语动作
  - 如 `scroll_page`
  - 如 `click_element`
  - 如 `input_text`
  - 如 `upload_asset`

推荐原因：

- 上层最需要管理的是“用户实际上允许系统做什么”
- 而不是直接管理成百上千个底层 DOM 原语组合
- 但 WebEnvoy 作为执行工具，内部仍然需要保留原语层来支撑 L2/L1 通用执行

因此更适合的做法是：

- 默认对外授权以语义动作 / 能力为主
- 原语动作只在明确需要通用执行时受控暴露

### 3. 资源主体在决策层先冻结为 `anonymous_context` 与 `profile_session`

从当前架构边界看，更稳妥的正式主语义应是：

- `anonymous_context`
  - 不依赖登录态、且在目标站点上不应带已有登录会话
- `profile_session`
  - 明确依赖某个持久 profile 会话 / 登录态 / 执行隔离容器

`account_ref` 更适合作为上游附带的治理引用，而不是当前 WebEnvoy 的主执行主体。

也就是：

- WebEnvoy 最终总要绑定到一个具体本地执行上下文，但外部协议只需要区分这是 `anonymous_context` 还是 `profile_session`
- `anonymous_context` 可以由 WebEnvoy 通过临时匿名上下文或专用匿名 profile 落地；这是内部实现细节，不改变外部资源主体语义
- 上游若需要把某个 `profile_session` 映射回业务账号，可额外携带 `subject_ref / account_ref`
- 匿名任务不应默认落到“已绑定账号但当前恰好不用登录”的 profile 上，否则会带来账号污染与误伤风险

### 4. 风险等级建议改成“上层给边界，WebEnvoy 负责最终映射”

比起让上层直接批准：

- `live_read_limited`
- `live_read_high_risk`
- `live_write`

更稳妥的方式是让上层给出：

- 允许的动作范围
- 资源范围
- 行为预算 / 冷却 / 节律上限
- 是否允许从当前风险状态发起恢复尝试

然后由 WebEnvoy 内部再映射为：

- 这次只能 `dry_run`
- 可以 `recon`
- 可以尝试某种 live
- 必须阻断

这里的“风险等级”更准确地说应是“执行级模式映射”，而不是上游资源策略状态。

### 5. paused 恢复建议显式区分“恢复授权”与“执行审计”

当前 formal 容易把两件事混在一起：

- 上层是否同意从 `paused` 发起恢复尝试
- WebEnvoy 是否已经实际完成恢复后的执行与审计

后续协议更适合拆开：

- `authorization_grant`
  - 表达上层是否允许这次恢复 / 尝试
- `admission_result / execution_audit`
  - 表达 WebEnvoy 最终是否放行、怎么执行、结果怎样

这样可以避免把“上层批准对象”直接做成“运行后记录对象”的半成品。

同时建议继续区分：

- 上游持有资源策略状态，例如是否进入 `active / cool_down / paused`
- WebEnvoy 持有请求级事实，例如是否阻断、是否中止、看到了哪些风控信号、证据是什么

## 当前更倾向的决策草案

如果现在先给出一版更明确的倾向，当前建议是：

1. WebEnvoy 的外部正式授权协议，应以 `action_request + resource_binding + authorization_grant + runtime_target` 为基础骨架。
2. `dry_run / recon / live_*` 保留为 WebEnvoy 内部运行时语义，不再作为上层主审批单位。
3. `tab/page/domain` 保留为 runtime target 与现场校验字段，不再承担长期权限主体职责。
4. 对外默认优先暴露语义动作；底层原语动作只在通用执行或高级调用场景下受控开放。
5. `anonymous_context` 与 `profile_session` 先作为第一版外部主资源主体；`account_ref` 先作为上游治理引用，不强行进入 WebEnvoy 主执行主体模型。
6. 匿名任务必须显式约束“不得使用目标站点已登录上下文”；WebEnvoy 应选择、创建或校验一个满足匿名要求的执行上下文。
7. `active / cool_down / paused` 一类资源策略状态应由上游持有和决策；WebEnvoy 只返回请求级阻断事实、风险信号与证据。
8. 上游资源策略状态的恢复必须依赖新的上游授权输入，WebEnvoy 不再假设内部自带审批产品。
9. 当前 FR-0010 / FR-0011 / FR-0014 中 request-side admission 相关对象，后续应评估是否重构为更通用的授权输入模型，再由兼容层映射回现有 gate/audit 输出。

## 后续 FR 输入（不阻塞 #470 关闭）

- 动作分类体系
  - 正式冻结语义动作、原语动作、站点能力别名之间的层级关系与命名规则
- 资源绑定 schema
  - 正式冻结 `anonymous_context`、`profile_session`、`account_ref/subject_ref` 的字段边界与绑定规则
- 授权输入与现有 formal 契约的兼容迁移
  - 评估现有 `approval_admission_evidence / audit_admission_evidence / approval_record / audit_record` 如何映射到新的 `authorization_grant` / request-time admission 模型
- 请求级 admission 与审计输出边界
  - 正式冻结“上游资源策略状态”与“WebEnvoy 请求级 admission / execution_audit 结果”的字段边界

以上事项进入后续正式 FR 处理，不再阻塞 `#470` 作为决策 / 分流 issue 收口。

## 关闭 #470 后的后续动作

1. 以 docs-only PR 形式提交本决策纪要，走正常 review / guardian / checks / merge gate。
2. PR 合入后关闭 `#470`，关闭语义应明确为“讨论 / 决策 issue 已完成”，而不是“实现已完成”。
3. 基于本决策新开正式 FR issue / formal suite，冻结授权协议、恢复入口与兼容策略。
4. PR 合入并确认 issue 状态一致后，清理本 worktree / 分支执行现场。
5. 在正式 FR 未完成前，不继续在 `#445`、`#469` 或现有 formal 契约上做零散补丁式扩写。

## 当前结论

当前已能正式确认：

- 现有“单次 live 命令审批”模型不适合作为长期外部授权模型
- “以上游资源策略状态为真相，由 WebEnvoy 负责请求期 admission、即时保护与事实回传”的方向成立
- `tab` 更适合作为运行时现场绑定，而不是权限主体
- `dry_run / recon / live_*` 更适合作为内部执行模式，而不是上层主授权语义
- `anonymous_context` 与 `profile_session` 已足以作为 `#470` 决策层的第一版外部资源主体
- `#470` 可以在本纪要通过 review 并合入后关闭；剩余 schema 与兼容迁移问题转入后续正式 FR
