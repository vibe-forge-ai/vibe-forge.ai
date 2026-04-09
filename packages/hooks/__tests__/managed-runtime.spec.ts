import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { callHook } from '#~/call.js'

const tempDirs: string[] = []

const writeDocument = async (filePath: string, content: string) => {
  await mkdir(dirname(filePath), { recursive: true })
  await writeFile(filePath, content)
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map(dir => rm(dir, { recursive: true, force: true })))
})

describe('managed hook runtime', () => {
  it('loads managed Claude hook plugins from .ai/plugins without config entries', async () => {
    const workspace = await mkdtemp(join(tmpdir(), 'vf-hook-managed-'))
    tempDirs.push(workspace)

    await writeDocument(
      join(workspace, '.ai/plugins/demo/.vf-plugin.json'),
      JSON.stringify({
        version: 1,
        adapter: 'claude',
        name: 'demo',
        scope: 'demo',
        installedAt: new Date().toISOString(),
        source: {
          type: 'path',
          path: './demo'
        },
        nativePluginPath: 'native',
        vibeForgePluginPath: 'vibe-forge'
      }, null, 2)
    )
    await writeDocument(
      join(workspace, '.ai/plugins/demo/vibe-forge/hooks.js'),
      'module.exports = { SessionStart: async (_ctx, _input, next) => ({ ...(await next()), systemMessage: "managed-hook" }) }\n'
    )

    const result = await callHook(
      'SessionStart',
      {
        cwd: workspace,
        sessionId: 'managed-session',
        source: 'startup'
      },
      {
        ...process.env,
        __VF_PROJECT_AI_CTX_ID__: 'ctx-managed-hook',
        __VF_PROJECT_AI_SERVER_HOST__: '127.0.0.1',
        __VF_PROJECT_AI_SERVER_PORT__: '1'
      }
    )

    expect(result).toEqual(expect.objectContaining({
      continue: true,
      systemMessage: 'managed-hook'
    }))
  })
})
