export const APP_HELP_TEXT = `Usage: vibe-forge-bootstrap app [cache] [--no-cache]

Launch the Vibe Forge desktop app.

Options:
  cache       Force launch from the bootstrap cache and remember the choice
  --no-cache  Force launch from the user install location and remember the choice
  --debug     Print bootstrap routing and launch details
  -h, --help  Show app help
`

export const BOOTSTRAP_HELP_TEXT = `
Top-level flags:
  --help, -h     Show bootstrap help
  --debug        Print bootstrap routing and launch details
  --version, -V  Print bootstrap version

Examples:
  npx @vibe-forge/bootstrap run "summarize the repo"
  npx @vibe-forge/bootstrap web --port 8787
  npx @vibe-forge/bootstrap server --host 0.0.0.0 --allow-cors
  npx @vibe-forge/bootstrap app
  npx @vibe-forge/bootstrap app cache
  npx @vibe-forge/bootstrap app --no-cache
`

export const extractBootstrapFlags = (args: string[]) => {
  let debug = false
  const forwardedArgs = args.filter((arg) => {
    if (arg !== '--debug') {
      return true
    }

    debug = true
    return false
  })

  return {
    debug,
    forwardedArgs
  }
}
