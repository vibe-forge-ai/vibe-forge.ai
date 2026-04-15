# @vibe-forge/cli 0.11.1

发布日期：2026-04-15

## 发布范围

- 发布 `@vibe-forge/cli@0.11.1`

## 主要变更

- CLI 现在会默认注入 companion 插件 `@vibe-forge/plugin-cli-skills`，安装后可直接通过 `--include-skill vf-cli-quickstart`、`--include-skill vf-cli-print-mode` 使用内建说明型 skills。
- `vf --print` 遇到权限请求或其他输入请求时，会把请求内容明确打印出来；如果当前运行没有可用的输入通道，会直接终止任务，避免静默卡住。
- `vf --resume ... --print --input-format ...` 新增 `submit_input` 控制协议，可在继续会话时提交 `allow_once` 等输入，处理挂起的权限确认或其他交互请求。
- CLI 的权限恢复链路补齐了 Claude Code / OpenCode 的 `permission_required` 场景，恢复授权后可以继续当前会话，而不是只能重新启动任务。

## 兼容性说明

- 本次为向后兼容的 patch 发布，既有 `vf run`、`vf --resume` 与 `--print` 用法继续可用。
- 新增的 companion skill 插件为默认注入能力，不要求现有调用方修改命令参数。
