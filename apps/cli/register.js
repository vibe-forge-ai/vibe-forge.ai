const path = require('node:path')
const process = require('node:process')

const packageRoot = path.resolve(__dirname)
const workspaceScopeSegment = `${path.sep}node_modules${path.sep}@vibe-forge${path.sep}`
const hookMatcher = (filename) =>
  filename.startsWith(packageRoot) || filename.includes(workspaceScopeSegment)

require('esbuild-register/dist/node.js').register({
  target: `node${process.version.slice(1)}`,
  hookIgnoreNodeModules: false,
  hookMatcher
})
