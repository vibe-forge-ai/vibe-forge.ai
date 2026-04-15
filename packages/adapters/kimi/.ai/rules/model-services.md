# Kimi Model Services

## 转换入口

[src/runtime/config.ts](../../src/runtime/config.ts) 会把 Vibe Forge `modelServices` 生成 Kimi config。命令里的：

```bash
--model serviceKey,modelName
```

会被解析为 Kimi 的：

- `default_model`
- `providers`
- `models`
- `services`，仅 `providerType: "kimi"` 时额外生成 search/fetch

## Provider Types

支持的 provider type：

- `kimi`
- `openai_legacy`
- `openai_responses`
- `anthropic`
- `gemini`
- `vertexai`

推断规则在 `inferProviderType`。新配置优先写 `modelServices.<key>.extra.kimi`，同名字段也兼容既有 `extra.codex` 和 `extra.opencode`。

常用扩展字段：

- `providerType`
- `providerId`
- `modelKey`
- `headers`
- `env`
- `queryParams`
- `maxContextSize`
- `capabilities`

## URL 归一化

外部 API 接入的关键是 provider base URL 归一化：

- `kimi` 和 `openai_legacy` 要剥掉结尾 `/chat/completions`
- `openai_responses` 要剥掉结尾 `/responses`
- `kimi` provider 要基于剥离后的 base URL 生成 `/search` 与 `/fetch`

维护结论：很多用户会直接把 `apiBaseUrl` 配成 `/v1/chat/completions`。如果不剥掉，Kimi CLI 会请求重复路径，search/fetch 也会拼错。

## Fallback

如果没有匹配到 `modelServices` 且没有复制到真实 Kimi config，fallback 会按裸 model 生成默认 provider，并从这些 env 取 key：

- `KIMI_API_KEY`
- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`
- `GEMINI_API_KEY`

维护时优先走 `modelServices`，不要把外部服务接入散落到 env 特判里。
