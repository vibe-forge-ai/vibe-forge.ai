---
alwaysApply: false
globs: apps/web/src/**/*
---
# 前端开发规范 (Frontend Development)

## 组件结构
- 业务组件放在 `src/components/` 下。
- 每个组件包含 `.tsx` 和对应的 `.scss` 文件。
- **样式引入**: 在 `.tsx` 文件的第一行引入对应的 `.scss` 文件，例如：`import './ComponentName.scss'`。

## 数据获取 (SWR)
- 优先使用 SWR 进行数据获取，以便享受自动缓存和重试功能。
- 在 `main.tsx` 的 `SWRConfig` 中统一配置 `fetcher`。

## 路由管理
- 使用 `react-router-dom` 的 `useNavigate` 和 `useParams`。
- 严禁手动修改 `window.location`。

## 样式规范
- **样式拆分**: 禁止将所有样式写在单个大的 `.scss` 文件中。每个组件应拥有独立的 `.scss` 文件，并在 `.tsx` 中显式引入。
- **无行内样式**: 严禁在组件中使用 `style={{...}}` 编写静态行内样式。仅允许用于必须根据运行时状态动态计算的属性（如：实时计算的宽度、高度、位置或颜色）。
- **类名命名规范**: 
  - 采用中划线命名法（kebab-case），例如：`.chat-message-item`。
  - 组件根节点类名建议与文件名保持一致。
  - 内部元素使用嵌套结构，推荐使用 SCSS 的 `&` 语法保持结构清晰。
- **布局容器**: 容器类名应反映其功能，如 `.container-list`, `.actions-grid`, `.settings-section`。

## CSS 变量 & 主题
- **全局变量**: 所有通用的颜色、边距、圆角等必须使用 CSS 变量（CSS Variables），定义在 `src/styles/global.scss` 的 `:root` 中。
- **变量命名**: 采用中划线命名，如 `--primary-color`, `--bg-color`, `--border-color`。
- **常用全局变量列表**:
  - `--bg-color`: 页面/容器主背景。
  - `--text-color`: 主文本颜色。
  - `--sub-text-color`: 次要/描述文本颜色。
  - `--border-color`: 边框及分割线颜色。
  - `--star-color`: 收藏/星标专用颜色（支持暗色模式切换）。
  - `--tag-bg`: 标签/微型容器背景。

## 暗色模式 (Dark Mode)
- **实现方案**: 采用基于 CSS 变量的主题切换方案。
- **规范**: 
  - 样式代码中**严禁直接写入硬编码的颜色值**（如 `#ffffff`, `black` 等）。
  - 必须使用 `var(--variable-name)` 引用颜色。
  - 在 `global.scss` 的 `html.dark` 选择器下覆盖对应的 CSS 变量值。
- **特定场景**: 
  - 如果某些特殊 UI 在暗色模式下需要完全不同的配色方案（非简单覆盖变量），应在组件级 SCSS 中使用 `html.dark .component-class` 进行针对性处理。
  - 按钮激活状态、悬浮状态应考虑暗色模式下的可读性和对比度。
+
+## 国际化 (i18n)
+- **原则**: 禁止在 UI 中直接编写硬编码的文本（尤其是中文），必须通过 `i18n` 进行管理。
+- **使用方法**: 
+  - 使用 `useTranslation` hook: `const { t } = useTranslation();`
+  - 翻译调用: `t('common.button.save')`
+- **资源管理**: 
+  - 翻译文件位于 `src/resources/locales/`。
+  - `zh.json` 为中文主文件，`en.json` 为英文翻译。
+  - Key 命名建议采用层级结构：`模块.功能.属性`（如 `chat.sidebar.delete_confirm`）。
