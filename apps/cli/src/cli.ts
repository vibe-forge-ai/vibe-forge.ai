import 'dotenv/config'

import process from 'node:process'

import { program } from 'commander'

import { resolveTaskConfig, run } from '@vibe-forge/core/controllers/task'
import { uuid } from '@vibe-forge/core/utils/uuid'

import { getCliVersion } from '#~/utils'

import { registerClearCommand } from './commands/clear'
import { registerMcpCommand } from './commands/mcp'

interface RunOptions {
  print: boolean
  model?: string
  adapter: string
  systemPrompt?: string
  sessionId?: string
  resume?: boolean
  spec?: string
  entity?: string
}

program
  .name('vf')
  .description('Vibe Forge CLI')
  .version(getCliVersion())

// Register default run options
program
  .option('--print', 'Run in direct mode with printed output', false)
  .option('--model <model>', 'Model to use')
  .option('--adapter <adapter>', 'Adapter to use', 'claude-code')
  .option('--system-prompt <prompt>', 'System prompt')
  .option('--session-id <id>', 'Session ID')
  .option('--resume', 'Resume existing session', false)
  .option('--spec <spec>', 'Load spec definition')
  .option('--entity <entity>', 'Load entity definition')
  .action(async (opts: RunOptions) => {
    if (opts.spec && opts.entity) {
      console.error('Error: --spec and --entity are mutually exclusive.')
      process.exit(1)
    }

    const taskId = uuid()
    const sessionId = opts.sessionId ?? uuid()
    const type = opts.resume ? 'resume' : 'create'

    const resolvedConfig = await resolveTaskConfig(
      opts.spec ? 'spec' : (opts.entity ? 'entity' : undefined),
      opts.spec || opts.entity,
      process.cwd()
    )

    // Merge system prompt: CLI arg > Resolved Config
    const finalSystemPrompt = opts.systemPrompt
      ? (resolvedConfig.systemPrompt ? `${resolvedConfig.systemPrompt}\n\n${opts.systemPrompt}` : opts.systemPrompt)
      : resolvedConfig.systemPrompt

    await new Promise<void>((resolve, reject) => {
      run({
        taskId,
        taskAdapter: opts.adapter,
        cwd: process.cwd(),
        env: process.env
      }, {
        type,
        runtime: 'cli',
        sessionId,
        model: opts.model,
        systemPrompt: finalSystemPrompt,
        mode: opts.print ? 'stream' : 'direct',
        tools: resolvedConfig.tools,
        mcpServers: resolvedConfig.mcpServers,
        onEvent: (event) => {
          if (event.type === 'exit') {
            resolve()
            // Force exit to ensure we don't hang if there are lingering handles
            process.exit(event.data.exitCode ?? 0)
          }

          if (!opts.print) {
            console.log(JSON.stringify(event))
          }
        }
      }).catch(reject)
    })
  })

registerMcpCommand(program)
registerClearCommand(program)

program.parse()
