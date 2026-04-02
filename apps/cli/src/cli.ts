import './commands/@core/extra-options'

import process from 'node:process'

import { program } from 'commander'

import { getCliDescription, getCliVersion } from '#~/utils.js'

import { normalizeCliArgs } from './cli-argv'
import { registerBenchmarkCommand } from './commands/benchmark'
import { registerClearCommand } from './commands/clear'
import { registerKillCommand } from './commands/kill'
import { registerListCommand } from './commands/list'
import { registerReportCommand } from './commands/report'
import { registerRunCommand } from './commands/run'
import { registerStopCommand } from './commands/stop'

program
  .name('vf')
  .description(getCliDescription())
  .version(getCliVersion())
  .showHelpAfterError()
  .addHelpText(
    'after',
    `
Examples:
  vf "读取 README 并给出改进建议"
  vf --resume <sessionId>
  vf list --running
`
  )

registerRunCommand(program)
registerBenchmarkCommand(program)
registerClearCommand(program)
registerListCommand(program)
registerReportCommand(program)
registerStopCommand(program)
registerKillCommand(program)

program.parse(normalizeCliArgs(process.argv.slice(2)), { from: 'user' })
