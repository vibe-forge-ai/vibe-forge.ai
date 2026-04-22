import { spawn } from 'node:child_process'
import process from 'node:process'

import { createReleaseStage, getVsceBinaryPath, resolveVsixPath } from './release-manifest.mjs'

const outputPath = readArgumentValue('--out')
const stage = await createReleaseStage()
const packagePath = resolveVsixPath(
  stage.manifest.version,
  stage.manifest.name,
  outputPath
)

try {
  await runCommand(
    getVsceBinaryPath(),
    ['package', '--out', packagePath, '--no-dependencies', '--skip-license'],
    stage.stageDir
  )
  console.log(`Packaged VSIX at ${packagePath}`)
} finally {
  await stage.cleanup()
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
