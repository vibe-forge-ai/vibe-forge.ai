# Vibe Forge VS Code Extension

This package is a thin VS Code shell for the existing Vibe Forge Web UI.

## Local Use

From the repository root:

```bash
pnpm -C apps/vscode-extension package
```

Run the extension from VS Code and open the Vibe Forge Activity Bar view, or execute `Vibe Forge: Open Workspace`.

The extension starts one local Vibe Forge server per selected workspace folder, disables local web auth, and opens the built client inside a VS Code sidebar webview. Multiple workspace folders can keep separate servers running while the sidebar shows the selected workspace.

The extension does not bundle or install Vibe Forge runtime packages. It searches the selected workspace `node_modules/.bin` and then the system `PATH` for `vfui-server` / `vibe-forge-ui-server`.

Install runtime packages in the project that you want to control:

```bash
pnpm add -D @vibe-forge/server @vibe-forge/client
```

## Settings

- `vibeForge.clientDistPath`: optional absolute path to a built `@vibe-forge/client` dist directory.
- `vibeForge.serverCommand`: optional `vfui-server` executable, command name, or wrapper command.

## Boundary

The extension does not duplicate client or server business logic. It only owns workspace selection, server process lifecycle, and the sidebar webview wrapper.
