# Hooks 开发与维护参考

本文件是 hooks 深度维护入口页；命令、实现入口和经验总结拆到 `hooks-reference/`。

## 先看这些

- [真实 CLI 验证](./hooks-reference/verification.md)
- [实现入口](./hooks-reference/implementation.md)
- [维护经验](./hooks-reference/lessons.md)

## 适用场景

- 你在改 hooks runtime、本地托管配置、bridge 去重、adapter hook 接入。
- 你需要真实 CLI smoke，而不是只跑单元测试。
- 你要定位三家 adapter 的实现入口或已知坑位。
