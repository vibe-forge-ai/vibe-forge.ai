---
name: create-entity
description: 根据用户需求创建新的 Vibe Forge entity，包含命名、文件布局、frontmatter、继承、规则和技能引用。
---

在用户要求“创建实体”“新增 agent/entity”“按某个角色沉淀实体”“把当前工作流变成实体”时使用这个 skill。

如果用户要求修改已有实体，使用 `update-entity`。

## 目标

把用户的自然语言需求转成可运行、可维护的 Vibe Forge entity。完成后，项目里应该出现一个清晰命名的实体定义，必要时配套默认 prompt 文件、规则引用、技能引用和继承关系。

## 信息收集

开始前先收敛这些信息；如果用户已经给出，就不要重复询问：

- 实体的职责：它负责什么问题、什么时候应该被选择。
- 使用场景：开发、评审、验证、调研、文档、运维或项目特定流程。
- 输出风格：汇报格式、语气、详略、是否优先列风险或结论。
- 能力边界：它不该做什么，什么时候应该交还给用户或其他实体。
- 可复用资产：是否应继承已有实体，是否需要引用已有 rules、skills、MCP server 或 tool filter。

如果需求仍然模糊，先用一个保守实体落地，再在 final answer 里列出可继续补充的字段。

## 资产检查

创建前先检查当前项目已有资产：

- 本地实体目录：避免实体名冲突，并观察本项目实体写法。
- 本地 rules 目录：优先引用已有规则，不要重复复制规则正文。
- 本地 skills 目录：优先引用已有技能，不要把大型操作流程塞进 entity prompt。
- 插件实体：如果项目启用了插件并配置了 scope，继承时使用 `scope/name`，例如 `std/dev-reviewer`。

不要凭空引用不存在的 rule 或 skill。确实需要新增配套资产时，先确认用户需求是否要求一起创建；否则在结果里说明缺口。

## 实体目录定位

不要硬编码 `.ai`。先解析本地资产根目录和实体目录，再创建文件：

- `__VF_PROJECT_AI_BASE_DIR__=.vf` 时，本地资产根目录从 `.ai` 变成 `.vf`。
- `__VF_PROJECT_AI_ENTITIES_DIR__=agents` 时，实体目录从 `<asset-root>/entities` 变成 `<asset-root>/agents`。
- 如果不确定配置，先检查 `.env` 和现有实体目录；仍不确定时使用默认 `.ai/entities/`。
- 后文的 `<entity-dir>` 指解析后的本地实体目录，不一定是 `.ai/entities`。

新实体只能写入当前项目的本地实体目录。不要修改这些上游或受管理位置：

- `node_modules/**`
- `packages/plugins/**`
- `<asset-root>/plugins/**/vibe-forge/**`
- 任意插件包或 marketplace 同步下来的实体文件

如果用户想“改某个插件实体”，创建一个本地派生实体，并用 `extends: scope/name` 继承插件实体。

## 文件布局

优先使用目录型实体：

```text
<entity-dir>/<entity-name>/README.md
```

当实体提示较长，或需要拆分身份、人格、记忆时，继续使用默认会被加载的文件：

```text
<entity-dir>/<entity-name>/INTRODUCTION.md
<entity-dir>/<entity-name>/PERSONALITY.md
<entity-dir>/<entity-name>/MEMORY.md
```

简单实体可以使用单文件：

```text
<entity-dir>/<entity-name>.md
```

命名使用 kebab-case，例如 `frontend-reviewer`、`release-coordinator`。名称应体现角色和场景，不要使用 `new-entity`、`agent1` 这类临时名。

## Frontmatter 模板

`README.md` 的 frontmatter 保持可读、最小够用：

```yaml
---
name: frontend-reviewer
description: 评审前端交互、样式、focus、主题和移动端布局风险的实体。
tags:
  - frontend
  - review
extends:
  - std/dev-reviewer
inherit:
  prompt: append
  rules: merge
  skills: merge
  tools: replace
  mcpServers: replace
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

字段使用原则：

- `description` 必须能让路由提示判断什么时候选择这个实体。
- `extends` 用于复用已有实体；插件实体用 `scope/name`。
- `inherit` 只控制当前实体如何继承父实体组合结果；默认不需要显式写满，只有需要强调策略时再写。
- `rules` 引用长期约束，适合稳定规范和边界。
- `skills` 引用可复用流程，适合较长的操作方法或工具工作流。
- `tools`、`mcpServers` 只在用户明确要求限制或开放能力时写。
- `plugins` 只在当前实体确实需要任务级插件覆盖时写，不要为了继承父实体而写。

## Prompt 写法

实体正文聚焦角色行为，不写宣传语。建议结构：

```markdown
# 角色

你是前端评审实体，负责发现交互、样式、focus、主题、可访问性和移动端布局风险。

## 工作方式

- 先读需求和改动范围，再检查用户可见行为。
- 优先输出会导致真实用户受影响的问题。
- 对每个问题给出证据、影响、建议修复方向。

## 边界

- 不替代实现实体直接改代码，除非用户明确要求。
- 不复述父实体已经覆盖的通用评审规则。
```

写作要求：

- 角色、职责、流程和边界要具体。
- 避免泛化的“你是一个专业助手”。
- 如果使用 `extends`，正文只写差异化补充，不要复制父实体内容。
- 用户给出团队偏好、历史记忆或固定口吻时，放到 `MEMORY.md` 或 `PERSONALITY.md`，不要塞进规则文件。
- 不写密钥、账号、个人隐私或一次性临时信息。

## 继承设计

当用户希望基于已有实体创建新实体时：

- 需要复用已有能力、避免复制插件内容或避免改上游实体时，使用 `extends`。
- 单父实体：`extends: std/dev-reviewer`。
- 多父实体：按用户期望的基础能力顺序写成列表，后面的父实体覆盖前面父实体的保守字段。
- 默认让 prompt 追加、rules/skills/tags 合并。
- 如果用户明确说“只保留新实体自己的规则”，用 `inherit.rules: replace`。
- 如果用户明确说“完全不要继承某字段”，用对应字段的 `none`。
- 子实体正文只写差异化补充，不要复制父实体正文。
- 插件实体引用必须使用已配置的 scope，例如 `std/dev-reviewer`；不要写插件包源码路径。

不要为父实体之间的每个字段设计单独策略；这是高级继承设计，应留给后续方案。

## 完成检查

交付前检查：

- 实体文件路径符合 `<entity-dir>/<name>/README.md` 或 `<entity-dir>/<name>.md`。
- frontmatter YAML 可解析，`description` 清楚。
- 引用的 `extends`、`rules`、`skills` 名称真实存在，或在结果里说明还需要补。
- 如果创建了默认 prompt 文件，内容不会重复 `README.md`。
- 没有覆盖用户已有实体，除非用户明确要求更新。
- 没有修改插件包、managed plugin 或其他上游来源的实体文件。

可运行验证时，优先执行与改动范围匹配的测试；只想手动冒烟时，可以用：

```bash
vf run --entity <entity-name> --print "说明这个实体的职责和边界"
```
