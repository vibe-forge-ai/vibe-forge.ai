import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  generateEntitiesRoutePrompt,
  generateRulesPrompt,
  generateSkillsPrompt,
  generateSkillsRoutePrompt,
  generateSpecRoutePrompt
} from '#~/prompt-builders.js'
import { generateWorkspaceRoutePrompt } from '#~/workspace-prompt.js'

describe('workspace asset prompt builders', () => {
  it('builds skill prompts with stable names, descriptions, and relative paths', () => {
    const cwd = '/tmp/project'

    const prompt = generateSkillsPrompt(cwd, [
      {
        path: join(cwd, '.ai/skills/research/SKILL.md'),
        body: '阅读 README.md\n',
        attributes: {
          description: '检索项目信息'
        }
      }
    ])

    expect(prompt).toContain('The following skill modules are loaded for the project')
    expect(prompt).toContain('# research')
    expect(prompt).toContain('> Skill description: 检索项目信息')
    expect(prompt).toContain('> Skill file path: .ai/skills/research/SKILL.md')
    expect(prompt).toContain('<skill-content>')
    expect(prompt).not.toContain('/tmp/project/.ai/skills/research/SKILL.md')
  })

  it('builds rules prompts with embedded always rules and summary-only optional rules', () => {
    const cwd = '/tmp/project'

    const prompt = generateRulesPrompt(cwd, [
      {
        path: join(cwd, '.ai/rules/base.md'),
        body: '始终检查公共边界。',
        attributes: {
          alwaysApply: true
        }
      },
      {
        path: join(cwd, '.ai/rules/optional.md'),
        body: '仅在需要时展开。',
        attributes: {
          description: '按需规则',
          alwaysApply: false
        }
      }
    ])

    expect(prompt).toContain('# base')
    expect(prompt).toContain('> 始终检查公共边界。')
    expect(prompt).toContain('> Use when: 按需规则')
    expect(prompt).toContain('> Rule file path: .ai/rules/optional.md')
    expect(prompt).not.toContain('> 仅在需要时展开。')
  })

  it('builds rule prompts with markdown headings and blockquotes', () => {
    const cwd = '/tmp/project'

    const prompt = generateRulesPrompt(cwd, [
      {
        path: join(cwd, '.ai/rules/required.md'),
        body: '# 标题\n\n正文',
        attributes: {
          alwaysApply: true
        }
      },
      {
        path: join(cwd, '.ai/rules/summary-only.md'),
        body: '不应该内联',
        attributes: {
          description: '只展示摘要',
          alwaysApply: false
        }
      }
    ])

    expect(prompt).toContain('# required')
    expect(prompt).toContain('> # 标题')
    expect(prompt).toContain('> 正文')
    expect(prompt).toContain('# summary-only')
    expect(prompt).toContain('> Use when: 只展示摘要')
    expect(prompt).toContain('> Rule file path: .ai/rules/summary-only.md')
    expect(prompt).not.toContain('> 不应该内联')
    expect(prompt).not.toContain('--------------------')
  })

  it('builds spec route prompts with logical identifiers and active identity guidance', () => {
    const cwd = '/tmp/project'

    const prompt = generateSpecRoutePrompt([
      {
        path: join(cwd, '.ai/specs/release/index.md'),
        body: '发布流程',
        attributes: {
          params: [
            {
              name: 'version',
              description: '版本号'
            }
          ]
        }
      }
    ], { active: true })

    expect(prompt).toContain('professional project execution manager')
    expect(prompt).toContain('Workflow name: release')
    expect(prompt).toContain('Identifier: release')
    expect(prompt).toContain('    - version: 版本号')
    expect(prompt).toContain('use the workflow identifier to locate and load the corresponding definition')
    expect(prompt).not.toContain('load-spec')
  })

  it('builds spec route prompts without exposing file paths', () => {
    const cwd = '/tmp/project'

    const prompt = generateSpecRoutePrompt([
      {
        path: join(cwd, '.ai/specs/release/index.md'),
        body: '发布流程\n执行发布任务',
        attributes: {
          params: [
            {
              name: 'version',
              description: '版本号'
            }
          ]
        }
      },
      {
        path: join(cwd, '.ai/specs/internal.md'),
        body: '内部流程',
        attributes: {
          always: false
        }
      }
    ])

    expect(prompt).toContain('Workflow name: release')
    expect(prompt).toContain('Description: 发布流程')
    expect(prompt).toContain('Identifier: release')
    expect(prompt).toContain('    - version: 版本号')
    expect(prompt).toContain('use the workflow identifier to locate and load the corresponding definition')
    expect(prompt).not.toContain('load-spec')
    expect(prompt).not.toContain('professional project execution manager')
    expect(prompt).not.toContain('.ai/specs/release/index.md')
    expect(prompt).not.toContain('internal')
  })

  it('builds entity routes from summaries instead of full bodies', () => {
    const cwd = '/tmp/project'

    const prompt = generateEntitiesRoutePrompt([
      {
        path: join(cwd, '.ai/entities/reviewer/README.md'),
        body: '负责代码审查\n需要关注变更风险',
        attributes: {}
      },
      {
        path: join(cwd, '.ai/entities/hidden.md'),
        body: '不应暴露',
        attributes: {
          name: 'hidden',
          always: false
        }
      }
    ])

    expect(prompt).toContain('reviewer: 负责代码审查')
    expect(prompt).toContain('`VibeForge.StartTasks`')
    expect(prompt).toContain('`VibeForge.GetTaskInfo`')
    expect(prompt).toContain('Task tool guide:')
    expect(prompt).toContain('After starting a task')
    expect(prompt).toContain('10 most recent log entries')
    expect(prompt).toContain('`logLimit`')
    expect(prompt).toContain('`logOrder`')
    expect(prompt).toContain('`VibeForge.SendTaskMessage`')
    expect(prompt).toContain('`{ taskId, message }`')
    expect(prompt).toContain('`VibeForge.SubmitTaskInput`')
    expect(prompt).toContain('Do not use it for ordinary follow-up instructions')
    expect(prompt).toContain('completed or failed tasks resume the same conversation')
    expect(prompt).toContain('keep working in that same thread of execution')
    expect(prompt).toContain('`wait`')
    expect(prompt).not.toContain('run-tasks')
    expect(prompt).not.toContain('需要关注变更风险')
    expect(prompt).not.toContain('hidden')
  })

  it('builds workspace routes with managed task guidance', () => {
    const cwd = '/tmp/project'

    const prompt = generateWorkspaceRoutePrompt(cwd, [
      {
        id: 'billing',
        cwd: join(cwd, 'packages/billing'),
        path: join(cwd, '.ai/workspaces/billing.md'),
        description: 'Billing workspace'
      }
    ])

    expect(prompt).toContain('The project includes the following registered workspaces')
    expect(prompt).toContain('Identifier: billing')
    expect(prompt).toContain('`VibeForge.StartTasks`')
    expect(prompt).toContain('type: "workspace"')
    expect(prompt).toContain('Task tool guide:')
    expect(prompt).toContain('`VibeForge.GetTaskInfo`')
    expect(prompt).toContain('`VibeForge.ListTasks`')
    expect(prompt).toContain('`VibeForge.SendTaskMessage`')
    expect(prompt).toContain('`VibeForge.SubmitTaskInput`')
    expect(prompt).toContain('Do not directly edit files inside a registered workspace')
  })

  it('builds skill route prompts without preloading content', () => {
    const cwd = '/tmp/project'

    const prompt = generateSkillsRoutePrompt(cwd, [
      {
        path: join(cwd, '.ai/skills/research/SKILL.md'),
        body: '阅读 README.md\n',
        attributes: {
          description: '检索项目信息'
        }
      }
    ])

    expect(prompt).toContain('# research')
    expect(prompt).toContain('> Skill description: 检索项目信息')
    expect(prompt).toContain('> Skill file path: .ai/skills/research/SKILL.md')
    expect(prompt).toContain(
      '> Do not preload the body by default; read the corresponding skill file only when the task clearly requires it.'
    )
    expect(prompt).not.toContain('<skill-content>')
    expect(prompt).not.toContain('阅读 README.md')
  })
})
