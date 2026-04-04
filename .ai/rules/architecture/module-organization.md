# 模块拆分与落点

返回入口：[ARCHITECTURE.md](../ARCHITECTURE.md)

## 目标

本文件定义仓库通用的模块拆分与代码落点规则。

它回答两个问题：

- 模块应该怎么拆，避免持续平铺和职责混杂
- 一段代码到底该落在模块内、应用内，还是共享 package

这是一条全仓约束，不是前端特例。前端的 `@components / @core / @hooks / @types / @utils / @store` 只是这条通用规则在 UI 模块中的具体落地形式。

## 先做哪层判断

写代码前先按下面顺序判断：

1. 这段代码是当前模块私有的吗？
2. 它会被当前应用内其他模块复用吗？
3. 它会被多个 app / package 共享吗？
4. 它是视图、编排、类型、状态、工具，还是运行时入口？

不要一上来只按“文件名像不像组件”决定位置。

## 第一层：放在哪个边界

### 模块私有

如果代码明显绑定某个功能模块，只被这个模块使用，就放在模块目录内部。

适用场景：

- sender 私有的提交编排
- 某个 settings 面板自己的 selector 逻辑
- 某个 route 页面自己的 filter state

### 应用内通用

如果代码会被当前 app 内多个模块复用，但没有跨 app 共享价值，就放在当前 app 的公共目录。

适用场景：

- `apps/client/src/components/...`
- `apps/client/src/hooks/...`
- `apps/client/src/store/...`
- `apps/server/src/services/...`

### 仓库级共享

如果代码会被多个 app / package 共同依赖，或者已经属于共享 contract / runtime / schema 语义，就上提到 `packages/*`。

适用场景：

- 公共类型、schema、contract：`packages/types`、`packages/core`
- 公共配置加载：`packages/config`
- 公共工具：`packages/utils`
- 共享运行时能力：`packages/task`、`packages/hooks`、`packages/benchmark`

## 第二层：模块内部怎么拆

模块不要长期平铺几十个文件。模块一旦开始复杂，就应该继续按职责拆分。

### 通用原则

- 模块根目录只保留入口、总样式和极少量必须与入口强绑定的文件。
- 模块私有实现继续按职责分目录，不要把视图、编排、状态、类型、工具重新打平。
- 如果某块功能已经形成稳定子语义，先建子模块目录，再继续拆。

### 前端模块

前端业务模块优先使用：

- `@components/`：模块私有视图组件
- `@core/`：模块核心编排与纯逻辑
- `@hooks/`：模块私有 hooks
- `@types/`：模块私有类型
- `@utils/`：模块私有工具与常量
- `@store/`：模块私有状态

### Server 模块

Server 侧优先遵循已有分层，不发明前端式目录名：

- `routes/`、`websocket/`、`channels/`：协议入口与适配
- `services/`：服务编排、运行态、跨入口复用逻辑
- `db/`：schema、repo、持久化

如果某个 server 领域继续膨胀，也应先在该领域目录下继续按职责拆，而不是把文件持续堆在单个 service 或 route 旁边。

### 共享 package 模块

共享 package 优先按领域和公开边界拆分：

- 对外公开的 contract、类型、schema、helper 保持清晰出口
- 内部实现按 domain / runtime / loader / adapter-support 等语义拆目录
- 不通过深层私有路径跨 package 复用

## 代码放置决策表

### 视图代码

- 只服务当前模块：放模块私有视图目录
- 当前 app 内多个模块复用：放当前 app 的 `components/`
- 多 app 共享：通常不直接共享 UI；先确认是否真需要共享，再考虑抽公共 package

### 编排与纯逻辑

- 只服务当前模块：放模块私有 core
- 当前 app 内复用：放 app 内公共 domain/core/helper 目录
- 多 app / package 共享：提升到 `packages/*`

### Hook

- 只服务当前模块：放模块私有 hook 目录
- 当前 app 多模块复用：放 `src/hooks/<domain>/`
- 多 app / runtime 共享：通常不要直接共享前端 hook；重新判断是否其实是通用逻辑/contract

### 类型

- 只服务当前模块：放模块私有类型目录
- 当前 app 多模块共享：放 app 内公共类型文件
- 多 app / package 共享：放 `packages/types` 或 `packages/core`

### 工具函数与常量

- 只服务当前模块：放模块私有 utils
- 当前 app 复用：放 `src/utils/`
- 全仓共享：放 `packages/utils`

### 状态

- 只服务当前模块：放模块私有 store/state
- 当前 app 全局共享：放 app 级 `store/`
- 跨 app 共享状态语义：上提为共享 contract 或公共逻辑，不直接共享 app store 实现

## 什么时候应该上提

满足下面任一条件，就不该继续留在模块私有目录：

- 已经有第二个模块要复用
- 代码脱离当前模块后语义仍然清晰
- 继续复制比抽象更贵
- 它表达的是共享 contract，而不是局部实现细节

## 什么时候不要上提

不要因为“以后可能复用”就提前抽公共层。以下情况优先留在模块内部：

- 仍然强依赖当前模块命名和状态
- 只是在当前任务里暂时被两个局部文件共用
- 抽出去会让公共目录出现大量低复用、强业务语义代码

## 子模块规则

如果模块内部出现一组明显同前缀、同职责、同交互的文件，不要继续平铺。

典型信号：

- 文件名开始出现一串相同前缀，如 `ModelSelect*`
- 同一块功能已经有 3 个以上文件
- 同一块功能同时包含样式、视图、逻辑、类型

此时应建子模块目录，例如：

- `model-select/`
- `reference-actions/`
- `sender-toolbar/`

子模块内部继续遵循同样的拆分原则。

## 设计约束

- 先拆职责，再抽复用；不要反过来。
- 入口层不重复实现共享 runtime。
- 共享层不吸收局部页面细节。
- 同一层目录里的文件应该具有一致语义，不要“顺手塞一个不相关的 helper”。
- 当一个文件开始同时承担视图、状态、编排、类型、工具四五种角色时，应立即拆分，而不是继续追加条件分支。

## 与现有仓库结构的关系

- 应用层、共享层、扩展实现层的边界，继续以 [layers.md](./layers.md) 为准。
- 本文档补充的是“到某一层之后，模块内部继续怎么拆”。
- 前端具体目录名与例子，继续看 `frontend-standard/module-organization.md`。
