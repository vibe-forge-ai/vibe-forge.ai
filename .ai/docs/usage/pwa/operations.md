# PWA 安装、验证与排查

返回入口：[PWA 与独立部署](../pwa.md)

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

## 连接与登录态

安装后的 PWA 会沿用同一 origin 下保存的后端地址和登录 token。如果要切换后端，可以在登录页使用“更换后端服务”，也可以进入应用后从“账号与连接”菜单重置后端地址。退出当前连接登录也在同一个菜单里。

连接页会保留连接成功的后端服务列表，不限制数量。每个服务可以设置别名和介绍，列表里会显示该服务在当前浏览器中是否保存了登录态。

更换后端时只清除当前选中的后端地址，不会清除各服务已保存的登录态；只有退出当前连接登录、或在服务管理中清除该服务登录态时，才会清掉对应服务的登录 token。

移动端打开键盘时，Web UI 会根据浏览器的 visual viewport 调整可视高度和底部留白，避免登录框、后端地址输入框和聊天输入框被键盘遮挡。

## 版本兼容

独立 client 在连接后端前会先读取：

```text
<server-base-url>/api/auth/status
```

然后按 semver 规则确认兼容性：

- `1.x` 之间视为兼容。
- `0.x` 要求 minor 相同。
- 预发布版本要求 client 和 server 的完整预发布标识一致。

不兼容或旧后端没有返回版本号时，连接页会直接提示“不支持这个后端版本”。连接成功后，服务列表会记录并展示对应后端版本号。

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
