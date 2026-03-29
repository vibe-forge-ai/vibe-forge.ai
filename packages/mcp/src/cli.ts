import { program } from 'commander'

import { configureMcpCommand } from './command'
import { getMcpDescription, getMcpVersion } from './package-config'

const version = getMcpVersion()

program
  .name('vf-mcp')
  .description(getMcpDescription())
  .version(version)

configureMcpCommand(program, version)

void program.parseAsync()
