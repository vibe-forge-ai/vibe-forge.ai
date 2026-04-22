# Winget Manifest Templates

This directory keeps the Vibe Forge Windows Package Manager manifest templates.

The public `winget install --id VibeForge.VibeForge -e` path only works after the manifests are submitted to and accepted by `microsoft/winget-pkgs`.

## Release Flow

1. Publish `@vibe-forge/cli` to npm.
2. Publish a Windows portable zip release asset that contains `vf.cmd`, `vforge.cmd`, `vibe-forge.cmd`, and the installed CLI package payload.
3. Sync versions and installer metadata:

   ```bash
   pnpm tools windows-install sync-cli \
     --version <version> \
     --winget-installer-url <windows-zip-url> \
     --winget-installer-sha256 <windows-zip-sha256>
   ```

4. Copy these templates into the matching `manifests/v/VibeForge/VibeForge/<version>/` path in a fork of `microsoft/winget-pkgs`, then validate and submit the PR.

The Scoop bucket can be released before the winget PR is accepted.
