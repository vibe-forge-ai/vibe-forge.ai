import 'dotenv/config'

import { Command } from 'commander'

import { registerUiCommand } from './commands/ui'

const program = new Command()
program.name('vf').description('Vibe Forge CLI').version('0.1.0')

registerUiCommand(program)

program.parse()
