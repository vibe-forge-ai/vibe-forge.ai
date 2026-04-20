# PWA 与独立部署

返回入口：[index.md](../index.md)

Vibe Forge Web 可以作为普通 Web UI 使用，也可以把 client 单独构建成静态 PWA，部署到 GitHub Pages、对象存储、CDN 或其他静态站点，再让用户在首次打开时填写后端服务地址。

## 适用场景

- 同源部署：server 直接托管 Web UI，用户访问 `/ui`。这是最省心的模式，前后端同源，不需要额外处理浏览器跨域和 HTTPS 混合内容。
- 独立部署：client 部署到静态站点，后端单独运行。用户首次打开页面时输入后端地址，例如 `https://<machine>.<tailnet>.ts.net` 或 `https://vf-api.example.com`。
- 移动端 PWA：用户可以把页面安装到桌面或主屏幕。浏览器通常要求页面运行在安全上下文中，也就是 `https://` 或本机 `localhost`。

独立部署时，后端会允许跨域请求，并通过登录返回的 bearer token 继续完成 HTTP 与 WebSocket 鉴权。即便如此，公开可访问的后端仍然必须开启 `webAuth`，并建议再叠加网络层访问控制。

## 构建 client

独立部署构建：

```bash
__VF_PROJECT_AI_CLIENT_MODE__=standalone pnpm --filter @vibe-forge/client exec vite build
```

如果部署到 GitHub Pages 的项目站点，例如 `https://<github-user>.github.io/<repo-name>/`，需要把 client base 设置为仓库路径：

```bash
__VF_PROJECT_AI_CLIENT_MODE__=standalone \
__VF_PROJECT_AI_CLIENT_BASE__=/<repo-name>/ \
pnpm --filter @vibe-forge/client exec vite build
```

构建产物在 `apps/client/dist/`。部署静态站点时要保留根目录下这些 PWA 文件：

- `index.html`
- `manifest.webmanifest`
- `sw.js`
- `pwa-icon-192.png`
- `pwa-icon-512.png`

Service Worker 只在生产构建中注册；本地 dev 模式会主动避免缓存干扰。

独立 client 构建时会把 client 版本号和构建 commit 写入前端产物。“设置 -> 关于”会展示 client 版本与 server 版本；双击 client 版本号可以显示构建 commit hash，方便确认手机上的 PWA 是否已经更新到预期版本。

## 启动后端

如果后端只给本机 tunnel 或反向代理使用，可以绑定到本机：

```bash
npx @vibe-forge/server --host 127.0.0.1 --port 8787
```

如果需要同一个局域网内的其他设备直接访问，可以绑定到所有网卡：

```bash
npx @vibe-forge/server --host 0.0.0.0 --port 8787 --allow-cors
```

对外访问时建议显式配置登录账号：

```bash
__VF_PROJECT_AI_WEB_AUTH_USERNAME=admin \
__VF_PROJECT_AI_WEB_AUTH_PASSWORD=<strong-password> \
npx @vibe-forge/server --host 0.0.0.0 --port 8787 --allow-cors
```

也可以把账号写入项目配置的 `webAuth.accounts`，避免在 shell 历史里留下密码。

## 后端地址方案

### 同源 server 托管

访问 server 自带的 `/ui`：

```text
http://localhost:8787/ui/
```

适合本机开发、内网工具或不需要静态站点独立发布的场景。前后端同源，不会遇到跨域、cookie、混合内容和 WebSocket 协议切换问题。

### 局域网 HTTP

后端绑定到 `0.0.0.0` 后，手机或其他设备可以填写：

```text
http://<lan-ip>:8787
```

这个方案适合快速验证，但不适合作为 GitHub Pages 等 HTTPS 前端的后端地址。HTTPS 页面访问 HTTP 后端时，浏览器可能因为混合内容、私有网络访问限制或 `ws://` WebSocket 限制而拦截请求。

### Tailscale Serve

适合“手机、电脑、平板都在自己的私有 tailnet 里”的个人或小团队场景。后端不公开到公网，只允许 tailnet 内设备访问。

先确认 server 正在本机运行，然后执行：

```bash
tailscale serve --bg --https=443 localhost:8787
```

用户在独立 PWA 中填写：

```text
https://<machine-name>.<tailnet-name>.ts.net
```

常用检查命令：

```bash
tailscale status
tailscale ping <peer-device-name>
tailscale serve status
```

停止 Serve：

```bash
tailscale serve --https=443 off
```

### Cloudflare Tunnel

适合需要稳定公网 HTTPS 域名，但后端机器没有公网 IP 或不想开放入站端口的场景。

临时测试可以使用 quick tunnel：

```bash
cloudflared tunnel --url http://localhost:8787
```

它会生成一个随机 `https://<random>.trycloudflare.com` 地址。这个地址适合短期调试，不适合固定给用户长期使用。

长期使用建议创建命名 tunnel，并把一个域名映射到本机服务：

```text
https://vf-api.example.com -> http://localhost:8787
```

Cloudflare Tunnel 暴露的是公网入口。除了 Vibe Forge 自身的 `webAuth`，建议再使用 Cloudflare Access、IP allowlist 或其他身份校验。

### ngrok

适合快速拿到一个公网 HTTPS 地址，或临时分享给不在同一私有网络里的设备。

示例：

```bash
ngrok http 8787
```

如果已经有固定域名或保留域名，可以绑定到固定地址：

```bash
ngrok http 8787 --url https://vf-api.example.ngrok.app
```

用户在独立 PWA 中填写 ngrok 提供的 `https://...` 地址。和 Cloudflare Tunnel 一样，这属于公网入口，应开启 `webAuth` 并控制可访问人群。

### 自有域名与本地 HTTPS

如果你有自己的域名，可以把后端做成：

```text
https://vf-api.example.com
```

常见做法：

- 用 Caddy、Nginx 或 Traefik 反向代理到 `http://localhost:8787`。
- 如果服务有公网入口，使用 ACME / Let's Encrypt 自动签发证书。
- 如果只在内网使用，可以用 `mkcert` 生成本地受信证书，并把本地 CA 安装到每台客户端设备。

内网自签证书最容易踩坑：证书域名、DNS 解析、手机系统信任根证书都要同时正确。它适合长期内网环境，不如 Tailscale Serve 省事。

## GitHub Pages 部署建议

GitHub Pages 可以托管独立 client。官方 PWA 部署由 `vibe-forge-ai/pwa` 仓库维护，访问地址是 `https://vibe-forge-ai.github.io/pwa/`。

主仓库 `master` 出现 client 相关更新后，会触发 `vibe-forge-ai/pwa` 重新构建并发布自己的 `gh-pages`。主仓库的 `gh-pages` 不再承载 PWA，后续主要用于项目文档站。fork 或私有部署仍可使用 `https://<github-user>.github.io/<repo-name>/` 这类项目站点形态。

用户首次打开后端地址时，优先填写 HTTPS 地址：

```text
https://<machine-name>.<tailnet-name>.ts.net
https://vf-api.example.com
https://vf-api.example.ngrok.app
https://<random>.trycloudflare.com
```

不要把 GitHub Pages 上的 HTTPS 前端长期连到 `http://<lan-ip>:8787`。即使某些浏览器或测试环境暂时可用，也很容易在手机、安装后的 PWA、WebSocket 或浏览器安全策略更新后失效。

## 安装、验证与排查

继续阅读：[安装、验证与排查](./pwa/operations.md)，包括 Android / iOS 安装、桌面快捷方式权限、连接历史、登录态管理、键盘遮挡、版本兼容、连通性检查和安全建议。
