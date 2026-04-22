# 发布步骤

返回入口：[RELEASE.md](../RELEASE.md)

## 发布前最小检查

- 把拟发布包列表收敛到最小范围，并能逐个说明为什么需要发版
- 跑目标包相关测试，不只看仓库全量状态
- 用 `pnpm tools publish-plan -- ...` 确认发布顺序和候选包
- 用 `npm view <pkg> version` 确认 registry 当前版本
- 用 `npm whoami` 确认 npm 登录态
- 在目标包目录执行 `npm pack --dry-run`

## 单包发布

1. 确认自上次发布以来存在应计入发版范围的变更
2. 区分 alpha / 正式版
3. 更新目标包 `package.json` 版本号
4. 补 `changelog/<version>/<package>.md`
5. 如有需要，更新锁文件或其他发布元数据
6. 执行发布前最小检查
7. 提交 release commit
8. 正式版应先合入默认分支，再执行发布
9. 发布成功后补 tag

## 整体发布

1. 明确纳入发布的 public workspace 包及其发版依据
2. 补 `changelog/<version>/readme.md`
3. 执行发布前最小检查
4. 提交 release commit
5. 执行整体发布
6. 发布成功后补整体 tag

## 发布中断

- 不要直接重跑整批发布命令
- 先逐包检查 registry 当前版本
- 已经在 registry 上出现目标版本的包，不要重复发布
- 分别核对 npm registry、远端分支和远端 tag，缺什么补什么

## CLI 发布后的 Homebrew tap 同步

`@vibe-forge/cli` 正式版发布成功并能通过 `npm view @vibe-forge/cli@<version>` 查到后，需要同步 Homebrew tap：

1. 更新 tap formula：

   ```bash
   pnpm tools homebrew-tap sync-cli --version <version>
   ```

2. 在 tap submodule 内格式检查、提交并推送：

   ```bash
   brew style infra/homebrew-tap/Formula/vibe-forge.rb
   git -C infra/homebrew-tap status
   git -C infra/homebrew-tap add Formula/vibe-forge.rb
   git -C infra/homebrew-tap commit -m "chore: update vibe-forge to <version>"
   git -C infra/homebrew-tap push origin main
   ```

3. 用正式 tap 路径验证并回到主仓库提交 submodule 指针：

   ```bash
   brew update
   brew audit --strict vibe-forge-ai/tap/vibe-forge
   brew reinstall --build-from-source vibe-forge-ai/tap/vibe-forge
   brew test vibe-forge-ai/tap/vibe-forge
   git add infra/homebrew-tap
   ```

4. 如本次 CLI 发布已经修复 npm bin shebang，删除 `Formula/vibe-forge.rb` 里的临时 `inreplace "cli.js"` 补丁，并随同 tap 更新一起提交。

注意：

- `sync-cli` 会从 npm tarball 计算真实 `sha256`，所以必须在 npm 包已经发布后执行。
- 只发 alpha / beta 时，除非明确要让 Homebrew 跟进预发布版本，否则不要更新 stable formula。

## CLI 发布后的 Windows 安装同步

`@vibe-forge/cli` 正式版发布成功并能通过 `npm view @vibe-forge/cli@<version>` 查到后，需要同步 Windows 安装资产：

1. 更新 Scoop manifest 和 winget manifest 模板：

   ```bash
   pnpm tools windows-install sync-cli --version <version>
   ```

2. 在 Scoop bucket submodule 内检查、提交并推送：

   ```bash
   git -C infra/windows/scoop-bucket status
   git -C infra/windows/scoop-bucket add bucket/vibe-forge.json
   git -C infra/windows/scoop-bucket commit -m "chore: update vibe-forge to <version>"
   git -C infra/windows/scoop-bucket push origin main
   ```

3. 如果本次发布了 Windows portable zip，用真实下载地址和 SHA256 重新同步 winget 模板：

   ```bash
   pnpm tools windows-install sync-cli \
     --version <version> \
     --winget-installer-url <windows-zip-url> \
     --winget-installer-sha256 <windows-zip-sha256>
   ```

4. 把 `infra/windows/winget/` 下的 manifest 模板复制到 `microsoft/winget-pkgs` fork 中对应版本目录，执行 `winget validate` 后提交 PR。也可以使用 `wingetcreate` 生成 / 更新 manifest，但需要保证 `PackageIdentifier` 仍为 `VibeForge.VibeForge`。

5. 回到主仓库提交 submodule 指针、winget 模板和一键安装脚本：

   ```bash
   git add infra/windows scripts/install-windows.ps1
   ```

注意：

- Scoop bucket 使用 npm tarball 作为下载源，`sync-cli` 会计算真实 tarball `sha256`。
- winget 公开安装依赖 `microsoft/winget-pkgs` 接受 manifest；未接受前，用户应使用 PowerShell 一键安装脚本或 Scoop。
