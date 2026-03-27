const fs = require('node:fs')
const path = require('node:path')
const process = require('node:process')

const writeDebugLog = (message, data = null) => {
  const timestamp = new Date().toISOString()
  try {
    const logMessage = data
      ? `# [${timestamp}] ${message}:\n` +
        '```json\n' +
        `${JSON.stringify(data, null, 2)}\n` +
        '```\n'
      : `# [${timestamp}] ${message}\n`

    const logPath = path.join(
      process.env.__VF_PROJECT_WORKSPACE_FOLDER__,
      '.ai',
      'logs',
      process.env.__VF_PROJECT_AI_CTX_ID__,
      process.env.__VF_PROJECT_AI_SESSION_ID__,
      'adapter-claude-code',
      'kimi-thinking-polyfill.js.log.md'
    )
    if (!fs.existsSync(logPath)) {
      fs.mkdirSync(path.dirname(logPath), { recursive: true })
    }

    fs.appendFileSync(logPath, logMessage)
  } catch (error) {
    fs.appendFileSync(
      path.join(__dirname, 'temp.log.md'),
      `# [${timestamp}] ${error}\n`
    )
    // 静默处理写入错误，避免影响正常流程
  }
}

class KimiThinkingPolyfillTransformer {
  name = 'kimi-thinking-polyfill'

  transformRequestIn(request) {
    writeDebugLog('request', request)
    request.thinking = { type: 'disabled' }
    writeDebugLog('request resolved', request)
    return request
  }

  transformResponseOut(response) {
    writeDebugLog('response', response)
    return response
  }
}

module.exports = KimiThinkingPolyfillTransformer
