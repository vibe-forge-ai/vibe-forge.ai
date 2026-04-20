import { describe, expect, it } from 'vitest'
import { z } from 'zod'

describe('schema summary helpers', () => {
  it('summarizes nested zod schemas', async () => {
    const { summarizeSchema } = await import('#~/services/mdp/schema-summary.js')

    const schema = z.object({
      sessionType: z.enum(['direct', 'group']).describe('Conversation type'),
      channelId: z.string().describe('Channel identifier'),
      senderId: z.string().optional().describe('Optional sender'),
      tags: z.array(z.string().describe('Tag value')).optional().describe('Optional tags')
    }).describe('Command target')

    expect(summarizeSchema(schema)).toEqual({
      type: 'object',
      description: 'Command target',
      properties: {
        sessionType: {
          type: 'enum',
          description: 'Conversation type',
          enumValues: ['direct', 'group']
        },
        channelId: {
          type: 'string',
          description: 'Channel identifier'
        },
        senderId: {
          type: 'string',
          description: 'Optional sender',
          optional: true
        },
        tags: {
          type: 'array',
          description: 'Optional tags',
          optional: true,
          item: {
            type: 'string',
            description: 'Tag value'
          }
        }
      }
    })
  })

  it('renders readable markdown lines', async () => {
    const { renderSummaryLines } = await import('#~/services/mdp/schema-summary.js')

    const lines = renderSummaryLines('Example Body', z.object({
      name: z.string().describe('Display name'),
      flags: z.array(z.enum(['a', 'b'])).optional().describe('Toggle flags')
    }))

    expect(lines.join('\n')).toContain('## Example Body')
    expect(lines.join('\n')).toContain('- object')
    expect(lines.join('\n')).toContain('- name')
    expect(lines.join('\n')).toContain('Display name')
    expect(lines.join('\n')).toContain('one of: a, b')
  })
})
