# Skills 与依赖

返回入口：[index.md](../index.md)

这页说明如何在项目里编写 Vibe Forge skill，以及如何用 `dependencies` 让一个 skill 自动带上它依赖的其他 skill。

## 基本目录

本地 skill 默认放在项目数据资产目录下：

```text
.ai/skills/<skill-name>/SKILL.md
```

最小示例：

```yaml
---
name: app-builder
description: Build the app
---

负责把需求实现成可运行的应用。
```

如果你修改过数据资产根目录，例如把 `.ai` 改成 `.vf`，skill 目录也会跟着变化。目录配置说明见 [数据资产目录配置](../asset-directories.md)。

## 声明依赖

在 `SKILL.md` 的 frontmatter 里写 `dependencies`：

```yaml
---
name: app-builder
description: Build the app
dependencies:
  - frontend-design
---

负责把需求实现成可运行的应用。
```

运行时选择或加载 `app-builder` 时，Vibe Forge 会自动把 `frontend-design` 一起解析出来。依赖会递归展开；如果 `frontend-design` 继续声明了自己的依赖，也会继续解析。

## 依赖写法

只写 skill 名称：

```yaml
dependencies:
  - frontend-design
```

这种写法会先查当前 workspace 和已启用插件里的 skill。本地找不到时，再去 registry 搜索同名 skill。

指定 Vercel Skills Hub source：

```yaml
dependencies:
  - anthropics/skills@frontend-design
```

也可以写成路径形式：

```yaml
dependencies:
  - anthropics/skills/frontend-design
```

对象形式适合给单个依赖指定 source 或 registry：

```yaml
dependencies:
  - name: frontend-design
    source: anthropics/skills
    registry: https://skills.example.com
```

字段含义：

- `name`：依赖 skill 名称
- `source`：远程 source，格式是 `owner/repo`
- `registry`：只对当前依赖生效的 registry 地址

## 解析顺序

Vibe Forge 会按这个顺序处理依赖：

1. 扫描当前 workspace 的 `.ai/skills`
2. 扫描已启用插件提供的 skills
3. 先用名称在本地和插件 skill 里解析依赖
4. 本地找不到时，从 registry 下载
5. 把下载结果作为普通 workspace skill 加入本次资产列表
6. 对新加入的依赖继续递归解析

如果本地存在多个同名或同 slug 的 skill，会报歧义错误。遇到这种情况，建议给插件实例配置 `scope`，再在引用处使用 `scope/name`。

## Registry 配置

不配置 registry 时，默认使用 Vercel 公开 Skills Hub：

```text
https://skills.sh
```

如果要切到兼容的私有 registry，在 `.ai.config.yaml` 里配置：

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

如果 search 和 download 共用同一个根地址，可以写：

```yaml
skills:
  registry:
    url: https://skills.example.com
```

关闭远程依赖安装：

```yaml
skills:
  registry:
    enabled: false
```

禁用后，本地缺失的依赖会直接报错。

Registry 协议、缓存目录与安全约束见 [Skills registry 细节](./skills/registry.md)。

## 与选择规则的关系

如果任务只显式选择父 skill：

```json
{
  "skills": {
    "include": ["app-builder"]
  }
}
```

`app-builder` 声明的依赖会自动加入同一次运行。

如果显式排除了某个依赖：

```json
{
  "skills": {
    "include": ["app-builder"],
    "exclude": ["frontend-design"]
  }
}
```

`frontend-design` 不会被投影到 adapter 原生 skill 目录，也不会进入 prompt skill 路由。

## Adapter 行为

依赖解析发生在统一 workspace assets 层。adapter 只消费已经展开后的 skill 列表。

当前落点：

- Claude Code：`.ai/.mock/.claude/skills`
- Codex：`.ai/.mock/.agents/skills` 和 `.ai/.mock/.codex/skills`
- Gemini：`.ai/.mock/.agents/skills`
- OpenCode：session 级 `OPENCODE_CONFIG_DIR/skills`

因此同一个 `dependencies` 声明可以跨 adapter 使用。

## 常见问题

如果依赖本地找不到、registry 也搜不到，会报错并停止本次资产解析。

如果下载结果没有 `SKILL.md`，会报错；registry 返回的每个 skill 必须是一个完整 skill 目录快照。

如果同名 skill 同时存在于本地和插件中，本地无 scope 的唯一匹配优先；否则会提示歧义，需要改名或使用 scoped 引用。
