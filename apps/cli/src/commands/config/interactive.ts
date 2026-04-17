import process from 'node:process'
import { createInterface } from 'node:readline/promises'

import type { ConfigSource } from '@vibe-forge/types'

import { CONFIG_SET_SOURCES, isInteractiveTerminal } from './shared'
import type { ConfigValueType } from './shared'

const readAllStdin = async () =>
  await new Promise<string>((resolve, reject) => {
    const chunks: string[] = []
    process.stdin.setEncoding('utf8')
    process.stdin.on('data', chunk => chunks.push(String(chunk)))
    process.stdin.once('end', () => resolve(chunks.join('')))
    process.stdin.once('error', reject)
  })

const promptSelect = async <TValue extends string>(params: {
  question: string
  choices: readonly TValue[]
  defaultValue: TValue
}) => {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout
  })

  try {
    while (true) {
      console.log(params.choices.map((choice, index) => `  ${index + 1}. ${choice}`).join('\n'))
      const answer = (await rl.question(`${params.question} [${params.defaultValue}]: `)).trim()
      if (answer === '') {
        return params.defaultValue
      }

      const matchedChoice = params.choices.find(choice => choice === answer)
      if (matchedChoice != null) {
        return matchedChoice
      }

      const index = Number.parseInt(answer, 10)
      if (Number.isInteger(index) && index >= 1 && index <= params.choices.length) {
        return params.choices[index - 1]!
      }

      console.log('Please choose one of the listed values.')
    }
  } finally {
    rl.close()
  }
}

const promptText = async (question: string) => {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout
  })

  try {
    return (await rl.question(question)).trim()
  } finally {
    rl.close()
  }
}

export const resolveWritableSource = async (
  source: ConfigSource | undefined,
  json: boolean | undefined
) => {
  if (source != null) return source
  if (json || !isInteractiveTerminal()) return 'project'

  return await promptSelect({
    question: 'Write target',
    choices: CONFIG_SET_SOURCES,
    defaultValue: 'project'
  })
}

export const resolveSetPathInput = async (
  pathInput: string | undefined,
  json: boolean | undefined
) => {
  if (pathInput != null) return pathInput
  if (json || !isInteractiveTerminal()) {
    throw new TypeError('Config path is required for set.')
  }

  const prompted = await promptText(
    'Config path (examples: general.defaultModel, general.permissions, ["models","gpt-4.1","title"]): '
  )
  if (prompted === '') {
    throw new TypeError('Config path is required for set.')
  }
  return prompted
}

export const resolveSetValueInput = async (
  valueInput: string | undefined,
  type: ConfigValueType,
  json: boolean | undefined
) => {
  if (valueInput != null) return valueInput

  if (!process.stdin.isTTY) {
    const stdinValue = await readAllStdin()
    if (stdinValue !== '') {
      return stdinValue
    }
  }

  if (type === 'null') {
    return undefined
  }

  if (json || !isInteractiveTerminal()) {
    throw new TypeError('Config value is required. Pass it as an argument or pipe it via stdin.')
  }

  return await promptText(`Config value (${type === 'auto' ? 'auto' : type} parse mode): `)
}
