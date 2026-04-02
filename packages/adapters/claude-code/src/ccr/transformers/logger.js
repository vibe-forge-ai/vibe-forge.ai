const {
  writeRequestDebugLog
} = require('./log-context')

class LoggerTransformer {
  name = 'logger'

  transformRequestIn(request, provider, context) {
    writeRequestDebugLog('logger.js.log.md', 'request', request, context, request)
    return request
  }

  transformResponseOut(response, context) {
    writeRequestDebugLog('logger.js.log.md', 'response', response, context)
    return response
  }
}

module.exports = LoggerTransformer
