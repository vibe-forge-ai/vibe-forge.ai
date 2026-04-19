# 本地私有规则

返回入口：[插件与数据资产](../plugins.md)

项目规则默认从 `.ai/rules/*.md` 读取。除了随项目提交的规则，也可以使用本地私有规则：

```text
.ai/rules/my-preferences.local.md
.ai/rules/debug.dev.md
```

说明：

- `*.local.md` 和 `*.dev.md` 会像普通 rule 一样参与加载。
- 仓库默认 `.gitignore` 会忽略 `.ai/rules/*.local.md`、`.ai/rules/*.dev.md` 及其子目录同名格式，避免提交到远端。
- 这些文件只存在当前用户的工作区，因此适合存放个人偏好、临时调试约束、本地环境规则。
- 如果项目通过 `__VF_PROJECT_AI_BASE_DIR__` 改了资产根目录，请在项目自己的 `.gitignore` 里为新目录添加对应忽略规则。
