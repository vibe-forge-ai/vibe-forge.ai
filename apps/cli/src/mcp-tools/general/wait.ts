import { z } from 'zod'

import { defineRegister } from '../types'

export default defineRegister(({ registerTool }) => {
  registerTool(
    'wait',
    {
      title: 'Wait Tool',
      description: 'Wait for a specified amount of time (milliseconds)',
      inputSchema: z.object({
        ms: z.number().min(0).max(60000).describe('Time to wait in milliseconds (max 60s)')
      })
    },
    async ({ ms }) => {
      await new Promise((resolve) => setTimeout(resolve, ms))
      return {
        content: [{ type: 'text', text: `Finished waiting for ${ms}ms` }]
      }
    }
  )
})
