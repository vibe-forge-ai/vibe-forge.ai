export interface ChromeDevtoolsClickToolInput {
  uid: string
  dblClick?: boolean
  includeSnapshot?: boolean
}

export interface ChromeDevtoolsClosePageToolInput {
  pageId: number
}

export interface ChromeDevtoolsDragToolInput {
  from_uid: string
  to_uid: string
  includeSnapshot?: boolean
}

export interface ChromeDevtoolsEmulateToolInput {
  networkConditions?: 'No emulation' | 'Offline' | 'Slow 3G' | 'Fast 3G' | 'Slow 4G' | 'Fast 4G'
  cpuThrottlingRate?: number
  geolocation?: { latitude: number; longitude: number } | null
  userAgent?: string | null
  colorScheme?: 'dark' | 'light' | 'auto'
  viewport?:
    | {
      width: number
      height: number
      deviceScaleFactor?: number
      isMobile?: boolean
      hasTouch?: boolean
      isLandscape?: boolean
    }
    | null
}

export interface ChromeDevtoolsEvaluateScriptToolInput {
  function: string
  args?: Array<{ uid: string }>
}

export interface ChromeDevtoolsFillToolInput {
  uid: string
  value: string
  includeSnapshot?: boolean
}

export interface ChromeDevtoolsFillFormToolInput {
  elements: Array<{ uid: string; value: string }>
  includeSnapshot?: boolean
}

export interface ChromeDevtoolsGetConsoleMessageToolInput {
  msgid: number
}

export interface ChromeDevtoolsGetNetworkRequestToolInput {
  reqid?: number
  requestFilePath?: string
  responseFilePath?: string
}

export interface ChromeDevtoolsHandleDialogToolInput {
  action: 'accept' | 'dismiss'
  promptText?: string
}

export interface ChromeDevtoolsHoverToolInput {
  uid: string
  includeSnapshot?: boolean
}

export interface ChromeDevtoolsListConsoleMessagesToolInput {
  pageSize?: number
  pageIdx?: number
  types?: Array<
    | 'log'
    | 'debug'
    | 'info'
    | 'error'
    | 'warn'
    | 'dir'
    | 'dirxml'
    | 'table'
    | 'trace'
    | 'clear'
    | 'startGroup'
    | 'startGroupCollapsed'
    | 'endGroup'
    | 'assert'
    | 'profile'
    | 'profileEnd'
    | 'count'
    | 'timeEnd'
    | 'verbose'
    | 'issue'
  >
  includePreservedMessages?: boolean
}

export interface ChromeDevtoolsListNetworkRequestsToolInput {
  pageSize?: number
  pageIdx?: number
  resourceTypes?: Array<
    | 'document'
    | 'stylesheet'
    | 'image'
    | 'media'
    | 'font'
    | 'script'
    | 'texttrack'
    | 'xhr'
    | 'fetch'
    | 'prefetch'
    | 'eventsource'
    | 'websocket'
    | 'manifest'
    | 'signedexchange'
    | 'ping'
    | 'cspviolationreport'
    | 'preflight'
    | 'fedcm'
    | 'other'
  >
  includePreservedRequests?: boolean
}

export interface ChromeDevtoolsListPagesToolInput {}

export interface ChromeDevtoolsNavigatePageToolInput {
  type?: 'url' | 'back' | 'forward' | 'reload'
  url?: string
  ignoreCache?: boolean
  handleBeforeUnload?: 'accept' | 'decline'
  initScript?: string
  timeout?: number
}

export interface ChromeDevtoolsNewPageToolInput {
  url: string
  background?: boolean
  isolatedContext?: string
  timeout?: number
}

export interface ChromeDevtoolsPerformanceAnalyzeInsightToolInput {
  insightSetId: string
  insightName: string
}

export interface ChromeDevtoolsPerformanceStartTraceToolInput {
  reload: boolean
  autoStop: boolean
  filePath?: string
}

export interface ChromeDevtoolsPerformanceStopTraceToolInput {
  filePath?: string
}

export interface ChromeDevtoolsPressKeyToolInput {
  key: string
  includeSnapshot?: boolean
}

export interface ChromeDevtoolsResizePageToolInput {
  width: number
  height: number
}

export interface ChromeDevtoolsSelectPageToolInput {
  pageId: number
  bringToFront?: boolean
}

export interface ChromeDevtoolsTakeMemorySnapshotToolInput {
  filePath: string
}

export interface ChromeDevtoolsTakeScreenshotToolInput {
  format?: 'png' | 'jpeg' | 'webp'
  quality?: number
  uid?: string
  fullPage?: boolean
  filePath?: string
}

export interface ChromeDevtoolsTakeSnapshotToolInput {
  verbose?: boolean
  filePath?: string
}

export interface ChromeDevtoolsTypeTextToolInput {
  text: string
  submitKey?: string
}

export interface ChromeDevtoolsUploadFileToolInput {
  uid: string
  filePath: string
  includeSnapshot?: boolean
}

export interface ChromeDevtoolsWaitForToolInput {
  text: string[]
  timeout?: number
}

export interface ChromeDevtoolsToolInputs {
  'mcp__ChromeDevtools__click': ChromeDevtoolsClickToolInput
  'mcp__ChromeDevtools__close_page': ChromeDevtoolsClosePageToolInput
  'mcp__ChromeDevtools__drag': ChromeDevtoolsDragToolInput
  'mcp__ChromeDevtools__emulate': ChromeDevtoolsEmulateToolInput
  'mcp__ChromeDevtools__evaluate_script': ChromeDevtoolsEvaluateScriptToolInput
  'mcp__ChromeDevtools__fill': ChromeDevtoolsFillToolInput
  'mcp__ChromeDevtools__fill_form': ChromeDevtoolsFillFormToolInput
  'mcp__ChromeDevtools__get_console_message': ChromeDevtoolsGetConsoleMessageToolInput
  'mcp__ChromeDevtools__get_network_request': ChromeDevtoolsGetNetworkRequestToolInput
  'mcp__ChromeDevtools__handle_dialog': ChromeDevtoolsHandleDialogToolInput
  'mcp__ChromeDevtools__hover': ChromeDevtoolsHoverToolInput
  'mcp__ChromeDevtools__list_console_messages': ChromeDevtoolsListConsoleMessagesToolInput
  'mcp__ChromeDevtools__list_network_requests': ChromeDevtoolsListNetworkRequestsToolInput
  'mcp__ChromeDevtools__list_pages': ChromeDevtoolsListPagesToolInput
  'mcp__ChromeDevtools__navigate_page': ChromeDevtoolsNavigatePageToolInput
  'mcp__ChromeDevtools__new_page': ChromeDevtoolsNewPageToolInput
  'mcp__ChromeDevtools__performance_analyze_insight': ChromeDevtoolsPerformanceAnalyzeInsightToolInput
  'mcp__ChromeDevtools__performance_start_trace': ChromeDevtoolsPerformanceStartTraceToolInput
  'mcp__ChromeDevtools__performance_stop_trace': ChromeDevtoolsPerformanceStopTraceToolInput
  'mcp__ChromeDevtools__press_key': ChromeDevtoolsPressKeyToolInput
  'mcp__ChromeDevtools__resize_page': ChromeDevtoolsResizePageToolInput
  'mcp__ChromeDevtools__select_page': ChromeDevtoolsSelectPageToolInput
  'mcp__ChromeDevtools__take_memory_snapshot': ChromeDevtoolsTakeMemorySnapshotToolInput
  'mcp__ChromeDevtools__take_screenshot': ChromeDevtoolsTakeScreenshotToolInput
  'mcp__ChromeDevtools__take_snapshot': ChromeDevtoolsTakeSnapshotToolInput
  'mcp__ChromeDevtools__type_text': ChromeDevtoolsTypeTextToolInput
  'mcp__ChromeDevtools__upload_file': ChromeDevtoolsUploadFileToolInput
  'mcp__ChromeDevtools__wait_for': ChromeDevtoolsWaitForToolInput
}

export type ChromeDevtoolsToolName = keyof ChromeDevtoolsToolInputs

export interface ChromeDevtoolsToolInput<
  TName extends ChromeDevtoolsToolName = ChromeDevtoolsToolName,
> {
  toolName: TName
  toolInput: ChromeDevtoolsToolInputs[TName]
}
