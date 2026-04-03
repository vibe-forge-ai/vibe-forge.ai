import { registerRunCommand } from './run/command'
import { parseCliInputControlEvent } from './run/input-bridge'
import {
  getDisallowedResumeFlags,
  resolveDefaultVibeForgeMcpServerOption,
  resolveInjectDefaultSystemPromptOption,
  resolveRunMode
} from './run/options'
import {
  getAdapterErrorMessage,
  getPrintableAssistantText,
  handlePrintEvent,
  resolvePrintableStopText,
  shouldPrintResumeHint
} from './run/output'
import { createSessionExitController } from './run/session-exit-controller'
import { RUN_INPUT_FORMATS, RUN_OUTPUT_FORMATS } from './run/types'

export {
  createSessionExitController,
  getAdapterErrorMessage,
  getDisallowedResumeFlags,
  getPrintableAssistantText,
  handlePrintEvent,
  parseCliInputControlEvent,
  registerRunCommand,
  resolveDefaultVibeForgeMcpServerOption,
  resolveInjectDefaultSystemPromptOption,
  resolvePrintableStopText,
  resolveRunMode,
  RUN_INPUT_FORMATS,
  RUN_OUTPUT_FORMATS,
  shouldPrintResumeHint
}
export type { RunInputFormat, RunOptions, RunOutputFormat } from './run/types'
