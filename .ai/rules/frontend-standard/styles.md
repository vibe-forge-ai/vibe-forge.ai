# 样式与类名

返回入口：[FRONTEND-STANDARD.md](../FRONTEND-STANDARD.md)

## 样式拆分

- 每个组件拥有独立 `.scss` 文件，并在 `.tsx` 中显式引入。
- 禁止把大量无关样式堆在单个大 `.scss` 文件里。
- 静态样式禁止写在 `style={{...}}`；只有运行时必须计算的属性才允许行内样式。

## 设计取向

- 多用图标，少堆重复提示文案。
- 样式保持简约，避免过度装饰和过深层级。
- 只渲染当前任务真正需要的信息。

## 类名规范

- 类名使用 kebab-case，例如 `.chat-message-item`。
- 组件根节点类名建议与文件名语义一致。
- 推荐使用 BEM 配合 SCSS 嵌套：
  - Block：`.a-b-c`
  - Element：`.a-b-c__d-e`
  - Modifier：`.a-b-c--active`

```scss
.a-b-c {
  &__d-e {
    &--disabled {
      opacity: .5;
    }
  }

  &--active {
    border-color: var(--border-color);
  }
}
```

- 嵌套深度建议控制在 3 层以内。
- 避免使用 `div span` 这类标签嵌套选择器，优先语义化类名。
