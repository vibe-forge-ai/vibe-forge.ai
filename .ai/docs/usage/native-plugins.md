# Adapter 原生插件与 Marketplace

返回入口：[index.md](../index.md)

这页讲的是 adapter 自己的原生插件格式，不是顶层 `plugins` 配置里的统一 Vibe Forge 插件。

如果你要看这套能力在仓库里的职责和运行方式，继续看 [架构说明](../../rules/usage/native-plugins.md)。

## 适用场景

当前完整 installer 支持的只有 Claude：

- 安装 Claude Code 原生插件到项目级 `.ai/plugins`
- 从配置里的 marketplace 解析 `plugin@marketplace`
- 把 Claude 插件里可复用的能力接入到当前项目

Copilot 不提供 Vibe Forge installer；但可以通过 `adapters.copilot.pluginDirs` 把本地 Copilot CLI plugin 目录传给官方 `--plugin-dir`。

如果你要配置统一 Vibe Forge 插件，继续看 [插件与数据资产](./plugins.md)。

## 安装命令

命令入口是：

```bash
vf plugin --adapter claude add <source>
```

当前支持的常见 source 形式：

- 本地路径：`./plugins/my-claude-plugin`
- GitHub shorthand：`obra/superpowers`
- 显式 GitHub：`github:obra/superpowers`
- Git URL：`https://github.com/obra/superpowers.git#main`
- npm：`npm:@scope/pkg`、`npm:pkg@1.2.3`
- marketplace 引用：`plugin-name@marketplace-name`

注意：

- `plugin@marketplace` 会优先按 marketplace 解析
- 如果你本来想装 npm 包并且 spec 里带 `@`，要显式写成 `npm:...`
- 例如 `npm:superpowers@latest`、`npm:@acme/claude-plugin@1.2.3`

## Marketplace 配置

Vibe Forge 默认内置 `skills` 官方源，指向 Vercel 的 [skills.sh](https://skills.sh/) hub；没有配置 `marketplaces` 时，Web 前端的「知识库 -> 技能 -> 市场」也可以搜索并安装 skills.sh 上的技能。

自定义源默认在解析后的 workspace 根目录的 `.ai.config.yaml`、`.ai.config.json`、`.ai.dev.config.yaml` 或 `.ai.dev.config.json` 中配置 `marketplaces`。

如果显式设置了 `__VF_PROJECT_CONFIG_DIR__`，则会从该目录读取 marketplace 配置。

Claude marketplace entry 的格式是：

```yaml
marketplaces:
  <marketplace-name>:
    type: claude-code
    enabled: true
    syncOnRun: true | false
    plugins:
      <plugin-name>:
        enabled: true | false
        scope: optional-scope
    options:
      source: ...
```

`options.source` 当前支持这些来源：

- `github`
- `git`
- `directory`
- `url`
- `settings`

其中最常见的是：

- `github`：直接指向一个 marketplace 仓库
- `settings`：在项目配置里直接内联一个最小 catalog

如果你在 `plugins` 里声明了某个 marketplace plugin：

- 第一次 `vf run` 创建新会话时，Vibe Forge 会自动把它安装到项目里的 `.ai/plugins`
- `syncOnRun: true` 时，每次创建新会话前都会按 marketplace 重新同步一次
- `syncOnRun: false` 或不写时，只会在缺失时自动补装，不会每次强制更新

## 示例：接入 Superpowers Marketplace

如果你想直接使用 Superpowers 维护的 Claude marketplace，可以这样配：

```yaml
marketplaces:
  superpowers-marketplace:
    type: claude-code
    enabled: true
    syncOnRun: true
    plugins:
      superpowers:
        scope: superpowers
      superpowers-chrome:
        enabled: false
    options:
      source:
        source: github
        repo: obra/superpowers-marketplace
        ref: main
```

然后安装：

```bash
vf plugin --adapter claude add superpowers@superpowers-marketplace
vf plugin --adapter claude add superpowers-developing-for-claude-code@superpowers-marketplace
vf plugin --adapter claude add private-journal-mcp@superpowers-marketplace
```

如果你还想装浏览器插件，也可以继续装：

```bash
vf plugin --adapter claude add superpowers-chrome@superpowers-marketplace
```

前提是这个 plugin 名字已经存在于该 marketplace 的 `marketplace.json` 里。

如果你已经在 `plugins` 里声明了它们，也可以不手动执行这些安装命令，直接运行 `vf run` 让项目在启动时自动同步。

如果你不想依赖整个外部 marketplace，也可以用 `options.source.source: settings` 在项目配置里内联一个最小 catalog，只声明你真正需要的几个插件。

更完整的 marketplace 配置示例见 [Marketplace 详细示例](./native-plugins/marketplaces.md)。

## 用户视角下的行为

执行 `vf plugin --adapter claude add ...` 之后，你可以把它理解成两件事：

1. 这个 Claude 插件被安装成了当前项目的一部分
2. Vibe Forge 会自动抹平 Claude 原生插件格式和项目统一资产层之间的差异

效果上：

- Claude 插件里的可转换能力会进入项目统一资产层
- Claude adapter 运行时会自动启用对应的项目级原生插件
- 如果插件是在 `marketplaces.<name>.plugins` 里声明的，`vf run` 也会在启动时自动补装或同步它
- 你不需要再手动维护额外的 Claude 用户目录配置

## 当前限制

- 当前只有 `--adapter claude` 实现了 native plugin installer
- Copilot 只支持运行时 `pluginDirs` 加载本地插件目录，不做 marketplace 安装、同步或转换
- marketplace 里的插件源最终需要能解析成标准 Claude plugin root；只暴露裸 `skills/` 目录的 catalog 目前还不能直接安装
- Claude 插件如果声明 `userConfig`，安装会被拒绝；Vibe Forge 还没有把 marketplace 选项映射到这类插件配置
- marketplace 名称必须先在 `marketplaces` 里配置好；否则 `foo@bar` 会报歧义错误，而不是自动猜成 npm spec
- `hostPattern` 类型的 Claude marketplace 目前不能直接被 installer 拉取

## 相关文档

- [Claude Code Plugins](https://code.claude.com/docs/en/plugins)
- [Claude Code Plugin Marketplaces](https://code.claude.com/docs/en/plugin-marketplaces)
- [Superpowers](https://github.com/obra/superpowers)
- [Superpowers Marketplace](https://github.com/obra/superpowers-marketplace)
- [Superpowers Chrome](https://github.com/obra/superpowers-chrome)
