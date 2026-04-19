# 插件与数据资产

返回入口：[index.md](../index.md)

## 两套插件体系

Vibe Forge 现在有两套并行的插件使用方式：

- 统一 Vibe Forge 插件：通过 `plugins` 配置加载 npm 包里的 `rules / skills / specs / entities / mcp / hooks`
- adapter 原生插件：通过 `npx vf plugin --adapter <adapter> add ...` 安装 adapter 自己的原生插件格式，再转成项目可复用的 Vibe Forge 资产

如果你要安装 Claude Code 插件、配置 marketplace，继续看 [Adapter 原生插件与 Marketplace](./native-plugins.md)。

## 安装方式

- 插件通过 npm 安装到你的项目 workspace。
- 运行时不会自动安装缺失插件；如果包解析不到，会直接报错。
- `id` 支持简写：例如配置 `logger` 时，会优先解析 `logger`，失败后再尝试 `@vibe-forge/plugin-logger`。

示例：

```bash
pnpm add -D @vibe-forge/plugin-standard-dev @vibe-forge/plugin-logger
```

## 基本配置

默认情况下，在解析后的 workspace 根目录的 `.ai.config.json` 或 `.ai.config.yaml` 中配置 `plugins`：

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
- 当本地项目资产目录中的资源和插件资源同名时，建议给插件实例增加 `scope`，避免歧义。

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

## 本地数据资产目录

项目内置资产默认从 `./.ai/` 读取：

- `rules`
- `skills`
- `specs`
- `entities`
- `mcp`

如果你的项目不想使用默认的 `.ai` 目录，可以在项目根 `.env` 中覆盖：

```env
__VF_PROJECT_AI_BASE_DIR__=.vf
```

这样本地资产会改为从 `./.vf/` 下读取。

如果只想改实体目录名，可以继续配置：

```env
__VF_PROJECT_AI_ENTITIES_DIR__=agents
```

此时实体会从 `./.vf/agents/` 读取。`__VF_PROJECT_AI_ENTITIES_DIR__` 也支持嵌套路径，例如：

```env
__VF_PROJECT_AI_ENTITIES_DIR__=knowledge/entities
```

此时实体会从 `./.vf/knowledge/entities/` 读取。

边界说明：

- 这里修改的是项目数据资产目录，不是配置文件位置
- `.ai.config.json` / `.ai.dev.config.*` 默认仍然放在解析后的 workspace 根目录或 `./infra/`
- 如果显式设置了 `__VF_PROJECT_CONFIG_DIR__`，插件配置会改为从该目录读取
- 修改 `.env` 后需要重启相关进程

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

另外，当前已支持一条 adapter-native 插件安装链路：

- `claude-code`: 支持 Claude 原生插件安装与 marketplace 解析，Vibe Forge 会自动处理项目侧的兼容接入
- `claude-code`: 还支持在 `marketplaces.<name>.plugins` 里声明项目默认插件，`vf run` 创建新会话时会自动补装或同步

当前还未接入：

- Codex 原生 plugin format 安装链路
- OpenCode 原生 plugin marketplace 安装链路

也就是说，同一个 Vibe Forge 插件可以同时服务 `claude-code`、`codex`、`opencode`；如果你安装的是 Claude 原生插件，Vibe Forge 会尽量把它抹平成项目统一插件层可用的能力，并在 Claude adapter 下自动接入。

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
