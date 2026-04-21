import { describe, expect, it } from 'vitest'

import {
  buildConversationStarterInitialContent,
  buildConversationStarterListItems,
  buildConversationStarterTargetDraft,
  buildConversationStarterWorkspacePatch,
  normalizeConversationStarterMode,
  partitionConversationStarterListItems
} from '#~/components/chat/new-session-guide-config'

describe('new-session-guide-config', () => {
  it('normalizes agent mode to entity target drafts', () => {
    expect(normalizeConversationStarterMode('agent')).toBe('entity')
    expect(buildConversationStarterTargetDraft({
      title: 'Planner',
      mode: 'agent',
      target: 'std/dev-planner',
      targetLabel: '标准开发 Agent'
    })).toEqual({
      type: 'entity',
      name: 'std/dev-planner',
      label: '标准开发 Agent'
    })
  })

  it('builds workspace patches and sender content from starter config', () => {
    expect(buildConversationStarterWorkspacePatch({
      title: 'Flow',
      worktree: {
        create: true,
        environment: 'default',
        branch: {
          name: 'feature/preset',
          kind: 'local',
          mode: 'create'
        }
      }
    })).toEqual({
      createWorktree: true,
      worktreeEnvironment: 'default',
      branch: {
        name: 'feature/preset',
        kind: 'local',
        mode: 'create'
      }
    })

    expect(buildConversationStarterInitialContent({
      title: 'Release',
      prompt: '请执行发布流程。',
      files: ['README.md'],
      rules: ['.ai/rules/RELEASE.md', 'review'],
      skills: ['research', 'std/standard-dev-flow']
    })).toEqual([
      {
        type: 'text',
        text: '请执行发布流程。\n\n请优先结合以下规则与技能：\n- 技能：std/standard-dev-flow'
      },
      {
        type: 'file',
        path: 'README.md',
        name: 'README.md'
      },
      {
        type: 'file',
        path: '.ai/rules/RELEASE.md',
        name: 'RELEASE.md'
      },
      {
        type: 'file',
        path: '.ai/rules/review.md',
        name: 'review.md'
      },
      {
        type: 'file',
        path: '.ai/skills/research/SKILL.md',
        name: 'SKILL.md'
      }
    ])
  })

  it('flattens starters and keeps favorites and recent ordering stable without duplicate rows', () => {
    const items = buildConversationStarterListItems(
      [
        { id: 'preset-a', title: '标准开发 Agent' },
        { id: 'preset-b', title: '标准开发 Flow' }
      ],
      [
        { id: 'action-release', title: '发布' },
        { id: 'action-fix-ci', title: '修复流水线' },
        { id: 'action-tests', title: '补回归测试' }
      ]
    )

    expect(items.map(item => item.key)).toEqual([
      'startupPresets:preset-a',
      'startupPresets:preset-b',
      'builtinActions:action-release',
      'builtinActions:action-fix-ci',
      'builtinActions:action-tests'
    ])

    expect(partitionConversationStarterListItems({
      items,
      favoriteKeys: ['builtinActions:action-release'],
      recentKeys: [
        'builtinActions:action-release',
        'builtinActions:action-tests',
        'startupPresets:preset-b'
      ],
      query: '',
      remainingLimit: 8
    })).toEqual({
      isSearchMode: false,
      favorites: [items[2]],
      recentKeys: [
        'builtinActions:action-release',
        'builtinActions:action-tests',
        'startupPresets:preset-b'
      ],
      visibleRemaining: [items[4], items[1], items[0], items[3]],
      totalRemainingCount: 4,
      hiddenRemainingCount: 0
    })
  })

  it('uses search mode to hide favorites and recents and returns all matches', () => {
    const items = buildConversationStarterListItems(
      [{ id: 'preset-a', title: '标准开发 Agent', description: '带规则和技能' }],
      [{ id: 'action-release', title: '发布', prompt: '请执行 release pipeline' }]
    )

    expect(partitionConversationStarterListItems({
      items,
      favoriteKeys: ['startupPresets:preset-a'],
      recentKeys: ['action-release'],
      query: 'release pipeline',
      remainingLimit: 1
    })).toEqual({
      isSearchMode: true,
      favorites: [],
      recentKeys: [],
      visibleRemaining: [items[1]],
      totalRemainingCount: 1,
      hiddenRemainingCount: 0
    })
  })
})
