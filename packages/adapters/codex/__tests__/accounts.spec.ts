import { mkdir, mkdtemp, readlink, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { prepareCodexSessionHome } from '#~/runtime/accounts.js'

const tempDirs: string[] = []

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map(dir => rm(dir, { recursive: true, force: true })))
})

describe('prepareCodexSessionHome', () => {
  it('links real home git config into the isolated Codex session home', async () => {
    const workspace = await mkdtemp(join(tmpdir(), 'vf-codex-session-home-'))
    const realHome = join(workspace, 'real-home')
    const mockHome = join(workspace, '.ai', '.mock')
    tempDirs.push(workspace)

    await mkdir(join(realHome, '.config', 'git'), { recursive: true })
    await writeFile(join(realHome, '.gitconfig'), '[user]\n\tname = real\n')
    await writeFile(join(realHome, '.config', 'git', 'config'), '[alias]\n\tco = checkout\n')

    const result = await prepareCodexSessionHome({
      ctx: {
        cwd: workspace,
        env: {
          HOME: mockHome,
          __VF_PROJECT_REAL_HOME__: realHome
        },
        ctxId: 'ctx',
        configs: []
      },
      sessionId: 'session'
    })

    expect(await readlink(join(result.homeDir, '.gitconfig'))).toBe(join(realHome, '.gitconfig'))
    expect(await readlink(join(result.homeDir, '.config', 'git'))).toBe(join(realHome, '.config', 'git'))
  })
})
