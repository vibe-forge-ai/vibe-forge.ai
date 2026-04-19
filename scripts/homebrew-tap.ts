import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import https from 'node:https'
import path from 'node:path'
import process from 'node:process'

const DEFAULT_TAP_DIR = 'infra/homebrew-tap'
const DEFAULT_FORMULA_PATH = 'Formula/vibe-forge.rb'
const CLI_PACKAGE_NAME = '@vibe-forge/cli'

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

export const updateVibeForgeFormula = (
  content: string,
  input: {
    version: string
    sha256: string
  }
) => {
  const version = normalizeCliVersion(input.version)
  const url = buildVibeForgeCliTarballUrl(version)
  let nextContent = content
  const urlPattern = /url "https:\/\/registry\.npmjs\.org\/@vibe-forge\/cli\/-\/cli-[^"]+\.tgz"/
  const sha256Pattern = /sha256 "[0-9a-f]{64}"/

  if (!urlPattern.test(content) || !sha256Pattern.test(content)) {
    throw new Error('Formula was not updated. Check url and sha256 patterns.')
  }

  nextContent = nextContent.replace(urlPattern, `url "${url}"`)
  nextContent = nextContent.replace(sha256Pattern, `sha256 "${input.sha256}"`)

  return nextContent
}

export const runHomebrewTapSyncCli = async (input: {
  version: string
  tapDir?: string
  formulaPath?: string
  dryRun?: boolean
  cwd?: string
  stdout?: Pick<NodeJS.WriteStream, 'write'>
}) => {
  const cwd = input.cwd ?? process.cwd()
  const version = normalizeCliVersion(input.version)
  const tapDir = input.tapDir ?? DEFAULT_TAP_DIR
  const formulaPath = input.formulaPath ?? DEFAULT_FORMULA_PATH
  const resolvedFormulaPath = path.resolve(cwd, tapDir, formulaPath)
  const tarballUrl = buildVibeForgeCliTarballUrl(version)
  const stdout = input.stdout ?? process.stdout

  const sha256 = await computeUrlSha256(tarballUrl)
  const content = await readFile(resolvedFormulaPath, 'utf8')
  const nextContent = updateVibeForgeFormula(content, {
    version,
    sha256
  })

  if (input.dryRun === true) {
    stdout.write(`[homebrew-tap] ${resolvedFormulaPath}\n`)
    stdout.write(`[homebrew-tap] url ${tarballUrl}\n`)
    stdout.write(`[homebrew-tap] sha256 ${sha256}\n`)
    stdout.write('[homebrew-tap] dry run: formula not written\n')
    return {
      formulaPath: resolvedFormulaPath,
      tarballUrl,
      sha256,
      written: false
    }
  }

  await mkdir(path.dirname(resolvedFormulaPath), { recursive: true })
  await writeFile(resolvedFormulaPath, nextContent)

  stdout.write(`[homebrew-tap] updated ${path.relative(cwd, resolvedFormulaPath)}\n`)
  stdout.write(`[homebrew-tap] url ${tarballUrl}\n`)
  stdout.write(`[homebrew-tap] sha256 ${sha256}\n`)

  return {
    formulaPath: resolvedFormulaPath,
    tarballUrl,
    sha256,
    written: true
  }
}
