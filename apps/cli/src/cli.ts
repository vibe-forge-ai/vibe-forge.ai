import 'dotenv/config'

import { program } from 'commander'

import { getCliVersion } from '#~/utils'

import { registerMcpCommand } from './commands/mcp'

program
  .name('vf')
  .description('Vibe Forge CLI')
  .version(getCliVersion())

registerMcpCommand(program)

program.parse()
