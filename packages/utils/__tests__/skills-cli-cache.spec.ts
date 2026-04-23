import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  execFile: vi.fn()
}))

vi.mock('node:child_process', () => ({
  execFile: mocks.execFile
}))

const createExecImplementation = (
  callback: (args: string[]) => { stderr?: string; stdout?: string }
) => {
  mocks.execFile.mockImplementation(
    ((...invokeArgs: any[]) => {
      const args = invokeArgs[1] as string[]
      const dividerIndex = args.indexOf('--')
      const cliArgs = dividerIndex >= 0 ? args.slice(dividerIndex + 1) : args
      const done = invokeArgs[3] as ((error: Error | null, stdout: string, stderr: string) => void)
      const result = callback(cliArgs)
      done(null, result.stdout ?? '', result.stderr ?? '')
      return {} as any
    }) as any
  )
}

describe('skills CLI cache pruning', () => {
  beforeEach(async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-22T00:00:00Z'))
    vi.clearAllMocks()
    const { clearSkillsCliCachesForTest } = await import('#~/skills-cli.js')
    clearSkillsCliCachesForTest()
  })

  afterEach(async () => {
    const { clearSkillsCliCachesForTest } = await import('#~/skills-cli.js')
    clearSkillsCliCachesForTest()
    vi.useRealTimers()
  })

  it('prunes expired find cache entries before storing a new query result', async () => {
    createExecImplementation(args => ({
      stdout: `${args[1]}/source@${args[1]} 1 install\n`
    }))

    const { findSkillsCli, getSkillsCliCacheSizesForTest } = await import('#~/skills-cli.js')

    await findSkillsCli({ query: 'alpha' })
    expect(getSkillsCliCacheSizesForTest()).toEqual({
      find: 1,
      list: 0
    })

    vi.advanceTimersByTime(60_001)

    await findSkillsCli({ query: 'beta' })
    expect(getSkillsCliCacheSizesForTest()).toEqual({
      find: 1,
      list: 0
    })
    expect(mocks.execFile).toHaveBeenCalledTimes(2)
  })

  it('prunes expired list cache entries before storing a new source listing', async () => {
    createExecImplementation(args => ({
      stdout: `  ${args[1]}-skill - Listed skill\n`
    }))

    const { getSkillsCliCacheSizesForTest, listSkillsCliSource } = await import('#~/skills-cli.js')

    await listSkillsCliSource({ source: 'example-source/default/public' })
    expect(getSkillsCliCacheSizesForTest()).toEqual({
      find: 0,
      list: 1
    })

    vi.advanceTimersByTime(300_001)

    await listSkillsCliSource({ source: 'example-source/default/private' })
    expect(getSkillsCliCacheSizesForTest()).toEqual({
      find: 0,
      list: 1
    })
    expect(mocks.execFile).toHaveBeenCalledTimes(2)
  })
})
