# @vibe-forge/adapter-claude-code 0.10.1

发布日期：2026-04-10

## 发布范围

- 发布 `@vibe-forge/adapter-claude-code@0.10.1`

## 主要变更

- adapter 初始化时会把工作区 `.ai/skills` 同步到 mock home 的 `.claude/skills`，让 Claude 原生 skills 在隔离运行目录下也能生效。
- Claude marketplace catalog 读取路径改成先按原始输入做归一化，再进入强类型结构，避免 catalog 输入在类型收敛前被错误假定为已合法。

## 兼容性说明

- 不新增启动参数。
- 如果工作区不存在 `.ai/skills`，adapter 会自动清理 mock home 里的旧 skills 映射。
