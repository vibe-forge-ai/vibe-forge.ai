import './commands/@core/extra-options'

import { program } from 'commander'

import { getCliDescription, getCliVersion } from '#~/utils.js'

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

// Register default run options
registerRunCommand(program)

registerBenchmarkCommand(program)
registerClearCommand(program)
registerListCommand(program)
registerReportCommand(program)
registerStopCommand(program)
registerKillCommand(program)

program.parse()
