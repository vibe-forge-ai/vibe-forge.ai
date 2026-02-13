import { spawn } from 'node:child_process'
import path from 'node:path'
import process from 'node:process'

import type { NotificationMetadata } from 'node-notifier'
import notifier from 'node-notifier'
import z from 'zod'

const notifyOptionsSchema = z.object({
  title: z.string().optional(),
  description: z.string(),
  icon: z.string().optional().describe('自定义图标路径'),
  sound: z
    .union([z.boolean(), z.string()])
    .optional()
    .describe('是否播放音效或指定音效文件路径'),
  volume: z.number().optional().describe('音量，0-1 或 0-100'),
  timeout: z
    .union([z.number(), z.literal(false)])
    .optional()
    .describe('通知超时时间'),
  actions: z.array(z.string()).optional().describe('通知操作按钮'),
  needConfirm: z.boolean().optional().describe('是否需要用户确认')
})

type NotifyOptions = z.infer<typeof notifyOptionsSchema>

export const notify = async (options: NotifyOptions) => {
  const {
    title,
    description,
    icon,
    sound = true,
    volume,
    timeout = 10 * 60 * 1000,
    needConfirm
  } = options

  // 默认图标
  const defaultIcon = path.resolve(__dirname, './assets/mcp.png')
  // 默认音效
  const defaultSound = path.resolve(__dirname, './assets/completed.mp3')

  const resolvedSound = typeof sound === 'string'
    ? sound
    : (sound ? defaultSound : undefined)
  const resolvedVolume = typeof volume === 'number'
    ? (volume > 1 ? Math.min(volume, 100) / 100 : Math.max(volume, 0))
    : undefined
  const shouldPlaySound = resolvedSound != null && resolvedVolume !== 0
  const shouldUseNotifierSound = !(resolvedVolume != null && resolvedSound != null && process.platform === 'darwin')
  if (shouldPlaySound && !shouldUseNotifierSound && resolvedSound != null) {
    try {
      const args = ['-v', `${resolvedVolume ?? 1}`, resolvedSound]
      const proc = spawn('afplay', args, { stdio: 'ignore', detached: true })
      proc.unref()
    } catch {
    }
  }

  const [response, metadata] = await new Promise<
    [string, NotificationMetadata | undefined]
  >((ok, no) => {
    notifier.notify(
      {
        icon: icon || defaultIcon,
        title,
        sound: shouldUseNotifierSound ? resolvedSound : undefined,
        message: description,
        wait: true,
        reply: true,
        timeout
      },
      (err, response, metadata) => {
        if (err) {
          no(err)
          return
        }
        if (!needConfirm) {
          return
        }
        ok([response, metadata])
      }
    )
    if (!needConfirm) {
      ok([
        'default',
        {
          activationType: 'default',
          activationAt: Date.now().toLocaleString(),
          deliveredAt: Date.now().toLocaleString()
        }
      ])
    }
  })
  return { response, metadata }
}

export const systemController = {
  notify,
  notifyOptionsSchema
}
