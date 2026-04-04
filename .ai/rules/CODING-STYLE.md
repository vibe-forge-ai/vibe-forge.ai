---
alwaysApply: true
description: 跨仓库通用代码风格规则，约束 import 顺序、路径写法、命名与目录组织。
---

# 代码风格指导

本文档定义了本项目中的代码风格规范，特别是关于模块引入（Import）的顺序和路径格式。

## 代码引入规范

使用 `import` 或 `require` 进行代码引入时，应遵循以下规则以保持代码整洁和一致。

### 引入顺序

在无特殊情况下，请按照以下顺序组织导入语句：

#### 1. 导入类型顺序

- **整体导入**：例如 `import './xxx.ts';`
- **具体导出导入**：例如 `import { useState } from 'react';`

#### 2. 模块来源顺序

1. **Node.js 内置模块**：使用 `node:` 前缀。
   - 例如：`import fs from 'node:fs';`
2. **外部第三方模块**：
   - 例如：`import axios from 'axios';`
   - 例如：`import 'react-style/xxx.css';`
3. **项目工作区内部模块**：引用同仓库下其他 package 的内容。
   - 例如：`import { useXXX } from '@vibe-forge/core';`
4. **项目包内绝对路径**：使用 `#~/` 前缀。
   - 例如：`import { useXXX } from '#~/utils/xxx';`
5. **相对路径**：仅用于当前目录或子目录。
   - 例如：`import { useXXX } from './xxx';`

#### 3. 分组与空行

- 每个 import group 之间必须保留一个空行，不要把不同来源的 import 连成一段。
- 样式、副作用 import 放在最前面，并与后续逻辑 import 断开。
- `import type` 仍按来源归组，不因为是 type 就打乱来源顺序。
- 同一个来源如果同时存在 type/value import，保持相邻，优先 `import` 后接 `import type` 或按格式化工具要求排序，不要插到其他 group 里。

前端常见示例：

```ts
import './Sender.scss'

import { Button, Input } from 'antd'
import type { TextAreaRef } from 'antd/es/input/TextArea'
import { useTranslation } from 'react-i18next'

import type { AskUserQuestionParams } from '@vibe-forge/core'

import { useSenderController } from '#~/components/chat/sender/@hooks/use-sender-controller'
import { ContextFilePicker } from '#~/components/workspace/ContextFilePicker'

import { SenderBody } from './@components/sender-body/SenderBody'
import type { SenderProps } from './@types/sender-props'
```

---

### 导入路径格式

为了提高代码的可读性和可维护性，请根据以下场景选择合适的路径格式：

- **包内跨目录引用**：
  - 当引用的模块位于当前包空间内，且层级较深或跨越了多个功能模块时，应使用包空间绝对路径，避免出现过多的 `../`。
  - 本项目统一使用 `#~/` 作为 src 目录的映射前缀（具体配置见各包的 `package.json` 中的 `imports` 字段）。
  - 示例：在 `apps/client/src/components/chat/MessageItem.tsx` 中引用 `apps/client/src/store/index.ts` 时：
    - 推荐：`import { useStore } from '#~/store';`
    - 避免：`import { useStore } from '../../store';`

- **同级或子级引用**：
  - 对于当前目录或子目录下的模块，优先使用相对路径。
  - 示例：`import { SubComponent } from './SubComponent';`

- **跨 Package 引用**：
  - 引用本项目下其他项目空间（Workspace）导出的内容时，使用对应的包名。
  - 示例：`import { CoreType } from '@vibe-forge/core';`
  - 注：可以通过查看对应包的 `package.json` 中的 `exports` 字段了解其导出规则。

---

## 命名与组织规范

- **组件命名**：组件文件/目录使用 PascalCase（例如 `CodeBlock.tsx`, `CodeBlock.scss`），组件导出使用 PascalCase。
- **非组件命名**：工具函数、hooks、普通模块文件/目录使用 kebab-case（例如 `safe-serialize.ts`, `use-chat-session.ts`）。
- **全局 Hook 约定**：跨模块、跨页面可复用的 Hook 放在 `src/hooks/` 下，并按域拆分子目录（例如 `src/hooks/chat/`）。
- **通用模块归档**：
  - 通用组件放在 `src/components/` 下，通过 `#~/components/...` 引用（例如 `#~/components/CodeBlock`），避免跨层级 `../../`。
  - 通用工具函数放在 `src/utils/` 下，通过 `#~/utils/...` 引用。
- **模块目录规范**：
  - 前端业务模块的完整落点规则见 `frontend-standard/module-organization.md`。
  - 页面或功能模块内部，统一使用职责目录收纳实现：
    - `@components/`：模块私有的通用视图组件
    - `@core/`：模块核心编排与纯逻辑
    - `@hooks/`：模块私有 hooks
    - `@types/`：模块私有类型定义
    - `@utils/`：模块私有工具函数与常量
    - `@store/`：模块私有状态
  - 如果某一块已经形成子模块，例如 `model-select`、`reference-actions`，优先建子目录，再按需要继续在子目录下拆自己的 `@components/`、`@hooks/` 等层级，而不是继续平铺在模块根目录。
- **目录边界**：
  - 模块私有实现优先放在模块目录下的 `@components / @core / @hooks / @types / @utils / @store` 中，不再把所有文件平铺在模块根目录。
  - 只有跨模块复用时，才提升到 `src/components/`、`src/hooks/`、`src/utils/`、`src/store/` 对应的全局目录。
  - 不要把全局通用和模块私有实现混放在同一层目录。
- **移动/重命名文件**：使用 `mv` 完成迁移，并同步更新所有相关的引入路径。
