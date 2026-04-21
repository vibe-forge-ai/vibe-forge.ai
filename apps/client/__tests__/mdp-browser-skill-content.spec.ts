import { beforeAll, describe, expect, it } from 'vitest'

let buildLayoutSkillContent: typeof import('#~/hooks/use-mdp-browser-runtime')['buildLayoutSkillContent']
let buildNavigationSkillContent: typeof import('#~/hooks/use-mdp-browser-runtime')['buildNavigationSkillContent']
let buildPanelsSkillContent: typeof import('#~/hooks/use-mdp-browser-runtime')['buildPanelsSkillContent']
let buildRootSkillContent: typeof import('#~/hooks/use-mdp-browser-runtime')['buildRootSkillContent']
let buildSessionSkillContent: typeof import('#~/hooks/use-mdp-browser-runtime')['buildSessionSkillContent']

beforeAll(async () => {
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: () => null,
      removeItem: () => {},
      setItem: () => {}
    }
  })

  const mod = await import('#~/hooks/use-mdp-browser-runtime')
  buildLayoutSkillContent = mod.buildLayoutSkillContent
  buildNavigationSkillContent = mod.buildNavigationSkillContent
  buildPanelsSkillContent = mod.buildPanelsSkillContent
  buildRootSkillContent = mod.buildRootSkillContent
  buildSessionSkillContent = mod.buildSessionSkillContent
})

describe('browser mdp skill content', () => {
  it('describes the browser runtime as a task router instead of a raw path index', () => {
    const content = buildRootSkillContent()

    expect(content).toContain('Use this client when you need to operate the active Vibe Forge browser tab')
    expect(content).toContain('Recommended order:')
    expect(content).toContain('Typical task routing:')
    expect(content).toContain('page jump or session jump -> `/navigation/skill.md`')
    expect(content).not.toContain('This client controls the active Vibe Forge browser tab through semantic UI actions.')
  })

  it('includes scoped examples for navigation, layout, session and panel skills', () => {
    expect(buildNavigationSkillContent()).toContain('Examples:')
    expect(buildNavigationSkillContent()).toContain('open the project config MDP tab')

    expect(buildLayoutSkillContent()).toContain('Examples:')
    expect(buildLayoutSkillContent()).toContain('ensure the desktop sidebar is open')

    expect(buildSessionSkillContent()).toContain('Examples:')
    expect(buildSessionSkillContent()).toContain('switch a session to timeline')

    expect(buildPanelsSkillContent()).toContain('Examples:')
    expect(buildPanelsSkillContent()).toContain('inspect one source file in the current session')
  })
})
