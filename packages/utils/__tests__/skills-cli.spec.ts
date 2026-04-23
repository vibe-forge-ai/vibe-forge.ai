import { describe, expect, it } from 'vitest'

import {
  buildSkillsCliEnv,
  parseSkillsCliFindOutput,
  parseSkillsCliListOutput,
  resolveSkillsCliRegistry
} from '#~/skills-cli.js'

describe('skills CLI utils', () => {
  it('parses search results from skills find output', () => {
    expect(parseSkillsCliFindOutput([
      'Install with npx skills add <owner/repo@skill>',
      '',
      'vercel-labs/agent-skills@vercel-react-best-practices 336.1K installs',
      '└ https://skills.sh/vercel-labs/agent-skills/vercel-react-best-practices',
      '',
      'google-labs-code/stitch-skills@react:components 38K installs',
      '└ https://skills.sh/google-labs-code/stitch-skills/react:components'
    ].join('\n'))).toEqual([
      {
        installRef: 'vercel-labs/agent-skills@vercel-react-best-practices',
        source: 'vercel-labs/agent-skills',
        skill: 'vercel-react-best-practices',
        installsLabel: '336.1K installs',
        url: 'https://skills.sh/vercel-labs/agent-skills/vercel-react-best-practices'
      },
      {
        installRef: 'google-labs-code/stitch-skills@react:components',
        source: 'google-labs-code/stitch-skills',
        skill: 'react:components',
        installsLabel: '38K installs',
        url: 'https://skills.sh/google-labs-code/stitch-skills/react:components'
      }
    ])
  })

  it('parses list output from skills add --list', () => {
    expect(parseSkillsCliListOutput([
      '◇  Available Skills',
      '│',
      '│    internal-review',
      '│',
      '│      Review code with internal checklists.',
      '│',
      '│    docs-writer',
      '│',
      '│      Write release docs with internal templates.',
      '│',
      '└  Use --skill <name> to install specific skills'
    ].join('\n'))).toEqual([
      {
        name: 'internal-review',
        description: 'Review code with internal checklists.'
      },
      {
        name: 'docs-writer',
        description: 'Write release docs with internal templates.'
      }
    ])
  })

  it('prefers explicit registry overrides over config aliases', () => {
    expect(resolveSkillsCliRegistry({
      config: {
        registry: 'https://new.example.test',
        npmRegistry: 'https://old.example.test'
      },
      registry: 'https://override.example.test'
    })).toBe('https://override.example.test')

    expect(buildSkillsCliEnv({
      config: {
        registry: 'https://new.example.test',
        env: {
          SKILLS_REGION: 'cn'
        }
      }
    })).toEqual({
      SKILLS_REGION: 'cn',
      npm_config_registry: 'https://new.example.test'
    })
  })
})
