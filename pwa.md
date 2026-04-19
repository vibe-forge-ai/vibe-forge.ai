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
__VF_PROJECT_AI_SERVER_HOST__=127.0.0.1 \
__VF_PROJECT_AI_SERVER_PORT__=8787 \
npx vfui-server
```

如果需要同一个局域网内的其他设备直接访问，可以绑定到所有网卡：

```bash
__VF_PROJECT_AI_SERVER_HOST__=0.0.0.0 \
__VF_PROJECT_AI_SERVER_PORT__=8787 \
npx vfui-server
```

对外访问时建议显式配置登录账号：

```bash
__VF_PROJECT_AI_WEB_AUTH_USERNAME=admin \
__VF_PROJECT_AI_WEB_AUTH_PASSWORD=<strong-password> \
npx vfui-server
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

GitHub Pages 可以托管独立 client。推荐形态：

```text
https://<github-user>.github.io/<repo-name>/
```

用户首次打开后端地址时，优先填写 HTTPS 地址：

```text
https://<machine-name>.<tailnet-name>.ts.net
https://vf-api.example.com
https://vf-api.example.ngrok.app
https://<random>.trycloudflare.com
```

不要把 GitHub Pages 上的 HTTPS 前端长期连到 `http://<lan-ip>:8787`。即使某些浏览器或测试环境暂时可用，也很容易在手机、安装后的 PWA、WebSocket 或浏览器安全策略更新后失效。

## 安装到手机

Android Chrome / Edge：

1. 打开独立 client URL。
2. 确认页面可以连接后端并登录。
3. 在浏览器菜单里选择“安装应用”或“添加到主屏幕”。

部分 Android 厂商系统会单独限制浏览器创建桌面快捷方式。比如 MIUI / HyperOS 上，如果安装流程看起来成功，但桌面或应用抽屉里找不到图标，通常需要给当前浏览器打开“桌面快捷方式”权限：

```text
设置 -> 应用管理 -> 浏览器应用 -> 权限管理 / 其他权限 -> 桌面快捷方式 -> 允许
```

也可以长按浏览器图标进入“应用信息”，再从“权限管理”或“其他权限”里开启同名权限。开启后建议删除已经半安装的 PWA，再重新从浏览器菜单安装一次。

如果仍然看不到图标，再检查桌面是否开启了“锁定桌面布局”、是否使用应用抽屉模式，以及是否开启了隐藏应用、第二空间或工作资料。

iOS Safari：

1. 用 Safari 打开独立 client URL。
2. 点击分享按钮。
3. 选择“添加到主屏幕”。

安装后的 PWA 会沿用同一 origin 下保存的后端地址和登录 token。如果要切换后端，可以在登录页使用“更换后端服务”，也可以进入应用后从“账号与连接”菜单重置后端地址。退出当前连接登录也在同一个菜单里。

连接页会保留连接成功的后端服务列表，不限制数量。每个服务可以设置别名和介绍，列表里会显示该服务在当前浏览器中是否保存了登录态。更换后端时只清除当前选中的后端地址，不会清除各服务已保存的登录态；只有退出当前连接登录、或在服务管理中清除该服务登录态时，才会清掉对应服务的登录 token。

移动端打开键盘时，Web UI 会根据浏览器的 visual viewport 调整可视高度和底部留白，避免登录框、后端地址输入框和聊天输入框被键盘遮挡。

独立 client 在连接后端前会先读取 `<server-base-url>/api/auth/status` 中的 server 版本，并按 semver 规则确认兼容性。`1.x` 之间视为兼容，`0.x` 要求 minor 相同；预发布版本要求 client 和 server 的完整预发布标识一致。不兼容或旧后端没有返回版本号时，连接页会直接提示“不支持这个后端版本”。连接成功后，服务列表会记录并展示对应后端版本号。

## 验证连通性

先在目标设备浏览器打开：

```text
<server-base-url>/api/auth/status
```

如果能看到包含 `success` 的 JSON，说明 HTTP API 可以访问。

再进入独立 client 页面，填写同一个 `<server-base-url>`。登录成功后，新建或进入会话，确认消息流和终端视图正常。WebSocket 默认路径是 `/ws`，独立 client 会根据后端地址自动把 `http` / `https` 转成 `ws` / `wss`。

排查顺序：

- `manifest.webmanifest` 和 `sw.js` 是否能从静态站点根路径访问。
- 静态站点是否使用 HTTPS。
- 后端地址是否使用 HTTPS。
- `<server-base-url>/api/auth/status` 是否能从同一设备浏览器打开。
- 后端是否开启 `webAuth`，账号密码是否正确。
- tunnel / VPN / 反向代理是否把 WebSocket 转发到 `/ws`。
- Android 上如果提示已安装但桌面没有图标，检查浏览器是否被系统禁止创建桌面快捷方式。

## 安全与隐私

- 文档、issue、截图和示例配置里不要写入真实邮箱、设备名、tailnet 名、家庭公网 IP、局域网 IP 或固定登录密码。
- 示例统一使用 `<machine-name>.<tailnet-name>.ts.net`、`vf-api.example.com`、`<lan-ip>`、`<repo-name>` 这类占位符。
- 独立部署会允许任意 Origin 访问后端，这是为了支持静态 client 部署；真正的访问边界应由 `webAuth`、tailnet ACL、Cloudflare Access、ngrok 访问控制或反向代理鉴权承担。
- 不要把没有认证的后端直接暴露到公网。

## 参考资料

- [GitHub Pages HTTPS](https://docs.github.com/en/pages/getting-started-with-github-pages/securing-your-github-pages-site-with-https)
- [Tailscale Serve](https://tailscale.com/docs/features/tailscale-serve)
- [Cloudflare Tunnel](https://developers.cloudflare.com/tunnel/setup/)
- [ngrok HTTP/S endpoints](https://ngrok.com/docs/universal-gateway/http)
- [mkcert](https://github.com/FiloSottile/mkcert)
