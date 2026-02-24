---
name: 🧑‍💻 开发代码
description: 开发代码时需要遵守的标准交付步骤，可以与其他特殊流程组合完成复杂开发任务的交付。
rules:
  - "${workspaceFolder}/.ai/rules/项目结构.md"
  - "${workspaceFolder}/.ai/rules/如何进行任务规划.md"
skills:
  include:
    - version-control
params:
- name: REVIEWER_RUNTIME_TYPE
  description: 需求分析时的运行时，默认使用 claude-code，可以使用：claude-code。
---

# 开发代码

创建如下的 TODO 计划并跟踪进度：

1. 技术方案生成
2. 技术方案确认
3. 分支切出切入
4. 完成功能代码
5. 完成测试代码
6. 代码结果检查
7. 代码结果确认
8. 工作总结分析
9. 代码提交推送

计划创建完成后调用 AskUserQuestion 工具，确认计划是否符合预期。
