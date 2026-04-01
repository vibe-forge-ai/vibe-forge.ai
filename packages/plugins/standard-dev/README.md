# @vibe-forge/plugin-standard-dev

标准开发流插件，提供一组常用研发实体和一个统一调度 skill。

推荐配置：

```json
{
  "plugins": [
    {
      "id": "standard-dev",
      "scope": "std"
    }
  ]
}
```

建议使用 scope，避免和项目内已有的 `reviewer`、`developer` 等资源重名。

主要资产：

- `standard-dev-flow` spec
- `standard-dev-flow` skill
- `dev-planner` entity
- `dev-implementer` entity
- `dev-reviewer` entity
- `dev-verifier` entity
