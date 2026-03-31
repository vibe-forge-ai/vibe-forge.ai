# 主题与国际化

返回入口：[FRONTEND-STANDARD.md](../FRONTEND-STANDARD.md)

## CSS 变量与主题

- 全局颜色、边距、圆角等统一定义在 `src/styles/global.scss` 的 `:root` 中。
- 暗色模式覆盖写在同文件的 `html.dark`。
- 样式中不要硬编码颜色，统一使用 `var(--variable-name)`。
- 新增全局变量时，同时补齐暗色模式对应值，并写清楚变量含义。

## 常用变量

- `--bg-color`：页面或容器背景
- `--text-color`：主文本
- `--sub-text-color`：次级文本
- `--border-color`：边框 / 分割线
- `--success-color` / `--warning-color` / `--danger-color`：状态色

## 国际化

- UI 中禁止直接写硬编码中文，统一通过 `i18n` 管理。
- 使用 `useTranslation()` 和 `t('module.key')`。
- 资源文件位于 `src/resources/locales/zh.json` 与 `src/resources/locales/en.json`。
- 新增 key 时，中文和英文文件必须同时补齐。
