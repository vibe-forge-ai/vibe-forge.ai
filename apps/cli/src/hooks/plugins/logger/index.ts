import { definePlugin } from '@vibe-forge/core/hooks'

export const logger = definePlugin({
  name: 'logger',
  SessionStart: ({ logger }, input, next) => {
    logger.info(input)
    return next()
  },
  UserPromptSubmit: ({ logger }, input, next) => {
    logger.info(input)
    return next()
  },
  PreToolUse: ({ logger }, input, next) => {
    logger.info(input.toolName, input.toolInput)
    return next()
  },
  PostToolUse: ({ logger }, input, next) => {
    switch (input.toolName) {
      case 'Bash':
        logger.info(
          input.toolName,
          input.toolInput.description,
          '\n```text\n' +
            `isImage: ${input.toolResponse?.isImage ?? ''}\n` +
            `interrupted: ${input.toolResponse?.interrupted ?? ''}\n` +
            `> ${input.toolInput.command}\n\n` +
            `stdout: ${input.toolResponse?.stdout ?? '<no stdout>'}\n` +
            '-----------------------------------------\n' +
            `stderr: ${input.toolResponse?.stderr ?? '<no stderr>'}\n` +
            '\n```'
        )
        break
      default:
        logger.info(input.toolName, {
          args: input.toolInput,
          resp: input.toolResponse ?? {}
        })
    }
    return next()
  },
  Stop: ({ logger }, input, next) => {
    logger.info(input)
    return next()
  },
  SessionEnd: ({ logger }, input, next) => {
    logger.info(input)
    return next()
  },
  PreCompact: ({ logger }, input, next) => {
    logger.info(input)
    return next()
  },
  Notification: ({ logger }, input, next) => {
    logger.info(input)
    return next()
  },
  SubagentStop: ({ logger }, input, next) => {
    logger.info(input)
    return next()
  }
})
