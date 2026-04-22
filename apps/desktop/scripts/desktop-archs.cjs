const SUPPORTED_ARCHS = {
  darwin: new Set(['arm64', 'x64']),
  linux: new Set(['arm64', 'armv7l', 'x64']),
  win32: new Set(['arm64', 'ia32', 'x64'])
}

const normalizeArch = (arch) => {
  if (arch === 'arm') return 'armv7l'
  return arch
}

const resolveSupportedArchs = (platform) => {
  const supportedArchs = SUPPORTED_ARCHS[platform]
  if (supportedArchs == null) {
    throw new Error(`Unsupported desktop packaging platform: ${platform}`)
  }
  return supportedArchs
}

const resolveTargetArchs = ({
  defaultArch = normalizeArch(process.arch),
  envName = 'VF_DESKTOP_ARCHS',
  platform = process.platform
} = {}) => {
  const supportedArchs = resolveSupportedArchs(platform)
  const requestedArchs = (process.env[envName] ?? '')
    .split(',')
    .map(item => normalizeArch(item.trim()))
    .filter(Boolean)

  const targetArchs = requestedArchs.length > 0 ? requestedArchs : [defaultArch]
  const dedupedArchs = []

  for (const arch of targetArchs) {
    if (!supportedArchs.has(arch)) {
      throw new Error(`Unsupported desktop arch "${arch}" for ${platform}`)
    }
    if (!dedupedArchs.includes(arch)) {
      dedupedArchs.push(arch)
    }
  }

  return dedupedArchs
}

const toBuilderArchArg = (arch) => {
  if (arch === 'x64') return '--x64'
  if (arch === 'arm64') return '--arm64'
  if (arch === 'ia32') return '--ia32'
  if (arch === 'armv7l') return '--armv7l'
  throw new Error(`Unsupported electron-builder arch "${arch}"`)
}

module.exports = {
  normalizeArch,
  resolveTargetArchs,
  toBuilderArchArg
}
