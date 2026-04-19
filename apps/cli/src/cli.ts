import './commands/@core/extra-options'

import process from 'node:process'

import { program } from 'commander'

import { getCliDescription, getCliVersion } from '#~/utils.js'

import { normalizeCliArgs } from './cli-argv'
import { registerAdapterCommand } from './commands/adapter'
import { registerBenchmarkCommand } from './commands/benchmark'
import { registerClearCommand } from './commands/clear'
import { registerConfigCommand } from './commands/config'
import { registerKillCommand } from './commands/kill'
import { registerListCommand } from './commands/list'
import { registerPluginCommand } from './commands/plugin'
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
  vf run --include-skill vf-cli-quickstart "介绍 vf CLI 的常用命令"
  vf list
  vf list --view full
  vf config list
  vf --resume <sessionId>
  vf list --running
`
  )

registerRunCommand(program)
registerAdapterCommand(program)
registerBenchmarkCommand(program)
registerClearCommand(program)
registerConfigCommand(program)
registerListCommand(program)
registerPluginCommand(program)
registerReportCommand(program)
registerStopCommand(program)
registerKillCommand(program)

program.parse(normalizeCliArgs(process.argv.slice(2)), { from: 'user' })
