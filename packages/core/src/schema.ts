import z from 'zod'

export const Settings = z.object({
  mcpServers: z
    .record(
      z.string(),
      z.intersection(
        z.object({
          enabled: z.boolean().default(true),
          env: z.record(z.string()).optional()
        }),
        z.discriminatedUnion('type', [
          z.object({
            type: z.undefined(),
            command: z.string(),
            args: z.array(z.string())
          }),
          z.object({
            type: z.literal('sse'),
            url: z.string().url(),
            headers: z.record(z.string(), z.string())
          })
        ])
      )
    )
    .optional(),
  includeMcpServers: z.array(z.string()).optional(),
  excludeMcpServers: z.array(z.string()).optional(),

  env: z.record(z.string(), z.string()).optional(),

  model: z.string().optional(),

  permissions: z.object({
    allow: z.array(z.string()).optional(),
    deny: z.array(z.string()).optional(),
    ask: z.array(z.string()).optional(),
    additionalDirectories: z.array(z.string()).optional(),
    defaultMode: z
      .union([
        /**
         * https://docs.anthropic.com/en/docs/claude-code/iam#permission-modes
         */
        z.literal('default'),
        z.literal('acceptEdits'),
        z.literal('plan'),
        z.literal('bypassPermissions')
      ])
      .optional(),
    disableBypassPermissionMode: z.literal('disable').optional()
  })
})

export type Settings = z.infer<typeof Settings>

export const InteractionOptionSchema = z.object({
  label: z.string(),
  description: z.string().optional()
})

export const AskUserQuestionParamsSchema = z.object({
  sessionId: z.string(),
  question: z.string(),
  options: z.array(InteractionOptionSchema).optional(),
  multiselect: z.boolean().optional()
})
