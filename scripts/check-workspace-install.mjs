import { access, readFile, readdir } from 'node:fs/promises'
import path from 'node:path'

const repoRoot = process.cwd()

const dependencyFields = [
  'dependencies',
  'devDependencies',
  'optionalDependencies',
  'peerDependencies'
]

const fileExists = async (targetPath) => {
  try {
    await access(targetPath)
    return true
  } catch {
    return false
  }
}

const readJson = async (targetPath) => JSON.parse(await readFile(targetPath, 'utf8'))

const parseWorkspacePatterns = async () => {
  const content = await readFile(path.join(repoRoot, 'pnpm-workspace.yaml'), 'utf8')
  return content
    .split('\n')
    .map(line => line.match(/^\s*-\s+(.+?)\s*$/)?.[1] ?? null)
    .filter(Boolean)
}

const expandSingleStarPattern = async (pattern) => {
  const normalized = pattern.replace(/\/+$/, '')
  const segments = normalized.split('/')
  const starIndex = segments.indexOf('*')
  if (starIndex === -1) {
    return []
  }

  const baseDir = path.join(repoRoot, ...segments.slice(0, starIndex))
  const suffixSegments = segments.slice(starIndex + 1)
  const entries = await readDirIfExists(baseDir)
  const directories = []

  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const candidateDir = path.join(baseDir, entry.name, ...suffixSegments)
    if (await fileExists(path.join(candidateDir, 'package.json'))) {
      directories.push(candidateDir)
    }
  }

  return directories
}

const readDirIfExists = async (targetPath) => {
  try {
    return await readdir(targetPath, { withFileTypes: true })
  } catch {
    return []
  }
}

const listWorkspacePackageDirs = async () => {
  const patterns = await parseWorkspacePatterns()
  const dirs = new Set([repoRoot])

  for (const pattern of patterns) {
    const packageDirs = await expandSingleStarPattern(pattern)
    for (const packageDir of packageDirs) {
      dirs.add(packageDir)
    }
  }

  return [...dirs]
}

const collectWorkspaceDependencies = (pkg) => {
  const deps = []
  for (const field of dependencyFields) {
    const records = pkg[field]
    if (records == null || typeof records !== 'object') continue
    for (const [name, version] of Object.entries(records)) {
      if (typeof version === 'string' && version.startsWith('workspace:')) {
        deps.push(name)
      }
    }
  }
  return deps
}

const resolveNodeModulesEntry = (packageDir, dependencyName) => (
  path.join(packageDir, 'node_modules', ...dependencyName.split('/'))
)

const main = async () => {
  const modulesStatePath = path.join(repoRoot, 'node_modules', '.modules.yaml')
  if (!(await fileExists(modulesStatePath))) {
    console.error('[start] Missing node_modules/.modules.yaml in current worktree.')
    console.error('[start] Run `pnpm install` in this worktree before starting.')
    process.exit(1)
  }

  const packageDirs = await listWorkspacePackageDirs()
  const missingLinks = []

  for (const packageDir of packageDirs) {
    const pkg = await readJson(path.join(packageDir, 'package.json'))
    const workspaceDependencies = collectWorkspaceDependencies(pkg)

    for (const dependencyName of workspaceDependencies) {
      const dependencyPath = resolveNodeModulesEntry(packageDir, dependencyName)
      if (await fileExists(dependencyPath)) {
        continue
      }
      missingLinks.push({
        packageName: pkg.name ?? path.relative(repoRoot, packageDir),
        packageDir,
        dependencyName
      })
    }
  }

  if (missingLinks.length === 0) {
    process.exit(0)
  }

  console.error('[start] Current worktree is missing workspace dependency links:')
  for (const item of missingLinks) {
    console.error(`- ${item.packageName}: ${item.dependencyName} (${path.relative(repoRoot, item.packageDir) || '.'})`)
  }
  console.error('[start] Run `pnpm install` in this worktree before starting.')
  process.exit(1)
}

await main()
