# 项目维护指南 (Maintenance)

## 开发环境启动

在根目录下运行：

- `pnpm dev`: 同时启动前端和后端（需配置对应的并行脚本，或分别在各目录下运行）。
- 后端启动: `cd apps/server && pnpm dev` (支持热重载)。
- 前端启动: `cd apps/web && pnpm dev` (支持 HMR)。

## 常见维护任务

### 0. 代码质量检查与格式化 (Tooling)

在进行任何提交或重大修改前，应运行以下指令确保代码质量：

- **Lint 检查**: `npx eslint .`
  - 场景：检查代码风格、潜在错误和类型安全（如 `strict-boolean-expressions`）。
  - 注意：项目使用 `@antfu/eslint-config`，对 `Promise` 处理、`any` 使用和显式空值检查有严格要求。
- **代码格式化**: `npx dprint fmt`
  - 场景：统一代码格式。
- **类型检查**: `pnpm -r exec tsc --noEmit`
  - 场景：在重构或修改共享包 (`packages/core`) 后，确保全量类型安全。
- **单元测试**: `pnpm test` (或 `npx vitest`)
  - 场景：修改核心逻辑或 API 适配器后验证功能正确性。

### 1. 修改后端 API

- 路由定义位于 `apps/server/src/routes/`。
- 如果涉及数据模型变更，请同步更新 `apps/server/src/db.ts` 中的 SQL 表结构定义以及 `apps/server/src/types.ts`。

### 2. 修改前端样式

- 样式文件采用 `.scss`，与组件同名放置在 `src/components/` 下。
- 全局样式位于 `src/styles/global.scss`。

### 3. 环境参数配置

- 环境变量通过 `.env` 文件或 shell 传入。
- 后端参数参考 `apps/server/src/env.ts`，如 `DB_PATH` 可用于指定数据库存储位置。
- 前端参数以 `VITE_` 开头，参考 `apps/web/src/vite-env.d.ts`。

### 4. 更新国际化文本

- 中文文本修改：编辑 `apps/web/src/resources/locales/zh.json`。
- 英文文本修改：编辑 `apps/web/src/resources/locales/en.json`。
- 如果添加了新的 Key，请确保在两个文件中都进行添加，以保证多语言支持的完整性。

## 注意事项

- **持久化**: 数据库文件默认存储在 `~/.vf/db.sqlite`，可以使用标准的 SQLite 客户端进行查看和维护。
- **原生依赖**: `better-sqlite3` 是原生依赖，安装时需确保环境具备编译能力。在 `pnpm` 模式下已通过 `onlyBuiltDependencies` 进行配置。
- **类型安全**: 共享类型建议在各自目录的 `types.ts` 中定义，保持前后端接口定义一致。
