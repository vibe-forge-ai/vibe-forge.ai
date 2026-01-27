import 'dotenv/config'

import process from 'node:process'

import { program } from 'commander'

import { run } from '@vibe-forge/core/controllers/task'
import { uuid } from '@vibe-forge/core/utils/uuid'

import { getCliVersion } from '#~/utils'

import { registerMcpCommand } from './commands/mcp'
import { registerClearCommand } from './commands/clear'

interface RunOptions {
  print: boolean
  model?: string
  adapter: string
  systemPrompt?: string
  sessionId?: string
  resume?: boolean
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
  .action(async (opts: RunOptions) => {
    const taskId = uuid()
    const sessionId = opts.sessionId ?? uuid()
    const type = opts.resume ? 'resume' : 'create'

    await new Promise<void>((resolve, reject) => {
      run({
        taskId,
        taskAdapter: opts.adapter,
        cwd: process.cwd(),
        env: process.env,
      }, {
        type,
        runtime: 'cli',
        sessionId,
        model: opts.model,
        systemPrompt: opts.systemPrompt,
        mode: opts.print ? 'stream' : 'direct',
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
