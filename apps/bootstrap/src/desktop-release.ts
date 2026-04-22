import type { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { createWriteStream } from 'node:fs'
import { mkdir, unlink } from 'node:fs/promises'
import https from 'node:https'
import path from 'node:path'
import process from 'node:process'

interface GitHubReleaseAsset {
  digest?: string
  name: string
  url: string
}

interface GitHubReleaseResponse {
  assets?: GitHubReleaseAsset[]
  tagName?: string
}

export interface DesktopRelease {
  assets: GitHubReleaseAsset[]
  tagName: string
}

const GITHUB_RELEASES_API = 'https://api.github.com/repos/vibe-forge-ai/vibe-forge.ai/releases'
const RELEASE_TAG_OVERRIDE = process.env.VF_BOOTSTRAP_DESKTOP_RELEASE_TAG?.trim()

const ensureDirectory = async (targetPath: string) => {
  await mkdir(targetPath, { recursive: true })
}

const requestJson = async <T>(url: string) => (
  await new Promise<T>((resolve, reject) => {
    https.get(url, {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'vibe-forge-bootstrap'
      }
    }, (response) => {
      const statusCode = response.statusCode ?? 0
      if (statusCode < 200 || statusCode >= 300) {
        response.resume()
        reject(new Error(`GitHub API request failed: HTTP ${statusCode}`))
        return
      }

      let content = ''
      response.setEncoding('utf8')
      response.on('data', (chunk: string) => {
        content += chunk
      })
      response.on('end', () => {
        try {
          resolve(JSON.parse(content) as T)
        } catch (error) {
          reject(error)
        }
      })
    }).on('error', reject)
  })
)

export const fetchDesktopRelease = async (): Promise<DesktopRelease> => {
  const url = RELEASE_TAG_OVERRIDE
    ? `${GITHUB_RELEASES_API}/tags/${encodeURIComponent(RELEASE_TAG_OVERRIDE)}`
    : `${GITHUB_RELEASES_API}/latest`
  const release = await requestJson<GitHubReleaseResponse>(url)
  if (!release.tagName || !Array.isArray(release.assets)) {
    throw new Error('Invalid desktop release metadata returned by GitHub.')
  }
  return {
    assets: release.assets,
    tagName: release.tagName
  }
}

export const selectDesktopAsset = (release: DesktopRelease, runtime: {
  arch: string
  platform: NodeJS.Platform
}) => {
  if (runtime.platform === 'darwin') {
    return release.assets.find(asset => asset.name.endsWith(`-mac-${runtime.arch}.zip`))
  }

  if (runtime.platform === 'linux') {
    const appImageArch = runtime.arch === 'x64' ? 'x86_64' : runtime.arch
    return release.assets.find(asset => asset.name.endsWith(`-linux-${appImageArch}.AppImage`))
  }

  if (runtime.platform === 'win32') {
    return release.assets.find(asset => asset.name.endsWith(`-win-${runtime.arch}.exe`))
  }

  return undefined
}

export const downloadReleaseAsset = async (asset: GitHubReleaseAsset, destinationPath: string) => {
  await ensureDirectory(path.dirname(destinationPath))

  return await new Promise<void>((resolve, reject) => {
    const hash = createHash('sha256')
    const file = createWriteStream(destinationPath)

    const request = https.get(asset.url, {
      headers: {
        'User-Agent': 'vibe-forge-bootstrap'
      }
    }, (response) => {
      const statusCode = response.statusCode ?? 0
      const redirectLocation = response.headers.location

      if (statusCode >= 300 && statusCode < 400 && redirectLocation != null) {
        file.close()
        void unlink(destinationPath).catch(() => {})
        downloadReleaseAsset({
          ...asset,
          url: new URL(redirectLocation, asset.url).toString()
        }, destinationPath).then(resolve, reject)
        return
      }

      if (statusCode < 200 || statusCode >= 300) {
        response.resume()
        file.close()
        reject(new Error(`Failed to download ${asset.name}: HTTP ${statusCode}`))
        return
      }

      response.on('data', (chunk: Buffer) => {
        hash.update(chunk)
      })
      response.pipe(file)
      file.on('finish', () => {
        file.close(() => {
          const expectedDigest = asset.digest?.replace(/^sha256:/, '')
          if (expectedDigest && hash.digest('hex') !== expectedDigest) {
            reject(new Error(`Downloaded desktop asset digest mismatch for ${asset.name}.`))
            return
          }

          resolve()
        })
      })
    })

    request.on('error', (error) => {
      file.close()
      reject(error)
    })
  })
}
