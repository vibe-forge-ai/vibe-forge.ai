# 更新日志

该目录用于维护项目版本发布记录。

约定：

- 每个版本使用一个独立目录，命名为 `<version>/`
- 整体发布记录在 `<version>/readme.md`
- 单包发布记录在 `<version>/<package>.md`
  - `<package>` 使用包名的短名或规范化名称
  - 例如 `@vibe-forge/server` 记录为 `server.md`
  - 例如 `@vibe-forge/adapter-codex` 记录为 `adapter-codex.md`
- 同一个版本目录下允许并列存在多份单包发布记录
  - 例如 `changelog/0.8.1/client.md` 与 `changelog/0.8.1/server.md`
- 只记录已经发布的版本
- 内容聚焦用户可感知变化、架构调整、兼容性影响与发布范围

范围判断约定：

- changelog 只记录实际发布的包，不按“最近仓库有改动”笼统归档。
- 纯测试、snapshot、AGENTS、普通文档改动默认不单独形成发布记录。
- 单包发布记录应只描述该包本次真正发布的内容，不要把其他包的变更混写进去。

Release tag 约定：

- 整体发布使用 `v<version>`
  - 例如 `v0.8.0`
- 单包发布使用 `pkg/<normalized-package-name>/v<version>`
  - `normalized-package-name` 规则：去掉包名中的 `@`，并将 `/` 替换为 `-`
  - 例如 `@vibe-forge/server@0.8.1` 使用 tag `pkg/vibe-forge-server/v0.8.1`

单包发布记录补充约定：

- 如果单包发布包含外部依赖升级，变更摘要里应明确写出关键依赖的目标版本。
- 如果单包发布包含导出路径、打包入口、后台运行方式之类的包装层调整，兼容性说明里应明确写出用户可见影响。
