import { describe, expect, it } from 'vitest'

import {
  buildVibeForgeBootstrapTarballUrl,
  buildVibeForgeCliTarballUrl,
  normalizeBootstrapVersion,
  normalizeCliVersion
} from '../cli-package-release'
import { updateVibeForgeFormula } from '../homebrew-tap'

describe('homebrew tap tooling', () => {
  it('builds the npm tarball url for the CLI package', () => {
    expect(buildVibeForgeCliTarballUrl('1.2.3')).toBe(
      'https://registry.npmjs.org/@vibe-forge/cli/-/cli-1.2.3.tgz'
    )
  })

  it('normalizes a tagged version', () => {
    expect(normalizeCliVersion('v1.2.3')).toBe('1.2.3')
  })

  it('builds the npm tarball url for the bootstrap package', () => {
    expect(buildVibeForgeBootstrapTarballUrl('1.2.3')).toBe(
      'https://registry.npmjs.org/@vibe-forge/bootstrap/-/bootstrap-1.2.3.tgz'
    )
  })

  it('normalizes a tagged bootstrap version', () => {
    expect(normalizeBootstrapVersion('v1.2.3')).toBe('1.2.3')
  })

  it('updates the formula url and sha256', () => {
    const content = [
      'class VibeForge < Formula',
      '  url "https://registry.npmjs.org/@vibe-forge/cli/-/cli-1.0.1.tgz"',
      '  sha256 "cc3992d84090cbce3eb30b49c49af87a119442ee5af3a4c5009a0dfd4abb68e3"',
      'end',
      ''
    ].join('\n')

    expect(updateVibeForgeFormula(content, {
      tarballUrl: 'https://registry.npmjs.org/@vibe-forge/cli/-/cli-1.2.3.tgz',
      sha256: 'a'.repeat(64)
    })).toContain('url "https://registry.npmjs.org/@vibe-forge/cli/-/cli-1.2.3.tgz"')
  })

  it('allows an already-synced formula', () => {
    const content = [
      'class VibeForge < Formula',
      '  url "https://registry.npmjs.org/@vibe-forge/cli/-/cli-1.2.3.tgz"',
      `  sha256 "${'a'.repeat(64)}"`,
      'end',
      ''
    ].join('\n')

    expect(updateVibeForgeFormula(content, {
      tarballUrl: 'https://registry.npmjs.org/@vibe-forge/cli/-/cli-1.2.3.tgz',
      sha256: 'a'.repeat(64)
    })).toBe(content)
  })
})
