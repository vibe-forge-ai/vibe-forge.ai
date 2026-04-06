import { access, mkdir, readdir, rm, symlink, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import process from 'node:process'

import {
  hasManagedHookPlugins,
  prepareManagedHookRuntime,
  resolveManagedHookScriptPath,
  writeJsonFile
} from '@vibe-forge/hooks'
import type { AdapterCtx } from '@vibe-forge/types'

const MANAGED_PLUGIN_FILE_NAME = 'vibe-forge-hooks.js'
const DEFAULT_OPENCODE_CONFIG = {
  $schema: 'https://opencode.ai/config.json'
}

const pathExists = async (targetPath: string) => {
  try {
    await access(targetPath)
    return true
  } catch {
    return false
  }
}

const ensureSymlinkTarget = async (sourcePath: string, targetPath: string) => {
  await rm(targetPath, { recursive: true, force: true })
  await mkdir(dirname(targetPath), { recursive: true })
  await symlink(sourcePath, targetPath)
}

const mirrorDirectory = async (sourceDir: string, targetDir: string) => {
  if (!await pathExists(sourceDir)) return
  await rm(targetDir, { recursive: true, force: true })
  await mkdir(dirname(targetDir), { recursive: true })
  await symlink(sourceDir, targetDir)
}

const mirrorFile = async (sourcePath: string, targetPath: string) => {
  if (!await pathExists(sourcePath)) return false
  await ensureSymlinkTarget(sourcePath, targetPath)
  return true
}

const syncPluginDirectory = async (sourceDir: string | undefined, targetDir: string) => {
  await mkdir(targetDir, { recursive: true })

  const existingEntries = await readdir(targetDir).catch(() => [])
  await Promise.all(
    existingEntries
      .filter(entry => entry !== MANAGED_PLUGIN_FILE_NAME)
      .map(entry => rm(resolve(targetDir, entry), { recursive: true, force: true }))
  )

  if (sourceDir == null || !await pathExists(sourceDir)) return

  const sourceEntries = await readdir(sourceDir)
  for (const entry of sourceEntries) {
    if (entry === MANAGED_PLUGIN_FILE_NAME) continue
    await ensureSymlinkTarget(resolve(sourceDir, entry), resolve(targetDir, entry))
  }
}

const buildManagedPluginSource = () => {
  const callHookPath = resolveManagedHookScriptPath('call-hook.js')

  return `import { spawnSync } from "node:child_process"
import process from "node:process"

const ACTIVE_MARKER = "__VF_VIBE_FORGE_OPENCODE_HOOKS_ACTIVE__"
const NODE_PATH = process.env.__VF_PROJECT_NODE_PATH__ ?? ${JSON.stringify(process.execPath)}
const CALL_HOOK_PATH = ${JSON.stringify(callHookPath)}
const SESSION_ID = process.env.__VF_OPENCODE_TASK_SESSION_ID__ ?? "opencode-session"
const RUNTIME = process.env.__VF_OPENCODE_HOOK_RUNTIME__

const parseJson = (value, fallback) => {
  try {
    return JSON.parse(value)
  } catch {
    return fallback
  }
}

const createBaseInput = (hookEventName, cwd, canBlock) => ({
  hookEventName,
  cwd,
  sessionId: SESSION_ID,
  adapter: "opencode",
  runtime: RUNTIME,
  hookSource: "native",
  canBlock,
})

const callVibeForgeHook = (payload) => {
  if (process.env[ACTIVE_MARKER] !== "1") return { continue: true }

  try {
    const result = spawnSync(NODE_PATH, [CALL_HOOK_PATH], {
      input: JSON.stringify(payload),
      encoding: "utf8",
      env: {
        ...process.env,
        __VF_PROJECT_WORKSPACE_FOLDER__: payload.cwd ?? process.env.__VF_PROJECT_WORKSPACE_FOLDER__ ?? process.cwd(),
      },
    })

    if ((result.status ?? 0) !== 0) {
      console.error("[vibe-forge opencode hook] process exited with", result.status, result.stderr)
      return { continue: true }
    }

    const stdout = result.stdout?.trim()
    return stdout ? parseJson(stdout, { continue: true }) : { continue: true }
  } catch (error) {
    console.error("[vibe-forge opencode hook] failed", error)
    return { continue: true }
  }
}

const stopReason = (result, fallback) => (
  typeof result?.stopReason === "string" && result.stopReason.trim() !== ""
    ? result.stopReason.trim()
    : fallback
)

const normalizeToolName = (input) => {
  if (typeof input?.tool === "string" && input.tool.trim() !== "") return input.tool
  if (typeof input?.name === "string" && input.name.trim() !== "") return input.name
  return "unknown"
}

const normalizeToolInput = (input, output) => (
  output?.args ?? input?.args ?? input?.input ?? input
)

const normalizeToolResponse = (input, output) => (
  output?.result ?? output?.response ?? output?.data ?? input?.result ?? output
)

export const VibeForgeHooks = async ({ directory }) => ({
  event: async ({ event }) => {
    if (event?.type === "session.created") {
      callVibeForgeHook({
        ...createBaseInput("SessionStart", directory, true),
        source: "startup",
      })
      return
    }

    if (event?.type === "session.idle") {
      callVibeForgeHook(createBaseInput("Stop", directory, false))
    }
  },
  "tool.execute.before": async (input, output) => {
    const result = callVibeForgeHook({
      ...createBaseInput("PreToolUse", directory, true),
      toolName: normalizeToolName(input),
      toolInput: normalizeToolInput(input, output),
    })

    if (result?.continue === false) {
      throw new Error(stopReason(result, "blocked by Vibe Forge PreToolUse hook"))
    }
  },
  "tool.execute.after": async (input, output) => {
    const result = callVibeForgeHook({
      ...createBaseInput("PostToolUse", directory, true),
      toolName: normalizeToolName(input),
      toolInput: normalizeToolInput(input, output),
      toolResponse: normalizeToolResponse(input, output),
      isError: Boolean(output?.error ?? output?.isError ?? input?.error),
    })

    if (result?.continue === false) {
      throw new Error(stopReason(result, "blocked by Vibe Forge PostToolUse hook"))
    }
  },
})
`
}

const resolveSourceConfigDir = (ctx: Pick<AdapterCtx, 'env'>) => {
  const explicit = ctx.env.OPENCODE_CONFIG_DIR?.trim() || process.env.OPENCODE_CONFIG_DIR?.trim()
  if (explicit) return resolve(explicit)

  const realHome = process.env.__VF_PROJECT_REAL_HOME__?.trim()
  return realHome ? resolve(realHome, '.config', 'opencode') : undefined
}

export const ensureOpenCodeNativeHooksInstalled = async (
  ctx: Pick<AdapterCtx, 'cwd' | 'env' | 'logger' | 'assets'>
) => {
  const { env, logger, assets } = ctx

  env.__VF_PROJECT_AI_OPENCODE_NATIVE_HOOKS_AVAILABLE__ = '0'
  const enabled = hasManagedHookPlugins({ assets }) || env.__VF_PROJECT_AI_ENABLE_BUILTIN_PERMISSION_HOOKS__ === '1'

  try {
    const { mockHome } = prepareManagedHookRuntime(ctx)
    const sourceConfigDir = resolveSourceConfigDir(ctx)
    const managedConfigDir = resolve(mockHome, '.config', 'opencode')
    const pluginDir = resolve(managedConfigDir, 'plugins')
    const managedPluginPath = resolve(pluginDir, MANAGED_PLUGIN_FILE_NAME)

    await mkdir(managedConfigDir, { recursive: true })

    if (sourceConfigDir != null && resolve(sourceConfigDir) !== managedConfigDir) {
      await Promise.all([
        mirrorDirectory(resolve(sourceConfigDir, 'agents'), resolve(managedConfigDir, 'agents')),
        mirrorDirectory(resolve(sourceConfigDir, 'commands'), resolve(managedConfigDir, 'commands')),
        mirrorDirectory(resolve(sourceConfigDir, 'modes'), resolve(managedConfigDir, 'modes')),
        mirrorDirectory(resolve(sourceConfigDir, 'skills'), resolve(managedConfigDir, 'skills')),
        mirrorFile(resolve(sourceConfigDir, 'package.json'), resolve(managedConfigDir, 'package.json')),
        mirrorFile(resolve(sourceConfigDir, 'bun.lock'), resolve(managedConfigDir, 'bun.lock')),
        mirrorFile(resolve(sourceConfigDir, 'bun.lockb'), resolve(managedConfigDir, 'bun.lockb'))
      ])
      await syncPluginDirectory(resolve(sourceConfigDir, 'plugins'), pluginDir)
      if (!await mirrorFile(resolve(sourceConfigDir, 'opencode.json'), resolve(managedConfigDir, 'opencode.json'))) {
        await writeJsonFile(resolve(managedConfigDir, 'opencode.json'), DEFAULT_OPENCODE_CONFIG)
      }
    } else {
      await syncPluginDirectory(undefined, pluginDir)
      if (!await pathExists(resolve(managedConfigDir, 'opencode.json'))) {
        await writeJsonFile(resolve(managedConfigDir, 'opencode.json'), DEFAULT_OPENCODE_CONFIG)
      }
    }

    if (enabled) {
      await mkdir(pluginDir, { recursive: true })
      await writeFile(managedPluginPath, buildManagedPluginSource(), 'utf8')
    } else {
      await rm(managedPluginPath, { force: true })
    }

    env.OPENCODE_CONFIG_DIR = managedConfigDir
    env.__VF_PROJECT_AI_OPENCODE_NATIVE_HOOKS_AVAILABLE__ = enabled ? '1' : '0'
    return enabled
  } catch (error) {
    logger.warn('[opencode hooks] failed to install native hook bridge', error)
    env.__VF_PROJECT_AI_OPENCODE_NATIVE_HOOKS_AVAILABLE__ = '0'
    return false
  }
}
