# 模块组织

返回入口：[FRONTEND-STANDARD.md](../FRONTEND-STANDARD.md)

## 适用范围

- 仓库级通用规则先看 `../architecture/module-organization.md`。
- 本文档定义的是 `apps/client/src/` 下前端业务模块的通用组织规范。
- 这不是 `sender` 的特例；`sender` 只是当前已经按这套规范落地的一个模块示例。
- 后端或 workspace package 如果没有 `components / hooks / store` 这类前端语义，不强行套用这套目录名。

## 模块目录标准

一个前端业务模块如果开始变复杂，不要继续平铺文件，优先按职责拆成：

- `@components/`
  - 模块私有的通用视图组件。
  - 适合放：面板、表单片段、选择器、列表项、弹层内容、子模块目录。
- `@core/`
  - 模块核心实现、编排逻辑、纯业务逻辑、数据拼装。
  - 适合放：controller builder、state mapper、payload builder、runtime state、interaction state。
- `@hooks/`
  - 模块私有 hooks。
  - 适合放：状态编排、快捷键、focus restore、overlay 控制、提交逻辑。
- `@types/`
  - 模块私有类型定义。
  - 适合放：props、view model、内部状态类型、局部 contract。
- `@utils/`
  - 模块私有工具函数、常量、轻量纯函数。
  - 适合放：icon map、format helper、storage helper、纯判断函数。
- `@store/`
  - 模块私有状态。
  - 适合放：atom、zustand store、selector、action factory。

模块根目录只保留：

- 模块入口，例如 `Sender.tsx`
- 模块顶层共享样式，例如 `Sender.scss`
- 极少量必须和入口强绑定的文件

## 代码放置决策

先问这段代码是不是只服务当前模块。

- 如果不是，只要跨模块复用，就不要放模块私有目录。
- 如果是，就先放当前模块内部，再按职责分层。

继续按下面判断：

1. 这是视图吗？

- 是，只在当前模块复用：放 `@components/`
- 是，多个模块会复用：放 `src/components/<domain>/`

2. 这是 hook 吗？

- 是，只服务当前模块：放 `@hooks/`
- 是，多个模块会复用：放 `src/hooks/<domain>/`

3. 这是纯逻辑或编排吗？

- 是，只服务当前模块：放 `@core/`
- 是，多个模块会复用且不依赖具体模块语义：放 `src/utils/` 或更高层公共 domain

4. 这是类型定义吗？

- 是，只服务当前模块：放 `@types/`
- 是，多个模块共享：优先放公共模块自己的 `types.ts`、`src/types/`，或上提到 `@vibe-forge/types` / `@vibe-forge/core`

5. 这是工具函数或常量吗？

- 是，只服务当前模块：放 `@utils/`
- 是，多个模块共用：放 `src/utils/`

6. 这是状态吗？

- 是，只服务当前模块：放 `@store/`
- 是，全局共享：放 `src/store/`

## 什么时候建子模块目录

当下面任一条件成立时，不要继续在模块根目录平铺：

- 某块功能已经有明确语义边界，例如 `model-select`、`reference-actions`
- 同一块功能已经有 3 个以上文件
- 同一块功能同时包含视图、样式、逻辑或类型
- 文件名开始出现一串相同前缀，例如 `ModelSelect*`、`ReferenceActions*`

这时应先建子模块目录，例如：

- `@components/model-select/`
- `@components/reference-actions/`
- `@components/sender-toolbar/`

子模块内部继续遵循同样的规则：

- 只是一组紧邻视图和样式，可以直接平铺在子模块目录
- 如果子模块继续膨胀，再在子模块内部继续拆 `@components / @hooks / @types / @utils / @store`

## 全局目录与模块目录的边界

优先留在模块内部的情况：

- 代码明显绑定当前模块语义
- 命名离开当前模块就会变得模糊
- 复用范围还不明确，只是“可能以后会复用”
- 需要依赖模块内部状态、局部类型或局部样式

应提升到 `src/` 全局目录的情况：

- 已经有第二个模块要复用
- 代码语义脱离当前模块后依然清晰
- 不再依赖模块内部实现细节
- 复用它比复制一份更便宜、更稳定

## import 约定

- 模块入口跨子模块引用时，可以显式指向 `@components / @core / @hooks / @types / @utils / @store`
- 子模块内部如果只是引用同子模块兄弟文件，继续使用相对路径
- 不要为了少写几层路径，把不同职责目录重新打平

## sender 示例

`src/components/chat/sender/` 当前只是一个示例：

- `Sender.tsx` / `Sender.scss` 留在模块根
- 视图子块在 `sender/@components/`
- 编排逻辑在 `sender/@core/`
- sender 私有 hooks 在 `sender/@hooks/`
- sender 私有类型在 `sender/@types/`
- sender 私有工具在 `sender/@utils/`

其他复杂模块也应该按同一套规则组织，而不是继续各写各的目录风格。
