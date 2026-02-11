import 'dotenv/config'
import './commands/@core/extra-options'

import { program } from 'commander'

import { getCliDescription, getCliVersion } from '#~/utils.js'

import { registerClearCommand } from './commands/clear'
import { registerKillCommand } from './commands/kill'
import { registerListCommand } from './commands/list'
import { registerMcpCommand } from './commands/mcp'
import { registerRunCommand } from './commands/run'
import { registerStopCommand } from './commands/stop'

program
  .name('vf')
  .description(getCliDescription())
  .version(getCliVersion())

// Register default run options
registerRunCommand(program)

registerMcpCommand(program)
registerClearCommand(program)
registerListCommand(program)
registerStopCommand(program)
registerKillCommand(program)

program.parse()
