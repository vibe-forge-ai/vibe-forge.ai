/* eslint-disable max-lines -- the inline selector document keeps markup, styles, and renderer logic synchronized. */
const escapeHtml = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

const createWorkspaceSelectorHtml = ({ errorMessage, mode = 'initial' } = {}) => {
  const title = mode === 'dialog' ? 'Switch Project' : 'Choose a Project'
  const subtitle = mode === 'dialog'
    ? 'Open another running project, reopen something recent, or pick a folder.'
    : 'Pick a recent project or choose a folder to keep going.'

  return `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <style>
      :root {
        color-scheme: light dark;
        --bg-color: #10131a;
        --panel-color: rgba(22, 28, 38, 0.94);
        --border-color: rgba(148, 163, 184, 0.22);
        --text-color: #f8fafc;
        --sub-text-color: #cbd5e1;
        --muted-text-color: #94a3b8;
        --accent-color: #38bdf8;
        --button-bg-color: #0f172a;
        --button-hover-color: rgba(56, 189, 248, 0.18);
        --badge-bg-color: rgba(56, 189, 248, 0.16);
        --badge-text-color: #bae6fd;
        --empty-bg-color: rgba(15, 23, 42, 0.72);
        --error-bg-color: rgba(239, 68, 68, 0.14);
        --error-border-color: rgba(239, 68, 68, 0.26);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }

      @media (prefers-color-scheme: light) {
        :root {
          --bg-color: #f3f7fb;
          --panel-color: rgba(255, 255, 255, 0.96);
          --border-color: rgba(15, 23, 42, 0.12);
          --text-color: #0f172a;
          --sub-text-color: #334155;
          --muted-text-color: #64748b;
          --accent-color: #0284c7;
          --button-bg-color: #ffffff;
          --button-hover-color: rgba(2, 132, 199, 0.12);
          --badge-bg-color: rgba(2, 132, 199, 0.12);
          --badge-text-color: #075985;
          --empty-bg-color: rgba(226, 232, 240, 0.6);
          --error-bg-color: rgba(254, 226, 226, 0.92);
          --error-border-color: rgba(239, 68, 68, 0.18);
        }
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        min-height: 100vh;
        background:
          radial-gradient(circle at top left, rgba(56, 189, 248, 0.18), transparent 36%),
          linear-gradient(180deg, rgba(15, 23, 42, 0.18), transparent 34%),
          var(--bg-color);
        color: var(--text-color);
      }

      main {
        width: min(720px, 100%);
        margin: 0 auto;
        padding: 28px 20px 20px;
      }

      h1 {
        margin: 0 0 8px;
        font-size: clamp(30px, 4vw, 38px);
        line-height: 1.1;
      }

      .subtitle {
        margin: 0;
        color: var(--sub-text-color);
        line-height: 1.6;
      }

      .panel {
        margin-top: 22px;
        padding: 18px;
        border: 1px solid var(--border-color);
        border-radius: 8px;
        background: var(--panel-color);
        backdrop-filter: blur(10px);
      }

      .error {
        display: none;
        margin-bottom: 16px;
        padding: 10px 12px;
        border: 1px solid var(--error-border-color);
        border-radius: 8px;
        background: var(--error-bg-color);
        color: var(--text-color);
        font-size: 14px;
        line-height: 1.5;
      }

      .error.is-visible {
        display: block;
      }

      .actions {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        margin-top: 18px;
      }

      .primary-button,
      .secondary-button {
        min-height: 42px;
        border-radius: 8px;
        padding: 0 14px;
        border: 1px solid var(--border-color);
        background: var(--button-bg-color);
        color: var(--text-color);
        font: inherit;
        cursor: pointer;
        transition: border-color .18s ease, background-color .18s ease, transform .18s ease;
      }

      .primary-button:hover,
      .secondary-button:hover {
        border-color: var(--accent-color);
        background: var(--button-hover-color);
        transform: translateY(-1px);
      }

      .primary-button {
        background: color-mix(in srgb, var(--accent-color) 18%, var(--button-bg-color));
      }

      section + section {
        margin-top: 20px;
      }

      h2 {
        margin: 0 0 10px;
        color: var(--sub-text-color);
        font-size: 13px;
        font-weight: 600;
        letter-spacing: 0;
        text-transform: uppercase;
      }

      .list {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .item-button {
        width: 100%;
        min-height: 68px;
        padding: 12px 14px;
        border: 1px solid var(--border-color);
        border-radius: 8px;
        background: transparent;
        color: inherit;
        text-align: left;
        cursor: pointer;
        transition: border-color .18s ease, background-color .18s ease, transform .18s ease;
      }

      .item-button:hover {
        border-color: var(--accent-color);
        background: var(--button-hover-color);
        transform: translateY(-1px);
      }

      .item-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
      }

      .item-name {
        font-size: 14px;
        font-weight: 600;
        line-height: 1.4;
      }

      .item-path {
        margin-top: 4px;
        color: var(--muted-text-color);
        font-size: 12px;
        line-height: 1.5;
        word-break: break-all;
      }

      .badge {
        flex-shrink: 0;
        padding: 2px 8px;
        border-radius: 999px;
        background: var(--badge-bg-color);
        color: var(--badge-text-color);
        font-size: 11px;
        line-height: 1.4;
      }

      .empty {
        padding: 14px;
        border-radius: 8px;
        background: var(--empty-bg-color);
        color: var(--muted-text-color);
        font-size: 13px;
        line-height: 1.6;
      }

      @media (max-width: 640px) {
        main {
          padding: 20px 14px 16px;
        }

        .panel {
          padding: 14px;
        }

        .actions {
          flex-direction: column;
        }

        .primary-button,
        .secondary-button {
          width: 100%;
        }
      }
    </style>
  </head>
  <body>
    <main>
      <h1>${escapeHtml(title)}</h1>
      <p class="subtitle">${escapeHtml(subtitle)}</p>

      <div class="panel">
        <div id="error" class="error" role="alert"></div>

        <section aria-labelledby="running-projects-title">
          <h2 id="running-projects-title">Running Projects</h2>
          <div id="running-projects" class="list"></div>
        </section>

        <section aria-labelledby="recent-projects-title">
          <h2 id="recent-projects-title">Recent Projects</h2>
          <div id="recent-projects" class="list"></div>
        </section>

        <div class="actions">
          <button type="button" id="browse-button" class="primary-button">Open Folder...</button>
        </div>
      </div>
    </main>

    <script>
      (() => {
        const errorElement = document.getElementById('error')
        const runningProjectsElement = document.getElementById('running-projects')
        const recentProjectsElement = document.getElementById('recent-projects')
        const browseButton = document.getElementById('browse-button')

        const clearNode = (node) => {
          while (node.firstChild) {
            node.removeChild(node.firstChild)
          }
        }

        const setError = (message) => {
          const normalizedMessage = typeof message === 'string' ? message.trim() : ''
          if (normalizedMessage === '') {
            errorElement.textContent = ''
            errorElement.classList.remove('is-visible')
            return
          }

          errorElement.textContent = normalizedMessage
          errorElement.classList.add('is-visible')
        }

        const createProjectButton = (project, badgeLabel) => {
          const button = document.createElement('button')
          button.type = 'button'
          button.className = 'item-button'
          button.dataset.workspace = project.workspaceFolder

          const header = document.createElement('div')
          header.className = 'item-header'

          const name = document.createElement('span')
          name.className = 'item-name'
          name.textContent = project.name
          header.appendChild(name)

          if (badgeLabel != null && badgeLabel !== '') {
            const badge = document.createElement('span')
            badge.className = 'badge'
            badge.textContent = badgeLabel
            header.appendChild(badge)
          }

          const path = document.createElement('div')
          path.className = 'item-path'
          path.textContent = project.description

          button.appendChild(header)
          button.appendChild(path)
          return button
        }

        const renderProjectSection = (node, projects, emptyMessage, badgeResolver) => {
          clearNode(node)
          if (!Array.isArray(projects) || projects.length === 0) {
            const empty = document.createElement('div')
            empty.className = 'empty'
            empty.textContent = emptyMessage
            node.appendChild(empty)
            return
          }

          for (const project of projects) {
            node.appendChild(createProjectButton(project, badgeResolver(project)))
          }
        }

        const renderState = (state) => {
          renderProjectSection(
            runningProjectsElement,
            state?.runningProjects,
            'No local project services are running yet.',
            (project) => (
              project.isCurrent
                ? 'Current Window'
                : project.status === 'starting'
                  ? 'Starting'
                  : project.status === 'stopping'
                    ? 'Stopping'
                  : 'Running'
            )
          )
          renderProjectSection(
            recentProjectsElement,
            state?.recentProjects,
            'Open a folder once and it will show up here for next time.',
            () => ''
          )
        }

        const openWorkspace = async (workspaceFolder) => {
          try {
            setError('')
            await window.vibeForgeDesktop.openWorkspace(workspaceFolder)
          } catch (error) {
            setError(error instanceof Error ? error.message : String(error))
          }
        }

        document.addEventListener('click', (event) => {
          const target = event.target instanceof HTMLElement ? event.target.closest('[data-workspace]') : null
          if (!(target instanceof HTMLElement)) {
            return
          }

          const workspaceFolder = target.dataset.workspace
          if (typeof workspaceFolder === 'string' && workspaceFolder.trim() !== '') {
            void openWorkspace(workspaceFolder)
          }
        })

        browseButton.addEventListener('click', () => {
          void window.vibeForgeDesktop.chooseWorkspace()
            .then(selectedWorkspace => {
              if (typeof selectedWorkspace === 'string' && selectedWorkspace.trim() !== '') {
                return openWorkspace(selectedWorkspace)
              }
              return undefined
            })
            .catch(error => {
              setError(error instanceof Error ? error.message : String(error))
            })
        })

        window.vibeForgeDesktop.onWorkspaceSelectorStateChange(renderState)
        void window.vibeForgeDesktop.getWorkspaceSelectorState()
          .then(renderState)
          .catch(error => {
            setError(error instanceof Error ? error.message : String(error))
          })
        setError(${JSON.stringify(typeof errorMessage === 'string' ? errorMessage : '')})
      })()
    </script>
  </body>
</html>
`
}

module.exports = {
  createWorkspaceSelectorHtml
}
