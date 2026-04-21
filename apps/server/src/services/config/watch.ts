/* eslint-disable max-lines -- config watcher keeps debounce, invalidation, and ref-counted lifecycle together. */
import type { Buffer } from 'node:buffer'
import { existsSync, statSync, watch } from 'node:fs'
import { resolve } from 'node:path'

import { resetConfigCache } from '@vibe-forge/config'

import { notifyConfigUpdated } from '#~/services/session/runtime.js'
import { logger } from '#~/utils/logger.js'

import { getWorkspaceFolder, loadConfigState } from './index.js'
import { buildBaseConfigWatchPlan, buildConfigWatchPlan } from './watch-plan.js'
const CONFIG_REFRESH_DEBOUNCE_MS = 120

interface DirectoryWatchEntry {
  controller: AbortController
  targets: Set<string>
}

interface ConfigWatchRuntime {
  workspaceFolder: string
  directoryWatches: Map<string, DirectoryWatchEntry>
  disposed: boolean
  refreshInFlight: boolean
  pendingRefresh: boolean
  refreshTimer?: NodeJS.Timeout
}

interface ConfigWatchRegistryEntry {
  refCount: number
  runtime: ConfigWatchRuntime
}

const configWatchRegistry = new Map<string, ConfigWatchRegistryEntry>()

const isDirectory = (value: string) => {
  try {
    return existsSync(value) && statSync(value).isDirectory()
  } catch {
    return false
  }
}

const shouldHandleDirectoryEvent = (
  dir: string,
  targets: Set<string>,
  filename: string | Buffer | null | undefined
) => {
  if (filename == null) return true
  return targets.has(resolve(dir, String(filename)))
}

const stopConfigWatchRuntime = (runtime: ConfigWatchRuntime) => {
  runtime.disposed = true
  if (runtime.refreshTimer != null) {
    clearTimeout(runtime.refreshTimer)
    runtime.refreshTimer = undefined
  }

  for (const entry of runtime.directoryWatches.values()) {
    entry.controller.abort()
  }
  runtime.directoryWatches.clear()
}

const syncDirectoryWatches = (
  runtime: ConfigWatchRuntime,
  plan: Map<string, Set<string>>
) => {
  for (const [dir, watchEntry] of runtime.directoryWatches.entries()) {
    if (!plan.has(dir) || !isDirectory(dir)) {
      watchEntry.controller.abort()
      runtime.directoryWatches.delete(dir)
    }
  }

  for (const [dir, targets] of plan.entries()) {
    if (!isDirectory(dir)) continue

    const existing = runtime.directoryWatches.get(dir)
    if (existing != null) {
      existing.targets = targets
      continue
    }

    const controller = new AbortController()
    const watchEntry: DirectoryWatchEntry = {
      controller,
      targets
    }
    const watcher = watch(
      dir,
      { signal: controller.signal },
      (_eventType, filename) => {
        if (runtime.disposed) return
        if (!shouldHandleDirectoryEvent(dir, watchEntry.targets, filename)) {
          return
        }
        scheduleConfigWatchRefresh(runtime)
      }
    )
    controller.signal.addEventListener('abort', () => {
      watcher.close()
    }, { once: true })
    runtime.directoryWatches.set(dir, watchEntry)
  }
}

const refreshConfigWatchRuntime = async (
  runtime: ConfigWatchRuntime,
  options: { broadcast: boolean }
) => {
  if (runtime.disposed) return

  if (runtime.refreshInFlight) {
    runtime.pendingRefresh = runtime.pendingRefresh || options.broadcast
    return
  }

  runtime.refreshInFlight = true

  try {
    resetConfigCache()
    const state = await loadConfigState(runtime.workspaceFolder)
    const plan = buildConfigWatchPlan(runtime.workspaceFolder, state)
    syncDirectoryWatches(runtime, plan)

    if (options.broadcast) {
      logger.info(
        { workspaceFolder: runtime.workspaceFolder },
        '[config] Detected config file change; reloading config cache'
      )
      notifyConfigUpdated(runtime.workspaceFolder)
    }
  } catch (error) {
    resetConfigCache()
    syncDirectoryWatches(runtime, buildBaseConfigWatchPlan(runtime.workspaceFolder))
    logger.warn({
      workspaceFolder: runtime.workspaceFolder,
      error: error instanceof Error ? error.message : String(error)
    }, '[config] Failed to refresh config watch targets after filesystem change')

    if (options.broadcast) {
      notifyConfigUpdated(runtime.workspaceFolder)
    }
  } finally {
    runtime.refreshInFlight = false

    if (runtime.pendingRefresh) {
      runtime.pendingRefresh = false
      void refreshConfigWatchRuntime(runtime, { broadcast: true })
    }
  }
}

const scheduleConfigWatchRefresh = (runtime: ConfigWatchRuntime) => {
  if (runtime.disposed) return

  if (runtime.refreshTimer != null) {
    clearTimeout(runtime.refreshTimer)
  }

  runtime.refreshTimer = setTimeout(() => {
    runtime.refreshTimer = undefined
    void refreshConfigWatchRuntime(runtime, { broadcast: true })
  }, CONFIG_REFRESH_DEBOUNCE_MS)
}

const createConfigWatchRuntime = async (workspaceFolder: string): Promise<ConfigWatchRuntime> => {
  const runtime: ConfigWatchRuntime = {
    workspaceFolder,
    directoryWatches: new Map(),
    disposed: false,
    refreshInFlight: false,
    pendingRefresh: false
  }

  await refreshConfigWatchRuntime(runtime, { broadcast: false })
  return runtime
}

export async function acquireConfigWatchRuntime(workspaceFolder = getWorkspaceFolder()) {
  const resolvedWorkspaceFolder = resolve(workspaceFolder)
  let registryEntry = configWatchRegistry.get(resolvedWorkspaceFolder)

  if (registryEntry == null) {
    registryEntry = {
      refCount: 0,
      runtime: await createConfigWatchRuntime(resolvedWorkspaceFolder)
    }
    configWatchRegistry.set(resolvedWorkspaceFolder, registryEntry)
  }

  registryEntry.refCount += 1

  let released = false
  return {
    release() {
      if (released) return
      released = true

      const current = configWatchRegistry.get(resolvedWorkspaceFolder)
      if (current == null) return

      current.refCount -= 1
      if (current.refCount > 0) return

      stopConfigWatchRuntime(current.runtime)
      configWatchRegistry.delete(resolvedWorkspaceFolder)
    }
  }
}
