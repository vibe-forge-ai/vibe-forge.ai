import { spawn } from 'node:child_process'
import { resolve } from 'node:path'
import process from 'node:process'

import { createReleaseStage, getAppRoot, getVsceBinaryPath } from './release-manifest.mjs'

if (!process.env.VSCE_PAT?.trim()) {
  throw new Error('Missing VSCE_PAT. Set a Visual Studio Marketplace token before publishing.')
}

const packagePath = readArgumentValue('--packagePath')

if (packagePath) {
  const resolvedPath = resolve(getAppRoot(), packagePath)
  await runCommand(
    getVsceBinaryPath(),
    ['publish', '--packagePath', resolvedPath, '--skip-license'],
    getAppRoot()
  )
  console.log(`Published VSIX ${resolvedPath}`)
} else {
  const stage = await createReleaseStage()

  try {
    await runCommand(
      getVsceBinaryPath(),
      ['publish', '--no-dependencies', '--skip-license'],
      stage.stageDir
    )
    console.log(
      `Published VS Code extension ${stage.manifest.publisher}.${stage.manifest.name}@${stage.manifest.version}`
    )
  } finally {
    await stage.cleanup()
  }
}

function readArgumentValue(flag) {
  const index = process.argv.indexOf(flag)

  if (index < 0) {
    return undefined
  }

  return process.argv[index + 1]
}

function runCommand(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: process.env,
      stdio: 'inherit'
    })

    child.on('exit', (code) => {
      if (code === 0) {
        resolve()
        return
      }

      reject(new Error(`${command} ${args.join(' ')} exited with code ${code}`))
    })
    child.on('error', reject)
  })
}
