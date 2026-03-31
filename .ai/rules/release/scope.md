# 发布范围与 changelog

返回入口：[RELEASE.md](../RELEASE.md)

## 范围判断

- 以最近一次版本更新或发布提交为基线做 diff。
- 只有运行时代码变更、发布元数据变更，才应计入发版范围。
- 纯测试、snapshot、AGENTS、普通文档改动默认不进入发版范围。
- 如果某个包本身不发布，不要因为测试改动把依赖闭包上的上层包一起带入发布计划。
- 先列出“候选发布包 -> 发版依据”的最小清单，再决定版本和 changelog。

## 发布类型

- 整体发布：一组 public workspace 包一起发布，在 `changelog/<version>/readme.md` 记录。
- 单包发布：只发布明确选中的包，在 `changelog/<version>/<package>.md` 记录。

## changelog 约定

- 每个版本使用一个独立目录 `<version>/`
- 整体发布记录在 `<version>/readme.md`
- 单包发布记录在 `<version>/<package>.md`
- 只记录已经发布的版本
- 聚焦用户可感知变化、兼容性影响和发布范围
- 单包记录只描述该包本次真正发布的内容，不混写其他包的变化

## publish-plan

- `pnpm tools publish-plan -- [args]` 用于基于显式包选择和内部依赖生成发布顺序。
- 它不是“哪些包该发布”的唯一依据；范围判断仍以前面的规则为准。
- 只做试算时，优先不要带 `--bump`。
