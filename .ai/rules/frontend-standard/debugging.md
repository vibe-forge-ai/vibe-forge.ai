# 前端调试与回归

返回入口：[FRONTEND-STANDARD.md](../FRONTEND-STANDARD.md)

## 先分层，不要上来就猜样式

- 交互触发层：先确认事件有没有打到正确 DOM，popup / tooltip / select 有没有真的 open。
- 视觉层：再看 token、继承链和 computed style，不要只看 SCSS 文件。
- 运行层：最后再看热更新、旧进程、console warning 是否让你读到了旧状态。

## 浮层组件组合经验

- `Tooltip` / `Popover` / `Select` 外面如果再包一层组件，包装组件必须把 `ref` 和 DOM props 透传到真实触发节点。
- 避免 `span` 包 `div` 这类无效嵌套；这类 React nesting warning 往往会伴随触发器失效。
- 同一个控件同时拥有 tooltip 和 popover / select 时，popup 打开后要禁用 tooltip，不然 hover 层会抢事件或扰乱 focus。
- 自定义 select 箭头时，不要默认 body click 和 arrow click 都还正常；这两个触发区需要分别验证。

## 样式与 token 排查经验

- 全局表面样式例如 tooltip 字号、通用浮层排版、主题 token，优先改 `src/styles/global.scss` 或主题配置，不要只在局部组件里覆盖。
- 如果只想改一个图标或一个状态，selector 要收紧；过宽的 `color` 覆盖很容易误伤其他图标，比如最高推理强度、权限菜单勾选、发送按钮、disabled 态。
- 颜色回归先对照 `git diff` 或最近可用提交，不要凭印象重新猜一套 token。
- `xterm.js` 这类终端视图要分开看外层 surface、`.xterm-viewport` 和 renderer canvas；外层已经切到浅色，不代表 viewport 默认黑底不会继续漏出来。

## 真实界面验证

- overlay / tooltip / focus / hover 相关问题必须在真实 Chrome 回归，不要只跑单测。
- 优先读取这些指标：
  - popup 是否真的 open
  - `computed style`
  - `document.activeElement`
  - console warning
- 改完 tooltip / popover / 全局 token 后，先 reload 页面再读指标；隐藏浮层节点和旧 bundle warning 常常会误导判断。

## CDP / Chrome 启动约定

- 需要通过 CDP 调试前端页面时，先确认自己读过本文件，不要只把页面 `open` 到默认浏览器就开始排查。
- 调试 Chrome 必须从冷启动开始带上 `--remote-debugging-port`；不要指望给一个已经打开的日常 Chrome 追加参数后继续复用。
- 调试必须使用独立 profile，例如单独的 `--user-data-dir=...`；不要和用户日常使用中的 Chrome profile 混用。
- 启动后先验 `http://127.0.0.1:<port>/json/version` 可访问，再确认目标页面真的出现在 target 列表里；不要只看“页面已经开着”。
- 如果仓库里已经沉淀了更细的 Chrome / CDP 操作经验，开始前优先补读对应文档，不要临时猜启动参数。

## Sender / 浮层最小回归清单

1. `更多` 能打开，且二级权限菜单能独立展开。
2. 模型、推理强度的文本区和箭头区都能打开。
3. popup 打开时，对应 tooltip 不显示。
4. popup 关闭后，focus 能回到输入框。
5. reload 后没有 React DOM nesting warning，也没有 Ant deprecation warning。
6. 同时检查浅色 / 深色主题下的 tooltip、icon 和 selected 态颜色。
