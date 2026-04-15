# Adapter 原生插件架构

返回入口：[USAGE.md](../USAGE.md)

这页只讲 adapter-native 插件在 Vibe Forge 里的角色、边界和运行方式；具体安装与配置方式见 [使用说明](../../docs/usage/native-plugins.md)。

## 定位

adapter-native 插件不是顶层 `plugins` 里的统一 Vibe Forge 插件。

它的目标是：

- 接住 adapter 自己的原生插件格式
- 把可复用能力转进项目统一资产层
- 在运行时把原生资产放到 adapter 能识别的位置并启用

## 分层

这套能力分成三层：

1. `adapter installer`
   负责理解某个 adapter 的原生插件格式、安装源和 marketplace 语义。
2. `managed plugins`
   负责把安装结果物化到项目里的 `.ai/plugins`，并记录托管元数据。
3. `adapter runtime`
   负责在任务启动前把项目里的原生资产同步到 adapter 运行环境，例如 mock home 或 session cache。

## 生命周期

### 1. 安装

执行 `vf plugin --adapter <adapter> add ...` 时：

- 先由 adapter installer 解析 source
- 再把原生插件快照安装到 `.ai/plugins/<slug>/native`
- 把可转换的能力转到 `.ai/plugins/<slug>/vibe-forge`
- 写入 `.vf-plugin.json`，作为后续同步和运行时加载的记录

### 2. 声明式同步

项目可以在 `marketplaces.<name>.plugins` 里声明希望默认存在的 marketplace 插件。

在 `vf run` 创建新会话时：

- 会先同步缺失或需要更新的已声明插件
- 然后再解析 workspace assets
- `resume` 不会重新同步，避免同一会话中途漂移

### 3. 运行时启用

adapter 启动任务时会读取 `.ai/plugins` 中对应 adapter 的原生插件，并把它们放到 adapter 自己的生效目录中。

对 Claude 来说，目前会：

- 把项目 skills 同步到 mock home 下的 Claude skills 目录
- 把已安装的 Claude 原生插件 stage 到 session cache
- 通过 Claude 的原生启动参数启用这些插件

## 当前支持范围

- 当前完整支持的 adapter-native 插件安装链路只有 `claude-code`
- `marketplaces.<name>.plugins` 的声明式同步也只对 `claude-code` 生效
- `codex`、`opencode` 后续应复用同一套 managed plugin 规范，再各自实现 installer 和 runtime 适配

## 设计边界

- `.ai/rules` 负责说明现有架构、边界和维护约束
- `.ai/docs` 负责面向用户的具体用法、配置示例和安装说明
- 用户不需要理解原生插件的内部目录，只需要知道 Vibe Forge 会在项目侧抹平这层差异

## 继续阅读

- [使用说明](../../docs/usage/native-plugins.md)
- [Marketplace 详细示例](../../docs/usage/native-plugins/marketplaces.md)
- [插件与数据资产](./plugins.md)
