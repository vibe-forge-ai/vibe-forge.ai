# 安装与准备

返回入口：[index.md](../index.md)

## 安装基础包

```bash
pnpm add -D @vibe-forge/server @vibe-forge/client @vibe-forge/cli @vibe-forge/adapter-claude-code
```

如果需要在项目里启用插件，还需要把对应插件包一起安装到当前 workspace：

```bash
pnpm add -D @vibe-forge/plugin-standard-dev @vibe-forge/plugin-logger
```

如果你想显式调用独立 `vf-mcp` 二进制：

```bash
pnpm add -D @vibe-forge/mcp
```

如果你想显式调用独立 `vf-call-hook` 二进制：

```bash
pnpm add -D @vibe-forge/hooks
```

不想写入依赖也可以直接用 `npx`：

```bash
npx -y vfui-server --help
npx -y vfui-client --help
```

## 配置文件

在你的项目根目录准备：

- `.ai.config.json` / `.ai.config.yaml` / `.ai.config.yml`
- 可选开发态配置：`.ai.dev.config.*`
- 同名配置也可放在 `./infra/` 下

配置支持 `${ENV_VAR}` 变量替换。使用 TS 配置时：

- `defineConfig()` 入口：`@vibe-forge/config`
- `Config` 类型：`@vibe-forge/types`

## 数据资产目录

默认情况下，项目数据资产目录位于 `./.ai/`，例如：

- `./.ai/rules`
- `./.ai/skills`
- `./.ai/specs`
- `./.ai/entities`
- `./.ai/mcp`

如果你希望改名或放到嵌套目录，可以在项目根 `.env` 中覆盖：

```env
__VF_PROJECT_AI_BASE_DIR__=.vf
__VF_PROJECT_AI_ENTITIES_DIR__=agents
```

常见用法：

- `__VF_PROJECT_AI_BASE_DIR__`：覆盖整个数据资产根目录，支持相对项目根的嵌套目录，也支持绝对路径
- `__VF_PROJECT_AI_ENTITIES_DIR__`：只覆盖实体子目录，基于 AI 基目录继续解析，也支持嵌套路径

例如：

```env
__VF_PROJECT_AI_BASE_DIR__=.config/vibe/ai-data
__VF_PROJECT_AI_ENTITIES_DIR__=knowledge/entities
```

最终实体目录会解析为 `./.config/vibe/ai-data/knowledge/entities`。

注意：

- `.ai.config.json` / `.ai.config.yaml` / `.ai.dev.config.*` 的文件名和位置不受这些环境变量影响
- 修改 `.env` 后需要重启相关 server / CLI / adapter 进程，已有进程不会自动重载
