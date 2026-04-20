import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

import {
  BOOTSTRAP_PACKAGE_NAME,
  buildNpmPackageTarballUrl,
  CLI_PACKAGE_NAME,
  computeUrlSha256,
  normalizeNpmPackageVersion
} from './cli-package-release'

const DEFAULT_TAP_DIR = 'infra/homebrew-tap'
const DEFAULT_FORMULA_PATH = 'Formula/vibe-forge.rb'

export const updateVibeForgeFormula = (
  content: string,
  input: {
    sha256: string
    tarballUrl: string
  }
) => {
  let nextContent = content
  const urlPattern = /url "https:\/\/registry\.npmjs\.org\/@vibe-forge\/[^"]+\.tgz"/
  const sha256Pattern = /sha256 "[0-9a-f]{64}"/

  if (!urlPattern.test(content) || !sha256Pattern.test(content)) {
    throw new Error('Formula was not updated. Check url and sha256 patterns.')
  }

  nextContent = nextContent.replace(urlPattern, `url "${input.tarballUrl}"`)
  nextContent = nextContent.replace(sha256Pattern, `sha256 "${input.sha256}"`)

  return nextContent
}

const runHomebrewTapSyncPackage = async (input: {
  version: string
  packageName: string
  tapDir?: string
  formulaPath?: string
  dryRun?: boolean
  cwd?: string
  stdout?: Pick<NodeJS.WriteStream, 'write'>
}) => {
  const cwd = input.cwd ?? process.cwd()
  const version = normalizeNpmPackageVersion(input.packageName, input.version)
  const tapDir = input.tapDir ?? DEFAULT_TAP_DIR
  const formulaPath = input.formulaPath ?? DEFAULT_FORMULA_PATH
  const resolvedFormulaPath = path.resolve(cwd, tapDir, formulaPath)
  const tarballUrl = buildNpmPackageTarballUrl(input.packageName, version)
  const stdout = input.stdout ?? process.stdout

  const sha256 = await computeUrlSha256(tarballUrl)
  const content = await readFile(resolvedFormulaPath, 'utf8')
  const nextContent = updateVibeForgeFormula(content, {
    tarballUrl,
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

export const runHomebrewTapSyncCli = async (input: {
  version: string
  tapDir?: string
  formulaPath?: string
  dryRun?: boolean
  cwd?: string
  stdout?: Pick<NodeJS.WriteStream, 'write'>
}) => await runHomebrewTapSyncPackage({
  ...input,
  packageName: CLI_PACKAGE_NAME
})

export const runHomebrewTapSyncBootstrap = async (input: {
  version: string
  tapDir?: string
  formulaPath?: string
  dryRun?: boolean
  cwd?: string
  stdout?: Pick<NodeJS.WriteStream, 'write'>
}) => await runHomebrewTapSyncPackage({
  ...input,
  packageName: BOOTSTRAP_PACKAGE_NAME
})
