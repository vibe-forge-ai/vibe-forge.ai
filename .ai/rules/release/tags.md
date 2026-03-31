# 发布 tag 与经验

返回入口：[RELEASE.md](../RELEASE.md)

## tag 约定

- 整体发布使用 `v<version>`
- 单包发布使用 `pkg/<normalized-package-name>/v<version>`
- `normalized-package-name` 规则：去掉包名中的 `@`，并将 `/` 替换为 `-`

## 发布后经验沉淀

- 新的稳定经验或踩坑结论，发布完成后要回写文档
- 包内实现或维护经验，优先写到对应包的 `AGENTS.md`
- 跨包、跨工具的通用发布规则，只写在 [RELEASE.md](../RELEASE.md) 及其子页
