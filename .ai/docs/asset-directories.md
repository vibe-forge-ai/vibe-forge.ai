# 数据资产目录配置

返回入口：[index.md](./index.md)

本文说明如何通过项目根 `.env` 调整 Vibe Forge 的项目数据资产目录，以及这些目录会影响哪些运行时消费链路。

## 默认目录

默认情况下，项目数据资产根目录是 `./.ai/`，常见结构包括：

- `./.ai/rules`
- `./.ai/skills`
- `./.ai/specs`
- `./.ai/entities`
- `./.ai/mcp`
- `./.ai/logs`
- `./.ai/caches`
- `./.ai/plugins`
- `./.ai/.mock`

## Skill 依赖

完整使用说明见 [Skills 与依赖](./usage/skills.md)。

`./.ai/skills/<name>/SKILL.md` 的 frontmatter 可以声明 `dependencies`：

```yaml
---
name: app-builder
description: Build the app
dependencies:
  - frontend-design
  - anthropics/skills@frontend-design
---
```

解析规则：

- 先在当前 workspace 和已启用插件的 skills 中按名称解析。
- 本地找不到时，会按 registry 拉取并缓存到 `./.ai/caches/skill-dependencies/`。
- 未配置 registry 时，默认使用 Vercel 的公开 Skills Hub：`https://skills.sh`。
- 如果需要切到兼容的私有 registry，可以在 `.ai.config.*` 配置：

```yaml
skills:
  registry: https://skills.example.com
```

也可以拆开搜索和下载入口：

```yaml
skills:
  registry:
    searchUrl: https://skills.example.com
    downloadUrl: https://skills.example.com
```

依赖安装只会写入项目 AI 目录的 cache，不会修改用户真实 home。adapter 启动时会把最终解析出的 skill 列表投影到对应原生目录。

## 环境变量

可以在项目根 `.env` 中覆盖：

```env
__VF_PROJECT_AI_BASE_DIR__=.vf
__VF_PROJECT_AI_ENTITIES_DIR__=agents
```

含义：

- `__VF_PROJECT_AI_BASE_DIR__`：覆盖整个项目数据资产根目录
- `__VF_PROJECT_AI_ENTITIES_DIR__`：只覆盖实体子目录，基于 AI 基目录继续解析

两者都支持：

- 相对项目根的目录
- 相对项目根的嵌套目录
- 绝对路径

例如：

```env
__VF_PROJECT_AI_BASE_DIR__=.config/vibe/ai-data
__VF_PROJECT_AI_ENTITIES_DIR__=knowledge/entities
```

此时：

- AI 基目录会解析为 `./.config/vibe/ai-data`
- 实体目录会解析为 `./.config/vibe/ai-data/knowledge/entities`

## 影响范围

这些环境变量会影响项目数据资产的主要消费链路：

- workspace assets：`rules`、`skills`、`specs`、`entities`、`mcp`
- 运行时目录：`logs`、`caches`、`plugins`
- mock HOME 与 adapter 派生目录：Codex、Claude Code、OpenCode
- CLI 维护命令：`vf clear`、`vf report`
- 启动入口：CLI、server、client、hook loader
- benchmark 运行时目录

其中：

- `__VF_PROJECT_AI_BASE_DIR__` 会影响整棵项目数据资产树
- `__VF_PROJECT_AI_ENTITIES_DIR__` 只影响 `entities` 的扫描与加载位置

## 不受影响的内容

当前不会跟随这些环境变量一起变化的内容：

- `.ai.config.json` / `.ai.config.yaml` / `.ai.config.yml`
- `.ai.dev.config.*`
- 这些配置文件位于项目根或 `./infra/` 的规则

也就是说，当前可配置的是“数据资产目录”，不是“配置文件文件名与位置”。

## 使用建议

- 如果只是想把 `.ai` 改成别的名字，优先只配 `__VF_PROJECT_AI_BASE_DIR__`
- 如果只是想把 `entities` 改名，优先只配 `__VF_PROJECT_AI_ENTITIES_DIR__`
- 如果同时配置两者，实体目录会基于新的 AI 基目录继续拼接
- 修改 `.env` 后需要重启相关进程；只刷新前端页面不会让已有子进程重新加载目录配置
