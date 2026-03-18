import { describe, expect, it, vi } from 'vitest'

import {
  applyVersionBump,
  buildPublishArgs,
  bumpVersion,
  createPublishPlan,
  loadWorkspacePackages,
  parseArgs,
  runPublishPlanCli,
} from '../publish-plan.mjs'

const createPackage = (
  name: string,
  version: string,
  deps: Record<string, string> = {},
  extra: Record<string, unknown> = {},
) => ({
  name,
  dir: `/repo/${name}`,
  private: Boolean(extra.private),
  json: {
    name,
    version,
    ...(Object.keys(deps).length > 0 ? { dependencies: deps } : {}),
    ...extra,
  },
})

describe('publish-plan', () => {
  it('parses CLI arguments and deduplicates packages', () => {
    const options = parseArgs([
      '--packages', '@scope/a,@scope/b',
      '--package', '@scope/b',
      '--publish',
      '--tag', 'next',
      '--bump', 'patch',
      '--dry-run',
      '--no-git-checks',
      '--no-confirm-retry',
      '--json',
    ])

    expect(options).toMatchObject({
      packages: ['@scope/a', '@scope/b'],
      publish: true,
      tag: 'next',
      bump: 'patch',
      dryRun: true,
      noGitChecks: true,
      confirmRetry: false,
      json: true,
    })
  })

  it('keeps explicit selection narrow and only uses dependencies for analysis', () => {
    const packages = new Map([
      ['@vibe-forge/core', createPackage('@vibe-forge/core', '1.0.0')],
      ['@vibe-forge/adapter', createPackage('@vibe-forge/adapter', '1.0.0', {
        '@vibe-forge/core': 'workspace:^',
      })],
      ['@vibe-forge/client', createPackage('@vibe-forge/client', '1.0.0', {
        '@vibe-forge/adapter': 'workspace:^',
      })],
    ])

    const plan = createPublishPlan(packages, {
      packages: ['@vibe-forge/client'],
      publish: false,
      access: 'public',
      tag: '',
      dryRun: false,
      noGitChecks: false,
      bump: '',
      confirmRetry: true,
      json: false,
      includePrivate: false,
      help: false,
    })

    expect(plan.items.map((item) => item.name)).toEqual([
      '@vibe-forge/client',
    ])
    expect(plan.items[0]?.internalDependencies).toEqual(['@vibe-forge/adapter'])
  })

  it('does not require dependent releases for compatible dependency bumps', () => {
    const packages = new Map([
      ['b', createPackage('b', '0.1.0')],
      ['a', createPackage('a', '1.0.0', { b: 'workspace:^0.1.0' })],
    ])

    const plan = createPublishPlan(packages, {
      packages: ['b'],
      publish: false,
      access: 'public',
      tag: '',
      dryRun: false,
      noGitChecks: false,
      bump: 'patch',
      confirmRetry: true,
      json: false,
      includePrivate: false,
      help: false,
    })

    expect(plan.items.map((item) => item.name)).toEqual(['b'])
    expect(plan.items[0]?.nextVersion).toBe('0.1.1')
    expect(plan.items[0]?.impactedDependents).toEqual([])
  })

  it('marks dependents when a zero-major caret range is no longer compatible', () => {
    const packages = new Map([
      ['b', createPackage('b', '0.1.0')],
      ['a', createPackage('a', '1.0.0', { b: 'workspace:^0.1.0' })],
    ])

    const plan = createPublishPlan(packages, {
      packages: ['b'],
      publish: false,
      access: 'public',
      tag: '',
      dryRun: false,
      noGitChecks: false,
      bump: 'minor',
      confirmRetry: true,
      json: false,
      includePrivate: false,
      help: false,
    })

    expect(plan.items.map((item) => item.name)).toEqual(['b'])
    expect(plan.items[0]?.nextVersion).toBe('0.2.0')
    expect(plan.items[0]?.impactedDependents).toEqual([
      {
        name: 'a',
        range: 'workspace:^0.1.0',
        field: 'dependencies',
        requiresRangeUpdate: true,
      },
    ])
  })

  it('rejects plans that depend on a private workspace package', () => {
    const packages = new Map([
      ['@vibe-forge/private-core', createPackage('@vibe-forge/private-core', '1.0.0', {}, { private: true })],
      ['@vibe-forge/client', createPackage('@vibe-forge/client', '1.0.0', {
        '@vibe-forge/private-core': 'workspace:^',
      })],
    ])

    expect(() => createPublishPlan(packages, {
      packages: ['@vibe-forge/client'],
      publish: false,
      access: 'public',
      tag: '',
      dryRun: false,
      noGitChecks: false,
      bump: '',
      confirmRetry: true,
      json: false,
      includePrivate: false,
      help: false,
    })).toThrow('依赖 private 包')
  })

  it('bumps versions for every package in the plan', async () => {
    const packages = new Map([
      ['@vibe-forge/core', createPackage('@vibe-forge/core', '1.2.3')],
      ['@vibe-forge/client', createPackage('@vibe-forge/client', '2.0.0')],
    ])
    const plan = {
      items: [
        { name: '@vibe-forge/core' },
        { name: '@vibe-forge/client' },
      ],
    }
    const writes: Array<{ filePath: string, content: string }> = []

    const updates = await applyVersionBump(plan as never, packages, 'minor', {
      readText: vi.fn(),
      readdir: vi.fn(),
      stat: vi.fn(),
      writeText: vi.fn(async (filePath: string, content: string) => {
        writes.push({ filePath, content })
      }),
    })

    expect(updates).toEqual([
      { name: '@vibe-forge/core', version: '1.3.0' },
      { name: '@vibe-forge/client', version: '2.1.0' },
    ])
    expect(writes.map((entry) => entry.filePath)).toEqual([
      '/repo/@vibe-forge/core/package.json',
      '/repo/@vibe-forge/client/package.json',
    ])
    expect(JSON.parse(writes[0]!.content).version).toBe('1.3.0')
  })

  it('builds pnpm publish arguments from publish flags', () => {
    expect(buildPublishArgs({
      access: 'public',
      tag: 'beta',
      dryRun: true,
      noGitChecks: true,
    })).toEqual([
      'publish',
      '--access',
      'public',
      '--tag',
      'beta',
      '--dry-run',
      '--no-git-checks',
    ])
  })

  it('loads workspace packages from pnpm-workspace patterns', async () => {
    const dirs = new Map<string, string[]>([
      ['/repo/apps', ['cli', 'server']],
    ])
    const files = new Map<string, string>([
      ['/repo/pnpm-workspace.yaml', 'packages:\n  - apps/*\n'],
      ['/repo/apps/cli/package.json', JSON.stringify({ name: '@vibe-forge/cli', version: '1.0.0' })],
      ['/repo/apps/server/package.json', JSON.stringify({ name: '@vibe-forge/server', version: '1.0.0' })],
    ])

    const packages = await loadWorkspacePackages('/repo', {
      async readText(filePath: string) {
        const content = files.get(filePath)
        if (!content) {
          throw new Error(`missing file: ${filePath}`)
        }
        return content
      },
      async readdir(dirPath: string) {
        return dirs.get(dirPath) ?? []
      },
      async stat(filePath: string) {
        return {
          isDirectory: () => !filePath.endsWith('package.json'),
        }
      },
      async writeText() {},
    })

    expect(Array.from(packages.keys())).toEqual([
      '@vibe-forge/cli',
      '@vibe-forge/server',
    ])
  })

  it('prints help without touching the workspace', async () => {
    const output: string[] = []

    const result = await runPublishPlanCli(['--help'], {
      repoRoot: '/repo',
      stdout: {
        write(value: string) {
          output.push(value)
        },
      },
      fsOps: {
        readText: vi.fn(async () => ''),
        readdir: vi.fn(async () => []),
        stat: vi.fn(async () => ({ isDirectory: () => false })),
        writeText: vi.fn(async () => {}),
      },
    })

    expect(result.kind).toBe('help')
    expect(output.join('')).toContain('pnpm publish:plan')
  })

  it('bumps semantic versions by kind', () => {
    expect(bumpVersion('1.2.3', 'patch')).toBe('1.2.4')
    expect(bumpVersion('1.2.3', 'minor')).toBe('1.3.0')
    expect(bumpVersion('1.2.3', 'major')).toBe('2.0.0')
  })
})