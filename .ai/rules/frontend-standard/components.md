# 组件与数据

返回入口：[FRONTEND-STANDARD.md](../FRONTEND-STANDARD.md)

## 组件结构

- 模块组织规范优先看 [module-organization.md](./module-organization.md)；本页只补组件视角的约束。
- 业务组件放在 `src/components/` 下。
- 每个组件包含 `.tsx` 和对应的 `.scss` 文件。
- `.tsx` 第一行引入对应样式，例如 `import './ComponentName.scss'`。
- 单一组件文件超过 400 行时，拆成目录结构，并在目录下用 `index.tsx` 聚合导出。
- 复杂交互组件不要把 view、状态编排、快捷键、浮层逻辑、helper 全堆在一个文件里；优先先拆子组件、hooks、utils，再考虑继续增量修改。
- 模块目录不要长期平铺几十个文件；优先按职责拆成 `@components/`、`@core/`、`@hooks/`、`@types/`、`@utils/`、`@store/`。
- 模块私有 hooks 放在模块目录下的 `@hooks/`；只有跨模块复用的 hooks 才放到 `src/hooks/`。
- 子模块如果已经成形，例如 `model-select`、`sender-toolbar`，应建自己的子目录，而不是继续堆在父模块根目录。
- 如果组件已经不只服务当前页面/子目录，例如工作区文件选择器、通用状态提示，不要继续挂在局部目录里，提升到更合适的公共 `src/components/<domain>/`。

## import 组织

- 前端文件遵循固定 import group，并且 group 之间保留一个空行：
  1. 同文件样式或其他副作用 import
  2. 第三方依赖
  3. workspace 包，例如 `@vibe-forge/*`
  4. 包内绝对路径，例如 `#~/components/...`、`#~/hooks/...`
  5. 当前目录相对路径
- 跨目录引用优先走 `#~/`，不要在前端组件里堆大量 `../../`。
- 当前目录或子目录下的紧邻模块，继续使用相对路径，保持可读性。

## 数据获取

- 优先使用 SWR 做数据获取，复用统一缓存与重试行为。
- `main.tsx` 的 `SWRConfig` 负责统一 `fetcher`。

## 路由管理

- 统一使用 `react-router-dom` 的 `useNavigate` 和 `useParams`。
- 严禁手动修改 `window.location`。

## URL Query

- 统一使用 `useQueryParams` 管理 query。
- 页面里集中声明 keys、默认值与省略规则，确保链接可回放。

```tsx
const { values, update } = useQueryParams({
  keys: ['rule', 'q', 'status'],
  defaults: { rule: '', q: '', status: 'all' },
  omit: {
    rule: value => value === '',
    q: value => value === '',
    status: value => value === 'all'
  }
})
```
