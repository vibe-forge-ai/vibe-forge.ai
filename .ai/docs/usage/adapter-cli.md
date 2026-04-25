# Adapter CLI 安装与版本

返回启动服务：[runtime.md](./runtime.md)

Vibe Forge 不把各原生 CLI 作为 adapter 包的运行时依赖。第一次使用时，adapter 会优先找显式配置的 binary、项目共享 cache、系统 `PATH`，都不可用时再安装到项目级共享 cache：

- npm 托管：`codex`、`gemini`、`copilot`、`opencode`、`claude-code.cli`、`claude-code.routerCli`
- uv 托管：`kimi.cli`

默认托管版本：

| Adapter                 | 托管包                           | 默认版本  |
| ----------------------- | -------------------------------- | --------- |
| `codex`                 | `@openai/codex`                  | `0.121.0` |
| `gemini`                | `@google/gemini-cli`             | `0.38.2`  |
| `copilot`               | `@github/copilot`                | `1.0.36`  |
| `opencode`              | `opencode-ai`                    | `1.14.18` |
| `claude-code.cli`       | `@anthropic-ai/claude-code`      | `2.1.114` |
| `claude-code.routerCli` | `@musistudio/claude-code-router` | `1.0.73`  |
| `kimi.cli`              | `kimi-cli`                       | `1.36.0`  |

可以在项目配置里固定来源和版本：

```yaml
adapters:
  codex:
    cli:
      source: managed
      version: 0.121.0
      prepareOnInstall: true
  claude-code:
    cli:
      version: 2.1.114
    routerCli:
      version: 1.0.73
  kimi:
    cli:
      package: kimi-cli
      version: 1.36.0
      python: "3.13"
```

`cli.source` 支持：

- `managed`：使用项目共享 cache 中的托管 CLI；缺失时按 `autoInstall` 安装
- `system`：优先使用系统 `PATH` 中的原生命令；缺失时仍可按 `autoInstall` 安装
- `path`：只使用 `cli.path` 指向的 binary

把 `autoInstall` 设为 `false` 可以关闭首次使用时的自动安装。npm 托管 adapter 还支持 `cli.package`、`cli.npmPath`；Kimi 支持 `cli.package`、`cli.python`、`cli.uvPath`。

如果希望提前把托管 CLI 下载到项目共享 cache，可以显式运行：

```bash
vf adapter prepare codex claude-code gemini
vf adapter prepare claude-code.routerCli
vf adapter prepare --all
```

不传 target 时，`vf adapter prepare` 只准备配置中声明了 `prepareOnInstall: true` 的 CLI：

```json
{
  "adapters": {
    "codex": {
      "cli": {
        "source": "managed",
        "version": "0.121.0",
        "prepareOnInstall": true
      }
    },
    "claude-code": {
      "routerCli": {
        "version": "1.0.73",
        "prepareOnInstall": true
      }
    }
  }
}
```

`@vibe-forge/cli` 的 package `postinstall` 也会读取项目根的 `.ai.config.json` 或 `infra/.ai.config.json`。只有发现上述 `prepareOnInstall: true` 时才会调用 `vf adapter prepare --from-postinstall`，否则不做网络下载。postinstall 默认跳过 `CI=true`；如需在 CI 里预热，设置 `VIBE_FORGE_POSTINSTALL_PREPARE=1`。如需跳过，设置 `VIBE_FORGE_SKIP_ADAPTER_PREPARE=1` 或 `VIBE_FORGE_SKIP_POSTINSTALL=1`。

同样可以用环境变量临时覆盖，`<ADAPTER>` 使用大写下划线，例如 `CODEX`、`GEMINI`、`CLAUDE_CODE`、`CLAUDE_CODE_ROUTER`：

```bash
export __VF_PROJECT_AI_ADAPTER_CODEX_CLI_SOURCE__=managed
export __VF_PROJECT_AI_ADAPTER_CODEX_INSTALL_VERSION__=0.121.0
export __VF_PROJECT_AI_ADAPTER_CODEX_AUTO_INSTALL__=false
export __VF_PROJECT_AI_ADAPTER_CODEX_CLI_PATH__=/absolute/path/to/codex

export __VF_PROJECT_AI_ADAPTER_KIMI_INSTALL_VERSION__=1.36.0
export __VF_PROJECT_AI_ADAPTER_KIMI_INSTALL_PYTHON__=3.13
export __VF_PROJECT_AI_ADAPTER_KIMI_UV_PATH__=/absolute/path/to/uv
```
