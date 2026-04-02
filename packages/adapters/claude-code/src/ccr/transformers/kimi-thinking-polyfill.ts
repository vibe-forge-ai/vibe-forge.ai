// @ts-nocheck
import { writeRequestDebugLog, writeResponseDebugLog } from './log-context'

class KimiThinkingPolyfillTransformer {
  name = 'kimi-thinking-polyfill'

  transformRequestIn(request, provider, context) {
    writeRequestDebugLog(
      'kimi-thinking-polyfill.js.log.md',
      'request',
      request,
      context,
      request
    )
    request.thinking = { type: 'disabled' }
    writeRequestDebugLog(
      'kimi-thinking-polyfill.js.log.md',
      'request resolved',
      request,
      context,
      request
    )
    return request
  }

  async transformResponseOut(response, context) {
    await writeResponseDebugLog(
      'kimi-thinking-polyfill.js.log.md',
      'response',
      response,
      context
    )
    return response
  }
}

module.exports = KimiThinkingPolyfillTransformer
