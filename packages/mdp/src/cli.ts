import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { createMcpBridge } from '@modeldriveprotocol/server'
import { buildConfigJsonVariables, loadConfigState } from '@vibe-forge/config'

import { createBridgeRequestHandler } from './bridge'
import { resolveMdpConfig } from './config'
import { startWorkspaceSkillProjection } from './skill-projection'

const closeHandles = async (
  handles: Array<{ disconnect: () => Promise<void> }>
) => {
  await Promise.allSettled(handles.map(handle => handle.disconnect()))
}

async function runCli() {
  const cwd = process.cwd()
  const configState = await loadConfigState({
    cwd,
    jsonVariables: buildConfigJsonVariables(cwd)
  })
  const mdp = resolveMdpConfig(configState.mergedConfig)
  let projectionHandles: Array<{ disconnect: () => Promise<void> }> = []
  let shuttingDown = false

  const transport = new StdioServerTransport()
  const bridge = createMcpBridge(
    createBridgeRequestHandler({
      cwd,
      config: configState.mergedConfig
    })
  )

  const projectionTask = startWorkspaceSkillProjection({
    cwd,
    configs: [configState.projectConfig, configState.userConfig],
    mdp
  }).then(async (handles) => {
    if (shuttingDown) {
      await closeHandles(handles)
      return
    }
    projectionHandles = handles
  }).catch((error) => {
    console.error(
      `[vibe-forge-mdp] workspace skill projection bootstrap failed: ${
        error instanceof Error ? error.message : String(error)
      }`
    )
  })

  const shutdown = async () => {
    shuttingDown = true
    await Promise.allSettled([
      closeHandles(projectionHandles),
      bridge.close()
    ])
  }

  process.once('SIGINT', () => {
    void shutdown().finally(() => {
      process.exit(0)
    })
  })
  process.once('SIGTERM', () => {
    void shutdown().finally(() => {
      process.exit(0)
    })
  })

  await bridge.connect(transport)
  void projectionTask
}

void runCli()
