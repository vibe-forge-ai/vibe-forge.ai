import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import https from 'node:https'

export const CLI_PACKAGE_NAME = '@vibe-forge/cli'

export const buildVibeForgeCliTarballUrl = (version: string) => (
  `https://registry.npmjs.org/@vibe-forge/cli/-/cli-${version}.tgz`
)

export const normalizeCliVersion = (value: string) => {
  const version = value.trim().replace(/^v/, '')
  if (!/^\d+\.\d+\.\d+(?:-[0-9a-z.-]+)?$/i.test(version)) {
    throw new Error(`Invalid ${CLI_PACKAGE_NAME} version: ${value}`)
  }
  return version
}

const download = (url: string, redirectsLeft = 5): Promise<Buffer> => (
  new Promise((resolve, reject) => {
    https.get(url, (response) => {
      const statusCode = response.statusCode ?? 0
      const location = response.headers.location

      if (statusCode >= 300 && statusCode < 400 && location != null) {
        response.resume()
        if (redirectsLeft <= 0) {
          reject(new Error(`Too many redirects while downloading ${url}`))
          return
        }
        const redirectedUrl = new URL(location, url).toString()
        download(redirectedUrl, redirectsLeft - 1).then(resolve, reject)
        return
      }

      if (statusCode < 200 || statusCode >= 300) {
        response.resume()
        reject(new Error(`Failed to download ${url}: HTTP ${statusCode}`))
        return
      }

      const chunks: Buffer[] = []
      response.on('data', (chunk: Buffer) => {
        chunks.push(chunk)
      })
      response.on('end', () => {
        resolve(Buffer.concat(chunks))
      })
    }).on('error', reject)
  })
)

export const computeUrlSha256 = async (url: string) => {
  const data = await download(url)
  return createHash('sha256').update(data).digest('hex')
}
