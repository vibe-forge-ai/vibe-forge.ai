# Hooks 托管配置

返回入口：[HOOKS.md](../HOOKS.md)

## 托管文件

当 workspace 配置了 hook 插件时，adapter init 会在 `.ai/.mock` 下安装托管配置：

| Adapter       | 托管文件                                                 |
| ------------- | -------------------------------------------------------- |
| `claude-code` | `.ai/.mock/.claude/settings.json`                        |
| `codex`       | `.ai/.mock/.codex/hooks.json`                            |
| `opencode`    | `.ai/.mock/.config/opencode/opencode.json`               |
| `opencode`    | `.ai/.mock/.config/opencode/plugins/vibe-forge-hooks.js` |

## 说明

- 托管配置只写入 mock home，不污染用户真实 home。
- OpenCode 会把已有配置镜像进 mock config dir，再叠加托管 plugin。
- 三家的 native 配置最终都会回调 `@vibe-forge/hooks/call-hook.js`。
- Codex 会同时加载 `~/.codex/hooks.json` 和 `<repo>/.codex/hooks.json`，要避免和项目级 managed hooks 重复。
