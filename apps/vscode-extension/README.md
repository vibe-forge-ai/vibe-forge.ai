# Vibe Forge VS Code Extension

This package is a thin VS Code shell for the existing Vibe Forge Web UI.

## Preview

![Vibe Forge running in the VS Code right sidebar](https://raw.githubusercontent.com/vibe-forge-ai/vibe-forge.ai/master/.docs/zh-hans/vscode-extension-sidebar.png)

## Local Use

From the repository root:

```bash
pnpm -C apps/vscode-extension build
```

Run the extension from VS Code and open Vibe Forge from the right Secondary Side Bar, or execute `Vibe Forge: Open Workspace`.

The extension starts one local Vibe Forge server per selected workspace folder, disables local web auth, and opens the built client inside a VS Code right sidebar webview. Multiple workspace folders can keep separate servers running while the right sidebar shows the selected workspace.

The extension does not bundle or install Vibe Forge runtime packages. It searches the selected workspace `node_modules/.bin` and then the system `PATH` for `vfui-server` / `vibe-forge-ui-server`.

Install runtime packages in the project that you want to control:

```bash
pnpm add -D @vibe-forge/server @vibe-forge/client
```

## Settings

- `vibeForge.clientDistPath`: optional absolute path to a built `@vibe-forge/client` dist directory.
- `vibeForge.serverCommand`: optional `vfui-server` executable, command name, or wrapper command.

## Boundary

The extension does not duplicate client or server business logic. It only owns workspace selection, server process lifecycle, and the right sidebar webview wrapper.

## Release

Package a local VSIX:

```bash
pnpm -C apps/vscode-extension package
```

Publish from an existing VSIX:

```bash
VSCODE_EXTENSION_PUBLISHER=your-publisher-id VSCE_PAT=your-token \
pnpm -C apps/vscode-extension publish:vsix -- --packagePath ./vibe-forge-vscode-extension-v0.1.0.vsix
```

CI builds and uploads a VSIX artifact on VS Code extension changes. Tags that match `vscode-extension-v*` package the same VSIX, optionally publish it to Marketplace when `VSCODE_EXTENSION_PUBLISHER` and `VSCE_PAT` are configured, and attach it to a GitHub Release.
