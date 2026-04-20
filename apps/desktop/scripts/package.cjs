const { spawnSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')

const { packager } = require('@electron/packager')

const desktopRoot = path.resolve(__dirname, '..')
const workspaceRoot = path.resolve(desktopRoot, '../..')
const clientDistPath = path.resolve(desktopRoot, '../client/dist')
const outputDir = path.join(desktopRoot, 'out')
const releaseDir = path.join(desktopRoot, 'release')
const stagingDir = path.join(workspaceRoot, '.data/desktop-package-staging')
const desktopStagingDir = path.join(desktopRoot, '.data/desktop-package-staging')
const appUpdateConfigPath = path.join(desktopRoot, 'build', 'app-update.yml')
const electronVersion = require('electron/package.json').version
const packageJson = require('../package.json')
const appName = 'Vibe Forge'
const executableName = process.platform === 'darwin' ? appName : 'vibe-forge'

const isTruthy = value => /^(1|true|yes|on)$/i.test(value ?? '')

const resolvePnpmInvocation = () => {
  const npmExecPath = process.env.npm_execpath?.trim()
  if (npmExecPath) {
    if (/\.(c|m)?js$/i.test(npmExecPath)) {
      return {
        args: [npmExecPath],
        command: process.execPath
      }
    }

    return {
      args: [],
      command: npmExecPath,
      shell: process.platform === 'win32' && /\.(cmd|bat)$/i.test(npmExecPath)
    }
  }

  return process.platform === 'win32'
    ? {
      args: [],
      command: 'pnpm.cmd',
      shell: true
    }
    : {
      args: [],
      command: 'pnpm'
    }
}

const resolveAppVersion = () => {
  const requestedVersion = process.env.VF_DESKTOP_VERSION?.trim()
  const version = requestedVersion || packageJson.version
  if (!/^[0-9]+\.[0-9]+\.[0-9]+([-.][0-9A-Za-z.-]+)?$/.test(version)) {
    throw new Error(`Invalid desktop app version: ${version}`)
  }
  return version
}

const runPnpm = (args) => {
  const { args: baseArgs, command, shell } = resolvePnpmInvocation()
  const result = spawnSync(command, [...baseArgs, ...args], {
    cwd: workspaceRoot,
    shell,
    stdio: 'inherit'
  })

  if (result.error != null) {
    throw result.error
  }
  if (result.status !== 0) {
    throw new Error(`pnpm ${args.join(' ')} failed with exit code ${result.status}`)
  }
}

const removeStagingDirs = () => {
  fs.rmSync(stagingDir, { recursive: true, force: true })
  fs.rmSync(desktopStagingDir, { recursive: true, force: true })
}

const removeIfExists = (targetPath) => {
  if (!fs.existsSync(targetPath)) return
  fs.rmSync(targetPath, { recursive: true, force: true })
}

const resolveStagingPackageRoot = (packageName) => {
  const pnpmDir = path.join(stagingDir, 'node_modules', '.pnpm')
  if (!fs.existsSync(pnpmDir)) {
    return undefined
  }

  for (const entry of fs.readdirSync(pnpmDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue
    }

    const packageRoot = path.join(pnpmDir, entry.name, 'node_modules', packageName)
    if (fs.existsSync(path.join(packageRoot, 'package.json'))) {
      return packageRoot
    }
  }

  return undefined
}

const pruneNodePtyPrebuilds = () => {
  const packageRoot = resolveStagingPackageRoot('node-pty')
  if (packageRoot == null) return

  const prebuildsDir = path.join(packageRoot, 'prebuilds')
  const targetPrebuildName = `${process.platform}-${process.arch}`
  if (fs.existsSync(prebuildsDir)) {
    for (const entry of fs.readdirSync(prebuildsDir, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name === targetPrebuildName) {
        continue
      }
      removeIfExists(path.join(prebuildsDir, entry.name))
    }
  }

  if (process.platform !== 'win32') {
    removeIfExists(path.join(packageRoot, 'third_party'))
  }
}

const pruneNodeNotifierVendors = () => {
  const packageRoot = resolveStagingPackageRoot('node-notifier')
  if (packageRoot == null) return

  const vendorDir = path.join(packageRoot, 'vendor')
  if (!fs.existsSync(vendorDir)) return

  const removableVendors = process.platform === 'win32'
    ? ['mac.noindex']
    : ['notifu', 'snoreToast']

  for (const vendorName of removableVendors) {
    removeIfExists(path.join(vendorDir, vendorName))
  }
}

const pruneUnusedPlatformBinaries = () => {
  pruneNodePtyPrebuilds()
  pruneNodeNotifierVendors()
}

const resolvePackagedAppRoot = (appPath) => {
  if (process.platform === 'darwin') {
    return path.join(appPath, `${appName}.app`, 'Contents', 'Resources', 'app')
  }

  return path.join(appPath, 'resources', 'app')
}

const resolvePackageIconPath = () => {
  if (process.platform === 'darwin') {
    return path.join(desktopRoot, 'build', 'icon.icns')
  }

  if (process.platform === 'win32') {
    return path.join(desktopRoot, 'build', 'icon.ico')
  }

  return path.join(desktopRoot, 'build', 'icon.png')
}

const resolvePackagedSymlinkTarget = (target, packagedAppRoot) => {
  if (target === stagingDir || target.startsWith(`${stagingDir}${path.sep}`)) {
    return path.join(packagedAppRoot, path.relative(stagingDir, target))
  }

  if (target === desktopRoot || target.startsWith(`${desktopRoot}${path.sep}`)) {
    return path.join(packagedAppRoot, path.relative(desktopRoot, target))
  }

  return undefined
}

const rewriteStagingSymlinks = (rootDir, packagedAppRoot) => {
  const entries = fs.readdirSync(rootDir, { withFileTypes: true })
  for (const entry of entries) {
    const entryPath = path.join(rootDir, entry.name)
    const stat = fs.lstatSync(entryPath)

    if (stat.isSymbolicLink()) {
      const target = fs.readlinkSync(entryPath)
      if (path.isAbsolute(target)) {
        const packagedTarget = resolvePackagedSymlinkTarget(target, packagedAppRoot)
        if (packagedTarget == null) continue
        const relativeTarget = path.relative(path.dirname(entryPath), packagedTarget)
        fs.unlinkSync(entryPath)
        fs.symlinkSync(relativeTarget, entryPath)
      }
      continue
    }

    if (stat.isDirectory()) {
      rewriteStagingSymlinks(entryPath, packagedAppRoot)
    }
  }
}

async function main() {
  removeStagingDirs()
  fs.rmSync(outputDir, { recursive: true, force: true })
  fs.rmSync(releaseDir, { recursive: true, force: true })

  try {
    console.log('[desktop] preparing production app staging')
    runPnpm([
      '--filter',
      '@vibe-forge/desktop',
      'deploy',
      '--legacy',
      '--prod',
      stagingDir
    ])
    pruneUnusedPlatformBinaries()

    const iconPath = resolvePackageIconPath()
    const appVersion = resolveAppVersion()
    const enableAutoUpdate = isTruthy(process.env.VF_DESKTOP_ENABLE_AUTO_UPDATE)
    if (!fs.existsSync(iconPath)) {
      throw new Error(`Desktop package icon is missing: ${iconPath}`)
    }
    if (enableAutoUpdate && !fs.existsSync(appUpdateConfigPath)) {
      throw new Error(`Desktop auto-update config is missing: ${appUpdateConfigPath}`)
    }
    if (!enableAutoUpdate) {
      console.log('[desktop] auto-update config disabled for this package')
    }

    const appPaths = await packager({
      appBundleId: 'ai.vibeforge.desktop',
      appCategoryType: 'public.app-category.developer-tools',
      appCopyright: 'Copyright Vibe Forge contributors',
      appVersion,
      arch: process.arch,
      asar: false,
      derefSymlinks: false,
      dir: stagingDir,
      electronVersion,
      executableName,
      extendInfo: {
        CFBundleIconFile: 'icon.icns'
      },
      extraResource: [
        ...(enableAutoUpdate ? [appUpdateConfigPath] : []),
        clientDistPath
      ],
      icon: iconPath,
      ignore: [
        /^\/out($|\/)/,
        /^\/scripts($|\/)/
      ],
      name: appName,
      out: outputDir,
      overwrite: true,
      platform: process.platform,
      prune: false
    })

    for (const appPath of appPaths) {
      const packagedAppRoot = resolvePackagedAppRoot(appPath)
      rewriteStagingSymlinks(packagedAppRoot, packagedAppRoot)
      console.log(`[desktop] packaged ${appPath}`)
    }
  } finally {
    removeStagingDirs()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
