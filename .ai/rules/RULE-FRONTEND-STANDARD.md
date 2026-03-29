---
alwaysApply: false
globs: apps/client/src/**/*
---

# 前端开发规范 (Frontend Development)

## 组件结构

- 业务组件放在 `src/components/` 下。
- 每个组件包含 `.tsx` 和对应的 `.scss` 文件。
- **样式引入**: 在 `.tsx` 文件的第一行引入对应的 `.scss` 文件，例如：`import './ComponentName.scss'`。
- **文件体量限制**: 单一组件文件超过 400 行时，必须拆分为目录结构，拆出子组件与逻辑模块，并在目录下用 `index.tsx` 聚合对外导出。

## 数据获取 (SWR)

- 优先使用 SWR 进行数据获取，以便享受自动缓存和重试功能。
- 在 `main.tsx` 的 `SWRConfig` 中统一配置 `fetcher`。

## 路由管理

- 使用 `react-router-dom` 的 `useNavigate` 和 `useParams`。
- 严禁手动修改 `window.location`。

## URL Query 管理

- 统一使用 `useQueryParams` 管理 query，避免手动拼接或直接读写 `useSearchParams`。
- 推荐在页面中集中声明 query 的 keys、默认值与省略规则，确保可回放链接一致。

```tsx
import { useQueryParams } from '../../hooks/useQueryParams'

const { values, update } = useQueryParams({
  keys: ['rule', 'q', 'status'],
  defaults: {
    rule: '',
    q: '',
    status: 'all'
  },
  omit: {
    rule: value => value === '',
    q: value => value === '',
    status: value => value === 'all'
  }
})
```

## 样式规范

- **样式拆分**: 禁止将所有样式写在单个大的 `.scss` 文件中。每个组件应拥有独立的 `.scss` 文件，并在 `.tsx` 中显式引入。
- **无行内样式**: 严禁在组件中使用 `style={{...}}` 编写静态行内样式。仅允许用于必须根据运行时状态动态计算的属性（如：实时计算的宽度、高度、位置或颜色）。
- **设计风格**:
  - 引导多使用图标，减少冗长文案与重复提示。
  - 样式保持简约，避免过度装饰与复杂层级。
  - 信息保持克制，仅渲染对当前任务必要的内容。
- **类名命名规范**:
  - 采用中划线命名法（kebab-case），例如：`.chat-message-item`。
  - 组件根节点类名建议与文件名保持一致。
  - 推荐使用 BEM 结构并结合 SCSS 嵌套，通过 `&` 保持选择器结构清晰、可搜索。
    - Block（组件根类名）: `.a-b-c`
    - Element（子元素）: `.a-b-c__d-e`
    - Modifier（状态/变体）: `.a-b-c--active`
    - Element + Modifier: `.a-b-c__d-e--disabled`
  - 开发时尽可能使用嵌套方式定义 Element/Modifier，避免重复书写前缀：

    ```scss
    .a-b-c {
      display: flex;

      &__d-e {
        padding: 8px 12px;

        &--disabled {
          opacity: .5;
          pointer-events: none;
        }
      }

      &--active {
        border-color: var(--border-color);
      }
    }
    ```

  - 嵌套深度建议控制在 3 层以内（Block → Element → Modifier），避免过深导致可读性下降和选择器权重难以控制。
  - 避免在组件样式中嵌套标签选择器（如 `div span`），优先使用语义化类名；必要时可使用 `& > .child` 明确结构边界。
- **布局容器**: 容器类名应反映其功能，如 `.container-list`, `.actions-grid`, `.settings-section`。

## CSS 变量 & 主题

- **全局变量**: 所有通用的颜色、边距、圆角等必须使用 CSS 变量（CSS Variables），定义在 `src/styles/global.scss` 的 `:root` 中；暗色模式在同文件的 `html.dark` 中覆盖。
- **查看位置**: `src/styles/global.scss` 的 `:root`（浅色）与 `html.dark`（暗色覆盖）。
- **变量命名**: 采用中划线命名，如 `--primary-color`, `--bg-color`, `--border-color`。
- **使用规范建议**:
  - **主色调**（`--primary-color`）: 仅用于主行动按钮、核心交互的激活态、关键选中状态；避免用于大面积背景。
  - **文本颜色**: 主文本用 `--text-color`，次级说明用 `--sub-text-color`，更弱化辅助信息用 `--sub-sub-text-color`。
  - **背景颜色**: 页面或主容器用 `--bg-color`，卡片/块级容器用 `--sub-bg-color`，更内层次容器用 `--sub-sub-bg-color`。
  - **边框颜色**: 组件默认边框使用 `--border-color`；分割线/轻边框使用 `--sub-border-color`；仅在需要更弱化层级时使用 `--sub-sub-border-color`。
  - **状态颜色**: 成功/警告/危险状态分别使用 `--success-color`、`--warning-color`、`--danger-color`。
- **变量维护**: 新增或调整全局变量时，必须同时补齐 `html.dark` 的对应值，并在 `global.scss` 中为变量添加明确含义注释。
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

## 国际化 (i18n)

- **原则**: 禁止在 UI 中直接编写硬编码的文本（尤其是中文），必须通过 `i18n` 进行管理。
- **使用方法**:
  - 使用 `useTranslation` hook: `const { t } = useTranslation();`
  - 翻译调用: `t('common.button.save')`
- **资源管理**:
  - 翻译文件位于 `src/resources/locales/`。
  - `zh.json` 为中文主文件，`en.json` 为英文翻译。
  - Key 命名建议采用层级结构：`模块.功能.属性`（如 `chat.sidebar.delete_confirm`）。
