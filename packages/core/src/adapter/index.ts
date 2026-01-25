import type { Adapter } from './type'

export * from './loader'
export * from './type'

export const defineAdapter = (adapter: Adapter) => adapter
