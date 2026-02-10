---
alwaysApply: true
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

---

### 导入路径格式

为了提高代码的可读性和可维护性，请根据以下场景选择合适的路径格式：

- **包内跨目录引用**：
  - 当引用的模块位于当前包空间内，且层级较深或跨越了多个功能模块时，应使用包空间绝对路径，避免出现过多的 `../`。
  - 本项目统一使用 `#~/` 作为 src 目录的映射前缀（具体配置见各包的 `package.json` 中的 `imports` 字段）。
  - 示例：在 `src/apps/web/components/chat/MessageItem.tsx` 中引用 `src/apps/web/store/index.ts` 时：
    - 推荐：`import { useStore } from '#~/store';`
    - 避免：`import { useStore } from '../../store';`

- **同级或子级引用**：
  - 对于当前目录或子目录下的模块，优先使用相对路径。
  - 示例：`import { SubComponent } from './SubComponent';`

- **跨 Package 引用**：
  - 引用本项目下其他项目空间（Workspace）导出的内容时，使用对应的包名。
  - 示例：`import { CoreType } from '@vibe-forge/core';`
  - 注：可以通过查看对应包的 `package.json` 中的 `exports` 字段了解其导出规则。
