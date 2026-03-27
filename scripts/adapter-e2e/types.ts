export type AdapterE2ETarget = 'codex' | 'claude-code' | 'opencode'

export type AdapterTransport = 'wrapper' | 'upstream-fallback'

export interface AdapterE2EHookExpectation {
  event: string
  count?: number
  minCount?: number
  maxCount?: number
}

export interface AdapterE2EMockTraceExpectation {
  minRequests?: number
  requiredToolNames?: string[]
  maxToolCalls?: number
  finalResponseText?: string
}

export interface AdapterE2ECaseExpectations {
  outputContains?: string[]
  hooks?: AdapterE2EHookExpectation[]
  mockTrace?: AdapterE2EMockTraceExpectation
}

export interface ManagedArtifactCandidate {
  path: string
  includes: string[]
}

export interface ManagedArtifactDefinition {
  label: string
  candidates: ManagedArtifactCandidate[]
}

export interface VerifiedManagedArtifact {
  label: string
  path: string
  includes: string[]
  content: string
}

export interface AdapterE2EResult {
  caseId: string
  adapter: AdapterE2ETarget
  ctxId: string
  sessionId: string
  logPath: string
  logContent: string
  managedArtifacts: VerifiedManagedArtifact[]
  stdout: string
  stderr: string
  exitCode: number
  transport: AdapterTransport
  mockTrace: MockLlmTraceEntry[]
}

export interface AdapterE2EHarnessOptions {
  passthroughStdIO?: boolean
  printSummary?: boolean
  mockServerOptions?: MockLlmServerOptions
  cases?: AdapterE2ECase[]
}

export interface RunProcessOptions {
  command: string
  args: string[]
  env: NodeJS.ProcessEnv
  timeoutMs?: number
  passthroughStdIO?: boolean
}

export interface RunProcessResult {
  code: number
  signal: NodeJS.Signals | null
  timedOut: boolean
  stdout: string
  stderr: string
}

export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue }

export type JsonObject = Record<string, JsonValue | undefined>

export interface MockToolCall {
  name: string
  args: Record<string, JsonValue>
}

export interface MockToolCandidate {
  name: string
  parameters: JsonObject
  args: Record<string, JsonValue>
}

export interface MockScenarioContext {
  model: string
  body: JsonObject
  repoRoot: string
}

export interface MockScenarioHelpers {
  hasToolResult: (body: JsonObject) => boolean
  isTitleGenerationRequest: (body: JsonObject) => boolean
  pickToolCall: (body: JsonObject) => MockToolCall | undefined
  getRequestText: (body: JsonObject) => string
}

export type MockScenarioTurn =
  | { kind: 'message', text: string }
  | { kind: 'tool', tool: MockToolCall }

export interface MockLlmTraceEntry {
  path: string
  model: string
  requestText: string
  inputTypes: string[]
  requestedToolCount: number
  selectedTool: MockToolCall | undefined
  response: MockScenarioTurn
}

export interface MockModelScenario {
  id: string
  aliases?: string[]
  title: string
  finalOutput: string
  resolveTurn?: (
    context: MockScenarioContext,
    helpers: MockScenarioHelpers
  ) => MockScenarioTurn
}

export interface MockLlmServerOptions {
  scenarios?: MockModelScenario[]
  debug?: boolean
}

export interface MockLlmServerHandle {
  port: number
  getTrace: () => MockLlmTraceEntry[]
  close: () => Promise<void>
}

export interface MockScenarioRule {
  id: string
  when: (
    context: MockScenarioContext,
    helpers: MockScenarioHelpers
  ) => boolean
  respond:
    | MockScenarioTurn
    | ((
      context: MockScenarioContext,
      helpers: MockScenarioHelpers
    ) => MockScenarioTurn)
}

export interface AdapterE2ECase {
  id: string
  title: string
  adapter: AdapterE2ETarget
  prompt?: string
  model?: string
  allowedTransports?: AdapterTransport[]
  extraArgs?: string[]
  mockScenarios?: MockModelScenario[]
  expectations?: AdapterE2ECaseExpectations
}

export interface ResolvedAdapterE2ECase {
  id: string
  title: string
  adapter: AdapterE2ETarget
  prompt: string
  model: string
  allowedTransports: AdapterTransport[]
  args: (sessionId: string) => string[]
  mockScenarios: MockModelScenario[]
  expectations: AdapterE2ECaseExpectations
}
