import { mkdir, mkdtemp, readFile, readlink, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const tempDirs: string[] = []

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map(dir => rm(dir, { recursive: true, force: true })))
})

describe('linkRealHomeGitConfig', () => {
  it('links real home git config entries into the mock home', async () => {
    const realHome = await mkdtemp(path.join(os.tmpdir(), 'vf-real-home-'))
    const mockHome = await mkdtemp(path.join(os.tmpdir(), 'vf-mock-home-'))
    tempDirs.push(realHome, mockHome)

    await mkdir(path.join(realHome, '.config', 'git'), { recursive: true })
    await writeFile(path.join(realHome, '.gitconfig'), '[user]\n\tname = real\n')
    await writeFile(path.join(realHome, '.gitconfig.local'), '[credential]\n\thelper = store\n')
    await writeFile(path.join(realHome, '.config', 'git', 'config'), '[alias]\n\tco = checkout\n')
    await writeFile(path.join(realHome, '.git-credentials'), 'https://example.invalid\n')

    const { linkRealHomeGitConfig } = require('../mock-home-git.js') as typeof import('../mock-home-git')
    linkRealHomeGitConfig({ realHome, mockHome })

    expect(await readlink(path.join(mockHome, '.gitconfig'))).toBe(path.join(realHome, '.gitconfig'))
    expect(await readlink(path.join(mockHome, '.gitconfig.local'))).toBe(path.join(realHome, '.gitconfig.local'))
    expect(await readlink(path.join(mockHome, '.config', 'git'))).toBe(path.join(realHome, '.config', 'git'))
    expect(await readlink(path.join(mockHome, '.git-credentials'))).toBe(path.join(realHome, '.git-credentials'))
  })

  it('does not overwrite existing mock home git config files', async () => {
    const realHome = await mkdtemp(path.join(os.tmpdir(), 'vf-real-home-'))
    const mockHome = await mkdtemp(path.join(os.tmpdir(), 'vf-mock-home-'))
    tempDirs.push(realHome, mockHome)

    await writeFile(path.join(realHome, '.gitconfig'), '[user]\n\tname = real\n')
    await writeFile(path.join(mockHome, '.gitconfig'), '[user]\n\tname = mock\n')

    const { linkRealHomeGitConfig } = require('../mock-home-git.js') as typeof import('../mock-home-git')
    linkRealHomeGitConfig({ realHome, mockHome })

    expect(await readFile(path.join(mockHome, '.gitconfig'), 'utf8')).toBe('[user]\n\tname = mock\n')
  })
})
