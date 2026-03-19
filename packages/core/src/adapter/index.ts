import type { Adapter } from './type'

export * from './loader'
export * from './type'

export const defineAdapter = <T extends Adapter>(adapter: T): Adapter => adapter
