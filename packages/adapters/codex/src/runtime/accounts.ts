/* eslint-disable max-lines -- codex account runtime intentionally centralizes the account management flow. */
import { Buffer } from 'node:buffer'
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { access, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import process from 'node:process'

import { resolveMockHome } from '@vibe-forge/hooks'
import { linkRealHomeGitConfig } from '@vibe-forge/register/mock-home-git'
import type {
  AdapterAccountActionDescriptor,
  AdapterAccountCredentialArtifact,
  AdapterAccountDetail,
  AdapterAccountDetailQueryOptions,
  AdapterAccountDetailResult,
  AdapterAccountInfo,
  AdapterAccountsQueryOptions,
  AdapterAccountsResult,
  AdapterCtx,
  AdapterManageAccountOptions,
  AdapterManageAccountResult
} from '@vibe-forge/types'
import {
  getAdapterConfiguredDefaultAccount,
  mergeAdapterConfigs,
  normalizeNonEmptyString,
  resolveAdapterAccountReadDirs,
  resolveAdapterAccountReadRoots,
  resolveAdapterAccountsRoot,
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

interface CodexAccountIdentity {
  email?: string
  planType?: string
  accountType?: string
  accountId?: string
  organizationId?: string
  organizationTitle?: string
  organizationRole?: string
}

interface CodexStoredAccountMetadata extends CodexAccountIdentity {
  title?: string
  description?: string
  quota?: AdapterAccountInfo['quota']
  source?: string
  createdAt?: number
  updatedAt?: number
  authDigest?: string
}

interface CodexAccountDescriptor {
  key: string
  title?: string
  description?: string
  accountDir?: string
  authFilePath?: string
  metaFilePath?: string
  status: NonNullable<AdapterAccountInfo['status']>
  metadata?: CodexStoredAccountMetadata
  identity?: CodexAccountIdentity
}

interface CodexAccountProbe extends CodexAccountIdentity {
  quota?: AdapterAccountInfo['quota']
}

interface CodexStoredAuthTokens {
  account_id?: unknown
  id_token?: unknown
}

interface CodexStoredAuthFile {
  auth_mode?: unknown
  tokens?: unknown
}

interface CodexJwtOrganizationClaim {
  id?: unknown
  title?: unknown
  role?: unknown
  is_default?: unknown
}

const CODEX_ACCOUNT_LIST_ACTIONS: AdapterAccountActionDescriptor[] = [
  {
    key: 'add',
    label: 'Add account',
    description: 'Run `codex login` in an isolated home and save the resulting auth.json into the workspace.',
    scope: 'adapter'
  }
]

const CODEX_ACCOUNT_DETAIL_ACTIONS: AdapterAccountActionDescriptor[] = [
  {
    key: 'refresh',
    label: 'Refresh quota',
    description: 'Refresh the latest Codex plan and quota snapshot for this account.',
    scope: 'account'
  },
  {
    key: 'remove',
    label: 'Remove account',
    description: 'Remove the workspace-stored auth snapshot for this account.',
    scope: 'account'
  }
]

const CODEX_QUOTA_CACHE_TTL_MS = 5 * 60 * 1000

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

const createAbortError = () => {
  const error = new Error('Codex login canceled.')
  error.name = 'AbortError'
  return error
}

const throwIfAborted = (signal: AbortSignal | undefined) => {
  if (signal?.aborted === true) {
    throw createAbortError()
  }
}

const buildSpawnEnv = (env: AdapterCtx['env']): NodeJS.ProcessEnv => ({
  ...process.env,
  ...Object.fromEntries(
    Object.entries(env).filter((entry): entry is [string, string] => entry[1] != null)
  )
})

const resolveCodexSharedAccountsRoot = (ctx: Pick<AdapterCtx, 'cwd' | 'env'>) => (
  resolveAdapterAccountsRoot(ctx.cwd, ctx.env, 'codex')
)

const resolveCodexReadableAccountsRoots = (ctx: Pick<AdapterCtx, 'cwd' | 'env'>) => (
  resolveAdapterAccountReadRoots(ctx.cwd, ctx.env, 'codex')
)

const resolveStoredAccountDir = (ctx: Pick<AdapterCtx, 'cwd' | 'env'>, key: string) => (
  resolve(resolveCodexSharedAccountsRoot(ctx), key)
)

const resolveStoredAccountReadDirs = (ctx: Pick<AdapterCtx, 'cwd' | 'env'>, key: string) => (
  resolveAdapterAccountReadDirs(ctx.cwd, ctx.env, 'codex', key)
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

const compactIdentityFragment = (value: string | undefined) => {
  const normalized = normalizeNonEmptyString(value)
  if (normalized == null) {
    return undefined
  }

  const compact = normalized
    .replace(/^[a-z]+-/i, '')
    .replace(/[^a-z0-9]+/gi, '')
    .toLowerCase()

  return compact === ''
    ? undefined
    : compact.slice(-8)
}

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

const CODEX_GENERATED_CONTEXT_LABELS = new Set([
  'personal',
  'free',
  'go',
  'plus',
  'pro',
  'team',
  'business',
  'enterprise',
  'edu',
  'unknown'
])

const isGenericCodexOrganizationTitle = (value: string | undefined) => {
  const normalized = normalizeNonEmptyString(value)
  if (normalized == null) {
    return false
  }

  return normalized.toLowerCase() === 'personal'
}

const shouldPreferPlanLabelForTitle = (planType: string | undefined) => {
  switch (planType) {
    case 'team':
    case 'business':
    case 'enterprise':
    case 'edu':
      return true
    default:
      return false
  }
}

const resolveCodexAccountContextTitle = (probe: CodexAccountProbe | undefined) => {
  const organizationTitle = normalizeNonEmptyString(probe?.organizationTitle)
  const normalizedPlanType = normalizeNonEmptyString(probe?.planType)
  const planLabel = formatPlanType(normalizedPlanType)

  if (
    organizationTitle != null &&
    !(
      isGenericCodexOrganizationTitle(organizationTitle) &&
      shouldPreferPlanLabelForTitle(normalizedPlanType)
    )
  ) {
    return organizationTitle
  }

  return planLabel ?? organizationTitle
}

const buildLegacyImportedAccountTitle = (params: {
  key: string
  probe?: CodexAccountProbe
}) => {
  const normalizedEmail = normalizeNonEmptyString(params.probe?.email)
  const normalizedOrganizationTitle = normalizeNonEmptyString(params.probe?.organizationTitle)
  if (normalizedEmail != null) {
    return normalizedOrganizationTitle != null
      ? `${normalizedEmail} · ${normalizedOrganizationTitle}`
      : normalizedEmail
  }

  if (params.probe?.accountType === 'apiKey') {
    return `API Key ${params.key.slice(-8)}`
  }

  return params.key
}

const formatCreditsValue = (value: number) => `${value.toLocaleString('en-US')} credits`

const parseFiniteNumber = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string') {
    const normalized = value.trim()
    if (normalized !== '') {
      const parsed = Number(normalized)
      if (Number.isFinite(parsed)) {
        return parsed
      }
    }
  }

  return undefined
}

const formatRateLimitWindow = (minutes: number | undefined) => {
  if (minutes == null || !Number.isFinite(minutes) || minutes <= 0) {
    return undefined
  }

  if (minutes % (60 * 24) === 0) {
    return `${minutes / (60 * 24)}d`
  }

  if (minutes % 60 === 0) {
    return `${minutes / 60}h`
  }

  return `${minutes}m`
}

const formatRateLimitResetAt = (epochSeconds: number | undefined) => {
  if (epochSeconds == null || !Number.isFinite(epochSeconds) || epochSeconds <= 0) {
    return undefined
  }

  const date = new Date(epochSeconds * 1000)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day} ${hours}:${minutes}`
}

const cloneQuotaInfo = (quota: AdapterAccountInfo['quota']) => (
  quota == null
    ? undefined
    : {
      ...quota,
      metrics: quota.metrics?.map(metric => ({ ...metric }))
    }
)

const normalizeCodexIdentity = (
  identity: CodexAccountIdentity | undefined
): CodexAccountIdentity | undefined => {
  if (identity == null) {
    return undefined
  }

  const normalized: CodexAccountIdentity = {
    email: normalizeNonEmptyString(identity.email),
    planType: normalizeNonEmptyString(identity.planType),
    accountType: normalizeNonEmptyString(identity.accountType),
    accountId: normalizeNonEmptyString(identity.accountId),
    organizationId: normalizeNonEmptyString(identity.organizationId),
    organizationTitle: normalizeNonEmptyString(identity.organizationTitle),
    organizationRole: normalizeNonEmptyString(identity.organizationRole)
  }

  return Object.values(normalized).some(value => value != null) ? normalized : undefined
}

const mergeCodexAccountProbes = (
  ...sources: Array<CodexAccountProbe | CodexAccountIdentity | undefined>
): CodexAccountProbe | undefined => {
  const merged: CodexAccountProbe = {}

  for (const source of sources) {
    if (source == null) {
      continue
    }

    const normalizedIdentity = normalizeCodexIdentity(source)
    if (normalizedIdentity != null) {
      Object.assign(merged, normalizedIdentity)
    }

    if ('quota' in source && source.quota != null) {
      merged.quota = cloneQuotaInfo(source.quota)
    }
  }

  return Object.keys(merged).length > 0 ? merged : undefined
}

const decodeJwtPayload = (token: string | undefined) => {
  const normalized = normalizeNonEmptyString(token)
  if (normalized == null) {
    return undefined
  }

  const payload = normalized.split('.')[1]
  if (payload == null || payload === '') {
    return undefined
  }

  try {
    const decoded = Buffer.from(payload, 'base64url').toString('utf8')
    const parsed = JSON.parse(decoded)
    return isRecord(parsed) ? parsed : undefined
  } catch {
    return undefined
  }
}

const parseStoredAuthTokens = (value: unknown): CodexStoredAuthTokens | undefined => (
  isRecord(value) ? value as CodexStoredAuthTokens : undefined
)

const pickPrimaryOrganization = (value: unknown) => {
  if (!Array.isArray(value)) {
    return undefined
  }

  const organizations = value
    .filter(isRecord)
    .map(entry => entry as CodexJwtOrganizationClaim)

  return organizations.find(entry => entry.is_default === true) ?? organizations[0]
}

const readCodexAuthIdentityFromContent = (authContent: string): CodexAccountProbe | undefined => {
  try {
    const parsed = JSON.parse(authContent) as CodexStoredAuthFile
    const tokens = parseStoredAuthTokens(parsed.tokens)
    const idTokenPayload = decodeJwtPayload(
      typeof tokens?.id_token === 'string' ? tokens.id_token : undefined
    )
    const authClaims = isRecord(idTokenPayload?.['https://api.openai.com/auth'])
      ? idTokenPayload['https://api.openai.com/auth']
      : undefined
    const organization = pickPrimaryOrganization(authClaims?.organizations)
    const accountType = typeof parsed.auth_mode === 'string'
      ? parsed.auth_mode === 'api_key'
        ? 'apiKey'
        : parsed.auth_mode
      : undefined

    return mergeCodexAccountProbes({
      accountType,
      email: typeof idTokenPayload?.email === 'string' ? idTokenPayload.email : undefined,
      planType: typeof authClaims?.chatgpt_plan_type === 'string'
        ? authClaims.chatgpt_plan_type
        : undefined,
      accountId: typeof authClaims?.chatgpt_account_id === 'string'
        ? authClaims.chatgpt_account_id
        : typeof tokens?.account_id === 'string'
        ? tokens.account_id
        : undefined,
      organizationId: typeof organization?.id === 'string' ? organization.id : undefined,
      organizationTitle: typeof organization?.title === 'string' ? organization.title : undefined,
      organizationRole: typeof organization?.role === 'string' ? organization.role : undefined
    })
  } catch {
    return undefined
  }
}

const readCodexAuthIdentityFromFile = async (authFilePath: string | undefined) => {
  if (authFilePath == null) {
    return undefined
  }

  try {
    return readCodexAuthIdentityFromContent(await readFile(authFilePath, 'utf8'))
  } catch {
    return undefined
  }
}

const isSameCodexAccountIdentity = (
  left: CodexAccountIdentity | undefined,
  right: CodexAccountIdentity | undefined
) => {
  const normalizedLeft = normalizeCodexIdentity(left)
  const normalizedRight = normalizeCodexIdentity(right)
  if (normalizedLeft == null || normalizedRight == null) {
    return false
  }

  const sameAccountId = normalizedLeft.accountId != null &&
    normalizedRight.accountId != null &&
    normalizedLeft.accountId === normalizedRight.accountId
  const sameOrganizationId = normalizedLeft.organizationId != null &&
    normalizedRight.organizationId != null &&
    normalizedLeft.organizationId === normalizedRight.organizationId
  const hasBothAccountIds = normalizedLeft.accountId != null &&
    normalizedRight.accountId != null
  const hasBothOrganizationIds = normalizedLeft.organizationId != null &&
    normalizedRight.organizationId != null

  if (hasBothAccountIds && !sameAccountId) {
    return false
  }

  if (hasBothOrganizationIds && !sameOrganizationId) {
    return false
  }

  if (
    sameAccountId && (sameOrganizationId || (
      normalizedLeft.organizationId == null &&
      normalizedRight.organizationId == null
    ))
  ) {
    return true
  }

  const sameEmail = normalizedLeft.email != null &&
    normalizedRight.email != null &&
    normalizedLeft.email.toLowerCase() === normalizedRight.email.toLowerCase()
  if (!sameEmail) {
    return false
  }

  if (sameOrganizationId) {
    if (hasBothAccountIds) {
      return sameAccountId
    }

    return true
  }

  if (hasBothAccountIds || hasBothOrganizationIds) {
    return false
  }

  return normalizedLeft.organizationTitle != null &&
    normalizedRight.organizationTitle != null &&
    normalizedLeft.organizationTitle.toLowerCase() === normalizedRight.organizationTitle.toLowerCase()
}

const buildProbeFromMetadata = (metadata: CodexStoredAccountMetadata | undefined): CodexAccountProbe | undefined => {
  return mergeCodexAccountProbes(
    metadata == null ? undefined : {
      email: metadata.email,
      planType: metadata.planType,
      accountType: metadata.accountType,
      accountId: metadata.accountId,
      organizationId: metadata.organizationId,
      organizationTitle: metadata.organizationTitle,
      organizationRole: metadata.organizationRole,
      quota: metadata.quota
    }
  )
}

const getCachedProbe = (
  metadata: CodexStoredAccountMetadata | undefined,
  refresh?: boolean
): CodexAccountProbe | undefined => {
  if (refresh === true) {
    return undefined
  }

  const updatedAt = parseFiniteNumber(metadata?.quota?.updatedAt)
  if (updatedAt == null || Date.now() - updatedAt > CODEX_QUOTA_CACHE_TTL_MS) {
    return undefined
  }

  return buildProbeFromMetadata(metadata)
}

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

const collectRateLimitEntries = (value: unknown) => {
  const uniqueEntries = new Map<string, Record<string, unknown>>()

  const appendEntry = (entry: unknown, fallbackKey: string) => {
    if (!isRecord(entry)) {
      return
    }

    const entryKey = typeof entry.limitId === 'string' && entry.limitId.trim() !== ''
      ? entry.limitId
      : fallbackKey
    if (!uniqueEntries.has(entryKey)) {
      uniqueEntries.set(entryKey, entry)
    }
  }

  if (isRecord(value)) {
    if (Array.isArray(value.rateLimits)) {
      value.rateLimits.forEach((entry, index) => appendEntry(entry, `array-${index}`))
    } else {
      appendEntry(value.rateLimits, 'primary')
    }

    if (isRecord(value.rateLimitsByLimitId)) {
      Object.entries(value.rateLimitsByLimitId).forEach(([key, entry]) => appendEntry(entry, key))
    }
  }

  return Array.from(uniqueEntries.values())
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
  const authIdentity = await readCodexAuthIdentityFromFile(authFilePath)
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

    const rateLimits = collectRateLimitEntries(rateLimitsResult)
    const directRateLimit = isRecord(rateLimitsResult) && isRecord(rateLimitsResult.rateLimits)
      ? rateLimitsResult.rateLimits
      : undefined
    const primaryRateLimit = directRateLimit ??
      rateLimits.find(item => item.limitId === 'codex') ??
      rateLimits.find(item => item.primary === true) ??
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
    } else if (credits?.hasCredits === true) {
      const creditsBalance = parseFiniteNumber(credits.balance)
      if (creditsBalance != null) {
        creditsSummary = formatCreditsValue(creditsBalance)
        metrics.push({
          id: 'credits',
          label: 'Credits',
          value: creditsSummary
        })
      }
    }

    const pushUsageMetric = (params: {
      key: 'primary' | 'secondary'
      label: string
      payload: unknown
      primary?: boolean
    }) => {
      const payload = isRecord(params.payload) ? params.payload : undefined
      const usedPercent = parseFiniteNumber(payload?.usedPercent)
      if (usedPercent == null) {
        return undefined
      }

      const windowMins = parseFiniteNumber(payload?.windowDurationMins)
      const resetAt = parseFiniteNumber(payload?.resetsAt)
      const windowLabel = formatRateLimitWindow(windowMins)
      const value = `${usedPercent}%`
      const resetDescription = formatRateLimitResetAt(resetAt)

      metrics.push({
        id: `${params.key}-usage`,
        label: windowLabel == null ? params.label : `${windowLabel} ${params.label}`,
        value,
        ...(resetDescription != null ? { description: `Resets ${resetDescription}` } : {}),
        primary: params.primary
      })

      return windowLabel == null ? value : `${windowLabel} ${value}`
    }

    const primaryUsageSummary = pushUsageMetric({
      key: 'primary',
      label: 'used',
      payload: primaryRateLimit?.primary,
      primary: true
    })
    const secondaryUsageSummary = pushUsageMetric({
      key: 'secondary',
      label: 'used',
      payload: primaryRateLimit?.secondary
    })

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

    const summary = [
      formattedPlan,
      primaryUsageSummary,
      secondaryUsageSummary,
      creditsSummary
    ].filter((value): value is string => value != null && value !== '')
      .join(' · ')

    return {
      ...authIdentity,
      accountType: accountType ?? authIdentity?.accountType,
      email: email ?? authIdentity?.email,
      planType: planType ?? authIdentity?.planType,
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
  const normalizedOrganizationTitle = slugifyAccountKey(params.probe?.organizationTitle ?? '')
  const organizationFragment = compactIdentityFragment(params.probe?.organizationId)
  const accountFragment = compactIdentityFragment(params.probe?.accountId)
  if (normalizedEmail != null) {
    const segments = [`chatgpt-${slugifyAccountKey(normalizedEmail)}`]

    if (normalizedOrganizationTitle !== '') {
      segments.push(normalizedOrganizationTitle)
    }

    if (organizationFragment != null) {
      segments.push(organizationFragment)
    }

    if (accountFragment != null && (organizationFragment == null || accountFragment !== organizationFragment)) {
      segments.push(accountFragment)
    }

    return segments.join('-')
  }

  if (params.probe?.accountType === 'apiKey') {
    return `api-key-${accountFragment ?? params.authDigest.slice(0, 8)}`
  }

  return `account-${organizationFragment ?? accountFragment ?? params.authDigest.slice(0, 8)}`
}

const buildImportedAccountTitle = (params: {
  key: string
  probe?: CodexAccountProbe
}) => {
  const normalizedEmail = normalizeNonEmptyString(params.probe?.email)
  const contextTitle = resolveCodexAccountContextTitle(params.probe)
  if (normalizedEmail != null) {
    return contextTitle != null
      ? `${normalizedEmail} · ${contextTitle}`
      : normalizedEmail
  }

  if (params.probe?.accountType === 'apiKey') {
    return `API Key ${params.key.slice(-8)}`
  }

  return params.key
}

const isGeneratedCodexEmailContextTitle = (params: {
  email?: string
  title?: string
}) => {
  const normalizedEmail = normalizeNonEmptyString(params.email)
  const normalizedTitle = normalizeNonEmptyString(params.title)
  if (normalizedEmail == null || normalizedTitle == null) {
    return false
  }

  const prefix = `${normalizedEmail} · `
  if (!normalizedTitle.startsWith(prefix)) {
    return false
  }

  const suffix = normalizeNonEmptyString(normalizedTitle.slice(prefix.length))
  if (suffix == null) {
    return false
  }

  return CODEX_GENERATED_CONTEXT_LABELS.has(suffix.toLowerCase())
}

const isAutoGeneratedCodexTitle = (params: {
  key: string
  title?: string
  probe?: CodexAccountProbe
}) => {
  const normalizedTitle = normalizeNonEmptyString(params.title)
  if (normalizedTitle == null) {
    return true
  }

  const emailOnlyProbe = params.probe == null
    ? undefined
    : {
      ...params.probe,
      organizationTitle: undefined
    }

  const generatedTitles = new Set([
    params.key,
    buildImportedAccountTitle({
      key: params.key,
      probe: emailOnlyProbe
    }),
    buildImportedAccountTitle(params),
    buildLegacyImportedAccountTitle({
      key: params.key,
      probe: emailOnlyProbe
    }),
    buildLegacyImportedAccountTitle(params)
  ].filter((value): value is string => value != null && value !== ''))

  return generatedTitles.has(normalizedTitle) || isGeneratedCodexEmailContextTitle({
    email: params.probe?.email,
    title: normalizedTitle
  })
}

const resolveCodexAccountTitle = (params: {
  key: string
  title?: string
  probe?: CodexAccountProbe
}) => {
  const normalizedTitle = normalizeNonEmptyString(params.title)
  if (normalizedTitle != null && !isAutoGeneratedCodexTitle(params)) {
    return normalizedTitle
  }

  return buildImportedAccountTitle(params) ?? normalizedTitle ?? params.key
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
  const authIdentity = readCodexAuthIdentityFromContent(authContent)
  const existingStoredAccount = await findStoredAccountByIdentity(ctx, {
    authDigest,
    probe: authIdentity
  })
  const cachedProbe = getCachedProbe(existingStoredAccount?.metadata, options.refresh)
  const probeHomeDir = resolveCodexProbeHomeDir(ctx, 'import-current')
  const probe = mergeCodexAccountProbes(
    authIdentity,
    cachedProbe ?? await probeCodexAccount({
      ctx,
      homeDir: probeHomeDir,
      authFilePath: realAuthPath,
      refresh: options.refresh,
      logKey: 'import-current'
    }).catch(() => buildProbeFromMetadata(existingStoredAccount?.metadata))
  )
  const key = existingStoredAccount?.key ?? buildImportedAccountKey({
    authDigest,
    probe
  })
  const authPath = resolveStoredAccountAuthPath(ctx, key)
  const metaPath = resolveStoredAccountMetaPath(ctx, key)
  const existingMeta = await readJsonFileIfPresent<CodexStoredAccountMetadata>(metaPath)

  await mkdir(dirname(authPath), { recursive: true })
  await writeFile(authPath, authContent, 'utf8')
  await writeJsonFile(
    metaPath,
    {
      ...existingMeta,
      title: resolveCodexAccountTitle({
        key,
        title: existingMeta?.title,
        probe: mergeCodexAccountProbes(probe, buildProbeFromMetadata(existingMeta))
      }),
      description: existingMeta?.description ?? 'Imported from ~/.codex/auth.json',
      email: probe?.email ?? existingMeta?.email,
      planType: probe?.planType ?? existingMeta?.planType,
      accountType: probe?.accountType ?? existingMeta?.accountType,
      accountId: probe?.accountId ?? existingMeta?.accountId,
      organizationId: probe?.organizationId ?? existingMeta?.organizationId,
      organizationTitle: probe?.organizationTitle ?? existingMeta?.organizationTitle,
      organizationRole: probe?.organizationRole ?? existingMeta?.organizationRole,
      quota: cloneQuotaInfo(probe?.quota) ?? existingMeta?.quota,
      source: 'imported-real-home',
      authDigest,
      createdAt: existingMeta?.createdAt ?? Date.now(),
      updatedAt: Date.now()
    } satisfies CodexStoredAccountMetadata
  )

  return key
}

const collectStoredAccountDescriptors = async (
  ctx: Pick<AdapterCtx, 'cwd' | 'env'>
): Promise<CodexAccountDescriptor[]> => {
  const descriptorMap = new Map<string, CodexAccountDescriptor>()

  for (const root of resolveCodexReadableAccountsRoots(ctx)) {
    const entries = await readdir(root, { withFileTypes: true }).catch(() => [])

    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith('.')) {
        continue
      }

      const accountDir = resolve(root, entry.name)
      const authFilePath = join(accountDir, 'auth.json')
      const metaFilePath = join(accountDir, 'meta.json')
      const metadata = await readJsonFileIfPresent<CodexStoredAccountMetadata>(metaFilePath)
      const hasStoredAuthFile = await pathExists(authFilePath)
      const authIdentity = hasStoredAuthFile
        ? await readCodexAuthIdentityFromFile(authFilePath)
        : undefined

      if (!hasStoredAuthFile && metadata == null) {
        continue
      }

      const mergedIdentity = mergeCodexAccountProbes(
        buildProbeFromMetadata(metadata),
        authIdentity
      )

      const descriptor: CodexAccountDescriptor = {
        key: entry.name,
        title: resolveCodexAccountTitle({
          key: entry.name,
          title: metadata?.title,
          probe: mergedIdentity
        }),
        description: normalizeNonEmptyString(metadata?.description),
        accountDir,
        authFilePath: hasStoredAuthFile ? authFilePath : undefined,
        metaFilePath,
        status: hasStoredAuthFile ? 'ready' : 'missing',
        metadata,
        identity: mergedIdentity
      }
      const existing = descriptorMap.get(entry.name)
      descriptorMap.set(
        entry.name,
        existing == null
          ? descriptor
          : pickPreferredCodexStoredSnapshotDescriptor(existing, descriptor)
      )
    }
  }

  return Array.from(descriptorMap.values())
}

const pickPreferredCodexStoredSnapshotDescriptor = (
  preferred: CodexAccountDescriptor,
  fallback: CodexAccountDescriptor
) => {
  if (preferred.status !== 'ready' && fallback.status === 'ready') {
    return fallback
  }

  return {
    ...preferred,
    title: preferred.title ?? fallback.title,
    description: preferred.description ?? fallback.description,
    authFilePath: preferred.authFilePath ?? fallback.authFilePath,
    metaFilePath: preferred.metaFilePath ?? fallback.metaFilePath,
    metadata: preferred.metadata ?? fallback.metadata,
    identity: mergeCodexAccountProbes(preferred.identity, fallback.identity) ?? preferred.identity
  }
}

const findStoredAccountByIdentity = async (
  ctx: Pick<AdapterCtx, 'cwd' | 'env'>,
  params: {
    authDigest?: string
    probe?: CodexAccountProbe
  }
) => {
  const descriptors = await collectStoredAccountDescriptors(ctx)
  const normalizedProbe = mergeCodexAccountProbes(params.probe)

  if (normalizedProbe != null) {
    const preferredKey = buildImportedAccountKey({
      authDigest: params.authDigest ?? '00000000',
      probe: normalizedProbe
    })
    const matchedDescriptors = descriptors.filter(descriptor => (
      isSameCodexAccountIdentity(normalizedProbe, descriptor.identity ?? buildProbeFromMetadata(descriptor.metadata))
    ))
    if (matchedDescriptors.length > 0) {
      return matchedDescriptors.sort((left, right) => {
        if (left.key === preferredKey) return -1
        if (right.key === preferredKey) return 1

        const leftFriendly = left.key.startsWith('chatgpt-') || left.key.startsWith('api-key-')
        const rightFriendly = right.key.startsWith('chatgpt-') || right.key.startsWith('api-key-')
        if (leftFriendly !== rightFriendly) {
          return leftFriendly ? -1 : 1
        }

        const leftUpdatedAt = parseFiniteNumber(left.metadata?.updatedAt) ?? 0
        const rightUpdatedAt = parseFiniteNumber(right.metadata?.updatedAt) ?? 0
        return rightUpdatedAt - leftUpdatedAt
      })[0]
    }
  }

  return params.authDigest == null
    ? undefined
    : descriptors.find(descriptor => descriptor.metadata?.authDigest === params.authDigest)
}

const pickPreferredCodexDescriptor = (
  left: CodexAccountDescriptor,
  right: CodexAccountDescriptor
) => {
  if (left.status !== right.status) {
    if (left.status === 'ready') return left
    if (right.status === 'ready') return right
  }

  const leftFriendly = left.key.startsWith('chatgpt-') || left.key.startsWith('api-key-')
  const rightFriendly = right.key.startsWith('chatgpt-') || right.key.startsWith('api-key-')
  if (leftFriendly !== rightFriendly) {
    return leftFriendly ? left : right
  }

  const leftUpdatedAt = parseFiniteNumber(left.metadata?.updatedAt) ?? 0
  const rightUpdatedAt = parseFiniteNumber(right.metadata?.updatedAt) ?? 0
  if (leftUpdatedAt !== rightUpdatedAt) {
    return leftUpdatedAt > rightUpdatedAt ? left : right
  }

  return compareCodexAccountDescriptors(left, right) <= 0 ? left : right
}

const dedupeCodexAccountDescriptors = (descriptors: CodexAccountDescriptor[]) => {
  const deduped: CodexAccountDescriptor[] = []

  for (const descriptor of descriptors) {
    const descriptorIdentity = descriptor.identity ?? buildProbeFromMetadata(descriptor.metadata)
    const existingIndex = deduped.findIndex(existing => (
      isSameCodexAccountIdentity(
        descriptorIdentity,
        existing.identity ?? buildProbeFromMetadata(existing.metadata)
      )
    ))

    if (existingIndex === -1) {
      deduped.push(descriptor)
      continue
    }

    deduped[existingIndex] = pickPreferredCodexDescriptor(deduped[existingIndex], descriptor)
  }

  return deduped
}

const writeProbeMetadata = async (params: {
  ctx: Pick<AdapterCtx, 'cwd' | 'env'>
  descriptor: CodexAccountDescriptor
  probe: CodexAccountProbe
}) => {
  const { ctx, descriptor, probe } = params
  const metaPath = descriptor.metaFilePath ?? resolveStoredAccountMetaPath(ctx, descriptor.key)
  const nextMetadata: CodexStoredAccountMetadata = {
    ...descriptor.metadata,
    ...(probe.email != null ? { email: probe.email } : {}),
    ...(probe.planType != null ? { planType: probe.planType } : {}),
    ...(probe.accountType != null ? { accountType: probe.accountType } : {}),
    ...(probe.accountId != null ? { accountId: probe.accountId } : {}),
    ...(probe.organizationId != null ? { organizationId: probe.organizationId } : {}),
    ...(probe.organizationTitle != null ? { organizationTitle: probe.organizationTitle } : {}),
    ...(probe.organizationRole != null ? { organizationRole: probe.organizationRole } : {}),
    ...(probe.quota != null ? { quota: cloneQuotaInfo(probe.quota) } : {}),
    title: resolveCodexAccountTitle({
      key: descriptor.key,
      title: descriptor.title ?? descriptor.metadata?.title,
      probe: mergeCodexAccountProbes(descriptor.identity, descriptor.metadata, probe)
    }),
    description: descriptor.description ?? descriptor.metadata?.description,
    createdAt: descriptor.metadata?.createdAt ?? Date.now(),
    updatedAt: Date.now()
  }

  await writeJsonFile(metaPath, nextMetadata)
  descriptor.metadata = nextMetadata
  descriptor.identity = mergeCodexAccountProbes(descriptor.identity, nextMetadata)
  descriptor.title = resolveCodexAccountTitle({
    key: descriptor.key,
    title: descriptor.title,
    probe: descriptor.identity
  })
}

const getCodexAccountProbe = async (params: {
  ctx: Pick<AdapterCtx, 'cwd' | 'env' | 'ctxId'>
  descriptor: CodexAccountDescriptor
  refresh?: boolean
  scope: string
}): Promise<CodexAccountProbe | undefined> => {
  const { ctx, descriptor, refresh, scope } = params
  const cachedProbe = getCachedProbe(descriptor.metadata, refresh)
  if (cachedProbe != null) {
    return cachedProbe
  }

  if (descriptor.authFilePath == null) {
    return buildProbeFromMetadata(descriptor.metadata)
  }

  const probe = await probeCodexAccount({
    ctx,
    homeDir: resolveCodexProbeHomeDir(ctx, `${scope}-${descriptor.key}`),
    authFilePath: descriptor.authFilePath,
    refresh,
    logKey: `${scope}-${descriptor.key}`
  })
  await writeProbeMetadata({
    ctx,
    descriptor,
    probe
  })

  return probe
}

const compareCodexAccountDescriptors = (
  left: Pick<CodexAccountDescriptor, 'key' | 'title' | 'status'>,
  right: Pick<CodexAccountDescriptor, 'key' | 'title' | 'status'>
) => {
  if (left.status !== right.status) {
    if (left.status === 'ready') return -1
    if (right.status === 'ready') return 1
  }

  const leftTitle = normalizeNonEmptyString(left.title)?.toLowerCase() ?? ''
  const rightTitle = normalizeNonEmptyString(right.title)?.toLowerCase() ?? ''
  const titleOrder = leftTitle.localeCompare(rightTitle)
  if (titleOrder !== 0) return titleOrder

  return left.key.localeCompare(right.key)
}

const buildCodexTitleDisambiguationSuffix = (descriptor: CodexAccountDescriptor) => {
  const authDigest = normalizeNonEmptyString(descriptor.metadata?.authDigest)
  if (authDigest != null) {
    return authDigest.slice(0, 8)
  }

  const accountFragment = compactIdentityFragment(
    descriptor.identity?.accountId ?? descriptor.metadata?.accountId
  )
  if (accountFragment != null) {
    return accountFragment
  }

  return descriptor.key.slice(-8)
}

const disambiguateCodexAccountTitles = (descriptors: CodexAccountDescriptor[]) => {
  const groups = new Map<string, CodexAccountDescriptor[]>()

  for (const descriptor of descriptors) {
    const normalizedTitle = normalizeNonEmptyString(descriptor.title)?.toLowerCase()
    if (normalizedTitle == null) {
      continue
    }

    const group = groups.get(normalizedTitle)
    if (group == null) {
      groups.set(normalizedTitle, [descriptor])
      continue
    }

    group.push(descriptor)
  }

  for (const group of groups.values()) {
    if (group.length < 2) {
      continue
    }

    for (const descriptor of group) {
      const baseTitle = normalizeNonEmptyString(descriptor.title) ?? descriptor.key
      descriptor.title = `${baseTitle} · ${buildCodexTitleDisambiguationSuffix(descriptor)}`
    }
  }

  return descriptors
}

const collectCodexAccountDescriptors = async (
  ctx: Pick<AdapterCtx, 'cwd' | 'env' | 'ctxId' | 'configs'>,
  options: { refresh?: boolean } = {}
) => {
  const { defaultAccount, accounts: configuredAccounts } = resolveCodexAdapterConfig(ctx)
  const importedAccountKey = await ensureImportedRealHomeAccount(ctx, options).catch(() => undefined)
  const discoveredAccounts = dedupeCodexAccountDescriptors(await collectStoredAccountDescriptors(ctx))
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
  const sortedDescriptors = disambiguateCodexAccountTitles(
    descriptors
      .map(account => ({
        ...account,
        title: resolveCodexAccountTitle({
          key: account.key,
          title: account.title,
          probe: mergeCodexAccountProbes(account.identity, buildProbeFromMetadata(account.metadata))
        })
      }))
      .sort(compareCodexAccountDescriptors)
  )
  const resolvedDefaultAccount = defaultAccount ??
    importedAccountKey ??
    sortedDescriptors.find(account => account.status === 'ready')?.key

  return {
    defaultAccount: resolvedDefaultAccount,
    accounts: sortedDescriptors
      .sort((left, right) => {
        if (left.key === resolvedDefaultAccount) return -1
        if (right.key === resolvedDefaultAccount) return 1
        return compareCodexAccountDescriptors(left, right)
      })
  }
}

const resolveCodexAccountSource = (params: {
  descriptor: CodexAccountDescriptor
  configuredAccount?: CodexConfiguredAccount
}): AdapterAccountDetail['source'] => {
  const sourceId = params.descriptor.metadata?.source

  if (sourceId === 'imported-real-home') {
    return {
      id: sourceId,
      label: 'Imported',
      description: params.descriptor.metadata?.description ?? 'Imported from ~/.codex/auth.json'
    }
  }

  if (sourceId === 'codex-login') {
    return {
      id: sourceId,
      label: 'Codex Login',
      description: params.descriptor.metadata?.description ?? 'Logged in via `codex login`.'
    }
  }

  if (params.configuredAccount?.authFile != null && params.configuredAccount.authFile.trim() !== '') {
    return {
      id: 'configured-auth-file',
      label: 'Configured authFile',
      description: params.configuredAccount.authFile
    }
  }

  return undefined
}

const buildCodexAccountDetail = (params: {
  descriptor: CodexAccountDescriptor
  defaultAccount?: string
  probe?: CodexAccountProbe
  configuredAccount?: CodexConfiguredAccount
  overrideError?: string
}): AdapterAccountDetail => {
  const {
    descriptor,
    defaultAccount,
    probe,
    configuredAccount,
    overrideError
  } = params
  const mergedProbe = mergeCodexAccountProbes(descriptor.identity, descriptor.metadata, probe)
  const baseTitle = resolveCodexAccountTitle({
    key: descriptor.key,
    title: descriptor.title,
    probe: mergedProbe
  })
  const baseDescription = overrideError ??
    descriptor.description ??
    normalizeNonEmptyString(descriptor.metadata?.description) ??
    (mergedProbe?.accountType === 'apiKey' ? 'API Key account' : undefined)
  const status = overrideError != null ? 'error' : descriptor.status

  return {
    key: descriptor.key,
    title: baseTitle,
    description: baseDescription,
    status,
    isDefault: descriptor.key === defaultAccount,
    quota: overrideError == null ? probe?.quota : undefined,
    email: normalizeNonEmptyString(mergedProbe?.email),
    planType: normalizeNonEmptyString(mergedProbe?.planType),
    accountType: normalizeNonEmptyString(mergedProbe?.accountType),
    source: resolveCodexAccountSource({ descriptor, configuredAccount }),
    actions: [...CODEX_ACCOUNT_DETAIL_ACTIONS]
  }
}

const resolveExistingCodexAccount = async (
  ctx: Pick<AdapterCtx, 'cwd' | 'env' | 'ctxId' | 'configs'>,
  accountKey: string,
  options: { refresh?: boolean } = {}
) => {
  const normalizedAccount = normalizeNonEmptyString(accountKey)
  if (normalizedAccount == null) {
    throw new Error('Codex account key is required.')
  }

  const catalog = await collectCodexAccountDescriptors(ctx, options)
  const descriptor = catalog.accounts.find(account => account.key === normalizedAccount)
  if (descriptor == null) {
    throw new Error(`Codex account "${normalizedAccount}" was not found.`)
  }

  return {
    descriptor,
    defaultAccount: catalog.defaultAccount,
    configuredAccount: resolveCodexAdapterConfig(ctx).accounts[normalizedAccount]
  }
}

const runCodexLogin = async (params: {
  ctx: Pick<AdapterCtx, 'cwd' | 'env' | 'ctxId'>
  onProgress?: AdapterManageAccountOptions['onProgress']
  signal?: AbortSignal
}) => {
  const { ctx, onProgress, signal } = params
  const binaryPath = resolveCodexBinaryPath(ctx.env)
  const spawnEnv = buildSpawnEnv(ctx.env)
  const loginKey = `login-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  const homeDir = resolveCodexProbeHomeDir(ctx, loginKey)
  const authFilePath = join(homeDir, '.codex', 'auth.json')

  throwIfAborted(signal)
  spawnEnv.HOME = homeDir
  await mkdir(join(homeDir, '.codex'), { recursive: true })
  onProgress?.({
    stream: 'status',
    message: 'Starting isolated `codex login` flow.'
  })

  let stdout = ''
  let stderr = ''

  try {
    await new Promise<void>((resolvePromise, rejectPromise) => {
      const proc = spawn(String(binaryPath), ['login'], {
        cwd: ctx.cwd,
        env: spawnEnv,
        stdio: ['ignore', 'pipe', 'pipe']
      })
      let settled = false

      const finishResolve = () => {
        if (settled) return
        settled = true
        signal?.removeEventListener('abort', abortLoginFlow)
        resolvePromise()
      }

      const finishReject = (error: unknown) => {
        if (settled) return
        settled = true
        signal?.removeEventListener('abort', abortLoginFlow)
        rejectPromise(error)
      }

      const abortLoginFlow = () => {
        proc.kill()
        finishReject(createAbortError())
      }

      proc.stdout?.on('data', (chunk) => {
        const text = String(chunk)
        stdout += text
        onProgress?.({ stream: 'stdout', message: text })
      })
      proc.stderr?.on('data', (chunk) => {
        const text = String(chunk)
        stderr += text
        onProgress?.({ stream: 'stderr', message: text })
      })
      proc.once('error', finishReject)
      proc.once('exit', (code) => {
        if (signal?.aborted === true) {
          finishReject(createAbortError())
          return
        }

        if (code === 0) {
          finishResolve()
          return
        }

        const failureLog = `${stdout}\n${stderr}`.trim()
        finishReject(
          new Error(
            failureLog === ''
              ? `\`codex login\` exited with code ${code ?? 'unknown'}.`
              : failureLog
          )
        )
      })

      if (signal?.aborted === true) {
        abortLoginFlow()
        return
      }

      signal?.addEventListener('abort', abortLoginFlow, { once: true })
    })

    throwIfAborted(signal)
    if (!await pathExists(authFilePath)) {
      throw new Error('Codex login completed but no auth.json was written to the isolated home.')
    }

    return {
      homeDir,
      authFilePath
    }
  } catch (error) {
    await rm(homeDir, { recursive: true, force: true }).catch(() => {})
    throw error
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

  await Promise.all(sharedMappings.map(mapping =>
    syncSymlinkTarget({
      ...mapping,
      onMissingSource: 'remove'
    })
  ))
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
  linkRealHomeGitConfig({
    realHome: ctx.env.__VF_PROJECT_REAL_HOME__ ?? undefined,
    mockHome: homeDir
  })
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
  const configuredAccounts = resolveCodexAdapterConfig(ctx).accounts

  for (const descriptor of catalog.accounts) {
    if (descriptor.authFilePath == null) {
      accounts.push({
        key: descriptor.key,
        title: descriptor.title ?? descriptor.key,
        description: descriptor.description,
        status: descriptor.status,
        isDefault: descriptor.key === catalog.defaultAccount
      })
      continue
    }

    try {
      const probe = await getCodexAccountProbe({
        ctx,
        descriptor,
        refresh: options.refresh,
        scope: 'list'
      })
      const detail = buildCodexAccountDetail({
        descriptor,
        defaultAccount: catalog.defaultAccount,
        configuredAccount: configuredAccounts[descriptor.key],
        probe
      })
      accounts.push({
        key: detail.key,
        title: detail.title,
        description: detail.description,
        status: detail.status,
        isDefault: detail.isDefault,
        quota: detail.quota
      })
    } catch (error) {
      const detail = buildCodexAccountDetail({
        descriptor,
        defaultAccount: catalog.defaultAccount,
        configuredAccount: configuredAccounts[descriptor.key],
        overrideError: error instanceof Error ? error.message : String(error)
      })
      accounts.push({
        key: detail.key,
        title: detail.title,
        description: detail.description,
        status: detail.status,
        isDefault: detail.isDefault
      })
    }
  }

  return {
    defaultAccount: catalog.defaultAccount,
    accounts,
    actions: [...CODEX_ACCOUNT_LIST_ACTIONS]
  }
}

export const getCodexAccountDetail = async (
  ctx: AdapterCtx,
  options: AdapterAccountDetailQueryOptions
): Promise<AdapterAccountDetailResult> => {
  const { descriptor, defaultAccount, configuredAccount } = await resolveExistingCodexAccount(ctx, options.account, {
    refresh: options.refresh
  })

  if (descriptor.authFilePath == null) {
    return {
      account: buildCodexAccountDetail({
        descriptor,
        defaultAccount,
        configuredAccount
      })
    }
  }

  try {
    const probe = await getCodexAccountProbe({
      ctx,
      descriptor,
      refresh: options.refresh,
      scope: 'detail'
    })
    return {
      account: buildCodexAccountDetail({
        descriptor,
        defaultAccount,
        configuredAccount,
        probe
      })
    }
  } catch (error) {
    return {
      account: buildCodexAccountDetail({
        descriptor,
        defaultAccount,
        configuredAccount,
        overrideError: error instanceof Error ? error.message : String(error)
      })
    }
  }
}

export const manageCodexAccount = async (
  ctx: AdapterCtx,
  options: AdapterManageAccountOptions
): Promise<AdapterManageAccountResult> => {
  if (options.action === 'refresh') {
    const normalizedAccount = normalizeNonEmptyString(options.account)
    if (normalizedAccount == null) {
      throw new Error('Codex refresh requires an account key.')
    }

    const detail = await getCodexAccountDetail(ctx, {
      account: normalizedAccount,
      model: options.model,
      refresh: true
    })

    return {
      accountKey: normalizedAccount,
      account: detail.account,
      message: `Refreshed Codex account "${normalizedAccount}".`
    }
  }

  if (options.action === 'remove') {
    const normalizedAccount = normalizeNonEmptyString(options.account)
    if (normalizedAccount == null) {
      throw new Error('Codex remove requires an account key.')
    }

    const { descriptor, configuredAccount } = await resolveExistingCodexAccount(ctx, normalizedAccount)
    const storedAuthPaths = resolveStoredAccountReadDirs(ctx, normalizedAccount).map(accountDir =>
      join(accountDir, 'auth.json')
    )
    const hasStoredSnapshot = descriptor.authFilePath != null && storedAuthPaths.includes(descriptor.authFilePath)

    if (!hasStoredSnapshot) {
      if (configuredAccount?.authFile != null && configuredAccount.authFile.trim() !== '') {
        throw new Error(
          `Codex account "${normalizedAccount}" is backed by adapters.codex.accounts.${normalizedAccount}.authFile. Remove that config entry instead.`
        )
      }
      throw new Error(`Codex account "${normalizedAccount}" does not have a removable workspace snapshot.`)
    }

    return {
      accountKey: normalizedAccount,
      removeStoredAccount: true,
      message: `Removed the stored Codex account snapshot for "${normalizedAccount}".`
    }
  }

  const normalizedRequestedKey = normalizeNonEmptyString(options.account)
  const loginResult = await runCodexLogin({
    ctx,
    onProgress: options.onProgress,
    signal: options.signal
  })

  try {
    throwIfAborted(options.signal)
    const authContent = await readFile(loginResult.authFilePath, 'utf8')
    const authDigest = createHash('sha256').update(authContent).digest('hex')
    const authIdentity = readCodexAuthIdentityFromContent(authContent)
    const probe = mergeCodexAccountProbes(
      authIdentity,
      await probeCodexAccount({
        ctx,
        homeDir: resolveCodexProbeHomeDir(ctx, `login-probe-${Date.now().toString(36)}`),
        authFilePath: loginResult.authFilePath,
        refresh: true,
        logKey: `login-${normalizedRequestedKey ?? 'new'}`
      }).catch(() => undefined)
    )
    const existingStoredAccount = await findStoredAccountByIdentity(ctx, {
      authDigest,
      probe
    })
    const accountKey = normalizedRequestedKey != null && slugifyAccountKey(normalizedRequestedKey) !== ''
      ? slugifyAccountKey(normalizedRequestedKey)
      : existingStoredAccount?.key != null
      ? existingStoredAccount.key
      : buildImportedAccountKey({ authDigest, probe })
    const metadata: CodexStoredAccountMetadata = {
      title: resolveCodexAccountTitle({
        key: accountKey,
        title: existingStoredAccount?.metadata?.title,
        probe
      }),
      description: 'Logged in via `codex login`.',
      email: probe?.email,
      planType: probe?.planType,
      accountType: probe?.accountType,
      accountId: probe?.accountId,
      organizationId: probe?.organizationId,
      organizationTitle: probe?.organizationTitle,
      organizationRole: probe?.organizationRole,
      quota: cloneQuotaInfo(probe?.quota),
      source: 'codex-login',
      authDigest,
      createdAt: existingStoredAccount?.metadata?.createdAt ?? Date.now(),
      updatedAt: Date.now()
    }
    const detail = buildCodexAccountDetail({
      descriptor: {
        key: accountKey,
        title: metadata.title,
        description: metadata.description,
        authFilePath: resolveStoredAccountAuthPath(ctx, accountKey),
        status: 'ready',
        metadata,
        identity: mergeCodexAccountProbes(existingStoredAccount?.identity, metadata)
      },
      probe
    })
    const artifacts: AdapterAccountCredentialArtifact[] = [
      {
        path: 'auth.json',
        content: authContent
      },
      {
        path: 'meta.json',
        content: `${JSON.stringify(metadata, null, 2)}\n`
      }
    ]

    return {
      accountKey,
      account: detail,
      artifacts,
      message: `Connected Codex account "${detail.title}".`
    }
  } finally {
    await rm(loginResult.homeDir, { recursive: true, force: true }).catch(() => {})
  }
}
