import process from 'node:process'
import { spawn } from 'node:child_process'
import type { Command } from 'commander'

interface UiOptions {
  cliPath?: string
  cliArgs?: string
  serverPort: string
  dataDir: string
  logLevel: string
  port: string
  host: string
}

export function registerUiCommand(program: Command) {
  program
    .command('ui')
    .description('启动 Web UI 与 Server')
    .option('--cli-path <path>', 'Claude Code CLI 可执行路径')
    .option('--cli-args <args>', 'Claude Code CLI 额外参数')
    .option('--server-port <port>', 'Server 端口', '8787')
    .option('--data-dir <dir>', '数据目录', '.data')
    .option('--log-level <level>', '日志级别', 'info')
    .option('--port <port>', 'Web 端口', '5173')
    .option('--host <host>', '绑定主机地址', 'localhost')
    .action((opts: UiOptions) => {
      const serverEnv = {
        ...process.env,
        SERVER_PORT: String(opts.serverPort),
        SERVER_HOST: String(opts.host),
        DATA_DIR: String(opts.dataDir),
        LOG_LEVEL: String(opts.logLevel),
        CLAUDE_CODE_CLI_PATH: opts.cliPath ?? process.env.CLAUDE_CODE_CLI_PATH,
        CLAUDE_CODE_CLI_ARGS: opts.cliArgs ?? process.env.CLAUDE_CODE_CLI_ARGS
      }

      const viteEnv = {
        ...process.env,
        VITE_PORT: String(opts.port),
        VITE_SERVER_HOST: String(opts.host),
        VITE_SERVER_PORT: String(opts.serverPort)
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
