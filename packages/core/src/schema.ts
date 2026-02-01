import z from 'zod'

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
