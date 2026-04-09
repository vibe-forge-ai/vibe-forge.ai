import { describe, expect, it } from 'vitest'

import { resolvePreferredNativeHookBridgePackage } from '#~/bridge-loader.js'
import { NATIVE_HOOK_BRIDGE_ADAPTER_ENV } from '#~/native.js'

describe('native hook bridge loader', () => {
  it('maps claude adapter aliases to the claude-code hook bridge package', () => {
    expect(resolvePreferredNativeHookBridgePackage({
      [NATIVE_HOOK_BRIDGE_ADAPTER_ENV]: 'claude'
    })).toBe('@vibe-forge/adapter-claude-code')
  })

  it('keeps existing package ids and non-claude adapter ids intact', () => {
    expect(resolvePreferredNativeHookBridgePackage({
      [NATIVE_HOOK_BRIDGE_ADAPTER_ENV]: 'codex'
    })).toBe('@vibe-forge/adapter-codex')
    expect(resolvePreferredNativeHookBridgePackage({
      [NATIVE_HOOK_BRIDGE_ADAPTER_ENV]: 'adapter-codex'
    })).toBe('@vibe-forge/adapter-codex')
    expect(resolvePreferredNativeHookBridgePackage({
      [NATIVE_HOOK_BRIDGE_ADAPTER_ENV]: '@scope/custom-adapter'
    })).toBe('@scope/custom-adapter')
  })
})
