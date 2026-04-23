import '../src/adapter-config'

import { chmod, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { delimiter, join } from 'node:path'
import { PassThrough } from 'node:stream'

import { describe, expect, it } from 'vitest'

import { resolveKimiBinaryPath, resolveKimiManagedToolPaths } from '../src/paths'
import { buildKimiAgentFileContent, deepMerge } from '../src/runtime/common'
import { resolveKimiSessionBase } from '../src/runtime/config'
import {
  buildKimiCliInstallArgs,
  buildKimiCliInstallEnv,
  buildKimiCliInstallInstructions,
  ensureKimiCli,
  initKimiAdapter,
  resolveKimiCliInstallOptions
} from '../src/runtime/init'
import { parseKimiOutputLine } from '../src/runtime/messages'

import type { AdapterCtx } from '@vibe-forge/types'

const createCtx = async () => {
  const cwd = await mkdtemp(join(tmpdir(), 'vf-kimi-test-'))
  const ctx: AdapterCtx = {
    ctxId: 'ctx-kimi',
    cwd,
    env: {
      KIMI_API_KEY: 'kimi-token'
    },
    cache: {
      set: async () => ({ cachePath: join(cwd, '.ai', 'cache', 'base.json') }),
      get: async () => undefined
    },
    logger: {
      stream: new PassThrough(),
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {}
    },
    configs: [{
      adapters: {
        kimi: {
          agent: 'okabe',
          maxStepsPerTurn: 12
        }
      },
      modelServices: {
        kimiService: {
          apiBaseUrl: 'https://api.openai.com/v1/responses',
          apiKey: 'service-token',
          models: ['gpt-5'],
          extra: {
            kimi: {
              maxContextSize: 123456
            }
          }
        }
      }
    }, undefined]
  }

  return {
    ctx,
    cleanup: () => rm(cwd, { recursive: true, force: true })
  }
}

describe('kimi runtime helpers', () => {
  it('builds a custom agent file when system prompt or tool filtering is requested', () => {
    const content = buildKimiAgentFileContent({
      agent: 'okabe',
      systemPrompt: 'Follow repo rules.',
      tools: {
        include: ['Shell', 'ReadFile']
      }
    })

    expect(content).toContain('extend: okabe')
    expect(content).toContain('system_prompt_path: ./system.md')
    expect(content).toContain('"kimi_cli.tools.shell:Shell"')
    expect(content).toContain('"kimi_cli.tools.file:ReadFile"')
    expect(content).not.toContain('"kimi_cli.tools.web:SearchWeb"')
  })

  it('deep-merges object config without clobbering scalar values', () => {
    expect(deepMerge({
      provider: {
        default: {
          timeout: 3000
        }
      },
      default_model: 'base-model'
    }, {
      provider: {
        default: {
          retries: 2
        }
      },
      default_model: 'override-model'
    })).toEqual({
      provider: {
        default: {
          timeout: 3000,
          retries: 2
        }
      },
      default_model: 'override-model'
    })
  })

  it('resolves a managed Kimi CLI binary before falling back to PATH', async () => {
    const { ctx, cleanup } = await createCtx()
    try {
      const paths = resolveKimiManagedToolPaths(ctx.cwd)
      const binaryPath = paths.binaryCandidates[0]
      await mkdir(paths.binDir, { recursive: true })
      await writeFile(binaryPath, '#!/bin/sh\n')
      await chmod(binaryPath, 0o755)

      expect(resolveKimiBinaryPath({}, ctx.cwd)).toBe(await realpath(binaryPath))
      expect(resolveKimiBinaryPath({
        __VF_PROJECT_AI_ADAPTER_KIMI_CLI_PATH__: '/usr/local/bin/kimi'
      }, ctx.cwd)).toBe('/usr/local/bin/kimi')
    } finally {
      await cleanup()
    }
  })

  it('uses the primary workspace shared cache for managed Kimi CLI paths', async () => {
    const { ctx, cleanup } = await createCtx()
    const primary = await mkdtemp(join(tmpdir(), 'vf-kimi-primary-'))
    try {
      ctx.env.__VF_PROJECT_PRIMARY_WORKSPACE_FOLDER__ = primary
      const paths = resolveKimiManagedToolPaths(ctx.cwd, ctx.env)
      const binaryPath = paths.binaryCandidates[0]

      await mkdir(paths.binDir, { recursive: true })
      await writeFile(binaryPath, '#!/bin/sh\n')
      await chmod(binaryPath, 0o755)

      expect(paths.rootDir).toBe(join(primary, '.ai', 'caches', 'adapter-kimi', 'cli'))
      expect(resolveKimiBinaryPath(ctx.env, ctx.cwd)).toBe(await realpath(binaryPath))
      expect(buildKimiCliInstallEnv(ctx).UV_TOOL_DIR).toBe(paths.toolDir)
    } finally {
      await cleanup()
      await rm(primary, { recursive: true, force: true })
    }
  })

  it('builds shared-cache uv tool install options for managed Kimi CLI installs', async () => {
    const { ctx, cleanup } = await createCtx()
    try {
      const options = resolveKimiCliInstallOptions({
        __VF_PROJECT_AI_ADAPTER_KIMI_AUTO_INSTALL__: 'false',
        __VF_PROJECT_AI_ADAPTER_KIMI_INSTALL_PACKAGE__: 'kimi-cli==1.2.3',
        __VF_PROJECT_AI_ADAPTER_KIMI_INSTALL_PYTHON__: '3.14',
        __VF_PROJECT_AI_ADAPTER_KIMI_UV_PATH__: '/opt/bin/uv'
      }, {
        autoInstall: true,
        installPackage: 'ignored',
        installPython: '3.13',
        uvPath: 'ignored'
      })
      const installEnv = buildKimiCliInstallEnv(ctx)
      const paths = resolveKimiManagedToolPaths(ctx.cwd)

      expect(options).toEqual({
        autoInstall: false,
        binaryPath: undefined,
        packageName: 'kimi-cli==1.2.3',
        python: '3.14',
        source: undefined,
        uvPath: '/opt/bin/uv'
      })
      expect(buildKimiCliInstallArgs(options)).toEqual([
        'tool',
        'install',
        '--python',
        '3.14',
        'kimi-cli==1.2.3'
      ])
      expect(installEnv.UV_TOOL_DIR).toBe(paths.toolDir)
      expect(installEnv.UV_TOOL_BIN_DIR).toBe(paths.binDir)
      expect(installEnv.UV_CACHE_DIR).toBe(paths.cacheDir)
      expect(installEnv.UV_PYTHON_INSTALL_DIR).toBe(paths.pythonDir)
      expect(installEnv.UV_PYTHON_BIN_DIR).toBe(paths.pythonBinDir)
      expect(installEnv.UV_NO_MODIFY_PATH).toBe('1')
    } finally {
      await cleanup()
    }
  })

  it('accepts nested Kimi CLI config for managed package version control', () => {
    expect(resolveKimiCliInstallOptions({}, {
      cli: {
        autoInstall: false,
        package: 'kimi-cli',
        path: '/opt/kimi/bin/kimi',
        python: '3.14',
        source: 'path',
        uvPath: '/opt/bin/uv',
        version: '1.2.3'
      },
      autoInstall: true,
      installPackage: 'ignored',
      installPython: '3.13',
      uvPath: 'ignored'
    })).toEqual({
      autoInstall: false,
      binaryPath: '/opt/kimi/bin/kimi',
      packageName: 'kimi-cli==1.2.3',
      python: '3.14',
      source: 'path',
      uvPath: '/opt/bin/uv'
    })
  })

  it('renders actionable install instructions when Kimi CLI or uv is missing', async () => {
    const { ctx, cleanup } = await createCtx()
    try {
      const options = resolveKimiCliInstallOptions({
        __VF_PROJECT_AI_ADAPTER_KIMI_INSTALL_PACKAGE__: 'kimi-cli==1.2.3',
        __VF_PROJECT_AI_ADAPTER_KIMI_INSTALL_PYTHON__: '3.14',
        __VF_PROJECT_AI_ADAPTER_KIMI_UV_PATH__: '/opt/bin/uv'
      })
      const instructions = buildKimiCliInstallInstructions(ctx, options)

      expect(instructions).toContain('https://code.kimi.com/install.sh')
      expect(instructions).toContain('https://astral.sh/uv/install.sh')
      expect(instructions).toContain('brew install uv')
      expect(instructions).toContain('/opt/bin/uv tool install --python 3.14 kimi-cli==1.2.3')
      expect(instructions).toContain('__VF_PROJECT_AI_ADAPTER_KIMI_CLI_PATH=/absolute/path/to/kimi')
      expect(instructions).toContain(resolveKimiManagedToolPaths(ctx.cwd).binDir)
    } finally {
      await cleanup()
    }
  })

  it('throws actionable install instructions when Kimi CLI is missing and auto-install is disabled', async () => {
    const { ctx, cleanup } = await createCtx()
    try {
      const emptyBinDir = join(ctx.cwd, 'empty-bin')
      await mkdir(emptyBinDir)
      ctx.env.PATH = emptyBinDir
      ctx.env.__VF_PROJECT_AI_ADAPTER_KIMI_AUTO_INSTALL__ = 'false'

      await expect(initKimiAdapter(ctx)).rejects.toThrow('https://code.kimi.com/install.sh')
    } finally {
      await cleanup()
    }
  })

  it.skipIf(process.platform === 'win32')('falls back to PATH when a managed Kimi binary is stale', async () => {
    const { ctx, cleanup } = await createCtx()
    try {
      const paths = resolveKimiManagedToolPaths(ctx.cwd)
      const managedBinaryPath = paths.binaryCandidates[0]
      const fakeBinDir = join(ctx.cwd, 'fake-bin')
      const fakePathBinary = join(fakeBinDir, 'kimi')

      await mkdir(paths.binDir, { recursive: true })
      await mkdir(fakeBinDir, { recursive: true })
      await writeFile(managedBinaryPath, '#!/bin/sh\nexit 1\n')
      await writeFile(fakePathBinary, '#!/bin/sh\necho kimi 1.0\n')
      await chmod(managedBinaryPath, 0o755)
      await chmod(fakePathBinary, 0o755)

      ctx.env.PATH = `${fakeBinDir}${delimiter}${process.env.PATH ?? ''}`

      await initKimiAdapter(ctx)

      expect(ctx.env.__VF_PROJECT_AI_ADAPTER_KIMI_CLI_PATH__).toBe('kimi')
    } finally {
      await cleanup()
    }
  })

  it.skipIf(process.platform === 'win32')(
    'prefers an auto-installed managed Kimi CLI over PATH by default',
    async () => {
      const { ctx, cleanup } = await createCtx()
      try {
        const fakeBinDir = join(ctx.cwd, 'fake-bin')
        const fakePathBinary = join(fakeBinDir, 'kimi')
        const fakeUvPath = join(ctx.cwd, 'uv')

        await mkdir(fakeBinDir, { recursive: true })
        await writeFile(fakePathBinary, '#!/bin/sh\necho kimi system\n')
        await writeFile(
          fakeUvPath,
          `#!/bin/sh
if [ "$1" = "--version" ]; then
  echo "uv 0.1.0"
  exit 0
fi

if [ "$1" = "tool" ] && [ "$2" = "install" ]; then
  mkdir -p "$UV_TOOL_BIN_DIR"
  tool="$UV_TOOL_BIN_DIR/kimi"
  {
    printf '%s\\n' '#!/bin/sh'
    printf '%s\\n' 'if [ "$1" = "--version" ]; then echo "kimi managed"; exit 0; fi'
    printf '%s\\n' 'exit 42'
  } > "$tool"
  chmod +x "$tool"
  exit 0
fi

exit 2
`
        )
        await chmod(fakePathBinary, 0o755)
        await chmod(fakeUvPath, 0o755)

        ctx.env.PATH = `${fakeBinDir}${delimiter}${process.env.PATH ?? ''}`
        ctx.env.__VF_PROJECT_AI_ADAPTER_KIMI_UV_PATH__ = fakeUvPath

        const binaryPath = await ensureKimiCli(ctx)

        expect(binaryPath).not.toBe('kimi')
        expect(binaryPath).toContain('/.ai/caches/adapter-kimi/cli/bin/kimi')
        expect(ctx.env.__VF_PROJECT_AI_ADAPTER_KIMI_CLI_PATH__).toBe(binaryPath)
      } finally {
        await cleanup()
      }
    }
  )

  it('builds routed config for Kimi print sessions', async () => {
    const { ctx, cleanup } = await createCtx()
    try {
      const base = await resolveKimiSessionBase(ctx, {
        type: 'create',
        runtime: 'cli',
        sessionId: 'session-kimi',
        model: 'kimiService,gpt-5',
        onEvent: () => {}
      })

      expect(base.cliModel).toBe('kimiService__gpt-5')
      expect(base.reportedAgent).toBe('okabe')
      expect(base.turnArgPrefix).toEqual(expect.arrayContaining([
        '--config-file',
        expect.stringContaining('/config.json'),
        '--agent',
        'okabe',
        '--model',
        'kimiService__gpt-5',
        '--max-steps-per-turn',
        '12'
      ]))

      const configPath = base.turnArgPrefix.at(base.turnArgPrefix.indexOf('--config-file') + 1)
      expect(configPath).toBeDefined()
      const config = JSON.parse(await readFile(configPath as string, 'utf8')) as {
        default_model?: string
        providers?: Record<string, { type?: string; base_url?: string; api_key?: string }>
        models?: Record<string, { provider?: string; model?: string; max_context_size?: number }>
      }

      expect(config.default_model).toBe('kimiService__gpt-5')
      expect(config.providers?.kimiService).toMatchObject({
        type: 'openai_responses',
        base_url: 'https://api.openai.com/v1',
        api_key: 'service-token'
      })
      expect(config.models?.['kimiService__gpt-5']).toMatchObject({
        provider: 'kimiService',
        model: 'gpt-5',
        max_context_size: 123456
      })
    } finally {
      await cleanup()
    }
  })

  it('normalizes Moonshot chat completions URLs for Kimi providers', async () => {
    const { ctx, cleanup } = await createCtx()
    try {
      ctx.configs = [{
        modelServices: {
          kimi: {
            apiBaseUrl: 'https://api.moonshot.ai/v1/chat/completions',
            apiKey: 'kimi-token',
            models: ['kimi-k2.5']
          }
        }
      }, undefined]

      const base = await resolveKimiSessionBase(ctx, {
        type: 'create',
        runtime: 'cli',
        sessionId: 'session-kimi-moonshot',
        model: 'kimi,kimi-k2.5',
        onEvent: () => {}
      })
      const configPath = base.turnArgPrefix.at(base.turnArgPrefix.indexOf('--config-file') + 1)
      expect(configPath).toBeDefined()
      const config = JSON.parse(await readFile(configPath as string, 'utf8')) as {
        providers?: Record<string, { type?: string; base_url?: string }>
        services?: Record<string, { base_url?: string }>
      }

      expect(config.providers?.kimi).toMatchObject({
        type: 'kimi',
        base_url: 'https://api.moonshot.ai/v1'
      })
      expect(config.services?.moonshot_search).toMatchObject({
        base_url: 'https://api.moonshot.ai/v1/search'
      })
      expect(config.services?.moonshot_fetch).toMatchObject({
        base_url: 'https://api.moonshot.ai/v1/fetch'
      })
    } finally {
      await cleanup()
    }
  })

  it('parses assistant tool calls and tool results from print-mode JSONL', () => {
    const assistant = parseKimiOutputLine(
      '{"role":"assistant","content":"check","tool_calls":[{"id":"tc_1","function":{"name":"Shell","arguments":"{\\"command\\":\\"ls\\"}"}}]}',
      'kimi-for-coding'
    )
    const tool = parseKimiOutputLine(
      '{"role":"tool","tool_call_id":"tc_1","content":"ok"}',
      'kimi-for-coding'
    )

    expect(assistant?.content).toEqual([
      { type: 'text', text: 'check' },
      { type: 'tool_use', id: 'tc_1', name: 'Shell', input: { command: 'ls' } }
    ])
    expect(tool?.content).toEqual([
      { type: 'tool_result', tool_use_id: 'tc_1', content: 'ok' }
    ])
  })
})
