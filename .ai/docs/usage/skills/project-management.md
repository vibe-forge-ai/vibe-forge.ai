# 项目安装与 CLI 管理

返回上级：[skills.md](../skills.md)

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
- `vf skills add lynx-cat --source example-source/lynx/skills --registry https://registry.example.com --version 1.0.3`
  - 把 registry/source/version 一起写进项目配置；后续会话启动前会按这条 spec 自动补装或更新
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
- `--registry`：仅控制这次运行里托管 `skills` CLI 包从哪个 npm 源安装

注意：公开版 `skills@latest` 默认不支持 `publish`。如果你要使用 `vf skills publish`，通常需要让这次命令从支持 publish 的内部 npm 源安装 `skills` CLI，例如：

```bash
vf skills publish internal-review --registry https://registry.example.com
```
