# @vibe-forge/plugin-cli-skills

给 `vf` CLI 提供一组通用说明型 skills，覆盖常用命令、print 模式、权限确认与恢复会话。

主要资产：

- `vf-cli-quickstart`
- `vf-cli-print-mode`

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
