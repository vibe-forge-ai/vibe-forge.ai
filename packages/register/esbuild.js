const Module = require('node:module')
const path = require('node:path')
const process = require('node:process')

const isRelativeOrAbsoluteRequest = (request) => (
  typeof request === 'string' &&
  (
    request.startsWith('./') ||
    request.startsWith('../') ||
    path.isAbsolute(request)
  )
)

const isDirectModuleNotFound = (error, request) => (
  error != null &&
  typeof error === 'object' &&
  error.code === 'MODULE_NOT_FOUND' &&
  typeof error.message === 'string' &&
  error.message.includes(`'${request}'`)
)

const originalResolveFilename = Module._resolveFilename

Module._resolveFilename = function patchedResolveFilename(request, parent, isMain, options) {
  try {
    return originalResolveFilename.call(this, request, parent, isMain, options)
  } catch (error) {
    if (!isDirectModuleNotFound(error, request)) {
      throw error
    }

    if (!isRelativeOrAbsoluteRequest(request) || !request.endsWith('.js')) {
      throw error
    }

    const stem = request.slice(0, -3)
    const candidates = [
      `${stem}.ts`,
      `${stem}.tsx`,
      `${stem}.mts`,
      `${stem}.cts`
    ]

    for (const candidate of candidates) {
      try {
        return originalResolveFilename.call(this, candidate, parent, isMain, options)
      } catch (candidateError) {
        if (!isDirectModuleNotFound(candidateError, candidate)) {
          throw candidateError
        }
      }
    }

    throw error
  }
}

require('esbuild-register/dist/node.js').register({
  target: `node${process.version.slice(1)}`,
  hookIgnoreNodeModules: false
})
