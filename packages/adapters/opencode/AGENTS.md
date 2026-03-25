# OpenCode Adapter 目录说明

- `src/runtime/common/`：纯配置与参数映射层，只做 prompt、tools、permissions、model、mcp、session record 转换，不承载进程控制
- `src/runtime/session/`：运行时层，负责 child env、skill bridge、direct/stream 会话执行与错误传播
- `src/runtime/common.ts` / `src/runtime/session.ts`：稳定入口文件，只做 re-export 或轻量路由
- `__tests__/runtime-*.spec.ts`：按能力拆分测试；公共 mock 和文件系统 helper 放在 `__tests__/runtime-test-helpers.ts`

约束：

- 单文件保持在 200 行以内；接近 160 行时优先继续拆，而不是继续堆分支
- 新增逻辑先判断属于“映射层”还是“运行时层”，不要再把两类职责混回一个文件
- 需要 mock `child_process` 的测试，mock 定义放在各自 spec 顶部；helper 不直接持有全局 mock 状态
- 修改 adapter 行为时，至少补一条对应的 runtime 或 common 回归测试
