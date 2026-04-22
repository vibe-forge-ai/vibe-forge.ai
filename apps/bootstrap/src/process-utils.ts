import type { Buffer } from 'node:buffer'
import { spawn } from 'node:child_process'
import process from 'node:process'

interface RunBufferedCommandOptions {
  args: string[]
  command: string
  cwd?: string
  env?: NodeJS.ProcessEnv
  stdio?: 'ignore' | 'inherit' | 'pipe'
}

export const runBufferedCommand = async (input: RunBufferedCommandOptions) => {
  const child = spawn(input.command, input.args, {
    cwd: input.cwd,
    env: input.env,
    stdio: input.stdio ?? 'pipe'
  })

  let stdout = ''
  let stderr = ''

  if (input.stdio !== 'inherit') {
    child.stdout?.on('data', (chunk: Buffer | string) => {
      stdout += String(chunk)
    })
    child.stderr?.on('data', (chunk: Buffer | string) => {
      stderr += String(chunk)
    })
  }

  return await new Promise<{
    code: number
    stderr: string
    stdout: string
  }>((resolve, reject) => {
    child.once('error', reject)
    child.once('exit', (code) => {
      resolve({
        code: code ?? 0,
        stderr,
        stdout
      })
    })
  })
}

export const runNodeEntrypoint = async (entryPath: string, forwardedArgs: string[]) => {
  const child = spawn(process.execPath, [entryPath, ...forwardedArgs], {
    cwd: process.cwd(),
    env: process.env,
    stdio: 'inherit'
  })

  const forwardSignal = (signal: NodeJS.Signals) => {
    if (!child.killed) {
      child.kill(signal)
    }
  }

  const handleSigint = () => {
    forwardSignal('SIGINT')
  }

  const handleSigterm = () => {
    forwardSignal('SIGTERM')
  }

  const cleanup = () => {
    process.off('SIGINT', handleSigint)
    process.off('SIGTERM', handleSigterm)
  }

  process.on('SIGINT', handleSigint)
  process.on('SIGTERM', handleSigterm)

  return await new Promise<number>((resolve, reject) => {
    child.once('error', (error) => {
      cleanup()
      reject(error)
    })
    child.once('exit', (code, signal) => {
      cleanup()
      if (signal != null) {
        process.kill(process.pid, signal)
        return
      }
      resolve(code ?? 0)
    })
  })
}
