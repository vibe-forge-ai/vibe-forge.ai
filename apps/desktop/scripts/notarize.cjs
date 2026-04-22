const path = require('node:path')

exports.default = async function notarizeMacApp(context) {
  if (context.electronPlatformName !== 'darwin') return

  const appleId = process.env.APPLE_ID
  const appleIdPassword = process.env.APPLE_ID_PASSWORD
  const teamId = process.env.APPLE_TEAM_ID
  if (!appleId || !appleIdPassword || !teamId) {
    console.log('[desktop] skipping notarization; APPLE_ID, APPLE_ID_PASSWORD, or APPLE_TEAM_ID is missing')
    return
  }

  const { notarize } = require('@electron/notarize')
  const appName = `${context.packager.appInfo.productFilename}.app`
  const appPath = path.join(context.appOutDir, appName)

  console.log(`[desktop] notarizing ${appPath}`)
  await notarize({
    appPath,
    appleId,
    appleIdPassword,
    teamId
  })
}
