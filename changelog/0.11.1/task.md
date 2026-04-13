# @vibe-forge/task 0.11.1

发布日期：2026-04-13

## 发布范围

- 发布 `@vibe-forge/task@0.11.1`

## 主要变更

- 当显式指定裸模型名且多个 model service 存在同名模型时，优先使用 `defaultModelService` 解析目标 provider。
- 修正 resume 场景下模型 service 选择漂移到非预期 provider 的问题，避免会话恢复后误落到 `gpt` 等默认顺序更靠前的 service。

## 兼容性说明

- 本次为向后兼容的 patch 发布，不引入新的配置字段。
- 若消费方此前依赖“同名模型按配置声明顺序命中”的隐式行为，升级后会优先遵循 `defaultModelService`。
