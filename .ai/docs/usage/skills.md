<!-- eslint-disable max-lines -->

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

## 项目预装 Skills

如果你希望项目在每次会话启动前自动确保一组 skills 已经安装，可以在 `.ai.config.json`、`.ai.config.yaml` 或 `.ai.config.yml` 里声明：

```yaml
skills:
  - frontend-design
  - example-source/default/public@design-review
  - name: design-review
    source: example-source/default/public
    rename: internal-review
```

支持两种写法：

- 字符串：和 `dependencies` 一样，支持 bare name、`source@skill`、以及完整 source path。
- 对象：`name` 表示远程 skill 名，`source` 表示 source path，`rename` 表示安装到本地后的 skill 名。

启动行为：

1. CLI `vf run` 和 server session 启动前，会检查目标目录下的 `SKILL.md` 是否存在。
2. 目标路径默认是 `.ai/skills/<skill-name>/SKILL.md`；如果配置了 `rename`，则改为 `.ai/skills/<rename>/SKILL.md`。
3. 本地不存在时，会自动通过 `skills` CLI 安装到项目 `.ai/skills`。
4. 本地已存在时，默认跳过，不会重复安装。

如果你希望在启动时强制刷新这些已安装的 skills：

- CLI：`vf run --update-skills "任务描述"`
- API：创建 session 时传 `updateSkills: true`

启用 `rename` 后，Vibe Forge 会同时重写本地 `SKILL.md` frontmatter 里的 `name`，这样后续引用和 include 都按重命名后的本地 skill 名工作。

如果你还需要配置 `skills.homeBridge`，可以切回对象形式：

```yaml
skills:
  install:
    - frontend-design
  homeBridge:
    enabled: false
```

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

## 解析顺序

Vibe Forge 会按这个顺序处理依赖与候选 skill：

1. 扫描当前 workspace 的 `.ai/skills`
2. 扫描已启用插件提供的 skills
3. 桥接支持的 home skill roots
4. 依赖解析时优先在项目和插件 skill 里按名称匹配
5. 本地未命中时，通过 `skills` CLI 搜索并安装
6. 对纯名称依赖，如果 `skills` CLI 不可用且只有 home-bridge skill 命中，才回退到 home skill
7. 把下载结果作为普通 workspace skill 加入本次资产列表
8. 对新加入的依赖继续递归解析

如果本地存在多个同名或同 slug 的 skill，会报歧义错误。遇到这种情况，建议给插件实例配置 `scope`，再在引用处使用 `scope/name`。

## 默认解析方式

本地缺失的 skill dependency 默认走 `skills` CLI，不再要求你额外配置 `skills.sh` 或私有 registry 地址。

默认情况下也**不需要**声明 `skillsCli`。Vibe Forge 会按托管 CLI 的默认策略使用 `skills@latest`；只有你所在环境不能直接安装，或者需要切到内网 npm 源、指定系统 binary、补充 env 时，才需要再配 `skillsCli`。

解析时会按依赖写法选择命令：

```bash
skills find <name>
skills add <source> --skill <name> --agent universal --copy -y
```

如果依赖已经写成 `source@skill`，Vibe Forge 会直接按 source 安装；如果只写 skill 名称，则先 `find` 再挑选匹配项。

安装结果会缓存到项目 `.ai/caches/skill-dependencies/`，不会写入用户真实 home，也不会修改 `.ai/skills` 下的手写 skill。

## Skills CLI 运行时

知识库里的「技能 -> 市场」页还提供了一个一次性的 “Install via Skills CLI” 入口，适合直接连接公司内网或私有 `skills` source。这个入口不会写入 `marketplaces`；它会在当前项目里临时执行：

```bash
skills add <source> --list
skills add <source> --skill <name> --agent universal --copy -y
```

安装结果会直接导入项目 `.ai/skills`。

只有在特殊环境下，你才需要控制 `skills` command 自身的运行时，例如：

- 机器默认 npm 源不能安装 `skills`
- 需要强制走内网 `bnpm`
- 需要传认证、region 等环境变量
- 需要指定系统里已有的 `skills` binary

这时才在 `.ai.config.yaml` 里配置：

```yaml
skillsCli:
  source: managed
  package: skills
  version: latest
  registry: https://registry.example.com
  env:
    SKILLS_REGION: cn
```

字段含义：

- `source` / `path` / `package` / `version` / `npmPath` / `autoInstall` / `prepareOnInstall`：和其他 managed npm CLI 一样，用来控制 `skills` 命令本身从哪里来。
- `registry`：只影响托管 `skills` CLI 包的安装来源，例如内网 npm 源；不会改变 `dependencies` 里写的 source。
- `env`：传给 `skills` CLI 的环境变量，适合补充私有 source 需要的认证或 region 信息。

`skillsCli` 同时也会用于配置型 project skills 的自动补装与更新；默认不配时，仍然按 `skills@latest` 的托管 CLI 策略执行。

## `vf skills` 命令

`vf` 自带一组项目级 skill 管理命令：

```bash
vf skills add <skill>
vf skills install [skills...]
vf skills update [skills...]
vf skills remove <skill>
vf skills publish <skill-or-path>
```

常见用法：

- `vf skills add design-review --source example-source/default/public --rename internal-review`
  - 把 skill 声明写进项目配置，并立即安装到 `.ai/skills/internal-review`
- `vf skills install`
  - 安装当前 `.ai.config.*` 里声明的全部 project skills
- `vf skills update`
  - 强制刷新当前 `.ai.config.*` 里声明的全部 project skills
- `vf skills remove internal-review`
  - 从项目配置中移除匹配 skill，并删除本地安装目录

`vf skills publish` 用来把一个本地 skill 发布到支持 publish 的 `skills` 平台。它支持三类输入：

- 项目里已经安装的 skill 名，例如 `vf skills publish internal-review`
- 本地路径，例如 `vf skills publish .ai/skills/internal-review`
- `skills` CLI 原生支持的远程发布 spec，例如 Git URL 或 ZIP URL

常见发布参数：

```bash
vf skills publish internal-review --group default/public --region cn --access restricted -y
```

这里：

- `--group`：目标 group；具体语义由你的 `skills` 平台决定
- `--region`：发布 region
- `--access`：访问级别
- `--registry`：仅控制托管 `skills` CLI 包从哪个 npm 源安装

注意：公开版 `skills@latest` 默认不支持 `publish`。如果你要使用 `vf skills publish`，通常需要把 `skillsCli` 指向带发布能力的内部 `skills` runtime，例如：

```yaml
skillsCli:
  registry: https://registry.example.com
```

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

如果依赖本地找不到、`skills` CLI 也搜不到，会报错并停止本次资产解析。

如果安装结果没有 `SKILL.md`，会报错；CLI 下载到的 skill 目录必须是一个完整 skill 快照。

如果同名 skill 同时存在于本地和插件中，本地无 scope 的唯一匹配优先；否则会提示歧义，需要改名或使用 scoped 引用。

- 同名 skill 的优先级与重复处理规则见 [Home Skill Auto-Bridge](./skills/home-bridge.md)。
