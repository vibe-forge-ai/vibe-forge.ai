import { describe, expect, it } from 'vitest'

import {
  resolveManagedNpmCliBinaryPath,
  resolveManagedNpmCliInstallOptions,
  resolveManagedNpmCliPaths
} from '#~/managed-npm-cli.js'

describe('managed npm cli utils', () => {
  it('resolves managed CLI paths from the primary workspace shared cache', () => {
    const paths = resolveManagedNpmCliPaths({
      adapterKey: 'codex',
      binaryName: 'codex',
      cwd: '/tmp/worktree',
      env: {
        __VF_PROJECT_PRIMARY_WORKSPACE_FOLDER__: '/tmp/primary'
      },
      packageName: '@openai/codex',
      version: '0.121.0'
    })

    expect(paths.binaryPath).toBe(
      '/tmp/primary/.ai/caches/adapter-codex/cli/npm/openai-codex/0.121.0/node_modules/.bin/codex'
    )
  })

  it('uses env version and package overrides when building install options', () => {
    expect(resolveManagedNpmCliInstallOptions({
      adapterKey: 'gemini',
      defaultPackageName: '@google/gemini-cli',
      defaultVersion: '0.38.2',
      env: {
        __VF_PROJECT_AI_ADAPTER_GEMINI_INSTALL_PACKAGE__: '@example/gemini',
        __VF_PROJECT_AI_ADAPTER_GEMINI_INSTALL_VERSION__: '1.2.3',
        __VF_PROJECT_AI_ADAPTER_GEMINI_CLI_SOURCE__: 'managed',
        __VF_PROJECT_AI_ADAPTER_GEMINI_NPM_PATH__: '/opt/npm'
      }
    })).toMatchObject({
      npmPath: '/opt/npm',
      packageName: '@example/gemini',
      packageSpec: '@example/gemini@1.2.3',
      source: 'managed',
      version: '1.2.3'
    })
  })

  it('returns the managed candidate path when source is forced to managed', () => {
    expect(resolveManagedNpmCliBinaryPath({
      adapterKey: 'opencode',
      binaryName: 'opencode',
      cwd: '/tmp/worktree',
      defaultPackageName: 'opencode-ai',
      defaultVersion: '1.14.18',
      env: {
        __VF_PROJECT_PRIMARY_WORKSPACE_FOLDER__: '/tmp/primary',
        __VF_PROJECT_AI_ADAPTER_OPENCODE_CLI_SOURCE__: 'managed'
      }
    })).toBe(
      '/tmp/primary/.ai/caches/adapter-opencode/cli/npm/opencode-ai/1.14.18/node_modules/.bin/opencode'
    )
  })
})
