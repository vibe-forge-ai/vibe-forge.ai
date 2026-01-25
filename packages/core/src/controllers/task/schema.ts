import z from 'zod'

export const TaskOptions = z.object({
  type: z
    .union([
      z.literal('entity'),
      // 基础库 API 能力开发
      z.literal('spec')
    ])
    .describe('任务模式'),
  name: z.string().describe('垂类知识库基准目标'),
  specParams: z.record(z.string()).describe('SPEC 执行时的参数').optional(),
  runtime: z
    .object({
      type: z
        .string()
        .describe('选择特定的 AI CLI 类型'),
      noDefaultSystemPrompt: z
        .boolean()
        .describe('是否禁用默认的系统提示')
        .optional()
    }),
  description: z
    .string()
    .describe('本次任务的描述，介绍关于本次任务需要进行的工作')
    .optional(),
  sessionId: z
    .string()
    .describe(
      '复用上次会话的历史消息作为本次任务的上下文。\n' +
        '- 通常如果某个任务在执行的时候出现了非预期的错误，那么你可以通过传入相同的 sessionID 来继续这个会话\n' +
        '- 如果有一个步骤需要间隔执行，比如说先执行任务 A 的 A-1，然后完成后执行 B 的 B-1，等 B-1 这个完成后回到 A-1 继续执行 A-2 时也可以使用'
    )
    .optional(),
  frontendTimeout: z
    .number()
    .describe(
      '前台等待时间的上限，单位秒，默认值为 8 分钟。' +
        '在超过这个时间后该任务会被转化为一个后台任务，并直接返回当前的输出以及 sessionId，你可以通过 sessionId 来继续这个任务，或者查询任务的状态'
    )
    .default(8 * 60)
    .optional(),
  defaultModel: z.string().describe('默认的模型').optional()
})

export type TaskOptions = z.infer<typeof TaskOptions>

export const MCPRunTasksOptions = z.object({
  tasks: z
    .array(TaskOptions)
    .describe(
      '子任务列表。传递多个子任务时会并发执行多个，可用于优化整体任务效率。'
    ),

  bashDefaultTimeoutMs: z.number().optional(),
  bashMaxTimeoutMs: z.number().optional(),
  maxMcpOutputTokens: z.number().optional(),
  mcpTimeout: z.number().optional(),
  mcpToolTimeout: z.number().optional()
})

export type MCPRunTasksOptions = z.infer<typeof MCPRunTasksOptions>

export const Options = z
  .object({
    taskId: z
      .string()
      .describe(
        '唯一 id，会用于关联多个任务相关信息。\n' +
          '如果是第一次执行，则不需要传入，会在返回值中自动生成一个，在下次创建或复用的时候必须传入该值以供记录相关上下文。\n' +
          '用户指定了 taskId，则以用户指定的 taskId 为准，在创建任务时则必须要指定对应的 taskId 参数。'
      )
      .optional()
  })
  .extend(MCPRunTasksOptions.shape)

export type Options = z.infer<typeof Options>

export const Entity = z.object({
  prompt: z
    .string()
    .describe('实体的描述，简单介绍一下当前实体的作用。')
    .optional(),
  promptPath: z
    .string()
    .describe(
      '实体的描述文件路径，文件内容为实体的描述。默认为当前目录下的 AGENTS.md 文件。'
    )
    .optional(),
  rules: z
    .array(
      z.union([
        z.string(),
        z.discriminatedUnion('type', [
          z.object({
            type: z.literal('local').optional(),
            path: z.string(),
            desc: z.string().optional()
          }),
          z.object({
            type: z.literal('remote'),
            tags: z.array(z.string()).describe('关键 tag').optional(),
            desc: z.string().describe('知识库的描述').optional()
          })
        ])
      ])
    )
    .optional()
    .describe('垂类 agent 的规则集合'),
  skills: z
    .object({
      type: z.union([z.literal('include'), z.literal('exclude')]),
      list: z.array(z.string()).describe('技能列表')
    })
    .optional(),
  mcpServers: z
    .object({
      include: z.array(z.string()).describe('包含的服务名称列表'),
      exclude: z.array(z.string()).describe('排除的服务名称列表')
    })
    .optional(),
  tools: z
    .object({
      include: z.array(z.string()).describe('包含的工具名称列表'),
      exclude: z.array(z.string()).describe('排除的工具名称列表')
    })
    .optional(),
  defaultModel: z.string().optional()
})

export type Entity = z.infer<typeof Entity>
