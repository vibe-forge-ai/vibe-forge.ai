# 更新日志

该目录用于维护项目版本发布记录。

约定：

- 每个版本使用一个独立目录，命名为 `<version>/`
- 整体发布记录在 `<version>/README.md`
- 单包发布记录在 `<version>/<package>.md`
  - `<package>` 使用包名的短名或规范化名称
  - 例如 `@vibe-forge/server` 记录为 `server.md`
  - 例如 `@vibe-forge/adapter-codex` 记录为 `adapter-codex.md`
- 只记录已经发布的版本
- 内容聚焦用户可感知变化、架构调整、兼容性影响与发布范围

Release tag 约定：

- 整体发布使用 `v<version>`
  - 例如 `v0.8.0`
- 单包发布使用 `pkg/<normalized-package-name>/v<version>`
  - `normalized-package-name` 规则：去掉包名中的 `@`，并将 `/` 替换为 `-`
  - 例如 `@vibe-forge/server@0.8.1` 使用 tag `pkg/vibe-forge-server/v0.8.1`
