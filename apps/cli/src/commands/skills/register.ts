import type { Command } from 'commander'

import { registerAddSkillSubcommand } from './add-command'
import { registerInstallSkillSubcommands } from './install-command'
import { registerPublishSkillSubcommand } from './publish-command'
import { registerRemoveSkillSubcommand } from './remove-command'

export function registerSkillsCommand(program: Command) {
  const skillsCommand = program
    .command('skills')
    .description('Install and manage project skills declared in workspace config')

  registerAddSkillSubcommand(skillsCommand)
  registerInstallSkillSubcommands(skillsCommand)
  registerRemoveSkillSubcommand(skillsCommand)
  registerPublishSkillSubcommand(skillsCommand)
}
