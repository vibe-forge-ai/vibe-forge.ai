import type { ChildProcess } from 'node:child_process'
import http from 'node:http'
import type { AddressInfo } from 'node:net'
import net from 'node:net'
import process from 'node:process'

import { SERVER_HOST, SERVER_READY_PATH, SERVER_READY_TIMEOUT_MS, SERVER_UI_READY_PATH } from './constants'

export const isRunning = (child: ChildProcess) => (
  child.exitCode == null && child.signalCode == null && !child.killed
)

const killChild = (child: ChildProcess, signal: NodeJS.Signals) => {
  if (child.pid != null && process.platform !== 'win32') {
    try {
      process.kill(-child.pid, signal)
      return
    } catch {
      // Fall back to killing the direct child below.
    }
  }
  child.kill(signal)
}

export const getAvailablePort = () =>
  new Promise<number>((resolve, reject) => {
    const server = net.createServer()

    server.once('error', reject)
    server.listen(0, SERVER_HOST, () => {
      const address = server.address() as AddressInfo | null
      server.close(() => {
        if (address == null) {
          reject(new Error('Failed to allocate a local server port.'))
          return
        }
        resolve(address.port)
      })
    })
  })

const requestStatus = (port: number, requestPath: string) =>
  new Promise<number>((resolve, reject) => {
    const request = http.get({
      hostname: SERVER_HOST,
      path: requestPath,
      port,
      timeout: 1000
    }, (response) => {
      response.resume()
      response.on('end', () => resolve(response.statusCode ?? 500))
    })

    request.once('timeout', () => {
      request.destroy(new Error('Request timed out.'))
    })

    request.once('error', reject)
  })

const waitForServerReady = ({ port, startedAt = Date.now() }: { port: number; startedAt?: number }) =>
  new Promise<void>((resolve, reject) => {
    const retry = () => {
      if (Date.now() - startedAt > SERVER_READY_TIMEOUT_MS) {
        reject(new Error('Timed out while waiting for the Vibe Forge server.'))
        return
      }
      setTimeout(() => {
        waitForServerReady({ port, startedAt }).then(resolve, reject)
      }, 250)
    }

    requestStatus(port, SERVER_READY_PATH).then(
      (statusCode) => {
        if (statusCode < 500) {
          resolve()
          return
        }
        retry()
      },
      retry
    )
  })

export const assertServerUiReady = async (port: number) => {
  const statusCode = await requestStatus(port, SERVER_UI_READY_PATH)
  if (statusCode < 200 || statusCode >= 400) {
    throw new Error(
      [
        `Vibe Forge UI was not served from ${SERVER_UI_READY_PATH} (status ${statusCode}).`,
        '',
        'Install the UI package in this workspace:',
        'pnpm add -D @vibe-forge/client',
        '',
        'Or configure `vibeForge.clientDistPath` with a built @vibe-forge/client dist directory.'
      ].join('\n')
    )
  }
}

export const waitForServerStartup = (child: ChildProcess, port: number) =>
  new Promise<void>((resolve, reject) => {
    let settled = false

    const cleanup = () => {
      child.off('error', onError)
      child.off('exit', onExit)
    }
    const settleResolve = () => {
      if (settled) return
      settled = true
      cleanup()
      resolve()
    }
    const settleReject = (error: Error) => {
      if (settled) return
      settled = true
      cleanup()
      reject(error)
    }
    const onError = (error: Error) => settleReject(error)
    const onExit = (code: number | null, signal: NodeJS.Signals | null) => {
      settleReject(
        new Error(`Vibe Forge server exited before it was ready (code=${code ?? 'null'} signal=${signal ?? 'null'}).`)
      )
    }

    child.once('error', onError)
    child.once('exit', onExit)
    waitForServerReady({ port }).then(
      settleResolve,
      error => settleReject(error instanceof Error ? error : new Error(String(error)))
    )
  })

export const stopChild = async (child: ChildProcess) => {
  if (!isRunning(child)) {
    return
  }

  killChild(child, 'SIGTERM')
  await new Promise<void>((resolve) => {
    const timer = setTimeout(() => {
      if (isRunning(child)) {
        killChild(child, 'SIGKILL')
      }
      resolve()
    }, 3000)
    child.once('exit', () => {
      clearTimeout(timer)
      resolve()
    })
  })
}
