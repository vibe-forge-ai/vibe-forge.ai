import process from 'node:process'

import {
  buildBaseEnv,
  cliPackageDir,
  createCtxId,
  createSessionId,
  mockHome,
  opencodeBin,
  realHome,
  repoRoot,
  runProcess,
  toProviderModel,
  waitForPath
} from './runtime'
import type {
  AdapterE2EHarnessOptions,
  AdapterE2EResult,
  ResolvedAdapterE2ECase
} from './types'
import {
  collectManagedArtifacts,
  readHookLog
} from './verify'

export const runWrappedAdapter = async (
  testCase: ResolvedAdapterE2ECase,
  mockServerPort: number,
  options: AdapterE2EHarnessOptions
): Promise<AdapterE2EResult> => {
  const ctxId = createCtxId(testCase.adapter)
  const sessionId = createSessionId()
  const result = await runProcess({
    command: process.execPath,
    args: testCase.args(sessionId),
    env: buildBaseEnv(ctxId, mockServerPort),
    timeoutMs: Number(process.env.HOOK_SMOKE_TIMEOUT_MS ?? 180_000),
    passthroughStdIO: options.passthroughStdIO ?? true
  })

  if (result.code !== 0) {
    throw new Error(`${testCase.adapter} smoke exited with code ${result.code}`)
  }

  const { logPath, content } = await readHookLog({
    ctxId,
    sessionId
  })

  return {
    caseId: testCase.id,
    adapter: testCase.adapter,
    ctxId,
    sessionId,
    logPath,
    logContent: content,
    managedArtifacts: await collectManagedArtifacts({
      adapter: testCase.adapter,
      sessionId
    }),
    stdout: result.stdout,
    stderr: result.stderr,
    exitCode: result.code,
    transport: 'wrapper',
    mockTrace: []
  }
}

export const runOpenCodeUpstream = async (input: {
  testCase: ResolvedAdapterE2ECase
  ctxId: string
  sessionId: string
  mockServerPort: number
  passthroughStdIO: boolean
}): Promise<AdapterE2EResult> => {
  const configDir = `${repoRoot}/.ai/.mock/.opencode-adapter/${input.sessionId}/config-dir`
  if (!await waitForPath(configDir, 5_000)) {
    throw new Error(`OpenCode config dir not found for fallback: ${configDir}`)
  }

  const result = await runProcess({
    command: opencodeBin,
    args: [
      'run',
      '--print-logs',
      '--format', 'json',
      '--model', toProviderModel(input.testCase.model),
      '--dir', repoRoot,
      input.testCase.prompt
    ],
    env: {
      ...buildBaseEnv(input.ctxId, input.mockServerPort),
      HOME: mockHome,
      OPENCODE_CONFIG_DIR: configDir,
      __VF_VIBE_FORGE_OPENCODE_HOOKS_ACTIVE__: '1',
      __VF_PROJECT_NODE_PATH__: process.execPath,
      __VF_PROJECT_REAL_HOME__: realHome,
      __VF_PROJECT_CLI_PACKAGE_DIR__: cliPackageDir,
      __VF_PROJECT_PACKAGE_DIR__: cliPackageDir,
      __VF_OPENCODE_TASK_SESSION_ID__: input.sessionId,
      __VF_OPENCODE_HOOK_RUNTIME__: 'cli'
    },
    timeoutMs: Number(process.env.HOOK_SMOKE_TIMEOUT_MS ?? 180_000),
    passthroughStdIO: input.passthroughStdIO
  })

  if (result.code !== 0) {
    throw new Error(`opencode upstream smoke exited with code ${result.code}`)
  }

  const { logPath, content } = await readHookLog({
    ctxId: input.ctxId,
    sessionId: input.sessionId
  })

  return {
    caseId: input.testCase.id,
    adapter: 'opencode',
    ctxId: input.ctxId,
    sessionId: input.sessionId,
    logPath,
    logContent: content,
    managedArtifacts: await collectManagedArtifacts({
      adapter: 'opencode',
      sessionId: input.sessionId
    }),
    stdout: result.stdout,
    stderr: result.stderr,
    exitCode: result.code,
    transport: 'upstream-fallback',
    mockTrace: []
  }
}

export const runOpenCode = async (
  testCase: ResolvedAdapterE2ECase,
  mockServerPort: number,
  options: AdapterE2EHarnessOptions
): Promise<AdapterE2EResult> => {
  const ctxId = createCtxId('opencode')
  const sessionId = createSessionId()
  const wrapperTimeoutMs = Number(
    process.env.HOOK_SMOKE_OPENCODE_WRAPPER_TIMEOUT_MS ?? 20_000
  )

  const wrapperResult = await runProcess({
    command: process.execPath,
    args: testCase.args(sessionId),
    env: buildBaseEnv(ctxId, mockServerPort),
    timeoutMs: wrapperTimeoutMs,
    passthroughStdIO: options.passthroughStdIO ?? true
  })

  if (
    wrapperResult.code === 0
    && !wrapperResult.timedOut
  ) {
    const { logPath, content } = await readHookLog({
      ctxId,
      sessionId
    })

    return {
      caseId: testCase.id,
      adapter: 'opencode',
      ctxId,
      sessionId,
      logPath,
      logContent: content,
      managedArtifacts: await collectManagedArtifacts({
        adapter: 'opencode',
        sessionId
      }),
      stdout: wrapperResult.stdout,
      stderr: wrapperResult.stderr,
      exitCode: wrapperResult.code,
      transport: 'wrapper',
      mockTrace: []
    }
  }

  if (options.passthroughStdIO ?? true) {
    console.warn('\n[smoke:opencode] wrapper path did not complete cleanly, falling back to upstream CLI')
  }

  return runOpenCodeUpstream({
    testCase,
    ctxId,
    sessionId,
    mockServerPort,
    passthroughStdIO: options.passthroughStdIO ?? true
  })
}
