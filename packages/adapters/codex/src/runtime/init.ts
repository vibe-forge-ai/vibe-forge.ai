import { execFile } from 'node:child_process'
import { access, mkdir, readdir, rm } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import process from 'node:process'
import { promisify } from 'node:util'

import { readJsonFileOrDefault, resolveMockHome, writeJsonFile } from '@vibe-forge/hooks'
import type { AdapterCtx } from '@vibe-forge/types'
import { resolveProjectAiPath, syncSymlinkTarget } from '@vibe-forge/utils'

import { resolveCodexBinaryPath } from '#~/paths.js'
import { writeManagedCodexConfigFile } from './config'
import { ensureCodexNativeHooksInstalled } from './native-hooks'

const execFileAsync = promisify(execFile)
const CODEX_MANAGED_SKILLS_STATE_FILE = '.vibe-forge-managed-skills.json'

const syncCodexMockHomeSymlink = async (params: {
  sourcePath: string
  targetPath: string
  type: 'dir' | 'file'
}) => {
  await syncSymlinkTarget({
    ...params,
    onMissingSource: 'remove'
  })
}

/**
 * Symlink `<home>/.codex/auth.json` into `<aiHome>/.codex/auth.json` so
 * the codex process can authenticate when HOME is redirected to `.ai/.mock`.
 */
async function linkAuthFile(home: string, mockHome: string): Promise<void> {
  const realAuth = join(home, '.codex', 'auth.json')
  const aiCodexDir = join(mockHome, '.codex')
  const aiAuth = join(aiCodexDir, 'auth.json')

  await mkdir(aiCodexDir, { recursive: true })
  await syncCodexMockHomeSymlink({
    sourcePath: realAuth,
    targetPath: aiAuth,
    type: 'file'
  })
}

async function syncCodexMockHomeSkills(ctx: Pick<AdapterCtx, 'cwd' | 'env'>): Promise<void> {
  const sourceDir = resolveProjectAiPath(ctx.cwd, ctx.env, 'skills')
  const mockHome = resolveMockHome(ctx.cwd, ctx.env)

  await syncCodexMockHomeSymlink({
    sourcePath: sourceDir,
    targetPath: resolve(mockHome, '.agents', 'skills'),
    type: 'dir'
  })
  await syncCodexMockHomeNativeSkillEntries({
    sourceDir,
    targetDir: resolve(mockHome, '.codex', 'skills')
  })
}

const syncCodexMockHomeNativeSkillEntries = async (params: {
  sourceDir: string
  targetDir: string
}) => {
  const { sourceDir, targetDir } = params
  const statePath = join(targetDir, CODEX_MANAGED_SKILLS_STATE_FILE)
  const previousState = await readJsonFileOrDefault<{ skills?: unknown }>(statePath, {})
  const previousManagedSkills = Array.isArray(previousState.skills)
    ? previousState.skills.filter((name): name is string => typeof name === 'string' && name.trim() !== '')
    : []

  for (const skillName of previousManagedSkills) {
    await rm(join(targetDir, skillName), { recursive: true, force: true })
  }

  try {
    await access(sourceDir)
  } catch {
    await writeJsonFile(statePath, { skills: [] })
    return
  }

  await mkdir(targetDir, { recursive: true })
  const nextManagedSkills = (await readdir(sourceDir, { withFileTypes: true }))
    .filter(entry => !entry.name.startsWith('.') && (entry.isDirectory() || entry.isSymbolicLink()))
    .map(entry => entry.name)
    .sort((left, right) => left.localeCompare(right))

  for (const skillName of nextManagedSkills) {
    await syncCodexMockHomeSymlink({
      sourcePath: join(sourceDir, skillName),
      targetPath: join(targetDir, skillName),
      type: 'dir'
    })
  }

  await writeJsonFile(statePath, { skills: nextManagedSkills })
}

async function writeManagedCodexConfig(ctx: Pick<AdapterCtx, 'cwd' | 'env' | 'configs'>): Promise<void> {
  const mockHome = resolveMockHome(ctx.cwd, ctx.env)
  await writeManagedCodexConfigFile({
    configPath: join(mockHome, '.codex', 'config.toml'),
    workspacePath: ctx.cwd,
    configs: ctx.configs
  })
}

/**
 * Initialize the Codex adapter.
 *
 * Unlike the claude-code adapter (which generates a CCR config.json and
 * restarts a router), the Codex adapter manages its own `~/.codex/config.toml`
 * and accepts all configuration as per-connection or per-turn overrides in the
 * JSON-RPC protocol.
 *
 * This init step:
 *   1. Verifies that the `codex` binary is reachable.
 *   2. Symlinks the real `~/.codex/auth.json` into the mock HOME directory so
 *      authentication works under HOME isolation.
 *   3. Writes a managed mock-home `config.toml` for trust and startup defaults.
 *   4. Installs a workspace-local native hooks bridge into the mock Codex home.
 */
export const initCodexAdapter = async (ctx: AdapterCtx) => {
  const { env } = ctx

  const home = ctx.env.__VF_PROJECT_REAL_HOME__?.trim() || process.env.__VF_PROJECT_REAL_HOME__?.trim()
  const mockHome = resolveMockHome(ctx.cwd, ctx.env)

  const binaryPath = resolveCodexBinaryPath(env)

  try {
    await execFileAsync(String(binaryPath), ['--version'])
  } catch {
    // Non-fatal: the binary might not be installed globally, or it might be
    // installed but the --version flag might not exist in older builds.
  }

  if (home != null && home !== '') {
    await linkAuthFile(home, mockHome)
  }
  await syncCodexMockHomeSkills(ctx)
  await writeManagedCodexConfig(ctx)
  await ensureCodexNativeHooksInstalled(ctx)
}
