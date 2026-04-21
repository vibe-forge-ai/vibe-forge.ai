import { mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { aiRouter } from '#~/routes/ai.js'

const findRouteHandler = (routePath: string, method: string) => {
  const router = aiRouter() as any
  const layer = router.stack.find((item: any) => item.path === routePath && item.methods.includes(method))
  if (layer == null) {
    throw new Error(`Route ${method} ${routePath} not found`)
  }
  return layer.stack[0] as (ctx: any) => Promise<void> | void
}

describe('aiRouter', () => {
  let workspaceFolder = ''
  const originalWorkspaceFolder = process.env.WORKSPACE_FOLDER

  beforeEach(async () => {
    workspaceFolder = await mkdtemp(path.join(os.tmpdir(), 'vf-ai-routes-'))
    process.env.WORKSPACE_FOLDER = workspaceFolder
  })

  afterEach(async () => {
    await rm(workspaceFolder, { recursive: true, force: true })
    workspaceFolder = ''
    if (originalWorkspaceFolder == null) {
      delete process.env.WORKSPACE_FOLDER
    } else {
      process.env.WORKSPACE_FOLDER = originalWorkspaceFolder
    }
  })

  it('returns presenter-aligned skill detail payloads after creating a skill', async () => {
    const handleCreateSkill = findRouteHandler('/skills', 'POST')
    const ctx = {
      request: {
        body: {
          name: 'Research',
          description: 'Read docs',
          body: 'Use docs'
        }
      },
      status: undefined,
      body: undefined
    }

    await handleCreateSkill(ctx)

    expect(ctx.status).toBe(201)
    expect(ctx.body).toEqual({
      skill: {
        id: '.ai/skills/research/SKILL.md',
        name: 'research',
        description: 'Read docs',
        always: false,
        instancePath: undefined,
        source: 'project',
        body: 'Use docs'
      }
    })
    await expect(
      readFile(path.join(workspaceFolder, '.ai', 'skills', 'research', 'SKILL.md'), 'utf8')
    ).resolves.toBe('---\ndescription: "Read docs"\n---\n\nUse docs\n')
  })
})
