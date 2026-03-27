# `src` 目录说明

hooks 相关改动先交叉看：

- `../AGENTS.md`
- `../../../docs/HOOKS.md`
- `../../../docs/HOOKS-REFERENCE.md`

## 入口层

- `index.ts`：adapter 包对外入口，只负责导出 `init` / `query` 能力
- `init.ts`：初始化阶段逻辑；只放启动前检查或一次性准备，不混入会话执行分支
- `paths.ts`：CLI binary 路径解析
- `models.ts` / `icon.ts` / `schema.ts`：展示或元数据层，不承载运行时逻辑
- `adapter-config.ts`：adapter 自身配置 schema 和类型

## Runtime 分层

- `runtime/common/`：纯映射层
- 负责 prompt、tools、permissions、model、mcp、inline config、session list parsing
- 不直接读写文件系统，不启动子进程，不维护会话状态

- `runtime/session/`：执行层
- 负责 child env、skill bridge、OpenCode 进程启动、direct/stream 会话控制、错误传播
- 可以依赖 `runtime/common/`，反向依赖不允许出现

- `runtime/common.ts` / `runtime/session.ts`
- 仅作为稳定入口和 re-export 路由
- 新逻辑不要继续堆回这两个文件
- `runtime/native-hooks.ts`
- `runtime/session/child-env.ts`
- `runtime/session/skill-config.ts`
- `runtime/session/stream.ts`
- `runtime/common/tools.ts`
  - 这几处共同决定 OpenCode native hooks、session config dir 和 JSON 事件流

## 依赖方向

- `src/*` 可以依赖 `runtime/*` 吗：不建议。公共入口只做装配。
- `runtime/session/*` 可以依赖 `runtime/common/*`
- `runtime/common/*` 不应依赖 `runtime/session/*`
- 测试 helper 只能放在 `__tests__/runtime-test-helpers.ts`，不要从 `src` 反向引用测试代码

## 修改约束

- 单文件保持在 200 行以内；接近 160 行就优先继续拆模块
- 新增参数适配时，先判断它属于“映射层”还是“执行层”，不要跨层散落
- 涉及 OpenCode CLI 参数、env、session resume 语义的改动，至少补一条 runtime 回归测试
- 涉及 permissions / tools / model / mcp 映射的改动，至少补一条 common 回归测试
- 若新增目录，先在本文件补一句职责说明，再落代码
- hooks 改动不要只跑单测，至少再按 `../AGENTS.md` 里的真实 CLI 路径补一轮 smoke
