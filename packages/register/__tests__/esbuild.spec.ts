import { spawnSync } from 'node:child_process'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)

describe('register/esbuild', () => {
  const tempDirs: string[] = []

  const runWithRegister = (entryPath: string) =>
    spawnSync(
      process.execPath,
      [
        '--conditions=__vibe-forge__',
        '-r',
        require.resolve('../esbuild.js'),
        '-e',
        `console.log(JSON.stringify(require(${JSON.stringify(entryPath)})))`
      ],
      {
        encoding: 'utf8'
      }
    )

  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map(dir => rm(dir, { force: true, recursive: true })))
  })

  it('falls back from relative .js requests to sibling .ts files inside opted-in node_modules packages', async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'vf-register-esbuild-'))
    tempDirs.push(tempDir)

    const packageDir = path.join(tempDir, 'node_modules', 'fixture-package')
    await mkdir(packageDir, { recursive: true })
    await writeFile(
      path.join(packageDir, 'package.json'),
      JSON.stringify({
        name: 'fixture-package',
        version: '1.0.0',
        vibeForge: {
          runtimeTranspile: true
        }
      })
    )
    await writeFile(path.join(packageDir, 'dep.ts'), 'module.exports = { value: 42 }\n')
    await writeFile(path.join(packageDir, 'entry.ts'), "module.exports = require('./dep.js')\n")

    const result = runWithRegister(path.join(packageDir, 'entry.ts'))

    expect(result.status).toBe(0)
    expect(result.stdout.trim()).toBe(JSON.stringify({ value: 42 }))
    expect(result.stderr).toBe('')
  })

  it('treats __vibe-forge__ source conditions as backward-compatible opt-in metadata', async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'vf-register-esbuild-'))
    tempDirs.push(tempDir)

    const packageDir = path.join(tempDir, 'node_modules', 'legacy-source-package')
    await mkdir(packageDir, { recursive: true })
    await writeFile(
      path.join(packageDir, 'package.json'),
      JSON.stringify({
        name: 'legacy-source-package',
        version: '1.0.0',
        exports: {
          '.': {
            '__vibe-forge__': {
              default: './src/index.ts'
            },
            default: {
              require: './dist/index.js'
            }
          }
        }
      })
    )
    await writeFile(path.join(packageDir, 'dep.ts'), 'module.exports = { value: 7 }\n')
    await writeFile(path.join(packageDir, 'entry.ts'), "module.exports = require('./dep.js')\n")

    const result = runWithRegister(path.join(packageDir, 'entry.ts'))

    expect(result.status).toBe(0)
    expect(result.stdout.trim()).toBe(JSON.stringify({ value: 7 }))
    expect(result.stderr).toBe('')
  })

  it('does not transpile third-party module-sync esm dependencies from node_modules', async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'vf-register-esbuild-'))
    tempDirs.push(tempDir)

    const sourcePackageDir = path.join(tempDir, 'node_modules', 'source-package')
    const thirdPartyPackageDir = path.join(tempDir, 'node_modules', 'third-party-package')
    await mkdir(sourcePackageDir, { recursive: true })
    await mkdir(thirdPartyPackageDir, { recursive: true })

    await writeFile(
      path.join(sourcePackageDir, 'package.json'),
      JSON.stringify({
        name: 'source-package',
        version: '1.0.0',
        vibeForge: {
          runtimeTranspile: true
        }
      })
    )
    await writeFile(
      path.join(sourcePackageDir, 'entry.ts'),
      "module.exports = require('third-party-package')\n"
    )

    await writeFile(
      path.join(thirdPartyPackageDir, 'package.json'),
      JSON.stringify({
        name: 'third-party-package',
        version: '1.0.0',
        exports: {
          '.': [
            {
              'module-sync': './require.mjs',
              default: './index.js'
            },
            './index.js'
          ]
        }
      })
    )
    await writeFile(
      path.join(thirdPartyPackageDir, 'index.js'),
      'module.exports = { value: 42 }\n'
    )
    await writeFile(
      path.join(thirdPartyPackageDir, 'require.mjs'),
      "import value from './index.js';\n\nexport default value;\nexport { value as 'module.exports' };\n"
    )

    const result = runWithRegister(path.join(sourcePackageDir, 'entry.ts'))

    expect(result.status).toBe(0)
    expect(result.stdout.trim()).toBe(JSON.stringify({ value: 42 }))
    expect(result.stderr).toBe('')
  })
})
