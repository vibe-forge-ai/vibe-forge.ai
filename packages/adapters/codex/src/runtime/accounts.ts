import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { access, mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import process from 'node:process'

import { resolveMockHome } from '@vibe-forge/hooks'
import type {
  AdapterAccountInfo,
  AdapterAccountsQueryOptions,
  AdapterAccountsResult,
  AdapterCtx
} from '@vibe-forge/types'
import {
  getAdapterConfiguredDefaultAccount,
  mergeAdapterConfigs,
  normalizeNonEmptyString,
  resolveProjectAiPath,
  syncSymlinkTarget
} from '@vibe-forge/utils'
import { createLogger } from '@vibe-forge/utils/create-logger'

import { resolveCodexBinaryPath } from '#~/paths.js'
import { CodexRpcClient } from '#~/protocol/rpc.js'

interface CodexConfiguredAccount {
  title?: string
  description?: string
  authFile?: string
}

interface CodexStoredAccountMetadata {
  title?: string
  description?: string
  email?: string
  planType?: string
  accountType?: string
  source?: string
  createdAt?: number
  updatedAt?: number
  authDigest?: string
}

interface CodexAccountDescriptor {
  key: string
  title?: string
  description?: string
  authFilePath?: string
  status: NonNullable<AdapterAccountInfo['status']>
  metadata?: CodexStoredAccountMetadata
}

interface CodexAccountProbe {
  accountType?: string
  email?: string
  planType?: string
  quota?: AdapterAccountInfo['quota']
}

const isRecord = (value: unknown): value is Record<string, unknown> => (
  value != null && typeof value === 'object' && !Array.isArray(value)
)

const pathExists = async (targetPath: string) => {
  try {
    await access(targetPath)
    return true
  } catch {
    return false
  }
}

const buildSpawnEnv = (env: AdapterCtx['env']): NodeJS.ProcessEnv => ({
  ...process.env,
  ...Object.fromEntries(
    Object.entries(env).filter((entry): entry is [string, string] => entry[1] != null)
  )
})

const resolveCodexLocalAccountsRoot = (ctx: Pick<AdapterCtx, 'cwd' | 'env'>) => (
  resolveProjectAiPath(ctx.cwd, ctx.env, '.local', 'adapters', 'codex', 'accounts')
)

const resolveStoredAccountDir = (ctx: Pick<AdapterCtx, 'cwd' | 'env'>, key: string) => (
  resolve(resolveCodexLocalAccountsRoot(ctx), key)
)

const resolveStoredAccountAuthPath = (ctx: Pick<AdapterCtx, 'cwd' | 'env'>, key: string) => (
  join(resolveStoredAccountDir(ctx, key), 'auth.json')
)

const resolveStoredAccountMetaPath = (ctx: Pick<AdapterCtx, 'cwd' | 'env'>, key: string) => (
  join(resolveStoredAccountDir(ctx, key), 'meta.json')
)

const resolveCodexSessionHomeDir = (ctx: Pick<AdapterCtx, 'cwd' | 'env' | 'ctxId'>, sessionId: string) => (
  resolveProjectAiPath(ctx.cwd, ctx.env, 'caches', ctx.ctxId, sessionId, 'adapter-codex-home')
)

const resolveCodexProbeHomeDir = (
  ctx: Pick<AdapterCtx, 'cwd' | 'env' | 'ctxId'>,
  suffix: string
) => resolveProjectAiPath(ctx.cwd, ctx.env, 'caches', ctx.ctxId, 'adapter-codex-accounts', suffix)

const MISSING_AUTH_SENTINEL_FILE = '.vf-missing-auth.json'

const slugifyAccountKey = (value: string) => (
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
)

const formatPlanType = (value: string | undefined) => {
  switch (value) {
    case 'free':
      return 'Free'
    case 'go':
      return 'Go'
    case 'plus':
      return 'Plus'
    case 'pro':
      return 'Pro'
    case 'team':
      return 'Team'
    case 'business':
      return 'Business'
    case 'enterprise':
      return 'Enterprise'
    case 'edu':
      return 'Edu'
    case 'unknown':
      return 'Unknown'
    default:
      return undefined
  }
}

const formatCreditsValue = (value: number) => `${value.toLocaleString('en-US')} credits`

const readJsonFileIfPresent = async <T>(filePath: string): Promise<T | undefined> => {
  try {
    return JSON.parse(await readFile(filePath, 'utf8')) as T
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return undefined
    }
    throw error
  }
}

const writeJsonFile = async (filePath: string, value: unknown) => {
  await mkdir(dirname(filePath), { recursive: true })
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

const resolveConfiguredAuthFilePath = (ctx: Pick<AdapterCtx, 'cwd'>, authFile: string | undefined) => {
  const normalized = normalizeNonEmptyString(authFile)
  if (normalized == null) {
    return undefined
  }

  return isAbsolute(normalized)
    ? resolve(normalized)
    : resolve(ctx.cwd, normalized)
}

const resolveRealHomeAuthPath = (ctx: Pick<AdapterCtx, 'env'>) => {
  const realHome = ctx.env.__VF_PROJECT_REAL_HOME__?.trim() || process.env.__VF_PROJECT_REAL_HOME__?.trim()
  return realHome != null && realHome !== ''
    ? resolve(realHome, '.codex', 'auth.json')
    : undefined
}

const resolveCodexAdapterConfig = (ctx: Pick<AdapterCtx, 'configs'>) => {
  const mergedAdapters = mergeAdapterConfigs(
    ctx.configs[0]?.adapters as Record<string, unknown> | undefined,
    ctx.configs[1]?.adapters as Record<string, unknown> | undefined
  ) as Record<string, unknown> | undefined

  const rawConfig = isRecord(mergedAdapters?.codex) ? mergedAdapters?.codex : {}
  const accounts = isRecord(rawConfig.accounts)
    ? Object.fromEntries(
      Object.entries(rawConfig.accounts)
        .filter((entry): entry is [string, CodexConfiguredAccount] => isRecord(entry[1]))
    )
    : {}

  return {
    defaultAccount: getAdapterConfiguredDefaultAccount(rawConfig),
    accounts
  }
}

const resolveProbeLogger = (ctx: Pick<AdapterCtx, 'cwd' | 'ctxId'>, key: string) => (
  createLogger(ctx.cwd, `${ctx.ctxId}/adapter-codex-accounts`, key)
)

const probeCodexAccount = async (params: {
  ctx: Pick<AdapterCtx, 'cwd' | 'env' | 'ctxId'>
  homeDir: string
  authFilePath: string
  refresh?: boolean
  logKey: string
}): Promise<CodexAccountProbe> => {
  const { ctx, homeDir, authFilePath, refresh, logKey } = params
  const logger = resolveProbeLogger(ctx, logKey)
  const binaryPath = resolveCodexBinaryPath(ctx.env)
  const spawnEnv = buildSpawnEnv(ctx.env)
  spawnEnv.HOME = homeDir

  await mkdir(join(homeDir, '.codex'), { recursive: true })
  await syncSymlinkTarget({
    sourcePath: authFilePath,
    targetPath: join(homeDir, '.codex', 'auth.json'),
    type: 'file',
    onMissingSource: 'remove'
  })

  const proc = spawn(String(binaryPath), ['app-server'], {
    cwd: ctx.cwd,
    env: spawnEnv,
    stdio: ['pipe', 'pipe', 'pipe']
  })
  const rpc = new CodexRpcClient(proc, logger)
  let didExit = false

  proc.stderr?.on('data', (chunk) => {
    logger.debug('[codex account] stderr', { chunk: String(chunk) })
  })
  proc.once('error', (error) => {
    rpc.destroy(error instanceof Error ? error.message : String(error))
  })
  proc.once('exit', () => {
    didExit = true
    rpc.destroy('codex account probe exited')
  })
  rpc.onRequest((id) => {
    rpc.respond(id, {})
  })

  try {
    await rpc.request('initialize', {
      clientInfo: {
        name: 'vibe-forge',
        title: 'Vibe Forge',
        version: 'dev'
      },
      capabilities: {
        experimentalApi: false,
        optOutNotificationMethods: []
      }
    })
    rpc.notify('initialized', {})

    const accountResult = await rpc.request('account/read', {
      ...(refresh === true ? { refreshToken: true } : {})
    })
    const rateLimitsResult = await rpc.request('account/rateLimits/read')

    const account = isRecord(accountResult) && isRecord(accountResult.account)
      ? accountResult.account
      : undefined
    const accountType = typeof account?.type === 'string' ? account.type : undefined
    const email = typeof account?.email === 'string' ? account.email : undefined
    const planType = typeof account?.planType === 'string' ? account.planType : undefined

    const rateLimits = isRecord(rateLimitsResult) && Array.isArray(rateLimitsResult.rateLimits)
      ? rateLimitsResult.rateLimits.filter(isRecord)
      : []
    const primaryRateLimit = rateLimits.find(item => item.primary === true) ??
      rateLimits.find(item => item.secondary !== true) ??
      rateLimits[0]

    const metrics: NonNullable<AdapterAccountInfo['quota']>['metrics'] = []
    const formattedPlan = formatPlanType(
      typeof primaryRateLimit?.planType === 'string' ? primaryRateLimit.planType : planType
    )
    if (formattedPlan != null) {
      metrics.push({
        id: 'plan',
        label: 'Plan',
        value: formattedPlan,
        primary: true
      })
    }

    const credits = isRecord(primaryRateLimit?.credits) ? primaryRateLimit.credits : undefined
    let creditsSummary: string | undefined
    if (credits?.unlimited === true) {
      creditsSummary = 'Unlimited credits'
      metrics.push({
        id: 'credits',
        label: 'Credits',
        value: 'Unlimited'
      })
    } else if (typeof credits?.balance === 'number' && Number.isFinite(credits.balance)) {
      creditsSummary = formatCreditsValue(credits.balance)
      metrics.push({
        id: 'credits',
        label: 'Credits',
        value: creditsSummary
      })
    }

    const limitName = typeof primaryRateLimit?.limitName === 'string'
      ? primaryRateLimit.limitName
      : undefined
    if (limitName != null && limitName.trim() !== '') {
      metrics.push({
        id: 'limit',
        label: 'Limit',
        value: limitName.trim()
      })
    }

    const summary = [formattedPlan, creditsSummary].filter((value): value is string => value != null && value !== '')
      .join(' · ')

    return {
      accountType,
      email,
      planType,
      quota: summary === '' && metrics.length === 0
        ? undefined
        : {
          summary: summary === '' ? undefined : summary,
          metrics,
          updatedAt: Date.now()
        }
    }
  } finally {
    rpc.destroy('codex account probe finished')
    if (!didExit) {
      proc.kill()
    }
  }
}

const buildImportedAccountKey = (params: {
  authDigest: string
  probe?: CodexAccountProbe
}) => {
  const normalizedEmail = normalizeNonEmptyString(params.probe?.email)
  if (normalizedEmail != null) {
    return `chatgpt-${slugifyAccountKey(normalizedEmail)}`
  }

  if (params.probe?.accountType === 'apiKey') {
    return `api-key-${params.authDigest.slice(0, 8)}`
  }

  return `account-${params.authDigest.slice(0, 8)}`
}

const buildImportedAccountTitle = (params: {
  key: string
  probe?: CodexAccountProbe
}) => {
  const normalizedEmail = normalizeNonEmptyString(params.probe?.email)
  if (normalizedEmail != null) {
    return normalizedEmail
  }

  if (params.probe?.accountType === 'apiKey') {
    return `API Key ${params.key.slice(-8)}`
  }

  return params.key
}

const ensureImportedRealHomeAccount = async (
  ctx: Pick<AdapterCtx, 'cwd' | 'env' | 'ctxId'>,
  options: { refresh?: boolean } = {}
) => {
  const realAuthPath = resolveRealHomeAuthPath(ctx)
  if (realAuthPath == null || !await pathExists(realAuthPath)) {
    return undefined
  }

  const authContent = await readFile(realAuthPath, 'utf8')
  const authDigest = createHash('sha256').update(authContent).digest('hex')
  const probeHomeDir = resolveCodexProbeHomeDir(ctx, 'import-current')
  const probe = await probeCodexAccount({
    ctx,
    homeDir: probeHomeDir,
    authFilePath: realAuthPath,
    refresh: options.refresh,
    logKey: 'import-current'
  }).catch(() => undefined)
  const key = buildImportedAccountKey({
    authDigest,
    probe
  })
  const authPath = resolveStoredAccountAuthPath(ctx, key)
  const metaPath = resolveStoredAccountMetaPath(ctx, key)
  const existingMeta = await readJsonFileIfPresent<CodexStoredAccountMetadata>(metaPath)

  await mkdir(dirname(authPath), { recursive: true })
  await writeFile(authPath, authContent, 'utf8')
  await writeJsonFile(metaPath, {
    ...existingMeta,
    title: existingMeta?.title ?? buildImportedAccountTitle({ key, probe }),
    description: existingMeta?.description ?? 'Imported from ~/.codex/auth.json',
    email: probe?.email ?? existingMeta?.email,
    planType: probe?.planType ?? existingMeta?.planType,
    accountType: probe?.accountType ?? existingMeta?.accountType,
    source: 'imported-real-home',
    authDigest,
    createdAt: existingMeta?.createdAt ?? Date.now(),
    updatedAt: Date.now()
  } satisfies CodexStoredAccountMetadata)

  return key
}

const collectStoredAccountDescriptors = async (
  ctx: Pick<AdapterCtx, 'cwd' | 'env'>
): Promise<CodexAccountDescriptor[]> => {
  const root = resolveCodexLocalAccountsRoot(ctx)
  const entries = await readdir(root, { withFileTypes: true }).catch(() => [])
  const descriptors: CodexAccountDescriptor[] = []

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) {
      continue
    }

    const authFilePath = resolveStoredAccountAuthPath(ctx, entry.name)
    if (!await pathExists(authFilePath)) {
      continue
    }

    const metadata = await readJsonFileIfPresent<CodexStoredAccountMetadata>(resolveStoredAccountMetaPath(ctx, entry.name))
    descriptors.push({
      key: entry.name,
      title: normalizeNonEmptyString(metadata?.title),
      description: normalizeNonEmptyString(metadata?.description),
      authFilePath,
      status: 'ready',
      metadata
    })
  }

  return descriptors
}

const collectCodexAccountDescriptors = async (
  ctx: Pick<AdapterCtx, 'cwd' | 'env' | 'ctxId' | 'configs'>,
  options: { refresh?: boolean } = {}
) => {
  const { defaultAccount, accounts: configuredAccounts } = resolveCodexAdapterConfig(ctx)
  const importedAccountKey = await ensureImportedRealHomeAccount(ctx, options).catch(() => undefined)
  const discoveredAccounts = await collectStoredAccountDescriptors(ctx)
  const descriptorMap = new Map<string, CodexAccountDescriptor>(
    discoveredAccounts.map(account => [account.key, account])
  )

  for (const [key, configuredAccount] of Object.entries(configuredAccounts)) {
    const existing = descriptorMap.get(key)
    const configuredAuthFilePath = resolveConfiguredAuthFilePath(ctx, configuredAccount.authFile)
    const hasConfiguredAuthFile = configuredAuthFilePath != null && await pathExists(configuredAuthFilePath)
    descriptorMap.set(key, {
      key,
      title: normalizeNonEmptyString(configuredAccount.title) ?? existing?.title,
      description: normalizeNonEmptyString(configuredAccount.description) ?? existing?.description,
      authFilePath: hasConfiguredAuthFile
        ? configuredAuthFilePath
        : existing?.authFilePath,
      status: hasConfiguredAuthFile || existing?.authFilePath != null
        ? 'ready'
        : 'missing',
      metadata: existing?.metadata
    })
  }

  const descriptors = Array.from(descriptorMap.values())
  const resolvedDefaultAccount = defaultAccount ??
    importedAccountKey ??
    descriptors.find(account => account.status === 'ready')?.key

  return {
    defaultAccount: resolvedDefaultAccount,
    accounts: descriptors
      .map(account => ({
        ...account,
        title: account.title ??
          normalizeNonEmptyString(account.metadata?.email) ??
          account.key
      }))
      .sort((left, right) => {
        if (left.key === resolvedDefaultAccount) return -1
        if (right.key === resolvedDefaultAccount) return 1
        if (left.status !== right.status) {
          return left.status === 'ready' ? -1 : 1
        }
        return left.title.localeCompare(right.title)
      })
  }
}

const syncSharedCodexSessionHomeFiles = async (
  ctx: Pick<AdapterCtx, 'cwd' | 'env'>,
  homeDir: string
) => {
  const mockHome = resolveMockHome(ctx.cwd, ctx.env)
  const sharedMappings: Array<{ sourcePath: string; targetPath: string; type: 'dir' | 'file' }> = [
    {
      sourcePath: join(mockHome, '.agents', 'skills'),
      targetPath: join(homeDir, '.agents', 'skills'),
      type: 'dir'
    },
    {
      sourcePath: join(mockHome, '.codex', 'skills'),
      targetPath: join(homeDir, '.codex', 'skills'),
      type: 'dir'
    },
    {
      sourcePath: join(mockHome, '.codex', 'config.toml'),
      targetPath: join(homeDir, '.codex', 'config.toml'),
      type: 'file'
    },
    {
      sourcePath: join(mockHome, '.codex', 'hooks.json'),
      targetPath: join(homeDir, '.codex', 'hooks.json'),
      type: 'file'
    }
  ]

  await Promise.all(sharedMappings.map(mapping => syncSymlinkTarget({
    ...mapping,
    onMissingSource: 'remove'
  })))
}

export const prepareCodexSessionHome = async (params: {
  ctx: Pick<AdapterCtx, 'cwd' | 'env' | 'ctxId' | 'configs'>
  sessionId: string
  account?: string
}) => {
  const { ctx, sessionId } = params
  const requestedAccount = normalizeNonEmptyString(params.account)
  const catalog = await collectCodexAccountDescriptors(ctx)
  const selectedAccountKey = requestedAccount ??
    catalog.defaultAccount ??
    catalog.accounts.find(account => account.status === 'ready')?.key
  const selectedAccount = selectedAccountKey == null
    ? undefined
    : catalog.accounts.find(account => account.key === selectedAccountKey)

  if (requestedAccount != null && (selectedAccount == null || selectedAccount.authFilePath == null)) {
    throw new Error(`Codex account "${requestedAccount}" is not available.`)
  }

  const homeDir = resolveCodexSessionHomeDir(ctx, sessionId)
  await mkdir(join(homeDir, '.codex'), { recursive: true })
  await syncSharedCodexSessionHomeFiles(ctx, homeDir)
  await syncSymlinkTarget({
    sourcePath: selectedAccount?.authFilePath ?? join(homeDir, MISSING_AUTH_SENTINEL_FILE),
    targetPath: join(homeDir, '.codex', 'auth.json'),
    type: 'file',
    onMissingSource: 'remove'
  })

  return {
    homeDir,
    accountKey: selectedAccount?.key ?? selectedAccountKey,
    authFilePath: selectedAccount?.authFilePath
  }
}

export const getCodexAccounts = async (
  ctx: AdapterCtx,
  options: AdapterAccountsQueryOptions
): Promise<AdapterAccountsResult> => {
  const catalog = await collectCodexAccountDescriptors(ctx, {
    refresh: options.refresh
  })
  const accounts: AdapterAccountInfo[] = []

  for (const descriptor of catalog.accounts) {
    const account: AdapterAccountInfo = {
      key: descriptor.key,
      title: descriptor.title ?? descriptor.key,
      description: descriptor.description,
      status: descriptor.status,
      isDefault: descriptor.key === catalog.defaultAccount
    }

    if (descriptor.authFilePath == null) {
      accounts.push(account)
      continue
    }

    try {
      const probe = await probeCodexAccount({
        ctx,
        homeDir: resolveCodexProbeHomeDir(ctx, `list-${descriptor.key}`),
        authFilePath: descriptor.authFilePath,
        refresh: options.refresh,
        logKey: `list-${descriptor.key}`
      })
      const title = descriptor.title ??
        normalizeNonEmptyString(probe.email) ??
        account.title
      accounts.push({
        ...account,
        title,
        description: descriptor.description ??
          normalizeNonEmptyString(descriptor.metadata?.description) ??
          (probe.accountType === 'apiKey' ? 'API Key account' : undefined),
        quota: probe.quota
      })
    } catch (error) {
      accounts.push({
        ...account,
        status: 'error',
        description: error instanceof Error ? error.message : String(error)
      })
    }
  }

  return {
    defaultAccount: catalog.defaultAccount,
    accounts
  }
}
