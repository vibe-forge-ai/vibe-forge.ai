import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

import { buildVibeForgeCliTarballUrl, computeUrlSha256, normalizeCliVersion } from './cli-package-release'

const DEFAULT_SCOOP_MANIFEST_PATH = 'infra/windows/scoop-bucket/bucket/vibe-forge.json'
const DEFAULT_WINGET_VERSION_MANIFEST_PATH = 'infra/windows/winget/VibeForge.VibeForge.yaml'
const DEFAULT_WINGET_LOCALE_MANIFEST_PATH = 'infra/windows/winget/VibeForge.VibeForge.locale.en-US.yaml'
const DEFAULT_WINGET_TEMPLATE_PATH = 'infra/windows/winget/VibeForge.VibeForge.installer.template.yaml'

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value != null && !Array.isArray(value)
)

export const buildDefaultWingetInstallerUrl = (version: string) => (
  `https://github.com/vibe-forge-ai/vibe-forge.ai/releases/download/v${version}/vibe-forge-cli-windows-${version}.zip`
)

const replaceRequiredLine = (
  content: string,
  pattern: RegExp,
  replacement: string | ((indent: string) => string),
  field: string
) => {
  let matched = false
  const nextContent = content.replace(pattern, (_match: string, indent: string | undefined) => {
    matched = true
    return typeof replacement === 'function' ? replacement(indent ?? '') : replacement
  })

  if (!matched) {
    throw new Error(`Winget template was not updated. Missing ${field}.`)
  }

  return nextContent
}

export const updateScoopManifest = (
  content: string,
  input: {
    sha256: string
    tarballUrl: string
    version: string
  }
) => {
  const manifest = JSON.parse(content) as unknown
  if (!isRecord(manifest)) {
    throw new Error('Scoop manifest must be a JSON object.')
  }

  manifest.version = normalizeCliVersion(input.version)
  manifest.url = input.tarballUrl
  manifest.hash = input.sha256

  const autoupdate = manifest.autoupdate
  if (isRecord(autoupdate)) {
    autoupdate.url = 'https://registry.npmjs.org/@vibe-forge/cli/-/cli-$version.tgz'
  }

  return `${JSON.stringify(manifest, null, 2)}\n`
}

export const updateWingetPackageVersion = (content: string, version: string) => (
  replaceRequiredLine(
    content,
    /^PackageVersion: .+$/m,
    `PackageVersion: ${normalizeCliVersion(version)}`,
    'PackageVersion'
  )
)

export const updateWingetInstallerTemplate = (
  content: string,
  input: {
    installerSha256?: string
    installerUrl: string
    version: string
  }
) => {
  const version = normalizeCliVersion(input.version)
  let nextContent = updateWingetPackageVersion(content, version)

  nextContent = replaceRequiredLine(
    nextContent,
    /^(\s*)InstallerUrl: .+$/m,
    indent => `${indent}InstallerUrl: ${input.installerUrl}`,
    'InstallerUrl'
  )
  if (input.installerSha256 != null) {
    nextContent = replaceRequiredLine(
      nextContent,
      /^(\s*)InstallerSha256: .+$/m,
      indent => `${indent}InstallerSha256: ${input.installerSha256}`,
      'InstallerSha256'
    )
  }

  return nextContent
}

export const runWindowsInstallSyncCli = async (input: {
  version: string
  dryRun?: boolean
  cwd?: string
  scoopManifestPath?: string
  stdout?: Pick<NodeJS.WriteStream, 'write'>
  wingetInstallerSha256?: string
  wingetInstallerUrl?: string
  wingetLocaleManifestPath?: string
  wingetTemplatePath?: string
  wingetVersionManifestPath?: string
}) => {
  const cwd = input.cwd ?? process.cwd()
  const version = normalizeCliVersion(input.version)
  const scoopManifestPath = path.resolve(cwd, input.scoopManifestPath ?? DEFAULT_SCOOP_MANIFEST_PATH)
  const wingetVersionManifestPath = path.resolve(
    cwd,
    input.wingetVersionManifestPath ?? DEFAULT_WINGET_VERSION_MANIFEST_PATH
  )
  const wingetLocaleManifestPath = path.resolve(
    cwd,
    input.wingetLocaleManifestPath ?? DEFAULT_WINGET_LOCALE_MANIFEST_PATH
  )
  const wingetTemplatePath = path.resolve(cwd, input.wingetTemplatePath ?? DEFAULT_WINGET_TEMPLATE_PATH)
  const tarballUrl = buildVibeForgeCliTarballUrl(version)
  const wingetInstallerUrl = input.wingetInstallerUrl ?? buildDefaultWingetInstallerUrl(version)
  const stdout = input.stdout ?? process.stdout
  const sha256 = await computeUrlSha256(tarballUrl)

  const scoopContent = await readFile(scoopManifestPath, 'utf8')
  const nextScoopContent = updateScoopManifest(scoopContent, {
    version,
    tarballUrl,
    sha256
  })

  const wingetVersionContent = await readFile(wingetVersionManifestPath, 'utf8')
  const nextWingetVersionContent = updateWingetPackageVersion(wingetVersionContent, version)

  const wingetLocaleContent = await readFile(wingetLocaleManifestPath, 'utf8')
  const nextWingetLocaleContent = updateWingetPackageVersion(wingetLocaleContent, version)

  const wingetInstallerContent = await readFile(wingetTemplatePath, 'utf8')
  const nextWingetInstallerContent = updateWingetInstallerTemplate(wingetInstallerContent, {
    version,
    installerUrl: wingetInstallerUrl,
    installerSha256: input.wingetInstallerSha256
  })

  if (input.dryRun === true) {
    stdout.write(`[windows-install] ${scoopManifestPath}\n`)
    stdout.write(`[windows-install] npm url ${tarballUrl}\n`)
    stdout.write(`[windows-install] npm sha256 ${sha256}\n`)
    stdout.write(`[windows-install] winget version ${wingetVersionManifestPath}\n`)
    stdout.write(`[windows-install] winget locale ${wingetLocaleManifestPath}\n`)
    stdout.write(`[windows-install] winget template ${wingetTemplatePath}\n`)
    stdout.write(`[windows-install] winget installer ${wingetInstallerUrl}\n`)
    stdout.write('[windows-install] dry run: files not written\n')
    return {
      scoopManifestPath,
      tarballUrl,
      sha256,
      wingetInstallerUrl,
      wingetLocaleManifestPath,
      wingetTemplatePath,
      wingetVersionManifestPath,
      written: false
    }
  }

  await mkdir(path.dirname(scoopManifestPath), { recursive: true })
  await mkdir(path.dirname(wingetVersionManifestPath), { recursive: true })
  await mkdir(path.dirname(wingetLocaleManifestPath), { recursive: true })
  await mkdir(path.dirname(wingetTemplatePath), { recursive: true })
  await writeFile(scoopManifestPath, nextScoopContent)
  await writeFile(wingetVersionManifestPath, nextWingetVersionContent)
  await writeFile(wingetLocaleManifestPath, nextWingetLocaleContent)
  await writeFile(wingetTemplatePath, nextWingetInstallerContent)

  stdout.write(`[windows-install] updated ${path.relative(cwd, scoopManifestPath)}\n`)
  stdout.write(`[windows-install] updated ${path.relative(cwd, wingetVersionManifestPath)}\n`)
  stdout.write(`[windows-install] updated ${path.relative(cwd, wingetLocaleManifestPath)}\n`)
  stdout.write(`[windows-install] updated ${path.relative(cwd, wingetTemplatePath)}\n`)
  stdout.write(`[windows-install] npm url ${tarballUrl}\n`)
  stdout.write(`[windows-install] npm sha256 ${sha256}\n`)

  return {
    scoopManifestPath,
    tarballUrl,
    sha256,
    wingetInstallerUrl,
    wingetLocaleManifestPath,
    wingetTemplatePath,
    wingetVersionManifestPath,
    written: true
  }
}
