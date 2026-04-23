import { chmod, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  ensureManagedNpmCli,
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

  it('separates managed CLI installs by extra install key segments', () => {
    const paths = resolveManagedNpmCliPaths({
      adapterKey: 'skills_cli',
      binaryName: 'skills',
      cwd: '/tmp/worktree',
      env: {
        __VF_PROJECT_PRIMARY_WORKSPACE_FOLDER__: '/tmp/primary'
      },
      installKey: ['registry', 'https://registry.example.com'],
      packageName: 'skills',
      version: 'latest'
    })

    expect(paths.binaryPath).toBe(
      '/tmp/primary/.ai/caches/adapter-skills_cli/cli/npm/registry/https-registry.example.com/skills/latest/node_modules/.bin/skills'
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

  it('supports CLIs that use custom version arguments for managed install validation', async () => {
    const workspace = await mkdtemp(join(tmpdir(), 'vf-managed-npm-cli-'))
    const npmPath = join(workspace, 'npm')
    await writeFile(
      npmPath,
      `#!/bin/sh
if [ "$1" = "--version" ]; then
  echo "10.0.0"
  exit 0
fi

prefix=""
while [ "$#" -gt 0 ]; do
  if [ "$1" = "--prefix" ]; then
    shift
    prefix="$1"
  fi
  shift
done

if [ -z "$prefix" ]; then
  exit 2
fi

mkdir -p "$prefix/node_modules/.bin"
tool="$prefix/node_modules/.bin/tool"
{
  printf '%s\\n' '#!/bin/sh'
  printf '%s\\n' 'if [ "$1" = "version" ]; then echo "tool 1.0.0"; exit 0; fi'
  printf '%s\\n' 'exit 42'
} > "$tool"
chmod +x "$tool"
`
    )
    await chmod(npmPath, 0o755)

    try {
      const binaryPath = await ensureManagedNpmCli({
        adapterKey: 'custom_tool',
        binaryName: 'tool',
        cwd: workspace,
        defaultPackageName: '@example/tool',
        defaultVersion: '1.0.0',
        env: {
          __VF_PROJECT_AI_ADAPTER_CUSTOM_TOOL_NPM_PATH__: npmPath
        },
        logger: {
          info: () => undefined
        },
        versionArgs: ['version']
      })

      expect(binaryPath.endsWith('/node_modules/.bin/tool')).toBe(true)
    } finally {
      await rm(workspace, { recursive: true, force: true })
    }
  })

  it('prefers the project managed install over a user PATH binary by default', async () => {
    const workspace = await mkdtemp(join(tmpdir(), 'vf-managed-npm-cli-'))
    const systemBinDir = join(workspace, 'system-bin')
    const systemToolPath = join(systemBinDir, 'tool')
    const npmPath = join(workspace, 'npm')
    await writeFile(
      npmPath,
      `#!/bin/sh
if [ "$1" = "--version" ]; then
  echo "10.0.0"
  exit 0
fi

prefix=""
while [ "$#" -gt 0 ]; do
  if [ "$1" = "--prefix" ]; then
    shift
    prefix="$1"
  fi
  shift
done

if [ -z "$prefix" ]; then
  exit 2
fi

mkdir -p "$prefix/node_modules/.bin"
tool="$prefix/node_modules/.bin/tool"
{
  printf '%s\\n' '#!/bin/sh'
  printf '%s\\n' 'if [ "$1" = "--version" ]; then echo "managed 1.0.0"; exit 0; fi'
  printf '%s\\n' 'exit 42'
} > "$tool"
chmod +x "$tool"
`
    )
    await mkdir(systemBinDir, { recursive: true })
    await writeFile(
      systemToolPath,
      `#!/bin/sh
if [ "$1" = "--version" ]; then
  echo "system 0.1.0"
  exit 0
fi
exit 42
`
    )
    await chmod(npmPath, 0o755)
    await chmod(systemToolPath, 0o755)

    try {
      const binaryPath = await ensureManagedNpmCli({
        adapterKey: 'custom_tool',
        binaryName: 'tool',
        cwd: workspace,
        defaultPackageName: '@example/tool',
        defaultVersion: '1.0.0',
        env: {
          PATH: `${systemBinDir}:${process.env.PATH ?? ''}`,
          __VF_PROJECT_AI_ADAPTER_CUSTOM_TOOL_NPM_PATH__: npmPath
        },
        logger: {
          info: () => undefined
        }
      })

      expect(binaryPath).not.toBe('tool')
      expect(binaryPath).toContain('/.ai/caches/adapter-custom_tool/cli/npm/example-tool/1.0.0/')
    } finally {
      await rm(workspace, { recursive: true, force: true })
    }
  })

  it('uses the user PATH binary when source is explicitly system', async () => {
    const workspace = await mkdtemp(join(tmpdir(), 'vf-managed-npm-cli-'))
    const systemBinDir = join(workspace, 'system-bin')
    const systemToolPath = join(systemBinDir, 'tool')
    await mkdir(systemBinDir, { recursive: true })
    await writeFile(
      systemToolPath,
      `#!/bin/sh
if [ "$1" = "--version" ]; then
  echo "system 0.1.0"
  exit 0
fi
exit 42
`
    )
    await chmod(systemToolPath, 0o755)

    try {
      const binaryPath = await ensureManagedNpmCli({
        adapterKey: 'custom_tool',
        binaryName: 'tool',
        cwd: workspace,
        defaultPackageName: '@example/tool',
        defaultVersion: '1.0.0',
        env: {
          PATH: `${systemBinDir}:${process.env.PATH ?? ''}`,
          __VF_PROJECT_AI_ADAPTER_CUSTOM_TOOL_CLI_SOURCE__: 'system'
        },
        logger: {
          info: () => undefined
        }
      })

      expect(binaryPath).toBe('tool')
    } finally {
      await rm(workspace, { recursive: true, force: true })
    }
  })
})
