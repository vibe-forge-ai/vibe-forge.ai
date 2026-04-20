import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import { applyServerRuntimeEnv } from '#~/cli-runtime.js'

describe('applyServerRuntimeEnv', () => {
  it('applies server defaults and resolves workspace-relative paths', () => {
    const repoRoot = process.cwd()
    const packageDir = resolve(repoRoot, 'apps/server')
    const env = applyServerRuntimeEnv({
      baseEnv: {},
      cwd: packageDir,
      packageDir,
      options: {
        configDir: '.ai/custom',
        workspace: '../..'
      },
      defaults: {
        allowCors: false,
        clientMode: 'none',
        entryKind: 'server',
        serverHost: '127.0.0.1',
        serverPort: '8787',
        serverWsPath: '/ws'
      }
    })

    expect(env.__VF_PROJECT_LAUNCH_CWD__).toBe(packageDir)
    expect(env.__VF_PROJECT_WORKSPACE_FOLDER__).toBe(repoRoot)
    expect(env.__VF_PROJECT_CONFIG_DIR__).toBe(resolve(packageDir, '.ai/custom'))
    expect(env.__VF_PROJECT_AI_SERVER_HOST__).toBe('127.0.0.1')
    expect(env.__VF_PROJECT_AI_SERVER_PORT__).toBe('8787')
    expect(env.__VF_PROJECT_AI_SERVER_WS_PATH__).toBe('/ws')
    expect(env.__VF_PROJECT_AI_SERVER_ALLOW_CORS__).toBe('false')
    expect(env.__VF_PROJECT_AI_CLIENT_MODE__).toBe('none')
    expect(env.__VF_PROJECT_AI_SERVER_ENTRY_KIND__).toBe('server')
    expect(env.HOME).toBe(resolve(repoRoot, '.ai/.mock'))
  })

  it('preserves explicit values for the integrated web entry', () => {
    const repoRoot = process.cwd()
    const packageDir = resolve(repoRoot, 'apps/web')
    const env = applyServerRuntimeEnv({
      baseEnv: {
        HOME: '/tmp/vf-home'
      },
      cwd: repoRoot,
      packageDir,
      options: {
        base: 'embedded',
        dataDir: '.vf-data',
        host: '0.0.0.0',
        logDir: '.vf-logs',
        port: '9000',
        publicBaseUrl: 'https://vf.example.com'
      },
      defaults: {
        allowCors: false,
        clientBase: '/ui',
        clientMode: 'static',
        entryKind: 'web',
        serverHost: '127.0.0.1',
        serverPort: '8787',
        serverWsPath: '/ws'
      }
    })

    expect(env.__VF_PROJECT_PACKAGE_DIR__).toBe(packageDir)
    expect(env.__VF_PROJECT_AI_SERVER_HOST__).toBe('0.0.0.0')
    expect(env.__VF_PROJECT_AI_SERVER_PORT__).toBe('9000')
    expect(env.__VF_PROJECT_AI_PUBLIC_BASE_URL__).toBe('https://vf.example.com')
    expect(env.__VF_PROJECT_AI_SERVER_DATA_DIR__).toBe('.vf-data')
    expect(env.__VF_PROJECT_AI_SERVER_LOG_DIR__).toBe('.vf-logs')
    expect(env.__VF_PROJECT_AI_CLIENT_MODE__).toBe('static')
    expect(env.__VF_PROJECT_AI_CLIENT_BASE__).toBe('embedded')
    expect(env.__VF_PROJECT_AI_SERVER_ENTRY_KIND__).toBe('web')
    expect(env.__VF_PROJECT_REAL_HOME__).toBe('/tmp/vf-home')
  })
})
