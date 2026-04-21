# 桌面签名与发布

返回入口：[desktop.md](./desktop.md)

## 发布策略

桌面应用的正式发布 tag 固定使用 `desktop-v` 前缀，例如：

```bash
git tag desktop-v0.1.0
git push origin desktop-v0.1.0
```

只有 `desktop-v*` tag，或手动触发工作流时填写 `desktop-v*` 格式的 `release_tag`，才会创建桌面 GitHub Release。普通 `v*` tag 不会发布 Electron 安装包。

tag 中 `desktop-v` 后面的部分会作为桌面应用版本号传入打包流程，例如 `desktop-v0.2.0-beta.1` 会生成版本 `0.2.0-beta.1` 的安装包。

自动更新只面向稳定桌面 release：

- PR、master push、本地默认打包只产出测试安装包，不内置更新配置。
- `desktop-v*` release 只有在 Repository variable `DESKTOP_AUTO_UPDATE=true` 时才内置 `app-update.yml`。
- 建议等 macOS / Windows 签名证书配置完成后，再开启 `DESKTOP_AUTO_UPDATE=true`。
- GitHub provider 会读取 GitHub 的 Latest release；CI 会把 `desktop-v*` release 标记为 Latest。若同一仓库还有非桌面 release，不要让非桌面 release 覆盖 Latest，否则桌面自动更新可能找不到 `latest*.yml`。

## macOS 证书

macOS 站外分发需要 Developer ID Application 证书和 Apple notarization。Apple 官方说明：站外分发的 app 需要 Developer ID 证书让 Gatekeeper 验证开发者身份，并建议提交 notarization；证书可以从 Xcode 或 Apple Developer 的 Certificates, Identifiers & Profiles 创建，但 Account Holder 才能创建 Developer ID 证书。

准备路径：

1. 加入 Apple Developer Program。
2. 用 Account Holder 账号登录 Apple Developer。
3. 进入 Certificates, Identifiers & Profiles。
4. 创建 `Developer ID Application` 证书。
5. 在本机 Keychain Access 生成 CSR，上传后下载证书并安装到 Keychain。
6. 在 Keychain 中导出证书和私钥为 `.p12`，设置一个强密码。
7. 在 GitHub repository secrets / variables 中配置：

```text
Repository variable:
DESKTOP_SIGN=true

Repository secrets:
DESKTOP_CSC_LINK=<base64 后的 .p12，或 electron-builder 可读取的证书 URL>
DESKTOP_CSC_KEY_PASSWORD=<导出 .p12 时设置的密码>
APPLE_ID=<Apple ID 邮箱>
APPLE_ID_PASSWORD=<Apple app-specific password>
APPLE_TEAM_ID=<Apple Team ID>
```

本机验证可以先用：

```bash
security find-identity -v -p codesigning
VF_DESKTOP_SIGN=true pnpm desktop:make
```

GitHub Secret 中如果使用 base64：

```bash
base64 -i DeveloperIDApplication.p12 | pbcopy
```

## Windows 证书

Windows 需要代码签名证书，否则 SmartScreen 和企业安全策略会更容易拦截安装包。Microsoft 当前推荐 Azure Artifact Signing；传统方式是从受信任 CA 购买 OV / EV Code Signing certificate，再用 SignTool 或 electron-builder 签名。

当前 CI 已经支持传统 PFX 方式：

```text
Repository variable:
DESKTOP_SIGN=true

Repository secrets:
DESKTOP_CSC_LINK=<base64 后的 .pfx/.p12，或 electron-builder 可读取的证书 URL>
DESKTOP_CSC_KEY_PASSWORD=<证书密码>
```

购买路径：

- DigiCert、Sectigo、GlobalSign、SSL.com 等 CA 购买 OV / EV Code Signing certificate。
- 购买时确认是否能导出为 CI 可用的 PFX / P12，或者是否只能用硬件 token / 云签名。
- 如果证书只能在硬件 token 中使用，GitHub-hosted runner 通常不好直接使用，需要自建 Windows runner 或接入云签名服务。

Microsoft 推荐路径：

- 使用 Azure Artifact Signing 创建签名账号和 certificate profile。
- Windows runner 安装 SignTool、.NET 8 Runtime、Artifact Signing Client Tools。
- 用 SignTool 的 Artifact Signing dlib 对 `.exe`、`.dll`、installer 产物签名。

Azure Artifact Signing 更适合 CI，但当前仓库还没有接入这个签名插件。如果确定走这条路，需要新增 Windows 签名脚本 / GitHub Action，不能只填 `DESKTOP_CSC_LINK`。

## 参考

- Apple Developer: https://developer.apple.com/developer-id/
- Apple Notarization: https://developer.apple.com/documentation/security/notarizing-macos-software-before-distribution
- Microsoft Smart App Control signing: https://learn.microsoft.com/en-us/windows/apps/develop/smart-app-control/code-signing-for-smart-app-control
- Azure Artifact Signing integration: https://learn.microsoft.com/en-us/azure/artifact-signing/how-to-signing-integrations
