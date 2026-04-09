import { loadEnv } from '@vibe-forge/core'

export class MissingChannelActionSecretError extends Error {
  constructor() {
    super('Missing __VF_PROJECT_AI_SERVER_ACTION_SECRET__')
    this.name = 'MissingChannelActionSecretError'
  }
}

export const resolveActionTokenSecret = () => {
  const env = loadEnv()
  const configuredSecret = env.__VF_PROJECT_AI_SERVER_ACTION_SECRET__?.trim()
  if (configuredSecret != null && configuredSecret !== '') {
    return configuredSecret
  }

  throw new MissingChannelActionSecretError()
}
