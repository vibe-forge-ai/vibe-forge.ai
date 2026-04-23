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

## Home Skill Auto-Bridge

Vibe Forge 默认会桥接用户真实 home 下的常见 skill roots，并把它们加入统一 workspace assets。

详细的默认 roots、优先级、symlink 投影行为和 `skills.homeBridge` 配置见 [Home Skill Auto-Bridge](./skills/home-bridge.md)。

## 项目安装与 CLI

项目预装 skills、启动前自动补装、`vf run --update-skills`、CLI 内置 skills，以及 `vf skills add/install/update/remove/publish` 的完整说明已经拆到单独文档：

- [项目安装与 CLI 管理](./skills/project-management.md)

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

这种写法会先查当前 workspace 和已启用插件里的 skill。本地找不到时，再用 `skills find <name>` 搜索同名 skill。

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

多段 source 也建议优先写成 `source@skill`，例如：

```yaml
dependencies:
  - example-source/default/public@frontend-design
```

这里的 `example-source/default/public` 会被当作完整 source path 原样传给 `skills` CLI：

```bash
skills add example-source/default/public --skill frontend-design
```

Vibe Forge 不会继续拆解 `/default/public` 的业务含义；它通常只是内部 `skills` 服务里的 namespace、group、channel 或可见性路径，具体语义由 source 自己决定。

对象形式适合给单个依赖指定 source：

```yaml
dependencies:
  - name: frontend-design
    source: anthropics/skills
```

字段含义：

- `name`：依赖 skill 名称
- `source`：远程 source，格式是 `owner/repo`

## 解析与运行时行为

依赖解析顺序、默认 `skills` CLI 行为、dependency cache、知识库里的 “Install via Skills CLI” 入口，以及父 skill 被选择后如何自动带出依赖，见：

- [依赖解析与运行时行为](./skills/resolution.md)

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

常见投影位置：

- Claude Code：`.ai/.mock/.claude/skills`
- Codex：`.ai/.mock/.agents/skills` 和 `.ai/.mock/.codex/skills`
- Gemini：`.ai/.mock/.agents/skills`
- OpenCode：session 级 `OPENCODE_CONFIG_DIR/skills`

## 常见问题

如果依赖本地找不到、`skills` CLI 也搜不到，会报错并停止本次资产解析。

如果安装结果没有 `SKILL.md`，会报错；CLI 下载到的 skill 目录必须是一个完整 skill 快照。

如果同名 skill 同时存在于本地和插件中，本地无 scope 的唯一匹配优先；否则会提示歧义，需要改名或使用 scoped 引用。

- 同名 skill 的优先级与重复处理规则见 [Home Skill Auto-Bridge](./skills/home-bridge.md)。
