import { compose } from '#~/utils/compose.js'

import type { ChannelContext } from './@types'

import { accessControlMiddleware } from './access-control'
import { ackMiddleware } from './ack'
import { adminGateMiddleware } from './admin-gate'
import { bindSessionMiddleware } from './bind-session'
import { channelCommandMiddleware } from './commands'
import { deduplicateMiddleware } from './deduplicate'
import { dispatchMiddleware } from './dispatch'
import { i18nMiddleware } from './i18n'
import { parseContentMiddleware } from './parse-content'
import { resolveSessionMiddleware } from './resolve-session'

export const pipeline = compose<ChannelContext>(
  deduplicateMiddleware,
  i18nMiddleware,
  parseContentMiddleware,
  accessControlMiddleware,
  resolveSessionMiddleware,
  channelCommandMiddleware,
  ackMiddleware,
  adminGateMiddleware,
  dispatchMiddleware,
  bindSessionMiddleware
)
