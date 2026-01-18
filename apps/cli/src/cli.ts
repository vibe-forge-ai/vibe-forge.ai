import 'dotenv/config'

import { program } from 'commander'

import { registerUiCommand } from './commands/ui'

program
  .name('vf')
  .description('Vibe Forge CLI')
  .version('0.1.0')

registerUiCommand(program)

program.parse()
