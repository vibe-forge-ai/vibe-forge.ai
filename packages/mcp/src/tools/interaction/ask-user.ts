import process from 'node:process'
import { z } from 'zod'
import { defineRegister } from '../types'

const Schema = z.object({
  question: z.string().describe('The question to ask the user'),
  options: z.array(z.object({
    label: z.string().describe('The label of the option'),
    value: z.string().optional().describe('Stable value returned when the option is chosen'),
    description: z.string().optional().describe('The description of the option')
  })).optional().describe('The options for the user to select from'),
  multiselect: z.boolean().optional().describe('Whether the user can select multiple options'),
  kind: z.enum(['question', 'permission']).optional().describe('UI hint for how to present the interaction'),
  permissionContext: z.object({
    adapter: z.string().optional(),
    currentMode: z.enum(['default', 'acceptEdits', 'plan', 'dontAsk', 'bypassPermissions']).optional(),
    suggestedMode: z.enum(['default', 'acceptEdits', 'plan', 'dontAsk', 'bypassPermissions']).optional(),
    deniedTools: z.array(z.string()).optional(),
    reasons: z.array(z.string()).optional(),
    subjectKey: z.string().optional(),
    subjectLabel: z.string().optional(),
    scope: z.enum(['tool']).optional(),
    projectConfigPath: z.string().optional()
  }).optional().describe('Extra context for permission escalation prompts')
})

export default defineRegister(({ registerTool }) => {
  registerTool(
    'AskUserQuestion',
    {
      title: 'Ask User Question',
      description: 'Ask the user a question via the web interface',
      inputSchema: Schema
    },
    async (args) => {
      const { question, options, multiselect, kind, permissionContext } = args
      const sessionId = process.env.__VF_PROJECT_AI_SESSION_ID__

      if (!sessionId) {
        throw new Error(
          'Session ID not found in environment variables. This tool can only be used within a Vibe Forge session.'
        )
      }

      const host = process.env.__VF_PROJECT_AI_SERVER_HOST__ ?? 'localhost'
      const port = process.env.__VF_PROJECT_AI_SERVER_PORT__ ?? '8787'
      const response = await fetch(`http://${host}:${port}/api/interact/ask`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sessionId,
          question,
          options,
          multiselect,
          kind,
          permissionContext
        })
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Failed to ask user question: ${response.statusText} - ${errorText}`)
      }

      const result = await response.json() as { data?: unknown; result?: unknown } | unknown
      const body = result != null &&
          typeof result === 'object' &&
          'data' in result
        ? (result as { data?: unknown }).data
        : result
      const answer = body != null &&
          typeof body === 'object' &&
          'result' in body
        ? (body as { result?: unknown }).result
        : body

      if (answer == null) {
        throw new Error('AskUserQuestion returned an empty result')
      }

      const text = Array.isArray(answer)
        ? answer.map(item => String(item)).join('\n')
        : String(answer)

      return {
        content: [
          {
            type: 'text',
            text
          }
        ]
      }
    }
  )
})
