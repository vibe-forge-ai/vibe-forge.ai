import { resolveAdapterCommonConfig, resolveConfigState } from '@vibe-forge/config'
import { callHook, createAdapterHookBridge } from '@vibe-forge/hooks'
import type { HookInputs } from '@vibe-forge/hooks'
import type {
  AdapterCtx,
  AdapterModelFallbackError,
  AdapterOutputEvent,
  AdapterQueryOptions,
  Config,
  TaskDetail,
  WorkspaceAssetAdapter
} from '@vibe-forge/types'
import { loadAdapter } from '@vibe-forge/types'
import { listServiceModels, resolveAdapterModelCompatibility, resolveEffectiveEffort } from '@vibe-forge/utils'
import { buildAdapterAssetPlan } from '@vibe-forge/workspace-assets'

import { prepare } from './prepare'
import { resolveQuerySelection } from './query-selection'
import type { RunTaskOptions } from './type'

const pickFirstNonEmptyString = (values: unknown[]) => (
  values.find((value): value is string => typeof value === 'string' && value.trim() !== '')?.trim()
)

const resolveEffectiveMcpSelection = (params: {
  assets?: AdapterCtx['assets']
  selection?: AdapterQueryOptions['mcpServers']
}) => ({
  include: params.selection?.include ??
    (
      (params.assets?.defaultIncludeMcpServers.length ?? 0) > 0
        ? params.assets?.defaultIncludeMcpServers
        : undefined
    ),
  exclude: params.selection?.exclude ??
    (
      (params.assets?.defaultExcludeMcpServers.length ?? 0) > 0
        ? params.assets?.defaultExcludeMcpServers
        : undefined
    )
})

const splitRuntimeMcpSelection = (params: {
  assets?: AdapterCtx['assets']
  runtimeServerNames: Set<string>
  selection?: AdapterQueryOptions['mcpServers']
}) => {
  const workspaceServerNames = new Set(Object.keys(params.assets?.mcpServers ?? {}))
  const effectiveSelection = resolveEffectiveMcpSelection({
    assets: params.assets,
    selection: params.selection
  })
  const splitRefs = (refs?: string[]) => {
    const workspaceRefs: string[] = []
    const runtimeRefs = new Set<string>()
    for (const ref of refs ?? []) {
      if (params.runtimeServerNames.has(ref) && !workspaceServerNames.has(ref)) {
        runtimeRefs.add(ref)
        continue
      }
      workspaceRefs.push(ref)
    }
    return { workspaceRefs, runtimeRefs }
  }

  const include = splitRefs(effectiveSelection.include)
  const exclude = splitRefs(effectiveSelection.exclude)

  return {
    workspaceSelection: effectiveSelection.include == null && effectiveSelection.exclude == null
      ? undefined
      : {
        ...(effectiveSelection.include == null ? {} : { include: include.workspaceRefs }),
        ...(effectiveSelection.exclude == null ? {} : { exclude: exclude.workspaceRefs })
      },
    runtimeInclude: effectiveSelection.include == null ? undefined : include.runtimeRefs,
    runtimeExclude: exclude.runtimeRefs,
    excludeAllWorkspaceMcp: effectiveSelection.include != null && include.workspaceRefs.length === 0
  }
}

const formatAdapterModelRuleSuffix = (params: {
  includeModels?: string[]
  excludeModels?: string[]
}) => {
  const parts = []
  if (params.includeModels != null && params.includeModels.length > 0) {
    parts.push(`includeModels=${params.includeModels.join(', ')}`)
  }
  if (params.excludeModels != null && params.excludeModels.length > 0) {
    parts.push(`excludeModels=${params.excludeModels.join(', ')}`)
  }
  return parts.length > 0 ? ` (${parts.join('; ')})` : ''
}

const formatAdapterModelFallbackError = (error: AdapterModelFallbackError) => {
  const ruleSuffix = formatAdapterModelRuleSuffix({
    includeModels: error.includeModels,
    excludeModels: error.excludeModels
  })

  if (error.type === 'missing_default_model') {
    return `Model "${error.requestedModel}" is not allowed for adapter "${error.adapter}"${ruleSuffix}. Configure adapters.${error.adapter}.defaultModel to continue.`
  }

  return `Adapter "${error.adapter}" defaultModel "${error.defaultModel}" is also not allowed${ruleSuffix}.`
}

declare module '@vibe-forge/types' {
  interface Cache {
    base: Omit<AdapterCtx, 'logger' | 'cache'>
    detail: TaskDetail
  }
}

const BASE_NATIVE_BRIDGE_DISABLED_EVENTS: Array<
  'SessionStart' | 'UserPromptSubmit' | 'PreToolUse' | 'PostToolUse' | 'Stop'
> = ['SessionStart', 'UserPromptSubmit', 'PreToolUse', 'PostToolUse', 'Stop']

const OPENCODE_NATIVE_BRIDGE_DISABLED_EVENTS: Array<
  'SessionStart' | 'PreToolUse' | 'PostToolUse' | 'Stop'
> = ['SessionStart', 'PreToolUse', 'PostToolUse', 'Stop']

export const run = async (
  options: RunTaskOptions,
  adapterOptions: AdapterQueryOptions
) => {
  const [ctx] = await prepare(options, adapterOptions)
  const { mergedConfig } = resolveConfigState({
    configState: ctx.configState,
    configs: ctx.configs
  })

  const { logger, cache, ...base } = ctx

  await cache.set('base', base)

  const resolvedSelection = resolveQuerySelection({
    mergedConfig,
    inputAdapter: options.adapter,
    inputModel: adapterOptions.model
  })
  const adapterType = resolvedSelection.adapter
  if (adapterType == null) {
    throw new Error('No adapter found in config, please set adapters in config file')
  }

  const mergedModelServices = mergedConfig.modelServices ?? {}
  const serviceModels = listServiceModels(mergedModelServices)
  const mergedDefaultModelService = pickFirstNonEmptyString([mergedConfig.defaultModelService])
  const supportedEffortAdapters = new Set(['claude-code', 'codex', 'copilot', 'kimi', 'opencode'])
  const supportsEffort = supportedEffortAdapters.has(adapterType)
  const adapterCommonConfig = supportsEffort
    ? resolveAdapterCommonConfig<Record<string, unknown> & { effort?: AdapterQueryOptions['effort'] }, 'effort'>(
      adapterType,
      {
        mergedConfig
      },
      {
        extraCommonKeys: ['effort']
      }
    )
    : resolveAdapterCommonConfig(adapterType, {
      mergedConfig
    })
  const compatibilityResult = resolveAdapterModelCompatibility({
    adapter: adapterType,
    model: resolvedSelection.model,
    adapterConfig: adapterCommonConfig,
    serviceModels,
    preferredServiceKey: mergedDefaultModelService,
    preserveUnknownDefaultModel: true
  })
  if (compatibilityResult.error) {
    throw new Error(formatAdapterModelFallbackError(compatibilityResult.error))
  }

  const adapter = await loadAdapter(adapterType)
  const resolvedModel = compatibilityResult.model ?? resolvedSelection.model
  const selectionWarnings = compatibilityResult.warning != null ? [compatibilityResult.warning] : undefined
  if (!supportsEffort && adapterOptions.effort != null) {
    throw new Error(`Adapter "${adapterType}" does not support effort`)
  }
  const { effort: resolvedEffort } = supportsEffort
    ? resolveEffectiveEffort({
      explicitEffort: adapterOptions.effort,
      model: resolvedModel,
      adapterConfig: adapterCommonConfig,
      configEffort: mergedConfig.effort,
      models: mergedConfig.models
    })
    : { effort: undefined as undefined }

  const originalOnEvent = adapterOptions.onEvent
  const supportedAssetPlanAdapters = new Set<WorkspaceAssetAdapter>([
    'claude-code',
    'codex',
    'copilot',
    'gemini',
    'kimi',
    'opencode'
  ])
  const supportsAssetPlan = (value: string): value is WorkspaceAssetAdapter => (
    supportedAssetPlanAdapters.has(value as WorkspaceAssetAdapter)
  )
  const runtimeMcpServers = Object.fromEntries(
    Object.entries(adapterOptions.runtimeMcpServers ?? {})
      .filter(([, server]) => server != null && server.enabled !== false)
      .map(([name, server]) => {
        const { enabled: _enabled, ...resolvedServer } = server as NonNullable<Config['mcpServers']>[string]
        return [name, resolvedServer]
      })
  ) as Record<string, NonNullable<Config['mcpServers']>[string]>
  const runtimeMcpSelection = splitRuntimeMcpSelection({
    assets: ctx.assets,
    runtimeServerNames: new Set(Object.keys(runtimeMcpServers)),
    selection: adapterOptions.mcpServers
  })
  const assetPlanBaseRaw = ctx.assets == null || !supportsAssetPlan(adapterType)
    ? undefined
    : await buildAdapterAssetPlan({
      adapter: adapterType,
      bundle: ctx.assets,
      options: {
        mcpServers: runtimeMcpSelection.workspaceSelection,
        skills: adapterOptions.skills,
        promptAssetIds: adapterOptions.promptAssetIds
      }
    })
  const workspaceMcpAssetIds = new Set(
    Object.values(ctx.assets?.mcpServers ?? {}).map(asset => asset.id)
  )
  const assetPlanBase = assetPlanBaseRaw == null || !runtimeMcpSelection.excludeAllWorkspaceMcp
    ? assetPlanBaseRaw
    : {
      ...assetPlanBaseRaw,
      mcpServers: {},
      diagnostics: assetPlanBaseRaw.diagnostics.filter(diagnostic => !workspaceMcpAssetIds.has(diagnostic.assetId))
    }
  const selectedRuntimeMcpServers = Object.fromEntries(
    Object.entries(runtimeMcpServers)
      .filter(([name]) => (
        (runtimeMcpSelection.runtimeInclude == null || runtimeMcpSelection.runtimeInclude.has(name)) &&
        !runtimeMcpSelection.runtimeExclude.has(name)
      ))
  ) as Record<string, NonNullable<Config['mcpServers']>[string]>
  const workspaceMcpServerNames = new Set(Object.keys(assetPlanBase?.mcpServers ?? {}))
  const shadowedRuntimeMcpServerNames = Object.keys(selectedRuntimeMcpServers)
    .filter(name => workspaceMcpServerNames.has(name))
  if (shadowedRuntimeMcpServerNames.length > 0) {
    logger.warn({
      runtimeMcpServerNames: shadowedRuntimeMcpServerNames
    }, '[mcp] Ignoring session companion MCP servers that would shadow workspace MCP servers')
  }
  const effectiveRuntimeMcpServers = Object.fromEntries(
    Object.entries(selectedRuntimeMcpServers)
      .filter(([name]) => !workspaceMcpServerNames.has(name))
  ) as Record<string, NonNullable<Config['mcpServers']>[string]>
  const assetPlan = assetPlanBase == null
    ? undefined
    : Object.keys(effectiveRuntimeMcpServers).length === 0
    ? assetPlanBase
    : {
      ...assetPlanBase,
      mcpServers: {
        ...assetPlanBase.mcpServers,
        ...effectiveRuntimeMcpServers
      }
    }
  await adapter.init?.(ctx)
  const nativeBridgeDisabledEvents: Array<keyof HookInputs> =
    adapterType === 'codex' && ctx.env.__VF_PROJECT_AI_CODEX_NATIVE_HOOKS_AVAILABLE__ === '1'
      ? BASE_NATIVE_BRIDGE_DISABLED_EVENTS
      : adapterType === 'claude-code' && ctx.env.__VF_PROJECT_AI_CLAUDE_NATIVE_HOOKS_AVAILABLE__ === '1'
      ? BASE_NATIVE_BRIDGE_DISABLED_EVENTS
      : adapterType === 'gemini' && ctx.env.__VF_PROJECT_AI_GEMINI_NATIVE_HOOKS_AVAILABLE__ === '1'
      ? BASE_NATIVE_BRIDGE_DISABLED_EVENTS
      : adapterType === 'kimi' && ctx.env.__VF_PROJECT_AI_KIMI_NATIVE_HOOKS_AVAILABLE__ === '1'
      ? BASE_NATIVE_BRIDGE_DISABLED_EVENTS
      : adapterType === 'opencode' && ctx.env.__VF_PROJECT_AI_OPENCODE_NATIVE_HOOKS_AVAILABLE__ === '1'
      ? OPENCODE_NATIVE_BRIDGE_DISABLED_EVENTS
      : []
  const hookBridge = createAdapterHookBridge({
    ctx,
    adapter: adapterType,
    runtime: adapterOptions.runtime,
    sessionId: adapterOptions.sessionId,
    type: adapterOptions.type,
    model: resolvedModel,
    disabledEvents: nativeBridgeDisabledEvents
  })
  const wrappedOnEvent = (event: AdapterOutputEvent) => {
    hookBridge.handleOutput(event)

    if (event.type === 'init') {
      originalOnEvent({
        ...event,
        data: {
          ...event.data,
          adapter: adapterType,
          effort: resolvedEffort ?? event.data.effort,
          selectionWarnings: selectionWarnings ?? event.data.selectionWarnings,
          assetDiagnostics: assetPlan?.diagnostics ?? event.data.assetDiagnostics
        }
      })
      return
    }

    if (event.type === 'exit') {
      const { data } = event

      void callHook('TaskStop', {
        adapter: adapterType,
        cwd: ctx.cwd,
        sessionId: adapterOptions.sessionId,

        options,
        adapterOptions,

        exitCode: data.exitCode,
        stderr: data.stderr
      }, ctx.env)
        .catch((e) => {
          logger.error('[Hook] TaskStop failed', e)
        })
    }
    originalOnEvent(event)
  }

  const taskStartOutput = await callHook('TaskStart', {
    adapter: adapterType,
    cwd: ctx.cwd,
    sessionId: adapterOptions.sessionId,

    options,
    adapterOptions
  }, ctx.env)
  if (taskStartOutput?.continue === false) {
    throw new Error(taskStartOutput.stopReason ?? 'TaskStart hook blocked task startup')
  }
  await hookBridge.start()
  const description = await hookBridge.prepareInitialPrompt(adapterOptions.description)
  const session = await adapter.query(
    ctx,
    {
      ...adapterOptions,
      assetPlan,
      description,
      effort: resolvedEffort,
      model: resolvedModel,
      onEvent: wrappedOnEvent
    }
  )

  return {
    session: hookBridge.wrapSession(session),
    ctx,
    resolvedAdapter: adapterType
  }
}
