const {
  stripRequestLogContextMarker,
  writeRequestDebugLog
} = require('./log-context')

class KimiThinkingPolyfillTransformer {
  name = 'kimi-thinking-polyfill'

  transformRequestIn(request, provider, context) {
    stripRequestLogContextMarker(request, context)
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

  transformResponseOut(response, context) {
    writeRequestDebugLog(
      'kimi-thinking-polyfill.js.log.md',
      'response',
      response,
      context
    )
    return response
  }
}

module.exports = KimiThinkingPolyfillTransformer
