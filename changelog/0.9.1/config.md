## @vibe-forge/config

- 默认 `vibe-forge` MCP server 现在会透传当前 runtime 的最小必要解析环境，例如 `NODE_PATH` 和关键 `__VF_PROJECT_*` 变量。
- 这让由外部宿主拉起的默认 MCP server 也能复用父会话的包解析上下文，避免在子任务场景下丢失插件包解析能力。
