const ROOT_ONLY_ARGS = new Set(['-h', '--help', '-V', '--version', 'help'])
const ROOT_SUBCOMMANDS = new Set(['benchmark', 'clear', 'kill', 'list', 'ls', 'plugin', 'report', 'run', 'stop'])

export const normalizeCliArgs = (args: string[]) => {
  const [firstArg] = args

  if (firstArg == null) return ['run']
  if (ROOT_ONLY_ARGS.has(firstArg)) return args
  if (!firstArg.startsWith('-') && ROOT_SUBCOMMANDS.has(firstArg)) return args

  return ['run', ...args]
}
