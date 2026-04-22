import process from 'node:process'

import { buildConfigJsonVariables, loadConfig } from '@vibe-forge/config'
import type { AdapterCtx, AdapterManageAccountProgressEvent } from '@vibe-forge/types'
import { loadAdapter } from '@vibe-forge/types'
import { persistAdapterAccountArtifacts, removeStoredAdapterAccount } from '@vibe-forge/utils'
import { createLogger } from '@vibe-forge/utils/create-logger'
import type { Command } from 'commander'

import { resolveCliWorkspaceCwd } from '#~/workspace.js'
import { normalizeCliAdapterOptionValue } from './@core/adapter-option'

const createTransientCache = (): AdapterCtx['cache'] => {
  const store = new Map<string, unknown>()

  return {
    set: async (key, value) => {
      store.set(String(key), value)
      return { cachePath: '' }
    },
    get: async (key) => store.get(String(key)) as any
  }
}

const loadCliAdapterContext = async (adapterKey: string, cwd: string) => {
  const [projectConfig, userConfig] = await loadConfig({
    cwd,
    jsonVariables: buildConfigJsonVariables(cwd, process.env)
  })
  const adapter = await loadAdapter(adapterKey)
  const adapterCtx = {
    ctxId: `cli-adapter-accounts-${adapterKey}`,
    cwd,
    env: {
      ...process.env
    },
    cache: createTransientCache(),
    logger: createLogger(cwd, `cli/adapter-accounts/${adapterKey}`, 'cli'),
    configs: [projectConfig, userConfig]
  } satisfies AdapterCtx

  return {
    adapter,
    adapterCtx
  }
}

const printAccountSummary = (prefix: string, summary: {
  key: string
  title: string
  description?: string
  quota?: { summary?: string }
  status?: string
}) => {
  console.log(`${prefix}: ${summary.title} (${summary.key})`)
  if (summary.status != null && summary.status !== '') {
    console.log(`Status: ${summary.status}`)
  }
  if (summary.description != null && summary.description !== '') {
    console.log(`Description: ${summary.description}`)
  }
  if (summary.quota?.summary != null && summary.quota.summary !== '') {
    console.log(`Quota: ${summary.quota.summary}`)
  }
}

const printAccountActionProgress = (event: AdapterManageAccountProgressEvent) => {
  if (event.stream === 'stdout') {
    process.stdout.write(event.message)
    return
  }
  if (event.stream === 'stderr') {
    process.stderr.write(event.message)
    return
  }
  console.log(event.message)
}

export function registerAccountsCommand(program: Command) {
  const accountsCommand = program
    .command('accounts')
    .description('Manage adapter accounts stored in the workspace')

  accountsCommand
    .command('add <adapter> [account]')
    .description('Run the adapter login flow and save the resulting credentials into workspace-private account storage')
    .action(async (adapterInput: string, account: string | undefined) => {
      try {
        const adapterKey = normalizeCliAdapterOptionValue(adapterInput)
        const cwd = resolveCliWorkspaceCwd()
        const { adapter, adapterCtx } = await loadCliAdapterContext(adapterKey, cwd)
        if (adapter.manageAccount == null) {
          throw new Error(`Adapter "${adapterKey}" does not support account management.`)
        }

        const result = await adapter.manageAccount(adapterCtx, {
          action: 'add',
          account,
          onProgress: printAccountActionProgress
        })

        if ((result.artifacts?.length ?? 0) > 0) {
          if (result.accountKey == null || result.accountKey.trim() === '') {
            throw new Error('Adapter returned account artifacts without an account key.')
          }
          await persistAdapterAccountArtifacts({
            cwd,
            env: adapterCtx.env,
            adapter: adapterKey,
            account: result.accountKey,
            artifacts: result.artifacts!
          })
        }

        const detail = result.accountKey != null && adapter.getAccountDetail != null
          ? await adapter.getAccountDetail(adapterCtx, {
            account: result.accountKey,
            refresh: true
          }).catch(() => undefined)
          : undefined

        if (result.message != null && result.message.trim() !== '') {
          console.log(result.message)
        }
        if (detail?.account != null) {
          printAccountSummary('Connected account', detail.account)
          return
        }
        if (result.account != null) {
          printAccountSummary('Connected account', result.account)
          return
        }
        if (result.accountKey != null) {
          console.log(`Connected account key: ${result.accountKey}`)
        }
      } catch (error) {
        console.error(error instanceof Error ? error.message : String(error))
        process.exit(1)
      }
    })

  accountsCommand
    .command('show <adapter> <account>')
    .description('Show the latest account detail and quota snapshot for one adapter account')
    .action(async (adapterInput: string, account: string) => {
      try {
        const adapterKey = normalizeCliAdapterOptionValue(adapterInput)
        const cwd = resolveCliWorkspaceCwd()
        const { adapter, adapterCtx } = await loadCliAdapterContext(adapterKey, cwd)
        if (adapter.getAccountDetail == null) {
          throw new Error(`Adapter "${adapterKey}" does not support account detail.`)
        }

        const detail = await adapter.getAccountDetail(adapterCtx, {
          account,
          refresh: true
        })
        printAccountSummary('Account', detail.account)
      } catch (error) {
        console.error(error instanceof Error ? error.message : String(error))
        process.exit(1)
      }
    })

  accountsCommand
    .command('remove <adapter> <account>')
    .description('Remove the workspace-stored credential snapshot for one adapter account')
    .action(async (adapterInput: string, account: string) => {
      try {
        const adapterKey = normalizeCliAdapterOptionValue(adapterInput)
        const cwd = resolveCliWorkspaceCwd()
        const { adapter, adapterCtx } = await loadCliAdapterContext(adapterKey, cwd)
        if (adapter.manageAccount == null) {
          throw new Error(`Adapter "${adapterKey}" does not support account management.`)
        }

        const result = await adapter.manageAccount(adapterCtx, {
          action: 'remove',
          account
        })

        if (result.removeStoredAccount === true) {
          if (result.accountKey == null || result.accountKey.trim() === '') {
            throw new Error('Adapter remove action requires an account key.')
          }
          await removeStoredAdapterAccount({
            cwd,
            env: adapterCtx.env,
            adapter: adapterKey,
            account: result.accountKey
          })
        }

        console.log(result.message ?? `Removed adapter account "${account}".`)
      } catch (error) {
        console.error(error instanceof Error ? error.message : String(error))
        process.exit(1)
      }
    })
}
