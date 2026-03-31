# 组件与数据

返回入口：[FRONTEND-STANDARD.md](../FRONTEND-STANDARD.md)

## 组件结构

- 业务组件放在 `src/components/` 下。
- 每个组件包含 `.tsx` 和对应的 `.scss` 文件。
- `.tsx` 第一行引入对应样式，例如 `import './ComponentName.scss'`。
- 单一组件文件超过 400 行时，拆成目录结构，并在目录下用 `index.tsx` 聚合导出。

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
    status: value => value === 'all',
  },
})
```
