# 实体目录默认文件

返回入口：[插件与数据资产](../plugins.md)

目录型实体可以把常驻内容拆成几个默认文件：

```text
.ai/entities/reviewer/
  README.md
  INTRODUCTION.md
  PERSONALITY.md
  MEMORY.md
```

说明：

- `README.md` 或 `index.json` 仍然是实体入口，用来声明 `description`、`skills`、`rules` 等元数据。
- 当选择该实体运行任务时，会在实体主体后依次追加 `INTRODUCTION.md`、`PERSONALITY.md`、`MEMORY.md` 的内容。
- 三个默认文件都是可选的，缺失时会自动跳过。
- 文件名也兼容小写和中文形式：`introduction.md` / `介绍.md`、`personality.md` / `人格.md`、`memory.md` / `记忆.md`。
- `index.json` 里的 `prompt` / `promptPath` 也会作为主体，再追加这些默认文件。
- 单文件实体如 `.ai/entities/reviewer.md` 不会读取旁边的默认文件。
