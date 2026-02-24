# 本仓库开发与贡献

本文件只描述如何参与本仓库开发；如何把 Vibe Forge 接入你的项目，请见 [USAGE.md](./USAGE.md)。

## 开发环境

- Node.js：建议 v18+
- pnpm：建议 v8+

## 本地启动（UI）

在仓库根目录：

```bash
pnpm install
pnpm start
```

该命令等价于运行 [start.sh](../start.sh)，会分别启动：

- `npx vfui-server`（后端）
- `npx vfui-client`（前端）

日志输出到 `.logs/`。

## 代码质量

参考维护指南：[maintenance.md](../.trae/rules/maintenance.md)

常用命令：

```bash
npx eslint .
npx dprint fmt
pnpm -r exec tsc --noEmit
pnpm -C apps/cli test
npx vitest run <path>
```

## 项目规范

- 架构说明：[architecture.md](../.trae/rules/architecture.md)
- 前端规范：[frontend_standard.md](../.trae/rules/frontend_standard.md)
- 后端规范：[backend_standard.md](../.trae/rules/backend_standard.md)
