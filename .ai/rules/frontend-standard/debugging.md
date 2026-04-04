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

## 真实界面验证

- overlay / tooltip / focus / hover 相关问题必须在真实 Chrome 回归，不要只跑单测。
- 优先读取这些指标：
  - popup 是否真的 open
  - `computed style`
  - `document.activeElement`
  - console warning
- 改完 tooltip / popover / 全局 token 后，先 reload 页面再读指标；隐藏浮层节点和旧 bundle warning 常常会误导判断。

## Sender / 浮层最小回归清单

1. `更多` 能打开，且二级权限菜单能独立展开。
2. 模型、推理强度的文本区和箭头区都能打开。
3. popup 打开时，对应 tooltip 不显示。
4. popup 关闭后，focus 能回到输入框。
5. reload 后没有 React DOM nesting warning，也没有 Ant deprecation warning。
6. 同时检查浅色 / 深色主题下的 tooltip、icon 和 selected 态颜色。
