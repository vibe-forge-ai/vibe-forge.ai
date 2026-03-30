# 发布规则

本文件是仓库中唯一的发布规则入口。凡是“是否该发布、怎么发布、发布后记录什么、tag 怎么打、经验写到哪里”这类问题，都以本文件为准。

## 适用范围

- 整体发布
- 单包发布
- 版本号调整
- changelog 记录
- publish-plan 使用
- npm 发布前后检查
- 发布后的 tag 与经验沉淀

## 范围判断

发布前先明确范围，不要直接把所有最近提交等价成“都要发布”：

- 先以最近一次版本更新或发布提交为基线做 diff，确认这段时间哪些 workspace 包真的发生了变化。
- 只有运行时代码变更、发布元数据变更，例如 `package.json` 的 `version`、`exports`、`dependencies`，才应计入发版范围。
- 纯测试、snapshot、AGENTS、普通文档改动默认不进入发版范围，也不应因此级联发布依赖方。
- 如果某个包本身不发布，就不要因为它的测试改动把依赖闭包上的上层包一起带入发布计划。

## 发布类型

- 整体发布：通常发布一组 public workspace 包，并在 `changelog/<version>/readme.md` 记录。
- 单包发布：只发布明确选中的包，并在 `changelog/<version>/<package>.md` 记录。
- 同一个版本目录下可以同时存在多份单包发布记录，例如 `client.md`、`server.md`、`adapter-claude-code.md`。

## changelog 约定

- 每个版本使用一个独立目录，命名为 `<version>/`
- 整体发布记录在 `<version>/readme.md`
- 单包发布记录在 `<version>/<package>.md`
- `<package>` 使用包名的短名或规范化名称
  - 例如 `@vibe-forge/server` 记录为 `server.md`
  - 例如 `@vibe-forge/adapter-codex` 记录为 `adapter-codex.md`
- 只记录已经发布的版本
- 内容聚焦用户可感知变化、架构调整、兼容性影响与发布范围
- changelog 只记录实际发布的包，不按“最近仓库有改动”笼统归档。
- 单包发布记录应只描述该包本次真正发布的内容，不要把其他包的变更混写进去。
- 如果单包发布包含外部依赖升级，变更摘要里应明确写出关键依赖的目标版本。
- 如果单包发布包含导出路径、打包入口、后台运行方式之类的包装层调整，兼容性说明里应明确写出用户可见影响。

## publish-plan 使用

- `pnpm tools publish-plan -- [args]` 用于基于显式包选择和内部依赖生成发布顺序。
- 是否应该发布某个包，仍需先按本文件的“范围判断”确认，不要把 `publish-plan` 当成自动决定“哪些包应该发布”的唯一依据。
- 传入 `--bump` 时，即使没有 `--publish`，脚本也会直接修改目标包的 `package.json` 版本号。
- 所以只做计划试算时，优先先跑不带 `--bump` 的命令；若必须带 `--bump`，确保工作区干净，或准备好丢弃试算改动。

## 发布前最小检查清单

- 跑目标包相关测试，不要只看仓库全量状态。
- 用 `pnpm tools publish-plan -- ...` 确认发布顺序和候选包。
- 用 `npm view <pkg> version` 确认 registry 当前版本，避免重复发已存在版本。
- 用 `npm whoami` 确认当前 npm 登录态。
- 在目标包目录执行 `npm pack --dry-run` 检查最终 tarball 内容。
- 如果本次发布包含外部依赖升级或发布元数据变化，记得同步提交根 `pnpm-lock.yaml`。
- 如果包存在子路径导出，`npm pack --dry-run` 时要确认导出目标的真实文件已经进入 tarball，不要依赖额外的空壳透传文件占位。

## 推荐发布步骤

### 单包发布

1. 确认该包自上次发布以来存在应计入发版范围的变更。
2. 区分 alpha / 正式版：
   - alpha / 预发布可以基于功能分支直接发布，用于下游联调验证。
   - 正式版应先把发布内容合入默认分支，再从默认分支对应提交发布，避免出现“npm 正式版已发布，但 GitHub 默认分支还没有这次变更”。
3. 更新目标包 `package.json` 版本号。
4. 补对应的 `changelog/<version>/<package>.md`。
5. 如果需要，更新锁文件或其它发布元数据。
6. 执行发布前最小检查清单。
7. 提交 release commit。
8. 若是正式版，先完成默认分支合入，再执行 `pnpm tools publish-plan -- --package <pkg> --publish`。
9. 发布成功后补 tag。
10. 如果形成了新的稳定经验，回写文档。

### 整体发布

1. 先明确本次真正纳入发布的 public workspace 包。
2. 补 `changelog/<version>/readme.md`。
3. 执行发布前最小检查清单。
4. 提交 release commit。
5. 执行整体发布。
6. 发布成功后补整体 tag。
7. 如果形成了新的稳定经验，回写文档。

## tag 约定

- 整体发布使用 `v<version>`
  - 例如 `v0.8.0`
- 单包发布使用 `pkg/<normalized-package-name>/v<version>`
  - `normalized-package-name` 规则：去掉包名中的 `@`，并将 `/` 替换为 `-`
  - 例如 `@vibe-forge/server@0.8.1` 使用 tag `pkg/vibe-forge-server/v0.8.1`

## 发布后的经验沉淀

- 如果本次发布暴露出新的稳定经验或踩坑结论，发布完成后应同步回写文档，避免下次重复确认同一决策。
- 包内的实现或维护经验，优先写到对应包的 `AGENTS.md`。
- 跨包、跨工具的通用发布规则，只写在本文件，不要再分散写到其它地方。
