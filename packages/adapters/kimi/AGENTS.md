# Kimi Adapter

本目录只保留本地入口。Kimi adapter 的设计、维护经验和验证规范统一维护在本 package 内的 [`.ai/rules/`](./.ai/rules/)：

- [KIMI-ADAPTER.md](./.ai/rules/KIMI-ADAPTER.md)
- [runtime.md](./.ai/rules/runtime.md)
- [model-services.md](./.ai/rules/model-services.md)
- [hooks-and-assets.md](./.ai/rules/hooks-and-assets.md)
- [verification.md](./.ai/rules/verification.md)

Kimi adapter 的实现与评审记录见 [PR #102](https://github.com/vibe-forge-ai/vibe-forge.ai/pull/102)。

## 目录职责

- [src/runtime/init.ts](./src/runtime/init.ts)：Kimi CLI 定位、workspace cache 自动安装、native hook bridge 初始化。
- [src/runtime/config.ts](./src/runtime/config.ts)：session share dir、modelServices 转 Kimi config、MCP、agent file、skills overlay、spawn env。
- [src/runtime/session.ts](./src/runtime/session.ts)：`kimi --print --output-format stream-json --prompt` 会话。
- [src/runtime/direct.ts](./src/runtime/direct.ts)：交互式直连模式，`stdio: inherit`。
- [src/runtime/native-hooks.ts](./src/runtime/native-hooks.ts) 与 [kimi-hook.js](./kimi-hook.js)：Kimi native hooks 到 Vibe Forge hook runtime 的 bridge。
- [src/icon.ts](./src/icon.ts)：client 展示图标，必须来自官方 KIMI Brand Guidelines。
- [tests/runtime-config.spec.ts](./__tests__/runtime-config.spec.ts) 与 [tests/native-hooks.spec.ts](./__tests__/native-hooks.spec.ts)：主要回归测试入口。
