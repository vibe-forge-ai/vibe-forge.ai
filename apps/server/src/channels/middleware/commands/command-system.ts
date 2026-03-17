// ── Argument types ──────────────────────────────────────────────────────────

type CommandArgumentParser<TValue> = (value: string) => TValue

export interface CommandArgumentChoice<TValue extends string = string> {
  readonly value: TValue
  readonly title: string
  readonly description?: string
}

type CommandArgumentChoices = readonly CommandArgumentChoice[]

interface BaseArgumentSpec<TValue> {
  readonly name: string
  readonly description?: string
  readonly parse: CommandArgumentParser<TValue>
  readonly choices?: CommandArgumentChoices
}

export interface RequiredArgumentSpec<TValue> extends BaseArgumentSpec<TValue> {
  readonly kind: 'required'
}

export interface OptionalArgumentSpec<TValue> extends BaseArgumentSpec<TValue> {
  readonly kind: 'optional'
}

export interface VariadicArgumentSpec<TValue> extends BaseArgumentSpec<TValue> {
  readonly kind: 'variadic'
}

export interface RestArgumentSpec<TValue> extends BaseArgumentSpec<TValue> {
  readonly kind: 'rest'
}

export type CommandArgumentSpec<TValue = unknown> =
  | RequiredArgumentSpec<TValue>
  | OptionalArgumentSpec<TValue>
  | VariadicArgumentSpec<TValue>
  | RestArgumentSpec<TValue>

type InferArgumentValue<TArgument extends CommandArgumentSpec> = TArgument extends RequiredArgumentSpec<infer TValue>
  ? TValue
  : TArgument extends OptionalArgumentSpec<infer TValue> ? TValue | undefined
  : TArgument extends VariadicArgumentSpec<infer TValue> ? TValue[]
  : TArgument extends RestArgumentSpec<infer TValue> ? TValue
  : never

export type InferArgumentValues<TArgs extends readonly CommandArgumentSpec[]> = {
  [K in keyof TArgs]: TArgs[K] extends CommandArgumentSpec ? InferArgumentValue<TArgs[K]> : never
}

// ── Argument builders ───────────────────────────────────────────────────────

const identity = <TValue>(value: TValue) => value

interface ParserArgumentOptions<TValue> {
  description?: string
  parse?: CommandArgumentParser<TValue>
}

interface ChoiceArgumentOptions<TChoices extends readonly CommandArgumentChoice[]> {
  description?: string
  choices: TChoices
}

const createChoiceParser = <const TChoices extends readonly CommandArgumentChoice[]>(choices: TChoices) => {
  return (value: string): TChoices[number]['value'] => {
    const match = choices.find(choice => choice.value === value)
    if (match) return match.value as TChoices[number]['value']
    throw new Error(`Invalid value: ${value}. Supported: ${choices.map(choice => choice.value).join(', ')}`)
  }
}

const resolveArgumentConfig = <TValue>(options: ParserArgumentOptions<TValue>) => ({
  description: options.description,
  parse: options.parse ?? (identity as CommandArgumentParser<TValue>),
  choices: undefined as CommandArgumentChoices | undefined
})

const resolveChoiceArgumentConfig = <const TChoices extends readonly CommandArgumentChoice[]>(
  options: ChoiceArgumentOptions<TChoices>
) => ({
  description: options.description,
  parse: createChoiceParser(options.choices),
  choices: options.choices as CommandArgumentChoices
})

export function requiredArg<const TChoices extends readonly CommandArgumentChoice[]>(
  name: string,
  options: ChoiceArgumentOptions<TChoices>
): RequiredArgumentSpec<TChoices[number]['value']>
export function requiredArg<TValue = string>(
  name: string,
  options?: ParserArgumentOptions<TValue>
): RequiredArgumentSpec<TValue>
export function requiredArg<TValue = string>(
  name: string,
  options: ParserArgumentOptions<TValue> | ChoiceArgumentOptions<readonly CommandArgumentChoice[]> = {}
): RequiredArgumentSpec<TValue> {
  const config = 'choices' in options ? resolveChoiceArgumentConfig(options) : resolveArgumentConfig(options)
  return {
    kind: 'required',
    name,
    description: config.description,
    parse: config.parse,
    choices: config.choices
  } as RequiredArgumentSpec<TValue>
}

export function optionalArg<const TChoices extends readonly CommandArgumentChoice[]>(
  name: string,
  options: ChoiceArgumentOptions<TChoices>
): OptionalArgumentSpec<TChoices[number]['value']>
export function optionalArg<TValue = string>(
  name: string,
  options?: ParserArgumentOptions<TValue>
): OptionalArgumentSpec<TValue>
export function optionalArg<TValue = string>(
  name: string,
  options: ParserArgumentOptions<TValue> | ChoiceArgumentOptions<readonly CommandArgumentChoice[]> = {}
): OptionalArgumentSpec<TValue> {
  const config = 'choices' in options ? resolveChoiceArgumentConfig(options) : resolveArgumentConfig(options)
  return {
    kind: 'optional',
    name,
    description: config.description,
    parse: config.parse,
    choices: config.choices
  } as OptionalArgumentSpec<TValue>
}

export function variadicArg<const TChoices extends readonly CommandArgumentChoice[]>(
  name: string,
  options: ChoiceArgumentOptions<TChoices>
): VariadicArgumentSpec<TChoices[number]['value']>
export function variadicArg<TValue = string>(
  name: string,
  options?: ParserArgumentOptions<TValue>
): VariadicArgumentSpec<TValue>
export function variadicArg<TValue = string>(
  name: string,
  options: ParserArgumentOptions<TValue> | ChoiceArgumentOptions<readonly CommandArgumentChoice[]> = {}
): VariadicArgumentSpec<TValue> {
  const config = 'choices' in options ? resolveChoiceArgumentConfig(options) : resolveArgumentConfig(options)
  return {
    kind: 'variadic',
    name,
    description: config.description,
    parse: config.parse,
    choices: config.choices
  } as VariadicArgumentSpec<TValue>
}

export function restArg<const TChoices extends readonly CommandArgumentChoice[]>(
  name: string,
  options: ChoiceArgumentOptions<TChoices>
): RestArgumentSpec<TChoices[number]['value']>
export function restArg<TValue = string>(
  name: string,
  options?: ParserArgumentOptions<TValue>
): RestArgumentSpec<TValue>
export function restArg<TValue = string>(
  name: string,
  options: ParserArgumentOptions<TValue> | ChoiceArgumentOptions<readonly CommandArgumentChoice[]> = {}
): RestArgumentSpec<TValue> {
  const config = 'choices' in options ? resolveChoiceArgumentConfig(options) : resolveArgumentConfig(options)
  return {
    kind: 'rest',
    name,
    description: config.description,
    parse: config.parse,
    choices: config.choices
  } as RestArgumentSpec<TValue>
}

// ── Command definition ──────────────────────────────────────────────────────

type MaybePromise<TValue> = TValue | Promise<TValue>

export type PermissionLevel = 'everyone' | 'admin'

export interface CommandActionInput<TContext, TArgs extends readonly CommandArgumentSpec[]> {
  readonly ctx: TContext
  readonly args: InferArgumentValues<TArgs>
  readonly rawArgs: readonly string[]
  readonly commandPath: readonly string[]
  readonly usage: string
}

export interface CommandSpec<TContext, TArgs extends readonly CommandArgumentSpec[] = readonly CommandArgumentSpec[]> {
  readonly name: string
  readonly aliases: readonly string[]
  readonly descriptionKey: string | undefined
  readonly permission: PermissionLevel
  readonly args: TArgs
  readonly subcommands: readonly AnyCommandSpec<TContext>[]
  readonly action: ((input: CommandActionInput<TContext, TArgs>) => MaybePromise<void>) | undefined
}

export type AnyCommandSpec<TContext> = CommandSpec<TContext, any>

// ── Chain builder ───────────────────────────────────────────────────────────

export interface CommandBuilder<TContext, TArgs extends readonly CommandArgumentSpec[]> {
  alias(...aliases: string[]): CommandBuilder<TContext, TArgs>
  description(key: string): CommandBuilder<TContext, TArgs>
  adminOnly(): CommandBuilder<TContext, TArgs>
  argument<TSpec extends CommandArgumentSpec>(arg: TSpec): CommandBuilder<TContext, readonly [...TArgs, TSpec]>
  subcommand(sub: AnyCommandSpec<TContext>): CommandBuilder<TContext, TArgs>
  action(fn: (input: CommandActionInput<TContext, TArgs>) => MaybePromise<void>): CommandSpec<TContext, TArgs>
  build(): CommandSpec<TContext, TArgs>
}

export const command = <TContext>(name: string): CommandBuilder<TContext, readonly []> => {
  const state = {
    name,
    aliases: [] as string[],
    descriptionKey: undefined as string | undefined,
    permission: 'everyone' as PermissionLevel,
    args: [] as CommandArgumentSpec[],
    subcommands: [] as AnyCommandSpec<TContext>[],
    action: undefined as
      | ((input: CommandActionInput<TContext, readonly CommandArgumentSpec[]>) => MaybePromise<void>)
      | undefined
  }

  const freeze = (): CommandSpec<TContext, readonly CommandArgumentSpec[]> => ({
    name: state.name,
    aliases: state.aliases,
    descriptionKey: state.descriptionKey,
    permission: state.permission,
    args: state.args,
    subcommands: state.subcommands,
    action: state.action
  })

  const builder: CommandBuilder<TContext, any> = {
    alias(...aliases) {
      state.aliases.push(...aliases)
      return builder
    },
    description(key) {
      state.descriptionKey = key
      return builder
    },
    adminOnly() {
      state.permission = 'admin'
      return builder
    },
    argument(arg) {
      state.args.push(arg)
      return builder
    },
    subcommand(sub) {
      state.subcommands.push(sub)
      return builder
    },
    action(fn) {
      state.action = fn as typeof state.action
      return freeze() as never
    },
    build() {
      return freeze() as never
    }
  }

  return builder
}

// ── Parsing ─────────────────────────────────────────────────────────────────

type CommandParseErrorCode =
  | 'unknown-command'
  | 'missing-subcommand'
  | 'unknown-subcommand'
  | 'missing-argument'
  | 'too-many-arguments'
  | 'invalid-argument'

export interface CommandParseError {
  readonly ok: false
  readonly code: CommandParseErrorCode
  readonly message: string
  readonly usage?: string
}

export interface CommandParseSuccess<TContext> {
  readonly ok: true
  readonly command: AnyCommandSpec<TContext>
  readonly args: readonly unknown[]
  readonly rawArgs: readonly string[]
  readonly commandPath: readonly string[]
  readonly usage: string
}

export type CommandParseResult<TContext> =
  | CommandParseError
  | CommandParseSuccess<TContext>

const formatArgumentUsage = (argument: CommandArgumentSpec) => {
  const choiceSuffix = argument.choices && argument.choices.length > 0
    ? `:${argument.choices.map(choice => choice.value).join('|')}`
    : ''
  switch (argument.kind) {
    case 'required':
      return `<${argument.name}${choiceSuffix}>`
    case 'optional':
      return `[${argument.name}${choiceSuffix}]`
    case 'variadic':
      return `<${argument.name}${choiceSuffix}...>`
    case 'rest':
      return `<${argument.name}${choiceSuffix}>`
  }
}

const joinPath = (segments: readonly string[]) => segments.join(' ')

const formatChoiceSummary = (
  choices: readonly CommandArgumentChoice[],
  translate: (key: string, args?: Record<string, string | number | boolean | undefined>) => string
) =>
  choices
    .map(choice => `${choice.value}(${translate(choice.title)})`)
    .join(', ')

const formatChoiceGuidance = (
  choices: readonly CommandArgumentChoice[],
  translate: (key: string, args?: Record<string, string | number | boolean | undefined>) => string
) =>
  choices.map((choice) => {
    const title = translate(choice.title)
    const description = choice.description ? translate(choice.description) : ''
    return `- ${choice.value}：${title}${description ? `，${description}` : ''}`
  })

const formatChoiceErrorMessage = (
  rawValue: string,
  choices: readonly CommandArgumentChoice[],
  translate: (key: string, args?: Record<string, string | number | boolean | undefined>) => string
) => {
  const summary = formatChoiceSummary(choices, translate)
  const guidance = formatChoiceGuidance(choices, translate)
  return `${translate('system.choiceError', { value: rawValue, choices: summary })}\n${translate('label.choices')}：\n${
    guidance.join('\n')
  }`
}

const formatMissingArgumentMessage = <TValue>(
  spec: CommandArgumentSpec<TValue>,
  translate: (key: string, args?: Record<string, string | number | boolean | undefined>) => string
) => {
  const base = translate('system.missingArgument', { name: spec.name })
  if (!spec.choices || spec.choices.length === 0) {
    return base
  }

  return `${base}\n${translate('label.choices')}：\n${formatChoiceGuidance(spec.choices, translate).join('\n')}`
}

const matchesName = <TContext>(cmd: AnyCommandSpec<TContext>, token: string) =>
  cmd.name === token || cmd.aliases.includes(token)

const parseArgValue = <TValue>(
  spec: CommandArgumentSpec<TValue>,
  rawValue: string,
  translate: (key: string, args?: Record<string, string | number | boolean | undefined>) => string
) => {
  if (spec.choices && spec.choices.length > 0) {
    const matched = spec.choices.find(choice => choice.value === rawValue)
    if (matched) {
      return { ok: true as const, value: matched.value as TValue }
    }
    return { ok: false as const, message: formatChoiceErrorMessage(rawValue, spec.choices, translate) }
  }

  try {
    return { ok: true as const, value: spec.parse(rawValue) }
  } catch (error) {
    return { ok: false as const, message: error instanceof Error ? error.message : String(error) }
  }
}

export const formatUsage = <TContext>(
  cmd: AnyCommandSpec<TContext>,
  ancestors: readonly string[] = [],
  prefix = '/'
) => {
  const name = ancestors.length === 0 ? `${prefix}${cmd.name}` : cmd.name
  const path = [...ancestors, name]
  const args = cmd.args.map(formatArgumentUsage)
  return joinPath([...path, ...args])
}

// ── Parse command string ────────────────────────────────────────────────────

export const parseCommandString = <TContext>(
  commands: readonly AnyCommandSpec<TContext>[],
  input: string,
  opts: { t?: (key: string, args?: Record<string, string | number | boolean | undefined>) => string; prefix?: string } =
    {}
): CommandParseResult<TContext> => {
  const { t: translate = (key: string) => key, prefix = '/' } = opts
  const tokens = input.trim().split(/\s+/).filter(Boolean)
  const rootToken = tokens[0]

  if (!rootToken) {
    return { ok: false, code: 'unknown-command', message: translate('system.emptyCommand') }
  }

  const stripped = rootToken.startsWith(prefix) ? rootToken.slice(prefix.length) : rootToken
  const rootCommand = commands.find(cmd => matchesName(cmd, stripped))
  if (!rootCommand) {
    return { ok: false, code: 'unknown-command', message: translate('system.unknownCommand', { token: rootToken }) }
  }

  let current: AnyCommandSpec<TContext> = rootCommand
  let commandPath = [`${prefix}${rootCommand.name}`]
  let index = 1

  while (true) {
    const nextToken = tokens[index]
    if (!nextToken) break
    const nextCommand = current.subcommands.find(cmd => matchesName(cmd, nextToken))
    if (!nextCommand) break
    current = nextCommand
    commandPath = [...commandPath, nextCommand.name]
    index += 1
  }

  if (current.subcommands.length > 0 && current.action == null) {
    const nextToken = tokens[index]
    const usage = formatUsage(current, commandPath.slice(0, -1), prefix)
    if (!nextToken) {
      return {
        ok: false,
        code: 'missing-subcommand',
        message: translate('system.missingSubcommand', { path: joinPath(commandPath) }),
        usage
      }
    }
    return {
      ok: false,
      code: 'unknown-subcommand',
      message: translate('system.unknownSubcommand', { token: nextToken }),
      usage
    }
  }

  const argSpecs = current.args
  const rawArgs = tokens.slice(index)
  const parsedValues: unknown[] = []
  let rawIndex = 0

  for (const spec of argSpecs) {
    if (spec.kind === 'variadic') {
      const values: unknown[] = []
      while (rawIndex < rawArgs.length) {
        const parsed = parseArgValue(spec, rawArgs[rawIndex], translate)
        if (!parsed.ok) {
          return {
            ok: false,
            code: 'invalid-argument',
            message: parsed.message,
            usage: formatUsage(current, commandPath.slice(0, -1), prefix)
          }
        }
        values.push(parsed.value)
        rawIndex += 1
      }
      parsedValues.push(values)
      continue
    }

    if (spec.kind === 'rest') {
      const rawValue = rawArgs.slice(rawIndex).join(' ')
      if (rawValue === '') {
        return {
          ok: false,
          code: 'missing-argument',
          message: formatMissingArgumentMessage(spec, translate),
          usage: formatUsage(current, commandPath.slice(0, -1), prefix)
        }
      }
      const parsed = parseArgValue(spec, rawValue, translate)
      if (!parsed.ok) {
        return {
          ok: false,
          code: 'invalid-argument',
          message: parsed.message,
          usage: formatUsage(current, commandPath.slice(0, -1), prefix)
        }
      }
      parsedValues.push(parsed.value)
      rawIndex = rawArgs.length
      continue
    }

    const rawValue = rawArgs[rawIndex]
    if (rawValue == null) {
      if (spec.kind === 'optional') {
        parsedValues.push(undefined)
        continue
      }
      return {
        ok: false,
        code: 'missing-argument',
        message: formatMissingArgumentMessage(spec, translate),
        usage: formatUsage(current, commandPath.slice(0, -1), prefix)
      }
    }

    const parsed = parseArgValue(spec, rawValue, translate)
    if (!parsed.ok) {
      return {
        ok: false,
        code: 'invalid-argument',
        message: parsed.message,
        usage: formatUsage(current, commandPath.slice(0, -1), prefix)
      }
    }
    parsedValues.push(parsed.value)
    rawIndex += 1
  }

  if (rawIndex < rawArgs.length) {
    return {
      ok: false,
      code: 'too-many-arguments',
      message: translate('system.tooManyArguments', { extra: rawArgs.slice(rawIndex).join(' ') }),
      usage: formatUsage(current, commandPath.slice(0, -1), prefix)
    }
  }

  return {
    ok: true,
    command: current,
    args: parsedValues,
    rawArgs,
    commandPath,
    usage: formatUsage(current, commandPath.slice(0, -1), prefix)
  }
}
