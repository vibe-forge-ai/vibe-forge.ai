export interface HookPluginMap {}

export type HookPluginConfig =
  | Record<string, Record<string, unknown>>
  | Partial<HookPluginMap>

export type EnabledPluginsConfig = Record<string, boolean>
