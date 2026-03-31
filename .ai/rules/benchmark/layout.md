# Benchmark 目录与输入

返回入口：[BENCHMARK.md](../BENCHMARK.md)

## Case 目录

每个 case 的目录固定为：

```text
.ai/benchmark/<category>/<title>/
  rfc.md
  patch.diff
  patch.test.diff
```

- `category`：可共享同一 benchmark workspace 的用例集合。
- `title`：单个任务用例名，建议 kebab-case。
- 一个目录只表示一个 case。

## 运行目录

```text
.ai/worktress/benchmark/<category>/
.ai/results/<category>/<title>/result.json
```

- `.ai/worktress/benchmark/<category>/` 是 category 级共享 workspace。
- `.ai/results/<category>/<title>/result.json` 是 case 级唯一结果文件。

## 输入文件

### `rfc.md`

- 同时承载 frontmatter 和任务目标正文。
- 最小字段：
  - `base_commit`
  - `setup_command`
  - `test_command`
  - `timeout_sec`
- 不引入 `tags`、`difficulty`、`allow_paths`、`forbid_paths` 这类额外约束字段。

### `patch.diff`

- 参考实现，用于辅助 judge 理解目标行为。
- 必须能在 `base_commit` 上 clean apply。
- 不作为唯一正确答案。

### `patch.test.diff`

- 验收测试补丁，用来形成统一验收标准。
- 必须优先验证外部行为，而不是绑定参考实现细节。
- 必须能同时验证参考实现和等价实现。
