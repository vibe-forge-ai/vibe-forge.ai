# 环境准备

## 适用场景

- 你要开始调试 Lark channel，但还没确认本地 Chrome 和 Lark 页面是否满足自动化条件。
- 你怀疑脚本连不上 DevTools，或者页面明明开着但工具找不到目标 tab。

## 先确认三件事

1. Chrome 必须从冷启动开始带上 remote debugging 端口。
2. Lark messenger 页面必须已经登录，并停留在 `.../next/messenger`。
3. 调试要用独立 profile，避免和用户日常 Chrome 进程混用。

推荐启动方式：

```bash
'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' \
  --user-data-dir=/tmp/vf-chrome-debug-profile \
  --profile-directory='Default' \
  --remote-debugging-port=9222 \
  --no-first-run \
  --no-default-browser-check \
  --new-window \
  'https://example.larkoffice.com/next/messenger'
```

## 最小验收

- `http://127.0.0.1:9222/json/version` 可以访问。
- 页面已经完成登录，不停在扫码或跳转页。
- `pnpm tools chrome-debug targets` 能列出包含 `/next/messenger` 的 tab。

## 常见误区

- 复用已经打开的 Chrome 再追加 `--remote-debugging-port`，通常不会生效；要先彻底退出再冷启动。
- 只确认页面开着，不确认 DevTools 端口是否可连，会让后面的脚本排查方向跑偏。
