import { loadAdapterCliPreparer, normalizeAdapterPackageId } from '@vibe-forge/types'
import type { AdapterCliPrepareTarget, AdapterCliPreparer, Config } from '@vibe-forge/types'

const KNOWN_PREPARE_ADAPTERS = [
  'codex',
  'claude-code',
  'gemini',
  'copilot',
  'opencode',
  'kimi'
]

const SPECIAL_TARGET_ALIASES: Record<string, { adapter: string; target: string }> = {
  ccr: {
    adapter: 'claude-code',
    target: 'routerCli'
  },
  'claude-code-router': {
    adapter: 'claude-code',
    target: 'routerCli'
  }
}

interface AdapterPrepareRequest {
  adapter: string
  target: AdapterCliPrepareTarget
  preparer: AdapterCliPreparer
}

type ParsedAdapterPrepareTarget =
  | { all: true }
  | { adapter: string; target?: string }

const isPlainRecord = (value: unknown): value is Record<string, unknown> => (
  value != null && typeof value === 'object' && !Array.isArray(value)
)

const normalizeAdapterId = (value: string) => {
  const normalized = normalizeAdapterPackageId(value)
  return normalized.startsWith('adapter-') ? normalized.slice('adapter-'.length) : normalized
}

const readPath = (value: unknown, path: string[]) => {
  let current = value
  for (const segment of path) {
    if (!isPlainRecord(current)) return undefined
    current = current[segment]
  }
  return current
}

const isTargetPrepareOnInstallEnabled = (
  config: Config,
  adapter: string,
  target: AdapterCliPrepareTarget
) => {
  const adapterConfig = (config.adapters as Record<string, unknown> | undefined)?.[adapter]
  const cliConfig = readPath(adapterConfig, target.configPath ?? [target.key])
  return isPlainRecord(cliConfig) && cliConfig.prepareOnInstall === true
}

const targetMatches = (target: AdapterCliPrepareTarget, value: string) => (
  target.key === value || target.aliases?.includes(value) === true
)

export const parseAdapterPrepareTargetInput = (rawValue: string): ParsedAdapterPrepareTarget | undefined => {
  const value = rawValue.trim()
  if (value === '') return undefined
  if (value === 'all') return { all: true as const }

  const specialTarget = SPECIAL_TARGET_ALIASES[value]
  if (specialTarget != null) return specialTarget

  const [rawAdapter, rawTarget] = value.split('.', 2)
  return {
    adapter: normalizeAdapterId(rawAdapter),
    target: rawTarget
  }
}

const pushUniqueRequest = (
  requests: AdapterPrepareRequest[],
  request: AdapterPrepareRequest
) => {
  const key = `${request.adapter}.${request.target.key}`
  if (requests.some(item => `${item.adapter}.${item.target.key}` === key)) return
  requests.push(request)
}

export const resolveAdapterPrepareRequests = (params: {
  all?: boolean
  config: Config
  preparers: AdapterCliPreparer[]
  targets: string[]
}): AdapterPrepareRequest[] => {
  const requests: AdapterPrepareRequest[] = []

  if (params.all === true) {
    for (const preparer of params.preparers) {
      for (const target of preparer.targets) {
        pushUniqueRequest(requests, {
          adapter: preparer.adapter,
          preparer,
          target
        })
      }
    }
    return requests
  }

  if (params.targets.length === 0) {
    for (const preparer of params.preparers) {
      for (const target of preparer.targets) {
        if (!isTargetPrepareOnInstallEnabled(params.config, preparer.adapter, target)) continue
        pushUniqueRequest(requests, {
          adapter: preparer.adapter,
          preparer,
          target
        })
      }
    }
    return requests
  }

  for (const rawTarget of params.targets) {
    const parsedTarget = parseAdapterPrepareTargetInput(rawTarget)
    if (parsedTarget == null) continue
    if ('all' in parsedTarget) {
      return resolveAdapterPrepareRequests({
        ...params,
        all: true,
        targets: []
      })
    }

    const preparer = params.preparers.find(item => item.adapter === parsedTarget.adapter)
    if (preparer == null) {
      throw new Error(`Unknown adapter CLI prepare target: ${rawTarget}`)
    }

    const targets = parsedTarget.target == null
      ? preparer.targets
      : preparer.targets.filter(target => targetMatches(target, parsedTarget.target!))
    if (targets.length === 0) {
      throw new Error(`Unknown adapter CLI prepare target: ${rawTarget}`)
    }

    for (const target of targets) {
      pushUniqueRequest(requests, {
        adapter: preparer.adapter,
        preparer,
        target
      })
    }
  }

  return requests
}

export const loadAdapterPreparePreparers = async (params: {
  config: Config
  requiredTargets: string[]
}) => {
  const configuredAdapters = Object.keys(params.config.adapters ?? {})
  const requestedAdapters = params.requiredTargets
    .map(parseAdapterPrepareTargetInput)
    .filter((value): value is { adapter: string; target?: string } => value != null && !('all' in value))
    .map(value => value.adapter)
  const adapterIds = Array.from(new Set([...KNOWN_PREPARE_ADAPTERS, ...configuredAdapters, ...requestedAdapters]))
  const preparers: AdapterCliPreparer[] = []

  for (const adapterId of adapterIds) {
    try {
      preparers.push(await loadAdapterCliPreparer(adapterId))
    } catch (error) {
      if (requestedAdapters.includes(adapterId)) throw error
    }
  }

  return preparers
}
