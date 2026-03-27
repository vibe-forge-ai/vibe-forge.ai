import { runHookCli } from './runtime'

import type { NativeHookBridgeModule } from './bridge-loader'
import { resolveActiveNativeHookBridge } from './bridge-loader'

export const runManagedHookEntrypoint = async (deps: {
  resolveActiveNativeHookBridge?: () => NativeHookBridgeModule | undefined
  runHookCli?: () => Promise<void>
} = {}) => {
  try {
    const bridge = (deps.resolveActiveNativeHookBridge ?? resolveActiveNativeHookBridge)()
    if (bridge) {
      await bridge.runHookBridge()
      return
    }
  } catch (error) {
    console.error('[vibe-forge hooks] failed to load native hook bridge, falling back to default hook runtime', error)
  }

  await (deps.runHookCli ?? runHookCli)()
}
