# Client 目录说明

- `src/App.tsx`：客户端根入口，负责挂载主题、全局订阅、侧边栏导航和应用壳。
- `src/routes/`：页面级 route 入口，只处理 URL、路由参数、页面装配和少量 route 级数据获取。
- `src/components/layout/`：全局布局组件，当前放置 `AppShell` 这类应用骨架。
- `src/components/`：可复用视图组件和页面内部面板，不承担路由匹配职责。
- `src/components/chat/`：聊天页子视图，包含 header、history、timeline、settings、sender 和工具渲染。
- `src/hooks/`：跨页面通用 hooks；`src/hooks/chat/` 专门承载聊天会话相关状态和交互逻辑。
- `src/api/`：HTTP API 封装与响应类型，页面和 hooks 统一通过这里访问后端。
- `src/store/`：全局状态原子。
- `src/resources/`：静态资源、适配器元数据和 i18n 文案。
- `src/styles/`：全局样式入口。

## 约定

路由分层：

- 新增页面入口时，优先放在 `src/routes/`。
- route 组件可以读取 `useParams`、`useNavigate`、query params，并做页面级数据装配。
- 纯展示或可复用 UI 不要放在 `src/routes/`，应放回 `src/components/`。

布局分层：

- 全局布局和页面外壳统一放在 `src/components/layout/`。
- 不要再创建 `components/app/routes` 这类把布局和路由混放的目录。

聊天页约定：

- 聊天页面入口统一由 route 组件承接，当前为 `src/routes/ChatRoute.tsx`。
- `ChatRoute` 负责 `/` 与 `/session/:sessionId` 的合并入口、会话解析和空态处理。
- `src/components/chat/` 只保留聊天页面内部视图，不再单独维护旧式 route wrapper。

数据流约定：

- 页面级列表或详情拉取优先放在 route 或对应页面 hook 中，不要散落在纯展示组件内。
- API 请求统一走 `src/api/`，避免在组件里直接手写 `fetch`。
- 能复用的状态逻辑优先抽到 hooks，不在 route 和 view 间复制业务逻辑。
