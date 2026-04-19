import { describe, expect, it } from 'vitest'

import {
  buildDefaultWingetInstallerUrl,
  updateScoopManifest,
  updateWingetInstallerTemplate,
  updateWingetPackageVersion
} from '../windows-install'

describe('windows install tooling', () => {
  it('builds the default winget release asset url', () => {
    expect(buildDefaultWingetInstallerUrl('1.2.3')).toBe(
      'https://github.com/vibe-forge-ai/vibe-forge.ai/releases/download/v1.2.3/vibe-forge-cli-windows-1.2.3.zip'
    )
  })

  it('updates the Scoop manifest version, url, and hash', () => {
    const content = JSON.stringify({
      version: '1.0.1',
      url: 'https://registry.npmjs.org/@vibe-forge/cli/-/cli-1.0.1.tgz',
      hash: '0'.repeat(64),
      autoupdate: {
        url: 'https://registry.npmjs.org/@vibe-forge/cli/-/cli-$version.tgz'
      }
    })

    const manifest = JSON.parse(updateScoopManifest(content, {
      version: '1.2.3',
      tarballUrl: 'https://registry.npmjs.org/@vibe-forge/cli/-/cli-1.2.3.tgz',
      sha256: 'a'.repeat(64)
    })) as Record<string, unknown>

    expect(manifest).toMatchObject({
      version: '1.2.3',
      url: 'https://registry.npmjs.org/@vibe-forge/cli/-/cli-1.2.3.tgz',
      hash: 'a'.repeat(64)
    })
  })

  it('updates the winget installer template', () => {
    const content = [
      'PackageIdentifier: VibeForge.VibeForge',
      'PackageVersion: 1.0.1',
      'Installers:',
      '- Architecture: x64',
      '  InstallerUrl: https://example.com/old.zip',
      `  InstallerSha256: ${'0'.repeat(64)}`,
      ''
    ].join('\n')

    const result = updateWingetInstallerTemplate(content, {
      version: '1.2.3',
      installerUrl: 'https://example.com/new.zip',
      installerSha256: 'b'.repeat(64)
    })

    expect(result).toContain('PackageVersion: 1.2.3')
    expect(result).toContain('  InstallerUrl: https://example.com/new.zip')
    expect(result).toContain(`  InstallerSha256: ${'b'.repeat(64)}`)
  })

  it('updates winget package versions across manifest files', () => {
    expect(updateWingetPackageVersion(
      [
        'PackageIdentifier: VibeForge.VibeForge',
        'PackageVersion: 1.0.1',
        'ManifestType: version',
        ''
      ].join('\n'),
      'v1.2.3'
    )).toContain('PackageVersion: 1.2.3')
  })
})
