import process from 'node:process'
import { z } from 'zod'
import { defineRegister } from '../types'

const Schema = z.object({
  question: z.string().describe('The question to ask the user'),
  options: z.array(z.object({
    label: z.string().describe('The label of the option'),
    description: z.string().optional().describe('The description of the option')
  })).optional().describe('The options for the user to select from'),
  multiselect: z.boolean().optional().describe('Whether the user can select multiple options')
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
      const { question, options, multiselect } = args
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
          multiselect
        })
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Failed to ask user question: ${response.statusText} - ${errorText}`)
      }

      const result = await response.json()
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result.result)
          }
        ]
      }
    }
  )
})
