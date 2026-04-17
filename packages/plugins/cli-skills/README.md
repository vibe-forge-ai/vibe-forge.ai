# @vibe-forge/plugin-cli-skills

给 `vf` CLI 提供一组通用说明型 skills，覆盖常用命令、config 子命令、print 模式、权限确认与恢复会话。

主要资产：

- `vf-cli-quickstart`
- `vf-cli-print-mode`

其中：

- `vf-cli-quickstart` 负责解释 `vf run` / `vf list` / `vf --resume`，以及 `vf config list|get|set|unset` 的基本用法。
- `vf config` 的读命令默认面向 merged config；文本模式输出 YAML。
- `vf config get models` / `vf config list models` 在文本模式下会把 `modelServices` 和 `models` metadata 合成可读视图；`--json` 仍返回原始配置结构。

典型接入方式：

```json
{
  "plugins": [
    {
      "id": "@vibe-forge/plugin-cli-skills"
    }
  ]
}
```

`@vibe-forge/cli` 会默认注入这个插件，所以通过 CLI 运行时通常不需要再手动配置。
