# 插件与数据资产

返回入口：[USAGE.md](../USAGE.md)

## 安装方式

- 插件通过 npm 安装到你的项目 workspace。
- 运行时不会自动安装缺失插件；如果包解析不到，会直接报错。
- `id` 支持简写：例如配置 `logger` 时，会优先解析 `logger`，失败后再尝试 `@vibe-forge/plugin-logger`。

示例：

```bash
pnpm add -D @vibe-forge/plugin-standard-dev @vibe-forge/plugin-logger
```

## 基本配置

在项目根目录的 `.ai.config.json` 或 `.ai.config.yaml` 中配置 `plugins`：

```json
{
  "plugins": [
    {
      "id": "standard-dev",
      "scope": "std"
    },
    {
      "id": "logger",
      "enabled": false
    }
  ]
}
```

支持字段：

- `id`: 插件包名或简写名
- `scope`: 可选。给该插件实例的资源加命名空间，避免重名
- `enabled`: 可选。默认 `true`；设为 `false` 时，该实例不会进入当前项目的有效插件图
- `options`: 可选。传给插件 hooks 或子插件解析逻辑
- `children`: 可选。显式启用或覆写 child plugin

## Scope 与资源引用

- scope 完全由用户控制，不由插件作者定义。
- 如果插件配置了 `scope`，资源标识会变成 `scope/name`，例如 `std/standard-dev-flow`、`std/dev-planner`。
- 如果没有配置 `scope`，可以直接写 `name`，但只有在该类资源全局唯一时才能成功解析。
- 当本地 `.ai/*` 资源和插件资源同名时，建议给插件实例增加 `scope`，避免歧义。

## Child Plugin

插件可以声明 child plugin，你也可以在配置里显式覆写：

```json
{
  "plugins": [
    {
      "id": "bundle",
      "scope": "corp",
      "children": [
        {
          "id": "review",
          "enabled": false
        },
        {
          "id": "logger",
          "scope": "corp-logger"
        }
      ]
    }
  ]
}
```

说明：

- child plugin 可以来自父插件 manifest，也可以是任意已安装依赖
- child 未显式设置 `scope` 时，会继承父实例的 `scope`
- `children[].enabled: false` 可以关闭默认激活的 child plugin

## 可加载的资产

统一插件资产支持：

- `rules`
- `skills`
- `specs`
- `entities`
- `mcp`
- `hooks`

其中 `spec` 和 `entity` 还支持在文档前置元数据里通过 `plugins: { mode, list }` 对当前任务的插件列表做 `extend` 或 `override`。

## Adapter 兼容范围

三种 adapter 都支持统一插件资产层：

- `claude-code`: 支持 prompt 资产、MCP、hooks
- `codex`: 支持 prompt 资产、MCP、hooks
- `opencode`: 支持 prompt 资产、MCP、hooks

只有 `opencode` 额外支持 native plugin overlay：

- `opencode/agents`
- `opencode/commands`
- `opencode/modes`
- `opencode/plugins`

当前还不支持：

- Claude 原生 plugin format 兼容层
- Codex 原生 plugin format 兼容层

也就是说，同一个 Vibe Forge 插件可以同时服务 `claude-code`、`codex`、`opencode`，但如果你写的是 OpenCode 原生目录结构，只有 OpenCode adapter 会消费这些 native 资产。

## 示例：标准开发流插件

`@vibe-forge/plugin-standard-dev` 提供一组常用研发实体和统一调度 skill：

```json
{
  "plugins": [
    {
      "id": "standard-dev",
      "scope": "std"
    }
  ]
}
```

常用资源：

- `std/standard-dev-flow`
- `std/dev-planner`
- `std/dev-implementer`
- `std/dev-reviewer`
- `std/dev-verifier`
