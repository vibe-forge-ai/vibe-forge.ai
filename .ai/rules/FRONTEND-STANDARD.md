---
alwaysApply: false
description: 仅在修改 apps/client 前端界面、路由、样式、主题或国际化时加载的前端规范。
globs:
  - apps/client/src/**/*
  - apps/client/__tests__/**/*
---

# 前端开发规范

本文件是前端约束入口页；具体约定拆到 `frontend-standard/`。

## 先看这些

- [组件与数据](./frontend-standard/components.md)
- [样式与类名](./frontend-standard/styles.md)
- [主题与国际化](./frontend-standard/theme-i18n.md)

## 核心约束

- 业务组件放在 `src/components/` 下。
- 路由统一使用 `react-router-dom`，不要手改 `window.location`。
- 静态样式不要写在 `style={{...}}` 里。
- 颜色、间距、圆角等全局设计 token 统一走 CSS 变量。
- UI 文本统一走 i18n，不在组件里硬编码中文。
