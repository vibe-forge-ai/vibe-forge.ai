import { describe, expect, it } from 'vitest'

import { toDesktopRelease } from '../src/desktop-release'

describe('desktop release metadata', () => {
  it('normalizes GitHub snake_case release fields', () => {
    const release = toDesktopRelease({
      assets: [
        {
          browser_download_url: 'https://example.com/vibe-forge.zip',
          name: 'vibe-forge-0.1.7-mac-arm64.zip',
          url: 'https://api.github.com/assets/1'
        }
      ],
      tag_name: 'desktop-v0.1.7'
    })

    expect(release.tagName).toBe('desktop-v0.1.7')
    expect(release.assets[0]?.browser_download_url).toBe('https://example.com/vibe-forge.zip')
  })
})
