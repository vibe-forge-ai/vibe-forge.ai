export interface AdapterBuiltinModel {
  value: string
  title: string
  description: string
}

/**
 * Claude Code native model options.
 * These models are supported directly by the `claude` CLI binary
 * and do not require CCR routing.
 */
export const builtinModels: AdapterBuiltinModel[] = [
  {
    value: 'default',
    title: 'default',
    description: '推荐的模型设置，取决于你的账户类型'
  },
  {
    value: 'sonnet',
    title: 'sonnet',
    description: '使用最新的 Sonnet 模型（当前为 Sonnet 4.6）用于日常编码任务'
  },
  {
    value: 'opus',
    title: 'opus',
    description: '使用最新的 Opus 模型（当前为 Opus 4.6）用于复杂推理任务'
  },
  {
    value: 'haiku',
    title: 'haiku',
    description: '使用快速高效的 Haiku 模型用于简单任务'
  },
  {
    value: 'sonnet[1m]',
    title: 'sonnet[1m]',
    description: '使用 Sonnet 和 100 万 token 上下文窗口用于长会话'
  },
  {
    value: 'opusplan',
    title: 'opusplan',
    description: '特殊模式，在计划模式中使用 Opus，然后在执行时切换到 Sonnet'
  }
]
