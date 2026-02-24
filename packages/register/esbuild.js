const process = require('node:process')

require('esbuild-register/dist/node.js').register({
  target: `node${process.version.slice(1)}`,
  hookIgnoreNodeModules: false
})
