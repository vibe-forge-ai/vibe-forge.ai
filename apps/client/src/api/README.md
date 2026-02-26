# Client API 模块规范

本目录用于承载前端的 API 调用与类型定义，按领域拆分并统一复用请求基建。

## 目录结构

- `base.ts`: 服务地址解析与通用请求封装
- `automation.ts`: 自动化规则与运行记录
- `config.ts`: 配置读取与更新
- `knowledge.ts`: 知识库与规则说明
- `projects.ts`: 项目列表与创建
- `sessions.ts`: 会话与消息
- `types.ts`: 跨模块共享的响应类型

## 新增或修改 API 的标准流程

1. 选择对应领域文件（若不存在，先创建新模块文件）。
2. 明确接口类型，优先复用 `@vibe-forge/core` 的类型，避免 `any` 和不明确类型。
3. 使用 `base.ts` 中的 `fetchApiJson` / `fetchApiJsonOrThrow` 统一请求逻辑与错误处理。
4. 在 `src/api.ts` 中 reexport，并为该模块添加说明注释。
5. 如涉及 SWR 的直接路径请求，确保路径仍以 `/api/...` 为前缀，避免手动拼接服务地址。

## 约定

- 类型只在必要位置导出，跨模块复用的类型应集中放到 `types.ts`。
- 返回结构保持与服务端一致，若后端契约变更需同步更新类型。
