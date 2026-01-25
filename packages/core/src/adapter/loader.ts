import type { Adapter } from './type'

export const loadAdapter = async (type: string) =>
  (
    // eslint-disable-next-line ts/no-require-imports
    require(
      type.startsWith('@') ? type : `@vibe-forge/adapter-${type}`
    )
  ).default as Adapter
