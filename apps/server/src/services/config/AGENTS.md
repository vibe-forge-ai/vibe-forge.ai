# Config 服务目录说明

- index.ts：配置子域稳定入口，统一负责 workspace 变量、项目配置与用户配置读取和合并

边界约定：server 侧所有配置读取都经由 services/config/；routes、websocket、channels 不直接调用 loadConfig，也不自行拼接 jsonVariables。

理解路径建议：先读 index.ts，确认 workspaceFolder、jsonVariables 和 mergedConfig 的来源，再回到调用方看它们如何消费统一配置。
