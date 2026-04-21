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

## CLI 内置 Skills

`vf` CLI 默认会注入 `@vibe-forge/plugin-cli-skills`，提供一组不需要项目手动配置的通用说明型 skills。通常直接描述需求即可；只有需要强制指定某个 skill 时，才使用 `vf run --include-skill <name> "任务描述"`。

- `vf-cli-quickstart`：说明 CLI 常用命令、配置命令和会话恢复方式。
- `vf-cli-print-mode`：说明 print 模式、stdin 控制和权限确认。
- `create-entity`：按用户需求创建新的 Vibe Forge entity。
- `update-entity`：按用户需求更新已有 Vibe Forge entity，强调最小改动和维护引用关系。

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

Vibe Forge 会按这个顺序处理依赖与候选 skill：

1. 扫描当前 workspace 的 `.ai/skills`
2. 扫描已启用插件提供的 skills
3. 桥接支持的 home skill roots
4. 依赖解析时优先在项目和插件 skill 里按名称匹配
5. 本地未命中时，从 registry 下载依赖 skill
6. 对纯名称依赖，如果 registry 不可用且只有 home-bridge skill 命中，才回退到 home skill
7. 把下载结果作为普通 workspace skill 加入本次资产列表
8. 对新加入的依赖继续递归解析

如果本地存在多个同名或同 slug 的 skill，会报歧义错误。遇到这种情况，建议给插件实例配置 `scope`，再在引用处使用 `scope/name`。

## Registry 配置

不配置 registry 时，默认使用 Vercel 公开 Skills Hub：`https://skills.sh`。

私有 registry 配置、搜索/下载入口拆分、缓存目录和安全约束见 [Skills registry 细节](./skills/registry.md)。

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

常见投影位置：

- Claude Code：`.ai/.mock/.claude/skills`
- Codex：`.ai/.mock/.agents/skills` 和 `.ai/.mock/.codex/skills`
- Gemini：`.ai/.mock/.agents/skills`
- OpenCode：session 级 `OPENCODE_CONFIG_DIR/skills`

## 常见问题

- 本地和 registry 都找不到依赖时，会报错并停止本次资产解析。
- registry 下载结果必须包含 `SKILL.md`，否则会报错。
- 同名 skill 的优先级与重复处理规则见 [Home Skill Auto-Bridge](./skills/home-bridge.md)。
