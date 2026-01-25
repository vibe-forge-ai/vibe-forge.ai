import 'dotenv/config'

import { program } from 'commander'

import { registerMcpCommand } from './commands/mcp'

program
  .name('vf')
  .description('Vibe Forge CLI')
  .version('0.1.0')

registerMcpCommand(program)

program.parse()
