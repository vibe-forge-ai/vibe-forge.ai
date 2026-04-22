import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const clientMode = process.env.__VF_PROJECT_AI_CLIENT_MODE__
const clientDeployMode = process.env.__VF_PROJECT_AI_CLIENT_DEPLOY_MODE__
const isDev = clientMode === 'dev'
const isStandalone = clientMode === 'standalone' ||
  clientMode === 'independent' ||
  clientDeployMode === 'standalone' ||
  clientDeployMode === 'independent'
const clientBase = isDev
  ? (process.env.__VF_PROJECT_AI_CLIENT_BASE__ ?? '/')
  : isStandalone
  ? (process.env.__VF_PROJECT_AI_CLIENT_BASE__ ?? '/')
  : '/__VF_PROJECT_AI_CLIENT_BASE__/'
const repoRoot = fileURLToPath(new URL('../..', import.meta.url))
const clientPackageJson = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  version?: string
}

const readGit = (args: string[]) =>
  execFileSync('git', args, {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore']
  }).trim()

const resolveDevGitRef = () => {
  try {
    return readGit(['symbolic-ref', '--short', 'HEAD'])
  } catch {
    try {
      return `detached@${readGit(['rev-parse', '--short', 'HEAD'])}`
    } catch {
      return ''
    }
  }
}

const resolveGitCommitHash = () => {
  try {
    return readGit(['rev-parse', 'HEAD'])
  } catch {
    return ''
  }
}

const devGitRef = isDev ? resolveDevGitRef() : ''
process.env.__VF_PROJECT_AI_DEV_GIT_REF__ = devGitRef
process.env.__VF_PROJECT_AI_CLIENT_VERSION__ ??= clientPackageJson.version ?? ''
process.env.__VF_PROJECT_AI_CLIENT_COMMIT_HASH__ ??= resolveGitCommitHash()
const normalizeTitle = (title: string) => title.trim().replace(/\s+\[[^\]]+\]$/, '')

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'vibe-forge-dev-document-title',
      transformIndexHtml(html) {
        if (!isDev || devGitRef === '') {
          return html
        }
        return html.replace(/<title>([^<]*)<\/title>/, (_match, title: string) => {
          return `<title>${normalizeTitle(title)} [${devGitRef}]</title>`
        })
      }
    }
  ],
  root: '.',
  base: clientBase,
  resolve: {
    alias: [
      {
        find: '@vibe-forge/core/channel',
        replacement: fileURLToPath(new URL('../../packages/core/src/channel.ts', import.meta.url))
      },
      {
        find: '@vibe-forge/plugin-chrome-devtools/schema',
        replacement: fileURLToPath(new URL('../../packages/plugins/chrome-devtools/src/schema.ts', import.meta.url))
      },
      {
        find: '@vibe-forge/utils/model-selection',
        replacement: fileURLToPath(new URL('../../packages/utils/src/model-selection.ts', import.meta.url))
      },
      {
        find: '@vibe-forge/utils/log-level',
        replacement: fileURLToPath(new URL('../../packages/utils/src/log-level.ts', import.meta.url))
      },
      {
        find: '@vibe-forge/channel-lark',
        replacement: fileURLToPath(new URL('../../packages/channels/lark/src/index.ts', import.meta.url))
      },
      {
        find: '@vibe-forge/core',
        replacement: fileURLToPath(new URL('../../packages/core/src/index.ts', import.meta.url))
      },
      {
        find: '@vibe-forge/types',
        replacement: fileURLToPath(new URL('../../packages/types/src/index.ts', import.meta.url))
      },
      {
        find: '@vibe-forge/utils',
        replacement: fileURLToPath(new URL('../../packages/utils/src/index.ts', import.meta.url))
      }
    ],
    conditions: ['browser', '__vibe-forge__', 'module', 'import', 'development']
  },
  server: {
    host: process.env.__VF_PROJECT_AI_CLIENT_HOST__,
    port: Number(process.env.__VF_PROJECT_AI_CLIENT_PORT__ ?? 5173)
  },
  envPrefix: [
    '__VF_PROJECT_AI_'
  ],
  css: {
    preprocessorOptions: {
      scss: {
        api: 'modern-compiler'
      }
    }
  }
})
