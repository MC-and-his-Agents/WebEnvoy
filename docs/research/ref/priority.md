# 研究优先级索引

本文档保留 `docs/research/ref/` 中最值得优先查阅的研究地图。
它是阅读建议，不是正式架构契约。

## 第一优先级

这些报告最直接影响 WebEnvoy 的执行主线与底层能力判断：

- `pinchtab_analysis.md`
  - 价值：账号隔离、Profile 保活、多实例执行模型
- `bb-browser_analysis.md`
  - 价值：寄生登录态、内存态直读、快速固化适配器路径
- `scrapling_analysis.md`
  - 价值：自适应选择器与高韧性抓取思路
- `camoufox_analysis.md`
  - 价值：内核级反检测上限与适用边界
- `ghost-cursor_analysis.md`
  - 价值：拟人化鼠标轨迹与行为模拟基础
- `browser-use_analysis.md`
  - 价值：AI 驱动浏览器漫游与感知管线参考

## 第二优先级

这些报告解决关键子问题，适合在具体设计时按需补读：

- `page-agent_analysis.md`
  - 价值：页内注入执行与元素映射思路
- `MultiPost-Extension_analysis.md`
  - 价值：富文本写入、媒体上传、发布链路脏活经验
- `nanobrowser_analysis.md`
  - 价值：复杂任务中的规划/导航拆分与 Shadow DOM 技巧
- `maxun_analysis.md`
  - 价值：录制回放与适配器生成思路
- `ui-tars_analysis.md`
  - 价值：视觉兜底路线
- `steel-browser_analysis.md`
  - 价值：请求拦截加速与云端浏览器运行形态
- `crawlee_analysis.md`
  - 价值：会话健康度、代理黏性与长尾节律
- `profile_seeding_analysis.md`
  - 价值：多账号预热与冷却状态机
- `selenoid_analysis.md`
  - 价值：容器级隔离与多实例部署参考

## 第三优先级

剩余报告大多用于补背景、看边界或验证某个局部想法，不建议在常规执行任务中整批加载。

## 不可丢的结论

- `Camoufox` 与 `Pinchtab` 不能互相替代
  - 前者偏一次性高隐匿，后者偏长期账号保活
- `ghost-cursor` 值得吸收其数学模型，但不应直接照搬 Puppeteer 适配层
- `browser-use` 对 L1/L2 感知链路有参考价值，但其完整技术栈不适合直接并入主运行时
- `bb-browser` 的“10 分钟固化适配器”思路对 WebEnvoy 很关键
- 多账号管理相关结论已分散吸收到 `account.md`、`anti-detection.md` 和 `dependencies.md`

## 正式文档优先级

如果研究结论已经被正式吸收，请优先读取：

- `docs/dev/architecture/system-design/dependencies.md`
- `docs/dev/architecture/system-design/reference.md`
- `docs/dev/architecture/anti-detection.md`
- `docs/dev/architecture/system-design/account.md`

如与正式架构文档或具体 spec 冲突，以后者为准。
