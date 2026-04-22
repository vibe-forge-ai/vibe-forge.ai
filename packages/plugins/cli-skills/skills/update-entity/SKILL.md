---
name: update-entity
description: 根据用户需求更新已有 Vibe Forge entity，保持最小改动并维护 prompt、frontmatter、继承、规则和技能引用。
---

在用户要求“更新实体”“调整 entity/agent”“给某个实体加规则/技能/记忆”“把实体改成继承另一个实体”“重命名或拆分已有实体”时使用这个 skill。

如果用户要求创建全新的实体，使用 `create-entity`。

## 目标

先读懂已有实体的职责和资产关系，再按用户需求做最小、可验证的更新。不要把更新任务当成重写任务；默认保留用户已有内容、命名、文件布局和引用关系。

## 更新前检查

先确认目标实体：

- 不要硬编码 `.ai`。先定位本地资产根目录和实体目录。
- 默认实体目录是 `.ai/entities/`；如果 `.env` 设置了 `__VF_PROJECT_AI_BASE_DIR__` 或 `__VF_PROJECT_AI_ENTITIES_DIR__`，按实际资产根目录和实体目录查找。
- 在本地实体目录查找同名实体，包含 `<name>.md`、`<name>/README.md` 和 `<name>/index.json`。
- 如果文件名和实体名不一致，继续看 frontmatter 或 JSON 里的 `name` 字段。
- 如果用户只给了模糊名字，先看实体 `description`、目录名和路由名，找到最可能的目标。
- 如果存在本地实体和插件实体同名，优先更新本地实体；插件实体不要直接修改，改用本地实体 `extends` 插件实体。
- 如果用户要求更新插件实体，建议创建或更新本地派生实体，例如 `extends: std/dev-reviewer`。

不要直接修改这些上游或受管理位置：

- `node_modules/**`
- `packages/plugins/**`
- `<asset-root>/plugins/**/vibe-forge/**`
- 任意插件包或 marketplace 同步下来的实体文件

如果目标只存在于插件或上游来源，创建一个本地派生实体；如果本地已经有派生实体，就更新派生实体。

继续检查关联资产：

- `README.md` 或实体单文件：主体 prompt 和 frontmatter。
- `INTRODUCTION.md`、`PERSONALITY.md`、`MEMORY.md`：目录型实体的默认加载文件。
- `rules`：实体引用的长期约束。
- `skills`：实体引用的可复用流程。
- `extends` / `inherit`：实体继承关系。

## 更新策略

按用户真实意图选择最小变更：

- 改职责：优先更新 `description` 和正文里的角色/边界。
- 改行为风格：优先更新 `PERSONALITY.md`，没有该文件时再考虑正文。
- 追加长期偏好或历史约定：优先更新 `MEMORY.md`。
- 增加稳定规范：优先引用或新增 rule，不要把大段规则塞进 prompt。
- 增加可复用操作流程：优先引用或新增 skill，不要把长流程塞进 entity。
- 基于已有实体改造：优先加 `extends` 和少量差异化 prompt。
- 不想继承某字段：使用 `inherit.<field>: replace` 或 `none`，不要复制父实体再删内容。
- 如果目标是插件实体或共享上游实体，绝不直接编辑上游文件；用本地实体覆盖差异。

只有用户明确要求“重写”“重构”“替换整个实体”时，才大幅改写 prompt。

## Frontmatter 更新

常见字段：

```yaml
---
description: 更准确地描述这个实体何时应该被选择。
extends:
  - std/dev-reviewer
inherit:
  rules: replace
rules:
  - frontend-standard
skills:
  - frontend-review
tools:
  include:
    - Read
    - Grep
---
```

维护原则：

- `description` 要面向路由选择，说明使用场景和职责。
- `extends` 引用插件实体时使用 `scope/name`，例如 `std/dev-reviewer`。
- `inherit` 只写需要偏离默认行为的字段。
- 添加 `rules` / `skills` 前先确认目标资产存在。
- 不要因为要继承父实体而写 `plugins`。

`extends` 设计原则：

- 只是补充项目差异时，加或保留 `extends`，不要复制父实体正文。
- 多父实体按列表顺序组合，顺序要反映能力优先级。
- 当前实体的 `inherit` 只控制自己如何继承父实体组合结果。
- 不要在更新任务里引入高级 per-parent 策略。

## Prompt 更新

更新正文时：

- 保留原有有效结构，不为了统一模板重排整篇。
- 新增内容放到最贴近的段落。
- 删除内容前确认它和用户新需求冲突。
- 如果已有父实体覆盖通用职责，子实体正文只写差异化补充。
- 避免同时在 `README.md`、`INTRODUCTION.md`、`PERSONALITY.md`、`MEMORY.md` 重复同一句话。

目录型实体推荐分工：

- `README.md`：角色、职责、工作方式、边界。
- `INTRODUCTION.md`：更详细的背景或接入说明。
- `PERSONALITY.md`：表达风格、判断偏好、沟通顺序。
- `MEMORY.md`：项目长期约定、用户偏好、历史经验。

## 重命名或拆分

用户要求重命名实体时：

- 同步更新文件或目录名。
- 如果 frontmatter 里有 `name`，同步更新。
- 检查其他实体、spec、文档里是否引用旧名。
- 在结果里明确旧名和新名。

用户要求拆分实体时：

- 先保留原实体的核心职责。
- 新实体只承接被拆出去的职责。
- 如需复用共同能力，考虑让两个实体继承同一个父实体。

## 完成检查

交付前检查：

- 没有覆盖无关的用户内容。
- frontmatter YAML 可解析。
- `description` 仍然能准确触发路由选择。
- `extends`、`rules`、`skills` 引用存在且不歧义。
- 默认 prompt 文件之间没有明显重复。
- 如果改了继承关系，确认没有形成循环。
- 没有修改插件包、managed plugin 或其他上游来源的实体文件。

可运行验证时，优先执行与改动范围匹配的测试；只想手动冒烟时，可以用：

```bash
vf run --entity <entity-name> --print "说明这个实体更新后的职责和边界"
```
