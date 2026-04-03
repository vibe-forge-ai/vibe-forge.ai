import z from 'zod'

export const InteractionOptionSchema = z.object({
  label: z.string(),
  value: z.string().optional(),
  description: z.string().optional()
})

export const AskUserQuestionParamsSchema = z.object({
  sessionId: z.string(),
  question: z.string(),
  options: z.array(InteractionOptionSchema).optional(),
  multiselect: z.boolean().optional(),
  kind: z.enum(['question', 'permission']).optional(),
  permissionContext: z.object({
    adapter: z.string().optional(),
    currentMode: z.enum(['default', 'acceptEdits', 'plan', 'dontAsk', 'bypassPermissions']).optional(),
    suggestedMode: z.enum(['default', 'acceptEdits', 'plan', 'dontAsk', 'bypassPermissions']).optional(),
    deniedTools: z.array(z.string()).optional(),
    reasons: z.array(z.string()).optional()
  }).optional()
})
