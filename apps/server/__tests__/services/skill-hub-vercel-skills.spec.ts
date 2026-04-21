import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { searchSkillHub } from '#~/services/skill-hub/index.js'
import { installVercelSkill, searchVercelSkills } from '#~/services/skill-hub/vercel-skills.js'

const jsonResponse = (body: unknown, init: ResponseInit = {}) => (
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
    ...init
  })
)

describe('vercel skills hub', () => {
  let workspace: string
  let fetchMock: ReturnType<typeof vi.fn>
  let previousWorkspaceFolder: string | undefined

  beforeEach(async () => {
    previousWorkspaceFolder = process.env.__VF_PROJECT_WORKSPACE_FOLDER__
    workspace = await mkdtemp(join(tmpdir(), 'vf-skills-hub-'))
    process.env.__VF_PROJECT_WORKSPACE_FOLDER__ = workspace
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(async () => {
    vi.unstubAllGlobals()
    if (previousWorkspaceFolder == null) {
      delete process.env.__VF_PROJECT_WORKSPACE_FOLDER__
    } else {
      process.env.__VF_PROJECT_WORKSPACE_FOLDER__ = previousWorkspaceFolder
    }
    await rm(workspace, { recursive: true, force: true })
  })

  it('exposes the built-in skills.sh registry without marketplace config', async () => {
    await expect(searchSkillHub()).resolves.toEqual({
      registries: [
        expect.objectContaining({
          id: 'skills',
          type: 'skills-sh',
          enabled: true,
          searchable: true,
          source: 'https://skills.sh'
        })
      ],
      items: []
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('searches skills.sh and marks installed project skills', async () => {
    await mkdir(join(workspace, '.ai', 'skills', 'react-best'), { recursive: true })
    await writeFile(
      join(workspace, '.ai', 'skills', 'react-best', 'SKILL.md'),
      '---\nname: vercel-react-best-practices\n---\nReact rules\n'
    )

    fetchMock.mockResolvedValueOnce(jsonResponse({
      count: 1,
      skills: [{
        id: 'vercel-labs/agent-skills/vercel-react-best-practices',
        skillId: 'vercel-react-best-practices',
        name: 'vercel-react-best-practices',
        source: 'vercel-labs/agent-skills',
        installs: 330226
      }]
    }))

    await expect(searchVercelSkills({ query: 'react', workspaceFolder: workspace })).resolves.toEqual({
      hasMore: false,
      registry: expect.objectContaining({
        id: 'skills',
        type: 'skills-sh',
        pluginCount: 1
      }),
      items: [
        expect.objectContaining({
          registry: 'skills',
          name: 'vercel-react-best-practices',
          installed: true,
          installRef: 'vercel-labs/agent-skills@vercel-react-best-practices',
          installs: 330226
        })
      ]
    })
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('limit=100'))
  })

  it('installs downloaded skills into .ai/skills', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({
      files: [
        {
          path: 'SKILL.md',
          contents: '---\nname: react:components\n---\n# React components\n'
        },
        {
          path: 'rules/base.md',
          contents: 'Use components.\n'
        }
      ],
      hash: 'abc'
    }))

    const result = await installVercelSkill({
      workspaceFolder: workspace,
      plugin: 'google-labs-code/stitch-skills@react:components'
    })

    expect(result).toEqual(expect.objectContaining({
      registry: 'skills',
      plugin: 'google-labs-code/stitch-skills@react:components',
      name: 'react:components'
    }))
    await expect(readFile(join(workspace, '.ai', 'skills', 'react-components', 'SKILL.md'), 'utf8'))
      .resolves.toContain('React components')
    await expect(readFile(join(workspace, '.ai', 'skills', 'react-components', 'rules', 'base.md'), 'utf8'))
      .resolves.toContain('Use components')
  })
})
