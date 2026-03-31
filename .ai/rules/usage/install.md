# 安装与准备

返回入口：[USAGE.md](../USAGE.md)

## 安装基础包

```bash
pnpm add -D @vibe-forge/server @vibe-forge/client @vibe-forge/cli @vibe-forge/adapter-claude-code
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
