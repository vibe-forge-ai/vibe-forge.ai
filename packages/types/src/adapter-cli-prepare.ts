import type { AdapterConfigState, AdapterCtx } from './adapter'

export interface AdapterCliPrepareTarget {
  key: string
  title: string
  aliases?: string[]
  configPath?: string[]
}

export interface AdapterCliPrepareContext {
  cwd: string
  env: AdapterCtx['env']
  configs: AdapterCtx['configs']
  configState?: AdapterConfigState
  logger: Pick<AdapterCtx['logger'], 'info'>
}

export interface AdapterCliPrepareOptions {
  target: string
}

export interface AdapterCliPrepareResult {
  adapter: string
  target: string
  title: string
  binaryPath: string
}

export interface AdapterCliPreparer {
  adapter: string
  title?: string
  targets: AdapterCliPrepareTarget[]
  prepare: (
    ctx: AdapterCliPrepareContext,
    options: AdapterCliPrepareOptions
  ) => Promise<AdapterCliPrepareResult>
}

export const defineAdapterCliPreparer = <T extends AdapterCliPreparer>(preparer: T) => preparer
