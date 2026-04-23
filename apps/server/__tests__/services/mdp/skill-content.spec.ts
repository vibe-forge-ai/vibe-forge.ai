import { z } from 'zod'
import { describe, expect, it, vi } from 'vitest'

vi.mock('#~/channels/loader.js', () => ({
  loadChannelModule: () => ({
    definition: {
      description: 'Lark channel runtime',
      label: 'Lark',
      messageSchema: z.object({
        receiveId: z.string().describe('Target receive_id'),
        receiveIdType: z.string().describe('Target receive_id_type'),
        text: z.string().describe('Outgoing message text')
      })
    }
  })
}))

import {
  buildChannelsSkillContent,
  buildChannelSkillContent,
  buildChannelTypeSkillContent,
  buildServerAutomationSkillContent,
  buildServerConfigSkillContent,
  buildServerInteractionsSkillContent,
  buildServerSessionGitSkillContent,
  buildServerSessionWorkspaceSkillContent,
  buildServerSessionsSkillContent,
  buildServerSkillContent,
  buildServerWorkspaceSkillContent,
  type ChannelPathEntry
} from '#~/services/mdp/runtime.js'

const channelEntry: ChannelPathEntry = {
  capabilities: {
    pushFollowUps: true,
    sendFileMessage: true,
    sendMessage: true,
    updateMessage: true
  },
  description: 'Primary Lark bot for the support workspace',
  instanceKey: 'support',
  key: 'support',
  label: 'Lark',
  status: 'connected',
  title: 'Support Bot',
  type: 'lark'
}

describe('server mdp skill content', () => {
  it('describes the server root skill as domain routing guidance', () => {
    const content = buildServerSkillContent()

    expect(content).toContain('Use this client when the task is about Vibe Forge server-owned state')
    expect(content).toContain('Typical task routing:')
    expect(content).toContain('create, branch, inspect or update a session -> `/sessions/skill.md`')
  })

  it('includes examples for important session, workspace, automation and config flows', () => {
    expect(buildServerSessionsSkillContent()).toContain('Examples:')
    expect(buildServerSessionsSkillContent()).toContain('branch from one assistant response')
    expect(buildServerSessionsSkillContent()).toContain('create a live Codex session and send the first user turn immediately')
    expect(buildServerSessionsSkillContent()).toContain('"adapter": "codex"')
    expect(buildServerSessionsSkillContent()).toContain('include `entryContext`')
    expect(buildServerSessionsSkillContent()).toContain('linked under that current session automatically')
    expect(buildServerSessionsSkillContent()).toContain('`POST /sessions/:session_id/model`')
    expect(buildServerSessionsSkillContent()).toContain('switch one existing session to another model for the next turn')
    expect(buildServerSessionsSkillContent()).toContain('use `POST /sessions/:session_id/update` only for metadata')

    expect(buildServerWorkspaceSkillContent()).toContain('Examples:')
    expect(buildServerWorkspaceSkillContent()).toContain('update one workspace file after editing content')

    expect(buildServerSessionWorkspaceSkillContent()).toContain('Recommended order:')
    expect(buildServerSessionWorkspaceSkillContent()).toContain('turn the current session sandbox into a managed worktree')

    expect(buildServerSessionGitSkillContent()).toContain('Recommended order:')
    expect(buildServerSessionGitSkillContent()).toContain('create and switch to a new branch in the session sandbox')

    expect(buildServerAutomationSkillContent()).toContain('Examples:')
    expect(buildServerAutomationSkillContent()).toContain('trigger one rule immediately')

    expect(buildServerConfigSkillContent()).toContain('Examples:')
    expect(buildServerConfigSkillContent()).toContain('write a config patch and reload')

    expect(buildServerInteractionsSkillContent()).toContain('Examples:')
    expect(buildServerInteractionsSkillContent()).toContain('permission-check')
  })

  it('describes channel routing progressively from family to instance', () => {
    const rootContent = buildChannelsSkillContent([channelEntry])
    const typeContent = buildChannelTypeSkillContent('lark', [channelEntry])
    const instanceContent = buildChannelSkillContent(channelEntry)

    expect(rootContent).toContain('Recommended order:')
    expect(rootContent).toContain('Typical task routing:')
    expect(rootContent).toContain('`/lark/skill.md`')

    expect(typeContent).toContain('Use this skill when the task belongs to the')
    expect(typeContent).toContain('Open one concrete instance next')

    expect(instanceContent).toContain('This usually covers problems like:')
    expect(instanceContent).toContain('Examples:')
    expect(instanceContent).toContain('bind one existing Vibe Forge session')
    expect(instanceContent).toContain('Use `/commands` and `/run-command` only as a fallback')
  })
})
