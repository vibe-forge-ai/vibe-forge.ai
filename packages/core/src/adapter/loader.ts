import type { Adapter } from './type'

const resolveAdapterPackageName = (type: string) => (
  type.startsWith('@') ? type : `@vibe-forge/adapter-${type}`
)

export const loadAdapter = async (type: string) =>
  (
    // eslint-disable-next-line ts/no-require-imports
    require(resolveAdapterPackageName(type))
  ).default as Adapter
