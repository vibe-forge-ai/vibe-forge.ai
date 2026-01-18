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
- 使用 BEM 或简单的类名嵌套。
- 优先使用全局变量和 Ant Design 的 Design Token 保持 UI 一致性。
- **样式拆分**: 禁止将所有样式写在单个大的 `.scss` 文件中（如 `Chat.scss`），应按照组件粒度进行拆分。
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
