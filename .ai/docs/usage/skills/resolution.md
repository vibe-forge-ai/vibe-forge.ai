# 依赖解析与运行时行为

返回上级：[skills.md](../skills.md)

## 解析顺序

Vibe Forge 会按这个顺序处理依赖与候选 skill：

1. 扫描当前 workspace 的 `.ai/skills`
2. 扫描已启用插件提供的 skills
3. 桥接支持的 home skill roots
4. 依赖解析时优先在项目和插件 skill 里按名称匹配
5. 本地未命中时，通过 `skills` CLI 搜索并安装
6. 对纯名称依赖，如果 `skills` CLI 不可用且只有 home-bridge skill 命中，才回退到 home skill
7. 把下载结果作为普通 workspace skill 加入本次资产列表
8. 对新加入的依赖继续递归解析

如果本地存在多个同名或同 slug 的 skill，会报歧义错误。遇到这种情况，建议给插件实例配置 `scope`，再在引用处使用 `scope/name`。

## 默认解析方式

本地缺失的 skill dependency 默认走 `skills` CLI，不再要求你额外配置 `skills.sh` 或私有 registry 地址。

默认情况下也**不需要**额外声明 CLI 配置。Vibe Forge 会按托管 CLI 的默认策略使用 `skills@latest`；如果某个 skill 需要指定包源或版本，直接把这些信息写进 dependency spec 本身即可。

解析时会按依赖写法选择命令：

```bash
skills find <name>
skills add <source> --skill <name> --agent universal --copy -y
```

如果依赖已经写成 `source@skill`，Vibe Forge 会直接按 source 安装；如果写成 `registry@source@skill@version`，则会把 `registry` 透传成托管 `skills` CLI 的安装源，并把 `version` 透传给 `skills add --version`；如果只写 skill 名称，则先 `find` 再挑选匹配项。

安装结果会缓存到项目 `.ai/caches/skill-dependencies/`，不会写入用户真实 home，也不会修改 `.ai/skills` 下的手写 skill。

知识库里的「技能 -> 市场」页还提供了一个一次性的 “Install via Skills CLI” 入口，适合直接连接公司内网或私有 `skills` source。这个入口不会写入 `marketplaces`；它会在当前项目里临时执行：

```bash
skills add <source> --list
skills add <source> --skill <name> --agent universal --copy -y
```

安装结果会直接导入项目 `.ai/skills`。如果需要切到特殊 npm 源，只在这次操作里填 `Registry` 即可。

## 与选择规则的关系

如果任务只显式选择父 skill：

```json
{
  "skills": {
    "include": ["app-builder"]
  }
}
```

`app-builder` 声明的依赖会自动加入同一次运行。
