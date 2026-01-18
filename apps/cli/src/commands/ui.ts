import { Command } from 'commander'
import { spawn } from 'node:child_process'

export function registerUiCommand(program: Command) {
  program
    .command('ui')
    .description('启动 Web UI 与 Server')
    .option('--cli-path <path>', 'Claude Code CLI 可执行路径')
    .option('--config-path <path>', 'Claude Code CLI 配置文件路径')
    .option('--server-port <port>', 'Server 端口', '8787')
    .option('--ws-path <path>', 'WebSocket 路径', '/ws')
    .option('--projects-root <dir>', '项目根目录', 'projects')
    .option('--data-dir <dir>', '数据目录', '.data')
    .option('--log-level <level>', '日志级别', 'info')
    .option('--vite-port <port>', 'Web 端口', '5173')
    .option('--host <host>', '绑定主机地址', 'localhost')
    .action((opts) => {
      const serverEnv = {
        ...process.env,
        SERVER_PORT: String(opts.serverPort),
        SERVER_HOST: String(opts.host),
        WS_PATH: String(opts.wsPath),
        PROJECTS_ROOT: String(opts.projectsRoot),
        DATA_DIR: String(opts.dataDir),
        LOG_LEVEL: String(opts.logLevel),
        CLAUDE_CODE_CLI_PATH: opts.cliPath ?? process.env.CLAUDE_CODE_CLI_PATH,
        CLAUDE_CODE_CONFIG_PATH: opts.configPath ?? process.env.CLAUDE_CODE_CONFIG_PATH
      }

      const viteEnv = {
        ...process.env,
        VITE_PORT: String(opts.vitePort),
        VITE_SERVER_HOST: String(opts.host),
        VITE_SERVER_PORT: String(opts.serverPort),
        VITE_SERVER_WS_PATH: String(opts.wsPath)
      }

      const server = spawn('pnpm', ['--filter', '@vibe-forge/server', 'dev'], {
        env: serverEnv,
        stdio: 'inherit'
      })

      const web = spawn('pnpm', ['--filter', '@vibe-forge/web', 'dev'], {
        env: viteEnv,
        stdio: 'inherit'
      })

      function shutdown(code = 0) {
        server.kill()
        web.kill()
        process.exit(code)
      }

      server.on('exit', (code) => {
        console.error(`[server] exited ${code}`)
        shutdown(code ?? 0)
      })
      web.on('exit', (code) => {
        console.error(`[web] exited ${code}`)
        shutdown(code ?? 0)
      })

      process.on('SIGINT', () => shutdown(0))
      process.on('SIGTERM', () => shutdown(0))
    })
}
