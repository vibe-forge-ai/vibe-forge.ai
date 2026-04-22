# Skills registry 细节

返回入口：[Skills 与依赖](../skills.md)

这页说明远程 skill 依赖 registry 的接口、缓存位置和下载安全约束。

## Registry 协议

Registry 需要兼容 Vercel Skills Hub 的两个接口：

```text
GET /api/search?q=<skill-name>&limit=10
GET /api/download/<owner>/<repo>/<skill-slug>
```

搜索接口返回的 skill 项应包含可解析的 `source` 和 skill id 信息。下载接口返回文件列表，且必须包含 `SKILL.md`。

Vibe Forge 会拒绝下载包里的绝对路径和 `..` 路径，避免远程文件写出缓存目录。

## 缓存位置

远程依赖会写入项目数据资产目录的 cache：

```text
.ai/caches/skill-dependencies/
```

缓存目录按 registry、source 和 skill slug 分组。已有完整 `SKILL.md` 时会直接复用缓存；首次下载会先写入临时目录，再在锁内切换到目标目录。

这个过程不会写入用户真实 home，也不会修改 `.ai/skills` 下的手写 skill。
