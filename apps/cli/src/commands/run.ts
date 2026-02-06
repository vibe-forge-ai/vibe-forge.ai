import process from 'node:process'

import type { Command } from 'commander'

import { resolveTaskConfig, run } from '@vibe-forge/core/controllers/task'
import { uuid } from '@vibe-forge/core/utils/uuid'

import { extraOptions } from './@core/extra-options'

interface RunOptions {
  print: boolean
  model?: string
  adapter: string
  systemPrompt?: string
  sessionId?: string
  resume?: boolean
  spec?: string
  entity?: string
  outputFormat?: 'json' | 'stream-json' | 'text'
  includeMcpServer?: string[]
  excludeMcpServer?: string[]
  includeTool?: string[]
  excludeTool?: string[]
  includeSkill?: string[]
  excludeSkill?: string[]
}

export function registerRunCommand(program: Command) {
  program
    .argument('[description...]')
    .option('--print', 'Run in direct mode with printed output', false)
    .option('--model <model>', 'Model to use')
    .option('--adapter <adapter>', 'Adapter to use', 'claude-code')
    .option('--system-prompt <prompt>', 'System prompt')
    .option('--session-id <id>', 'Session ID')
    .option('--resume', 'Resume existing session', false)
    .option('--output-format <format>', 'Output format', 'text')
    .option('--spec <spec>', 'Load spec definition')
    .option('--entity <entity>', 'Load entity definition')
    .option('--include-mcp-server <server...>', 'Include MCP server')
    .option('--exclude-mcp-server <server...>', 'Exclude MCP server')
    .option('--include-tool <tool...>', 'Include tool')
    .option('--exclude-tool <tool...>', 'Exclude tool')
    .option('--include-skill <skill...>', 'Include skill')
    .option('--exclude-skill <skill...>', 'Exclude skill')
    .action(async (descriptionArgs: string[], opts: RunOptions) => {
      const description = descriptionArgs.join(' ')

      if (opts.spec && opts.entity) {
        console.error('Error: --spec and --entity are mutually exclusive.')
        process.exit(1)
      }

      const sessionId = opts.sessionId ?? uuid()
      const type = opts.resume ? 'resume' : 'create'

      const resolvedConfig = await resolveTaskConfig(
        opts.spec ? 'spec' : (opts.entity ? 'entity' : undefined),
        opts.spec || opts.entity,
        process.cwd()
      )

      const finalSystemPrompt = [
        resolvedConfig.systemPrompt,
        opts.systemPrompt
      ]
        .filter(Boolean)
        .join('\n\n')

      const toolsInclude = resolvedConfig.tools?.include || opts.includeTool
        ? [
          ...(resolvedConfig.tools?.include ?? []),
          ...(opts.includeTool ?? [])
        ]
        : undefined
      const toolsExclude = resolvedConfig.tools?.exclude || opts.excludeTool
        ? [
          ...(resolvedConfig.tools?.exclude ?? []),
          ...(opts.excludeTool ?? [])
        ]
        : undefined
      const tools = toolsInclude || toolsExclude
        ? {
          include: toolsInclude,
          exclude: toolsExclude
        }
        : undefined
      const mcpServersInclude = resolvedConfig.mcpServers?.include || opts.includeMcpServer
        ? [
          ...(resolvedConfig.mcpServers?.include ?? []),
          ...(opts.includeMcpServer ?? [])
        ]
        : undefined
      const mcpServersExclude = resolvedConfig.mcpServers?.exclude || opts.excludeMcpServer
        ? [
          ...(resolvedConfig.mcpServers?.exclude ?? []),
          ...(opts.excludeMcpServer ?? [])
        ]
        : undefined
      const mcpServers = mcpServersInclude || mcpServersExclude
        ? {
          include: mcpServersInclude,
          exclude: mcpServersExclude
        }
        : undefined
      const { session } = await run({
        adapter: opts.adapter,
        cwd: process.cwd(),
        env: process.env
      }, {
        type,
        description,
        runtime: 'cli',
        sessionId,
        model: opts.model,
        systemPrompt: finalSystemPrompt,
        mode: opts.print ? 'stream' : 'direct',
        tools,
        mcpServers,
        skills: opts.includeSkill || opts.excludeSkill
          ? {
            include: opts.includeSkill,
            exclude: opts.excludeSkill
          }
          : undefined,
        extraOptions,
        onEvent: (event) => {
          if (opts.print) {
            switch (opts.outputFormat) {
              case 'stream-json':
                console.log(JSON.stringify(event, null, 2))
                break
              case 'text':
                if (event.type === 'stop') {
                  console.log(event.data?.content)
                  session.kill()
                  process.exit(0)
                }
                break
              case 'json':
                if (event.type === 'stop') {
                  console.log(JSON.stringify(event, null, 2))
                  session.kill()
                  process.exit(0)
                }
                break
            }
          }
          if (event.type === 'exit') {
            process.exit(event.data.exitCode ?? 0)
          }
        }
      })
    })
}
