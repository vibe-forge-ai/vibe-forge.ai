# @vibe-forge/adapter-claude-code 0.10.2

发布日期：2026-04-10

## 发布范围

- 发布 `@vibe-forge/adapter-claude-code@0.10.2`

## 主要变更

- Claude adapter 在初始化 mock home 时，会把真实 home 下的 `Library/Keychains` 软链到 `.ai/.mock/Library/Keychains`
- 当 Claude 运行在 `HOME=.ai/.mock` 的隔离环境下时，仍然可以复用 macOS Keychain 中已有的认证材料
- 如果当前运行拿不到真实 home，adapter 会清理 mock home 里旧的 `Library/Keychains` 软链，避免残留到过期路径

## 兼容性说明

- 不增加新的 CLI 参数或配置项
- 变更只影响 `@vibe-forge/adapter-claude-code` 初始化 mock home 时的原生资产同步逻辑
