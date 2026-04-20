import { access, chmod, copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import path from 'node:path'
import process from 'node:process'

import { downloadReleaseAsset, fetchDesktopRelease, selectDesktopAsset } from './desktop-release'
import type { DesktopInstallMode } from './desktop-mode'
import { resolveBootstrapDataDir, resolveRealHomeDir } from './paths'

interface DesktopInstallMetadata {
  executablePath: string
  installedPath: string
  releaseTag: string
}

const APP_NAME = 'Vibe Forge'

const ensureDirectory = async (targetPath: string) => {
  await mkdir(targetPath, { recursive: true })
}

const hasExistingPath = async (targetPath: string) => {
  try {
    await access(targetPath)
    return true
  } catch {
    return false
  }
}

const runSystemCommand = async (command: string, args: string[]) => {
  const child = spawn(command, args, { stdio: 'inherit' })
  return await new Promise<void>((resolve, reject) => {
    child.once('error', reject)
    child.once('exit', (code) => {
      if (code !== 0) {
        reject(new Error(`${command} exited with code ${code ?? 'null'}.`))
        return
      }
      resolve()
    })
  })
}

const resolveDesktopMetadataPath = (installMode: DesktopInstallMode) => (
  path.join(resolveBootstrapDataDir(), 'desktop', `${installMode}.json`)
)

const readDesktopMetadata = async (installMode: DesktopInstallMode) => {
  try {
    const content = await readFile(resolveDesktopMetadataPath(installMode), 'utf8')
    return JSON.parse(content) as DesktopInstallMetadata
  } catch {
    return undefined
  }
}

const writeDesktopMetadata = async (installMode: DesktopInstallMode, metadata: DesktopInstallMetadata) => {
  const filePath = resolveDesktopMetadataPath(installMode)
  await ensureDirectory(path.dirname(filePath))
  await writeFile(filePath, `${JSON.stringify(metadata, null, 2)}\n`)
}

const resolveDownloadsDir = () => path.join(resolveBootstrapDataDir(), 'desktop', 'downloads')
const resolveCacheInstallRoot = (releaseTag: string) => path.join(resolveBootstrapDataDir(), 'desktop', 'apps', releaseTag)

const installDesktopForMac = async (releaseTag: string, asset: { digest?: string, name: string, url: string }, installMode: DesktopInstallMode) => {
  const installDir = installMode === 'cache'
    ? resolveCacheInstallRoot(releaseTag)
    : path.join(resolveRealHomeDir(), 'Applications')
  const installPath = path.join(installDir, `${APP_NAME}.app`)
  const archivePath = path.join(resolveDownloadsDir(), asset.name)
  const stagingDir = path.join(resolveBootstrapDataDir(), 'desktop', 'staging', `${installMode}-${releaseTag}`)
  const extractedAppPath = path.join(stagingDir, `${APP_NAME}.app`)

  await rm(stagingDir, { recursive: true, force: true })
  await ensureDirectory(stagingDir)
  await downloadReleaseAsset(asset, archivePath)
  await runSystemCommand('ditto', ['-x', '-k', archivePath, stagingDir])
  await ensureDirectory(installDir)
  await rm(installPath, { recursive: true, force: true })
  await runSystemCommand('ditto', [extractedAppPath, installPath])

  return {
    executablePath: path.join(installPath, 'Contents', 'MacOS', APP_NAME),
    installedPath: installPath,
    releaseTag
  } satisfies DesktopInstallMetadata
}

const installDesktopForLinux = async (releaseTag: string, asset: { digest?: string, name: string, url: string }, installMode: DesktopInstallMode) => {
  const installDir = installMode === 'cache'
    ? resolveCacheInstallRoot(releaseTag)
    : path.join(resolveRealHomeDir(), '.local', 'opt', 'vibe-forge')
  const installPath = path.join(installDir, asset.name)
  const archivePath = path.join(resolveDownloadsDir(), asset.name)

  await ensureDirectory(installDir)
  await downloadReleaseAsset(asset, archivePath)
  await copyFile(archivePath, installPath)
  await chmod(installPath, 0o755)

  return {
    executablePath: installPath,
    installedPath: installPath,
    releaseTag
  } satisfies DesktopInstallMetadata
}

const installDesktopForWindows = async (releaseTag: string, asset: { digest?: string, name: string, url: string }, installMode: DesktopInstallMode) => {
  const localAppData = process.env.LOCALAPPDATA?.trim()
  if (installMode === 'user' && !localAppData) {
    throw new Error('LOCALAPPDATA is required to install the Vibe Forge desktop app on Windows.')
  }

  const installDir = installMode === 'cache'
    ? resolveCacheInstallRoot(releaseTag)
    : path.join(localAppData as string, 'Programs', APP_NAME)

  const installPath = path.join(installDir, asset.name)
  const archivePath = path.join(resolveDownloadsDir(), asset.name)

  await ensureDirectory(installDir)
  await downloadReleaseAsset(asset, archivePath)
  await copyFile(archivePath, installPath)

  return {
    executablePath: installPath,
    installedPath: installPath,
    releaseTag
  } satisfies DesktopInstallMetadata
}

export const ensureDesktopInstall = async (installMode: DesktopInstallMode) => {
  const release = await fetchDesktopRelease()
  const selectedAsset = selectDesktopAsset(release, {
    platform: process.platform,
    arch: process.arch
  })
  if (selectedAsset == null) {
    throw new Error(`No supported desktop asset was found for ${process.platform}-${process.arch} in ${release.tagName}.`)
  }

  const currentMetadata = await readDesktopMetadata(installMode)
  if (currentMetadata?.releaseTag === release.tagName && await hasExistingPath(currentMetadata.executablePath)) {
    return currentMetadata
  }

  const metadata = process.platform === 'darwin'
    ? await installDesktopForMac(release.tagName, selectedAsset, installMode)
    : process.platform === 'linux'
      ? await installDesktopForLinux(release.tagName, selectedAsset, installMode)
      : process.platform === 'win32'
        ? await installDesktopForWindows(release.tagName, selectedAsset, installMode)
        : undefined
  if (metadata == null) {
    throw new Error(`Desktop bootstrap is not supported on ${process.platform}.`)
  }

  await writeDesktopMetadata(installMode, metadata)
  return metadata
}
