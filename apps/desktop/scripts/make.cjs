const { spawnSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')

const desktopRoot = path.resolve(__dirname, '..')
const outputDir = path.join(desktopRoot, 'out')
const releaseDir = path.join(desktopRoot, 'release')
const builderConfigPath = path.join(desktopRoot, 'electron-builder.yml')
const packageJson = require('../package.json')
const appName = 'Vibe Forge'

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
    return ['--win', ...(requestedTargets.length > 0 ? requestedTargets : ['nsis'])]
  }

  return ['--linux', ...(requestedTargets.length > 0 ? requestedTargets : ['AppImage', 'deb', 'tar.gz'])]
}

const builderArchArgs = () => {
  if (process.arch === 'x64') return ['--x64']
  if (process.arch === 'arm64') return ['--arm64']
  if (process.arch === 'ia32') return ['--ia32']
  if (process.arch === 'arm') return ['--armv7l']
  return []
}

const resolvePrepackagedPath = () => {
  const packageDirs = fs.readdirSync(outputDir, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && entry.name.startsWith(`${appName}-`))
    .map(entry => path.join(outputDir, entry.name))
    .sort()

  if (packageDirs.length === 0) {
    throw new Error('Desktop app package was not found. Run `pnpm desktop:package` first.')
  }

  const packageDir = packageDirs[0]
  if (process.platform === 'darwin') {
    const appPath = path.join(packageDir, `${appName}.app`)
    if (!fs.existsSync(appPath)) {
      throw new Error(`macOS app bundle was not found at ${appPath}`)
    }
    return appPath
  }

  return packageDir
}

const runElectronBuilder = () => {
  fs.rmSync(releaseDir, { recursive: true, force: true })

  const builderCliPath = require.resolve('electron-builder/cli.js')
  const appVersion = resolveAppVersion()
  const publishMode = process.env.VF_DESKTOP_PUBLISH ?? 'never'
  const env = {
    ...process.env
  }

  if (!isTruthy(process.env.VF_DESKTOP_SIGN)) {
    env.CSC_IDENTITY_AUTO_DISCOVERY = 'false'
    delete env.CSC_KEY_PASSWORD
    delete env.CSC_LINK
    delete env.WIN_CSC_KEY_PASSWORD
    delete env.WIN_CSC_LINK
  }

  const args = [
    builderCliPath,
    '--projectDir',
    desktopRoot,
    '--config',
    builderConfigPath,
    `--config.extraMetadata.version=${appVersion}`,
    '--prepackaged',
    resolvePrepackagedPath(),
    ...builderTargetArgs(),
    ...builderArchArgs(),
    '--publish',
    publishMode
  ]

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
}

runElectronBuilder()
