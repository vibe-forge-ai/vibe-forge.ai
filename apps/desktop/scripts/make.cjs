const { spawnSync } = require('node:child_process')
const fs = require('node:fs')
const { createRequire } = require('node:module')
const path = require('node:path')

const { resolveTargetArchs, toBuilderArchArg } = require('./desktop-archs.cjs')

const desktopRoot = path.resolve(__dirname, '..')
const outputDir = path.join(desktopRoot, 'out')
const releaseDir = path.join(desktopRoot, 'release')
const builderConfigPath = path.join(desktopRoot, 'electron-builder.yml')
const packageJson = require('../package.json')
const appName = 'Vibe Forge'
const electronBuilderRequire = createRequire(require.resolve('electron-builder/package.json'))
const yaml = electronBuilderRequire('js-yaml')

const isTruthy = value => /^(1|true|yes|on)$/i.test(value ?? '')

const resolveAppVersion = () => {
  const requestedVersion = process.env.VF_DESKTOP_VERSION?.trim()
  const version = requestedVersion || packageJson.version
  if (!/^[0-9]+\.[0-9]+\.[0-9]+([-.][0-9A-Za-z.-]+)?$/.test(version)) {
    throw new Error(`Invalid desktop app version: ${version}`)
  }
  return version
}

const builderTargetArgs = () => {
  const requestedTargets = (process.env.VF_DESKTOP_MAKE_TARGETS ?? '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean)

  if (process.platform === 'darwin') {
    return ['--mac', ...(requestedTargets.length > 0 ? requestedTargets : ['dmg', 'zip'])]
  }

  if (process.platform === 'win32') {
    return ['--win', ...(requestedTargets.length > 0 ? requestedTargets : ['nsis-web'])]
  }

  return ['--linux', ...(requestedTargets.length > 0 ? requestedTargets : ['AppImage', 'deb', 'tar.gz'])]
}

const resolvePackageDirForArch = (targetArch) => {
  const packageDirs = fs.readdirSync(outputDir, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && entry.name.startsWith(`${appName}-`))
    .map(entry => path.join(outputDir, entry.name))
    .sort()

  if (packageDirs.length === 0) {
    throw new Error('Desktop app package was not found. Run `pnpm desktop:package` first.')
  }

  const packageDir = packageDirs.find(candidate => candidate.endsWith(`-${targetArch}`))
  if (packageDir == null) {
    throw new Error(`Desktop app package for arch ${targetArch} was not found. Run \`pnpm desktop:package\` first.`)
  }
  return packageDir
}

const resolvePrepackagedPath = (targetArch) => {
  const packageDir = resolvePackageDirForArch(targetArch)
  if (process.platform === 'darwin') {
    const appPath = path.join(packageDir, `${appName}.app`)
    if (!fs.existsSync(appPath)) {
      throw new Error(`macOS app bundle was not found at ${appPath}`)
    }
    return appPath
  }

  return packageDir
}

const buildElectronBuilderArgs = ({ appVersion, publishMode, targetArch }) => {
  const builderCliPath = require.resolve('electron-builder/cli.js')
  return [
    builderCliPath,
    '--projectDir',
    desktopRoot,
    '--config',
    builderConfigPath,
    `--config.extraMetadata.version=${appVersion}`,
    '--prepackaged',
    resolvePrepackagedPath(targetArch),
    ...builderTargetArgs(),
    toBuilderArchArg(targetArch),
    '--publish',
    publishMode
  ]
}

const mergeMacUpdateInfo = (targetArchs) => {
  const macUpdateInfoPaths = targetArchs
    .map(targetArch => path.join(releaseDir, `latest-mac-${targetArch}.yml`))
    .filter(candidate => fs.existsSync(candidate))

  if (macUpdateInfoPaths.length <= 1) {
    return
  }

  const updateInfos = macUpdateInfoPaths.map(filePath => yaml.load(fs.readFileSync(filePath, 'utf8')))
  const combinedFiles = []

  for (const updateInfo of updateInfos) {
    for (const fileInfo of updateInfo.files ?? []) {
      if (!combinedFiles.some(candidate => candidate.url === fileInfo.url)) {
        combinedFiles.push(fileInfo)
      }
    }
  }

  const primaryUpdateInfo = updateInfos[0]
  const primaryZipFile = combinedFiles.find(fileInfo => fileInfo.url.endsWith('.zip')) ?? combinedFiles[0]
  const mergedUpdateInfo = {
    ...primaryUpdateInfo,
    files: combinedFiles
  }

  if (primaryZipFile != null) {
    mergedUpdateInfo.path = primaryZipFile.url
    mergedUpdateInfo.sha512 = primaryZipFile.sha512
  }

  fs.writeFileSync(path.join(releaseDir, 'latest-mac.yml'), yaml.dump(mergedUpdateInfo, {
    lineWidth: -1,
    noRefs: true
  }))

  for (const filePath of macUpdateInfoPaths) {
    fs.rmSync(filePath, { force: true })
  }
}

const runElectronBuilder = () => {
  const appVersion = resolveAppVersion()
  const publishMode = process.env.VF_DESKTOP_PUBLISH ?? 'never'
  const env = {
    ...process.env
  }
  const targetArchs = resolveTargetArchs()

  fs.rmSync(releaseDir, { recursive: true, force: true })

  if (!isTruthy(process.env.VF_DESKTOP_SIGN)) {
    env.CSC_IDENTITY_AUTO_DISCOVERY = 'false'
    delete env.CSC_KEY_PASSWORD
    delete env.CSC_LINK
    delete env.WIN_CSC_KEY_PASSWORD
    delete env.WIN_CSC_LINK
  }

  for (const targetArch of targetArchs) {
    const args = buildElectronBuilderArgs({
      appVersion,
      publishMode,
      targetArch
    })

    const result = spawnSync(process.execPath, args, {
      cwd: desktopRoot,
      env,
      stdio: 'inherit'
    })

    if (result.error != null) {
      throw result.error
    }
    if (result.status !== 0) {
      throw new Error(`electron-builder failed with exit code ${result.status}`)
    }

    if (process.platform === 'darwin') {
      const macUpdateInfoPath = path.join(releaseDir, 'latest-mac.yml')
      if (fs.existsSync(macUpdateInfoPath)) {
        fs.copyFileSync(macUpdateInfoPath, path.join(releaseDir, `latest-mac-${targetArch}.yml`))
      }
    }
  }

  if (process.platform === 'darwin') {
    mergeMacUpdateInfo(targetArchs)
  }
}

runElectronBuilder()
