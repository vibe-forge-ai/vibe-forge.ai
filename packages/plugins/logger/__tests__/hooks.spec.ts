import { describe, expect, it, vi } from 'vitest'

import loggerPlugin from '#~/hooks.js'

describe('logger plugin', () => {
  it('escapes markdown fence lines in bash tool logs', async () => {
    const info = vi.fn()
    const next = vi.fn().mockResolvedValue({ continue: true })
    const postToolUse = loggerPlugin.PostToolUse

    expect(postToolUse).toBeTypeOf('function')

    const result = await postToolUse?.(
      {
        logger: { info }
      } as never,
      {
        toolName: 'Bash',
        adapter: 'codex',
        toolInput: {
          description: 'Bash output\n```bash\ncat README.md\n```',
          command: 'printf "demo"\n```bash\ncat README.md\n```'
        },
        toolResponse: {
          stdout: 'stdout line\n```bash\necho "ok"\n```',
          stderr: '```bash\necho "err"\n```'
        }
      } as never,
      next
    )

    expect(result).toEqual({ continue: true })
    expect(next).toHaveBeenCalledOnce()
    expect(info).toHaveBeenCalledOnce()

    const [toolName, description, textBlock] = info.mock.calls[0] ?? []

    expect(toolName).toBe('Bash')
    expect(description).toBe('Bash output\n\\`\\`\\`bash\ncat README.md\n\\`\\`\\`')
    expect(textBlock).toContain('\n```text\n')
    expect(textBlock).toContain('> printf "demo"\n\\`\\`\\`bash\ncat README.md\n\\`\\`\\`')
    expect(textBlock).toContain('stdout: stdout line\n\\`\\`\\`bash\necho "ok"\n\\`\\`\\`')
    expect(textBlock).toContain('stderr: \\`\\`\\`bash\necho "err"\n\\`\\`\\`')
    expect(textBlock).toContain('\n```')
  })
})
