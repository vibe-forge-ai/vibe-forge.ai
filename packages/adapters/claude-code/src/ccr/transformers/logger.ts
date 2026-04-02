// @ts-nocheck
import { writeRequestDebugLog, writeResponseDebugLog } from './log-context'

class LoggerTransformer {
  name = 'logger'

  transformRequestIn(request, provider, context) {
    writeRequestDebugLog('logger.js.log.md', 'request', request, context, request)
    return request
  }

  async transformResponseOut(response, context) {
    await writeResponseDebugLog('logger.js.log.md', 'response', response, context)
    return response
  }
}

module.exports = LoggerTransformer
