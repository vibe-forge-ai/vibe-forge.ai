# Marketplace 详细示例

返回入口：[Adapter 原生插件与 Marketplace](../native-plugins.md)

这页补充用户侧更完整的 marketplace 配置示例，适合你已经确定要把 Claude Code 插件接进项目时参考。

Web 前端的「知识库 -> 技能」页会把 `marketplaces` 展示为可搜索的 skills hub 源。Vibe Forge 默认内置 `skills` 官方源，指向 Vercel 的 [skills.sh](https://skills.sh/) hub；你也可以在界面里新增 URL、目录、GitHub 或 Git 源，或者直接编辑配置文件。skills.sh 搜索结果会安装到项目 `.ai/skills`，Claude marketplace 搜索结果安装后会转换成当前项目可用的 Vibe Forge skills / entities / MCP / hooks 资产。

如果你想隐藏内置官方源，可以声明同名 marketplace 并禁用它；`skills` 这个源名由内置 skills.sh 源保留：

```yaml
marketplaces:
  skills:
    type: claude-code
    enabled: false
```

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
npx vf plugin --adapter claude add superpowers@superpowers-marketplace
npx vf plugin --adapter claude add superpowers-developing-for-claude-code@superpowers-marketplace
npx vf plugin --adapter claude add private-journal-mcp@superpowers-marketplace
```

如果你还想装浏览器插件，也可以继续装：

```bash
npx vf plugin --adapter claude add superpowers-chrome@superpowers-marketplace
```

前提是这个 plugin 名字已经存在于该 marketplace 的 `marketplace.json` 里。

## 示例：项目内联一个最小 Marketplace

如果你不想依赖整个外部 marketplace，也可以只在项目里声明你真正要用的几个插件：

```yaml
marketplaces:
  superpowers:
    type: claude-code
    enabled: true
    plugins:
      superpowers:
        scope: superpowers
      superpowers-chrome:
        enabled: false
    options:
      source:
        source: settings
        plugins:
          - name: superpowers
            source:
              source: github
              repo: obra/superpowers
              ref: main
          - name: superpowers-chrome
            source:
              source: github
              repo: obra/superpowers-chrome
              ref: main
          - name: private-journal-mcp
            source:
              source: github
              repo: obra/private-journal-mcp
              ref: main
```

然后安装：

```bash
npx vf plugin --adapter claude add superpowers@superpowers
npx vf plugin --adapter claude add superpowers-chrome@superpowers
npx vf plugin --adapter claude add private-journal-mcp@superpowers
```

说明：

- `source: settings` 适合把项目依赖锁到你自己指定的仓库和 ref。
- 这种内联 catalog 里的 `plugins[].source` 必须写显式对象，不能写相对路径字符串。
- 相对路径插件源只适用于目录型 marketplace，因为只有目录型 marketplace 才有本地 root 可解析。

## 自动同步行为

如果你在 `marketplaces.<name>.plugins` 里声明了插件：

- 第一次 `vf run` 创建新会话时，Vibe Forge 会自动补装缺失插件。
- `syncOnRun: true` 时，每次创建新会话前都会按 marketplace 重新同步一次。
- `resume` 不会重新同步，避免同一会话中途漂移。

## 相关文档

- [Claude Code Plugins](https://code.claude.com/docs/en/plugins)
- [Claude Code Plugin Marketplaces](https://code.claude.com/docs/en/plugin-marketplaces)
- [Superpowers](https://github.com/obra/superpowers)
- [Superpowers Marketplace](https://github.com/obra/superpowers-marketplace)
- [Superpowers Chrome](https://github.com/obra/superpowers-chrome)
