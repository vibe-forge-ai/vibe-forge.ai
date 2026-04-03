import { Buffer } from 'node:buffer'

interface ChromeDebugTarget {
  id: string
  type: string
  title: string
  url: string
  webSocketDebuggerUrl?: string
}

interface ChromeDebugProtocolError {
  code?: number
  message?: string
}

interface ChromeDebugPendingRequest {
  resolve: (value: unknown) => void
  reject: (reason: Error) => void
}

interface ChromeDebugEvaluateResult<TResult> {
  result?: {
    value?: TResult
  }
}

interface MessengerConversationSelection {
  found: boolean
  conversation?: {
    preview: string
    rect: {
      x: number
      y: number
      width: number
      height: number
    }
    score: number
  }
  candidates?: Array<{
    preview: string
    rect: {
      x: number
      y: number
      width: number
      height: number
    }
    score: number
  }>
}

interface MessengerConversationListSnapshot {
  conversations: Array<{
    title: string
    preview: string
    rect: {
      x: number
      y: number
      width: number
      height: number
    }
  }>
}

interface MessengerComposerLocation {
  found: boolean
  editor?: {
    rect: {
      x: number
      y: number
      width: number
      height: number
    }
    tag: string
    contenteditable: string | null
    value: string
  }
  sendButton?: {
    rect: {
      x: number
      y: number
      width: number
      height: number
    }
    text: string
    aria: string
    title: string
  }
}

interface MessengerComposerFocusResult {
  found: boolean
  blocked: boolean
  previousValue: string
}

interface MessengerSendButtonClickResult {
  found: boolean
  sendButton?: {
    rect: {
      x: number
      y: number
      width: number
      height: number
    }
    text: string
    aria: string
    title: string
  }
}

interface MessengerTailSnapshot {
  tail: string[]
  matches: Array<{
    index: number
    lines: string[]
  }>
}

interface MessengerBubbleSelection {
  found: boolean
  bubble?: {
    preview: string
    rect: {
      x: number
      y: number
      width: number
      height: number
    }
  }
}

interface MessengerReplyButtonClickResult {
  found: boolean
  replyButton?: {
    rect: {
      x: number
      y: number
      width: number
      height: number
    }
    index: number
  }
}

interface MessengerReplyComposerSnapshot {
  bottomTexts: string[]
  matchedSnippet: boolean
}

export interface ChromeDebugTargetsInput {
  port: number
  json: boolean
}

export interface ChromeDebugMessengerSendInput {
  port: number
  pageUrlSubstring: string
  conversation: string
  message: string
  replaceDraft: boolean
  settleMs: number
}

export interface ChromeDebugMessengerConversationsInput {
  port: number
  pageUrlSubstring: string
}

export interface ChromeDebugMessengerClickReplyInput {
  port: number
  pageUrlSubstring: string
  conversation: string
  messageSnippet: string
  replyIndex: number
  settleMs: number
}

export interface ChromeDebugMessengerClickTextInput {
  port: number
  pageUrlSubstring: string
  conversation: string
  text: string
  settleMs: number
}

const DEFAULT_PAGE_URL_SUBSTRING = '/next/messenger'

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null

const isNonEmptyString = (value: unknown): value is string => typeof value === 'string' && value.trim() !== ''

const stringifyWebSocketMessage = (value: string | ArrayBuffer | Blob | ArrayBufferView) => {
  if (typeof value === 'string') return value
  if (value instanceof ArrayBuffer) return Buffer.from(value).toString('utf8')
  if (ArrayBuffer.isView(value)) return Buffer.from(value.buffer, value.byteOffset, value.byteLength).toString('utf8')
  throw new TypeError('Unsupported WebSocket payload type')
}

const sleep = async (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
  })

const parseChromeDebugTargets = (value: unknown): ChromeDebugTarget[] => {
  if (!Array.isArray(value)) {
    throw new TypeError('Chrome DevTools target list returned an unexpected payload.')
  }

  return value.flatMap((item) => {
    if (!isRecord(item)) return []

    const id = item.id
    const type = item.type
    const title = item.title
    const url = item.url
    const webSocketDebuggerUrl = item.webSocketDebuggerUrl

    if (!isNonEmptyString(id) || !isNonEmptyString(type) || !isNonEmptyString(title) || !isNonEmptyString(url)) {
      return []
    }

    return [{
      id,
      type,
      title,
      url,
      webSocketDebuggerUrl: isNonEmptyString(webSocketDebuggerUrl) ? webSocketDebuggerUrl : undefined
    }]
  })
}

const formatTargetsForConsole = (targets: ChromeDebugTarget[]) =>
  targets
    .map((target) => `[${target.type}] ${target.title} -> ${target.url}`)
    .join('\n')

export const parsePositiveIntegerOption = (value: string, label: string) => {
  const parsed = Number.parseInt(value, 10)
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${label} must be a positive integer.`)
  }
  return parsed
}

const createChromeCdpClient = async (webSocketDebuggerUrl: string) => {
  const socket = new WebSocket(webSocketDebuggerUrl)
  let nextId = 0
  let isClosed = false
  const pending = new Map<number, ChromeDebugPendingRequest>()

  const rejectPending = (message: string) => {
    for (const entry of pending.values()) {
      entry.reject(new Error(message))
    }
    pending.clear()
  }

  await new Promise<void>((resolve, reject) => {
    const handleOpen = () => {
      socket.removeEventListener('error', handleError)
      resolve()
    }
    const handleError = () => {
      socket.removeEventListener('open', handleOpen)
      reject(new Error(`Failed to connect to Chrome DevTools: ${webSocketDebuggerUrl}`))
    }

    socket.addEventListener('open', handleOpen, { once: true })
    socket.addEventListener('error', handleError, { once: true })
  })

  socket.addEventListener('message', (event) => {
    let parsed: unknown
    try {
      parsed = JSON.parse(stringifyWebSocketMessage(event.data))
    } catch (error) {
      rejectPending(error instanceof Error ? error.message : String(error))
      return
    }

    if (!isRecord(parsed) || typeof parsed.id !== 'number') return
    const task = pending.get(parsed.id)
    if (task == null) return
    pending.delete(parsed.id)

    if (isRecord(parsed.error)) {
      const errorInfo = parsed.error as ChromeDebugProtocolError
      task.reject(
        new Error(`Chrome DevTools error ${errorInfo.code ?? 'unknown'}: ${errorInfo.message ?? 'unknown error'}`)
      )
      return
    }

    task.resolve(parsed.result)
  })

  socket.addEventListener('close', () => {
    isClosed = true
    rejectPending('Chrome DevTools connection closed unexpectedly.')
  })

  return {
    async send<TResult>(method: string, params?: Record<string, unknown>) {
      if (isClosed) {
        throw new Error('Chrome DevTools connection is already closed.')
      }

      const id = ++nextId
      const payload = JSON.stringify({
        id,
        method,
        params: params ?? {}
      })

      const resultPromise = new Promise<TResult>((resolve, reject) => {
        pending.set(id, {
          resolve: value => resolve(value as TResult | PromiseLike<TResult>),
          reject
        })
      })

      socket.send(payload)

      const result = await resultPromise
      return result
    },
    close() {
      if (isClosed) return
      isClosed = true
      socket.close()
      rejectPending('Chrome DevTools connection closed.')
    }
  }
}

const buildVisibilityHelpersExpression = () => `
const isVisible = (element) => {
  if (!(element instanceof Element)) return false;
  const style = window.getComputedStyle(element);
  if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
};
const serializeRect = (rect) => ({
  x: rect.x,
  y: rect.y,
  width: rect.width,
  height: rect.height
});
const getEditorValue = (element) => {
  if ('value' in element) {
    return String(element.value ?? '');
  }

  const clone = element.cloneNode(true);
  if (clone instanceof Element) {
    clone
      .querySelectorAll('.editor__custom--placeholder, [data-zero-space="true"], [data-void="true"], [contenteditable="false"]')
      .forEach((node) => node.remove());
    return String(clone.textContent ?? '').replace(/\\u200B/g, '').trim();
  }

  return String(element.textContent ?? '').replace(/\\u200B/g, '').trim();
};
`

const buildSelectMessengerConversationExpression = (conversation: string) => `
(() => {
  ${buildVisibilityHelpersExpression()}
  const targetName = ${JSON.stringify(conversation)};
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const candidates = [];
  const seen = new Set();

  while (walker.nextNode()) {
    const currentNode = walker.currentNode;
    const text = currentNode.textContent?.trim();
    if (text !== targetName) continue;

    const parent = currentNode.parentElement;
    if (!parent || !isVisible(parent)) continue;

    let row = parent;
    while (row && row !== document.body) {
      const rect = row.getBoundingClientRect();
      const rightEdge = rect.x + rect.width;
      const isConversationRow = (
        rect.width >= 160 &&
        rect.height >= 36 &&
        rect.height <= 120 &&
        rect.x >= window.innerWidth * 0.15 &&
        rightEdge <= window.innerWidth * 0.55
      );

      if (isConversationRow) {
        const key = [Math.round(rect.x), Math.round(rect.y), Math.round(rect.width), Math.round(rect.height)].join(':');
        if (!seen.has(key)) {
          seen.add(key);
          const score = (
            (rect.y >= window.innerHeight * 0.18 ? 3 : 0) +
            (rect.width >= 220 ? 2 : 0) +
            (rect.x >= window.innerWidth * 0.2 ? 1 : 0)
          );

          candidates.push({
            element: row,
            score,
            rect: serializeRect(rect),
            preview: String(row.innerText ?? '').trim().replace(/\\n+/g, ' | ').slice(0, 200)
          });
        }
        break;
      }

      row = row.parentElement;
    }
  }

  const best = [...candidates].sort((left, right) => (
    right.score - left.score ||
    right.rect.y - left.rect.y
  ))[0];

  if (!best) {
    return {
      found: false,
      candidates: candidates.map(({ score, rect, preview }) => ({ score, rect, preview }))
    };
  }

  best.element.scrollIntoView({ block: 'nearest' });
  if (typeof best.element.click === 'function') {
    best.element.click();
  } else {
    best.element.dispatchEvent(new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      view: window
    }));
  }

  return {
    found: true,
    conversation: {
      score: best.score,
      rect: best.rect,
      preview: best.preview
    }
  };
})()
`

const buildListMessengerConversationsExpression = () => `
(() => {
  ${buildVisibilityHelpersExpression()}
  const rows = [];
  const seen = new Set();
  const normalizeLines = (value) => String(value ?? '')
    .split('\\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const ignoredTitles = new Set([
    '开启读屏标签',
    '读屏标签已关闭',
    '搜索',
    '(⌘+K)',
    '消息',
    '知识问答',
    '会议',
    '日历',
    '云文档',
    '通讯录',
    '邮箱',
    '任务',
    '工作台',
    '下载飞书客户端',
    '分组',
    '免打扰',
    '未读',
    '标记',
    '@我',
    '标签',
    '单聊',
    '群组',
    '话题',
    '已完成',
    '展开'
  ]);
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);

  while (walker.nextNode()) {
    const currentNode = walker.currentNode;
    const text = currentNode.textContent?.trim();
    if (!text || ignoredTitles.has(text)) continue;

    const parent = currentNode.parentElement;
    if (!parent || !isVisible(parent)) continue;

    let row = parent;
    while (row && row !== document.body) {
      const rect = row.getBoundingClientRect();
      const rightEdge = rect.x + rect.width;
      const isConversationRow = (
        rect.width >= 160 &&
        rect.height >= 36 &&
        rect.height <= 140 &&
        rect.x >= window.innerWidth * 0.08 &&
        rightEdge <= window.innerWidth * 0.55 &&
        rect.y >= 140
      );

      if (isConversationRow) {
        const lines = normalizeLines(row.innerText);
        const title = lines[0] ?? '';
        const preview = lines.join(' | ');

        if (
          title === '' ||
          title.length > 80 ||
          ignoredTitles.has(title) ||
          /^\\d+$/.test(title)
        ) {
          break;
        }

        const key = [Math.round(rect.x), Math.round(rect.y), Math.round(rect.width), Math.round(rect.height)].join(':');
        if (!seen.has(key)) {
          seen.add(key);
          rows.push({
            title,
            preview: preview.slice(0, 200),
            rect: serializeRect(rect)
          });
        }
        break;
      }

      row = row.parentElement;
    }
  }

  return {
    conversations: rows
      .sort((left, right) => left.rect.y - right.rect.y || left.rect.x - right.rect.x)
      .slice(0, 20)
  };
})()
`

const buildLocateMessengerComposerExpression = () => `
(() => {
  ${buildVisibilityHelpersExpression()}
  const editor = [...document.querySelectorAll('[contenteditable="true"], textarea, input[type="text"]')]
    .filter(isVisible)
    .filter((element) => {
      const rect = element.getBoundingClientRect();
      return rect.y >= window.innerHeight * 0.6 && rect.width >= 200;
    })
    .sort((left, right) => right.getBoundingClientRect().y - left.getBoundingClientRect().y)[0];

  const sendButton = [...document.querySelectorAll('button, [role="button"]')]
    .filter(isVisible)
    .map((element) => {
      const rect = element.getBoundingClientRect();
      return {
        element,
        rect,
        text: String(element.innerText ?? '').trim(),
        aria: String(element.getAttribute('aria-label') ?? ''),
        title: String(element.getAttribute('title') ?? '')
      };
    })
    .filter((entry) => entry.rect.y >= window.innerHeight * 0.72)
    .sort((left, right) => right.rect.x - left.rect.x)
    .find((entry) => /发送/.test([entry.text, entry.aria, entry.title].join(' ')))
    ?? [...document.querySelectorAll('button, [role="button"]')]
      .filter(isVisible)
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          element,
          rect,
          text: String(element.innerText ?? '').trim(),
          aria: String(element.getAttribute('aria-label') ?? ''),
          title: String(element.getAttribute('title') ?? '')
        };
      })
      .filter((entry) => (
        entry.rect.y >= window.innerHeight * 0.72 &&
        entry.rect.x >= window.innerWidth * 0.85 &&
        entry.rect.width <= 48 &&
        entry.rect.height <= 48
      ))
      .sort((left, right) => right.rect.x - left.rect.x)[0];

  return {
    found: editor != null && sendButton != null,
    editor: editor == null
      ? undefined
      : {
        rect: serializeRect(editor.getBoundingClientRect()),
        tag: editor.tagName,
        contenteditable: editor.getAttribute('contenteditable'),
        value: getEditorValue(editor).trim()
      },
    sendButton: sendButton == null
      ? undefined
      : {
        rect: serializeRect(sendButton.rect),
        text: sendButton.text,
        aria: sendButton.aria,
        title: sendButton.title
      }
  };
})()
`

const buildFocusMessengerComposerExpression = (replaceDraft: boolean) => `
(() => {
  ${buildVisibilityHelpersExpression()}
  const editor = [...document.querySelectorAll('[contenteditable="true"], textarea, input[type="text"]')]
    .filter(isVisible)
    .filter((element) => {
      const rect = element.getBoundingClientRect();
      return rect.y >= window.innerHeight * 0.6 && rect.width >= 200;
    })
    .sort((left, right) => right.getBoundingClientRect().y - left.getBoundingClientRect().y)[0];

  if (!editor) {
    return {
      found: false,
      blocked: false,
      previousValue: ''
    };
  }

  const previousValue = getEditorValue(editor).trim();
  editor.focus();

  if (previousValue !== '' && !${replaceDraft}) {
    return {
      found: true,
      blocked: true,
      previousValue
    };
  }

  if (${replaceDraft}) {
    if ('value' in editor) {
      editor.value = '';
    } else {
      const selection = window.getSelection?.();
      const range = document.createRange?.();
      if (selection && range) {
        range.selectNodeContents(editor);
        selection.removeAllRanges();
        selection.addRange(range);
      }
      if (typeof document.execCommand === 'function') {
        document.execCommand('delete');
      }
      editor.textContent = '';
    }
    editor.dispatchEvent(new CompositionEvent('compositionend', {
      bubbles: true,
      data: ''
    }));
    editor.dispatchEvent(new Event('input', { bubbles: true }));
    editor.dispatchEvent(new Event('change', { bubbles: true }));
    editor.blur();
    editor.focus();
  }

  return {
    found: true,
    blocked: false,
    previousValue
  };
})()
`

const buildClickMessengerSendButtonExpression = () => `
(() => {
  ${buildVisibilityHelpersExpression()}
  const candidates = [...document.querySelectorAll('button, [role="button"]')]
    .filter(isVisible)
    .map((element) => {
      const rect = element.getBoundingClientRect();
      return {
        element,
        rect,
        text: String(element.innerText ?? '').trim(),
        aria: String(element.getAttribute('aria-label') ?? ''),
        title: String(element.getAttribute('title') ?? '')
      };
    })
    .filter((entry) => entry.rect.y >= window.innerHeight * 0.72)
    .sort((left, right) => right.rect.x - left.rect.x);

  const sendButton = candidates.find((entry) => /发送/.test([entry.text, entry.aria, entry.title].join(' ')))
    ?? candidates.find((entry) => (
      entry.rect.x >= window.innerWidth * 0.85 &&
      entry.rect.width <= 48 &&
      entry.rect.height <= 48
    ));

  if (!sendButton) {
    return {
      found: false
    };
  }

  if (typeof sendButton.element.click === 'function') {
    sendButton.element.click();
  } else {
    sendButton.element.dispatchEvent(new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      view: window
    }));
  }

  return {
    found: true,
    sendButton: {
      rect: serializeRect(sendButton.rect),
      text: sendButton.text,
      aria: sendButton.aria,
      title: sendButton.title
    }
  };
})()
`

const buildMessengerTailSnapshotExpression = (message: string) => `
(() => {
  const lines = String(document.body?.innerText ?? '')
    .split('\\n')
    .map((value) => value.trim())
    .filter(Boolean);
  const targetMessage = ${JSON.stringify(message)};
  const matches = lines
    .map((line, index) => line === targetMessage ? index : -1)
    .filter((index) => index >= 0)
    .slice(-5)
    .map((index) => ({
      index,
      lines: lines.slice(Math.max(0, index - 3), index + 5)
    }));

  return {
    tail: lines.slice(-30),
    matches
  };
})()
`

const buildSelectMessengerBubbleExpression = (messageSnippet: string) => `
(() => {
  ${buildVisibilityHelpersExpression()}
  const snippet = ${JSON.stringify(messageSnippet)};
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const candidates = [];
  const seen = new Set();

  document
    .querySelectorAll('[data-vf-chrome-debug-target="message-bubble"]')
    .forEach((element) => element.removeAttribute('data-vf-chrome-debug-target'));

  while (walker.nextNode()) {
    const currentNode = walker.currentNode;
    const text = currentNode.textContent?.trim();
    if (!text || !text.includes(snippet)) continue;

    const parent = currentNode.parentElement;
    if (!parent || !isVisible(parent)) continue;

    let bubble = parent;
    while (bubble && bubble !== document.body) {
      const rect = bubble.getBoundingClientRect();
      const isMessageBubble = (
        rect.x >= window.innerWidth * 0.45 &&
        rect.width >= 120 &&
        rect.width <= window.innerWidth * 0.6 &&
        rect.height >= 24 &&
        rect.height <= window.innerHeight * 0.6
      );

      if (isMessageBubble) {
        const key = [Math.round(rect.x), Math.round(rect.y), Math.round(rect.width), Math.round(rect.height)].join(':');
        if (!seen.has(key)) {
          seen.add(key);
          candidates.push({
            element: bubble,
            rect: serializeRect(rect),
            area: rect.width * rect.height,
            preview: String(bubble.innerText ?? '').trim().replace(/\\n+/g, ' | ').slice(0, 200)
          });
        }
        break;
      }

      bubble = bubble.parentElement;
    }
  }

  const best = [...candidates].sort((left, right) => (
    right.rect.y - left.rect.y ||
    left.area - right.area
  ))[0];

  if (!best) {
    return {
      found: false
    };
  }

  best.element.setAttribute('data-vf-chrome-debug-target', 'message-bubble');

  return {
    found: true,
    bubble: {
      rect: best.rect,
      preview: best.preview
    }
  };
})()
`

const buildRevealMessengerBubbleToolbarExpression = () => `
(() => {
  const bubble = document.querySelector('[data-vf-chrome-debug-target="message-bubble"]');
  if (!(bubble instanceof Element)) {
    return {
      found: false
    };
  }

  bubble.scrollIntoView({ block: 'nearest' });
  ['mouseenter', 'mouseover', 'mousemove'].forEach((type) => {
    bubble.dispatchEvent(new MouseEvent(type, {
      bubbles: true,
      cancelable: true,
      view: window
    }));
  });

  return {
    found: true
  };
})()
`

const buildClickMessengerReplyButtonExpression = (input: {
  bubbleRect: {
    x: number
    y: number
    width: number
    height: number
  }
  replyIndex: number
}) => `
(() => {
  ${buildVisibilityHelpersExpression()}
  const bubbleRect = ${JSON.stringify(input.bubbleRect)};
  const replyIndex = ${input.replyIndex};
  const visibleButtons = [...document.querySelectorAll('.toolbar-item.reply')]
    .filter(isVisible)
    .map((element) => {
      const rect = element.getBoundingClientRect();
      return {
        element,
        rect
      };
    })
    .filter((entry) => (
      entry.rect.y >= bubbleRect.y - 48 &&
      entry.rect.y <= bubbleRect.y + 24 &&
      entry.rect.x >= bubbleRect.x + bubbleRect.width * 0.7 &&
      entry.rect.x <= bubbleRect.x + bubbleRect.width + 24
    ));

  const allButtons = [...document.querySelectorAll('.toolbar-item.reply')]
    .map((element) => {
      const rect = element.getBoundingClientRect();
      return {
        element,
        rect,
        distance: Math.abs((rect.x + rect.width / 2) - (bubbleRect.x + bubbleRect.width)) +
          Math.abs((rect.y + rect.height / 2) - bubbleRect.y)
      };
    })
    .sort((left, right) => left.distance - right.distance || left.rect.x - right.rect.x);

  const fallbackButtons = visibleButtons.length > 0
    ? visibleButtons
    : [...document.querySelectorAll('.toolbar-item.reply')]
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          element,
          rect,
          distance: Math.abs((rect.x + rect.width / 2) - (bubbleRect.x + bubbleRect.width)) +
            Math.abs((rect.y + rect.height / 2) - bubbleRect.y)
        };
      })
      .filter((entry) => entry.rect.width > 0 && entry.rect.height > 0)
      .sort((left, right) => left.distance - right.distance || left.rect.x - right.rect.x);

  const orderedButtons = fallbackButtons
    .sort((left, right) => left.rect.x - right.rect.x);

  const finalButtons = orderedButtons.length > 0 ? orderedButtons : allButtons;

  const target = finalButtons[Math.max(0, replyIndex - 1)];
  if (!target) {
    return {
      found: false
    };
  }

  if (typeof target.element.click === 'function') {
    target.element.click();
  } else {
    target.element.dispatchEvent(new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      view: window
    }));
  }

  return {
    found: true,
    replyButton: {
      index: replyIndex,
      rect: serializeRect(target.rect)
    }
  };
})()
`

const buildMessengerReplyComposerSnapshotExpression = (messageSnippet: string) => `
(() => {
  ${buildVisibilityHelpersExpression()}
  const snippet = ${JSON.stringify(messageSnippet)};
  const bottomTexts = [...document.querySelectorAll('*')]
    .filter(isVisible)
    .map((element) => {
      const rect = element.getBoundingClientRect();
      return {
        rect,
        text: String(element.innerText ?? '').trim().replace(/\\n+/g, ' | ')
      };
    })
    .filter((entry) => (
      entry.rect.x >= window.innerWidth * 0.5 &&
      entry.rect.y >= window.innerHeight * 0.72 &&
      entry.rect.y <= window.innerHeight &&
      entry.text !== ''
    ))
    .map((entry) => entry.text)
    .slice(0, 20);

  return {
    bottomTexts,
    matchedSnippet: bottomTexts.some((text) => text.includes(snippet))
  };
})()
`

const buildClickMessengerTextExpression = (text: string) => `
(() => {
  ${buildVisibilityHelpersExpression()}
  const targetText = ${JSON.stringify(text)};
  const normalizeText = (value) => String(value ?? '').trim().replace(/\\n+/g, ' ');
  const getPreferredTarget = (element) => {
    let current = element;
    let best = element;

    while (current && current !== document.body) {
      const rect = current.getBoundingClientRect();
      const text = normalizeText(current.innerText);
      const role = current.getAttribute('role') ?? '';
      const isCompact = rect.width <= window.innerWidth * 0.4 && rect.height <= 96;

      if (text === targetText && isCompact) {
        best = current;
      }

      if (
        current.tagName === 'BUTTON' ||
        current.tagName === 'A' ||
        role === 'button' ||
        role === 'link'
      ) {
        return current;
      }

      current = current.parentElement;
    }

    return best;
  };

  const candidates = [];
  const seen = new Set();

  for (const element of document.querySelectorAll('*')) {
    if (!(element instanceof Element) || !isVisible(element)) continue;
    if (normalizeText(element.innerText) !== targetText) continue;

    const target = getPreferredTarget(element);
    if (!(target instanceof Element) || !isVisible(target)) continue;

    const rect = target.getBoundingClientRect();
    const key = [Math.round(rect.x), Math.round(rect.y), Math.round(rect.width), Math.round(rect.height)].join(':');
    if (seen.has(key)) continue;
    seen.add(key);

    if (
      rect.x < window.innerWidth * 0.45 ||
      rect.y < window.innerHeight * 0.62 ||
      rect.width < 40 ||
      rect.width > window.innerWidth * 0.45 ||
      rect.height > 96
    ) {
      continue;
    }

    candidates.push({
      element: target,
      rect: serializeRect(rect),
      area: rect.width * rect.height,
      preview: normalizeText(target.innerText)
    });
  }

  const best = [...candidates].sort((left, right) => (
    right.rect.y - left.rect.y ||
    left.area - right.area
  ))[0];

  if (!best) {
    return {
      found: false
    };
  }

  if (typeof best.element.click === 'function') {
    best.element.click();
  } else {
    best.element.dispatchEvent(new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      view: window
    }));
  }

  return {
    found: true,
    clicked: {
      rect: best.rect,
      preview: best.preview
    }
  };
})()
`

export const getChromeDebugTargets = async (port: number) => {
  const response = await fetch(`http://127.0.0.1:${port}/json/list`)
  if (!response.ok) {
    throw new Error(`Failed to load Chrome DevTools targets from port ${port}: HTTP ${response.status}`)
  }

  const payload = await response.json()
  return parseChromeDebugTargets(payload)
}

export const resolveChromeDebugPageTarget = (
  targets: ChromeDebugTarget[],
  pageUrlSubstring: string
) => {
  const pageTargets = targets.filter((target) => target.type === 'page' && target.webSocketDebuggerUrl != null)
  const matchedTargets = pageTargets.filter((target) => target.url.includes(pageUrlSubstring))

  if (matchedTargets.length === 0) {
    throw new Error(`No Chrome page target matched "${pageUrlSubstring}".`)
  }

  return matchedTargets[0]!
}

const runOnPage = async <T>(
  webSocketDebuggerUrl: string,
  work: (client: Awaited<ReturnType<typeof createChromeCdpClient>>) => Promise<T>
) => {
  const client = await createChromeCdpClient(webSocketDebuggerUrl)
  try {
    return await work(client)
  } finally {
    client.close()
  }
}

export const runChromeDebugTargets = async (input: ChromeDebugTargetsInput) => {
  const targets = await getChromeDebugTargets(input.port)
  if (input.json) {
    console.log(JSON.stringify(targets, null, 2))
    return
  }

  console.log(formatTargetsForConsole(targets))
}

export const runChromeDebugMessengerConversations = async (input: ChromeDebugMessengerConversationsInput) => {
  const targets = await getChromeDebugTargets(input.port)
  const target = resolveChromeDebugPageTarget(targets, input.pageUrlSubstring)
  const webSocketDebuggerUrl = target.webSocketDebuggerUrl

  if (webSocketDebuggerUrl == null) {
    throw new Error(`Chrome page "${target.title}" does not expose a WebSocket debugger URL.`)
  }

  const summary = await runOnPage(webSocketDebuggerUrl, async (client) => {
    await client.send('Page.bringToFront')
    await client.send('Runtime.enable')

    const conversationsResult = await client.send<ChromeDebugEvaluateResult<MessengerConversationListSnapshot>>(
      'Runtime.evaluate',
      {
        expression: buildListMessengerConversationsExpression(),
        returnByValue: true,
        awaitPromise: true
      }
    )
    const conversations = conversationsResult.result?.value

    return {
      target: {
        title: target.title,
        url: target.url
      },
      conversations: conversations?.conversations ?? []
    }
  })

  console.log(JSON.stringify(summary, null, 2))
}

export const runChromeDebugMessengerSend = async (input: ChromeDebugMessengerSendInput) => {
  const targets = await getChromeDebugTargets(input.port)
  const target = resolveChromeDebugPageTarget(targets, input.pageUrlSubstring)
  const webSocketDebuggerUrl = target.webSocketDebuggerUrl

  if (webSocketDebuggerUrl == null) {
    throw new Error(`Chrome page "${target.title}" does not expose a WebSocket debugger URL.`)
  }

  const summary = await runOnPage(webSocketDebuggerUrl, async (client) => {
    await client.send('Page.bringToFront')
    await client.send('Runtime.enable')

    const selectedConversationResult = await client.send<ChromeDebugEvaluateResult<MessengerConversationSelection>>(
      'Runtime.evaluate',
      {
        expression: buildSelectMessengerConversationExpression(input.conversation),
        returnByValue: true,
        awaitPromise: true
      }
    )
    const selectedConversation = selectedConversationResult.result?.value

    if (
      selectedConversation == null || selectedConversation.found !== true || selectedConversation.conversation == null
    ) {
      throw new Error(`Conversation "${input.conversation}" was not found on the current messenger page.`)
    }

    await sleep(800)

    const composerLocationResult = await client.send<ChromeDebugEvaluateResult<MessengerComposerLocation>>(
      'Runtime.evaluate',
      {
        expression: buildLocateMessengerComposerExpression(),
        returnByValue: true,
        awaitPromise: true
      }
    )
    const composerLocation = composerLocationResult.result?.value

    if (
      composerLocation == null || composerLocation.found !== true || composerLocation.editor == null ||
      composerLocation.sendButton == null
    ) {
      throw new Error('Messenger composer was not found on the current page.')
    }

    const focusResult = await client.send<ChromeDebugEvaluateResult<MessengerComposerFocusResult>>('Runtime.evaluate', {
      expression: buildFocusMessengerComposerExpression(input.replaceDraft),
      returnByValue: true,
      awaitPromise: true
    })
    const focusState = focusResult.result?.value

    if (focusState == null || focusState.found !== true) {
      throw new Error('Messenger composer could not be focused.')
    }

    if (focusState.blocked) {
      throw new Error(
        `Messenger composer already contains draft text: "${focusState.previousValue}". Re-run with --replace-draft to overwrite it.`
      )
    }

    await client.send('Input.insertText', { text: input.message })
    await sleep(200)

    const sendButtonClickResult = await client.send<ChromeDebugEvaluateResult<MessengerSendButtonClickResult>>(
      'Runtime.evaluate',
      {
        expression: buildClickMessengerSendButtonExpression(),
        returnByValue: true,
        awaitPromise: true
      }
    )
    const sendButtonClick = sendButtonClickResult.result?.value

    if (sendButtonClick == null || sendButtonClick.found !== true || sendButtonClick.sendButton == null) {
      throw new Error('Messenger send button was not found.')
    }

    await sleep(input.settleMs)

    const tailSnapshotResult = await client.send<ChromeDebugEvaluateResult<MessengerTailSnapshot>>('Runtime.evaluate', {
      expression: buildMessengerTailSnapshotExpression(input.message),
      returnByValue: true,
      awaitPromise: true
    })
    const tailSnapshot = tailSnapshotResult.result?.value

    return {
      target: {
        title: target.title,
        url: target.url
      },
      conversation: selectedConversation.conversation,
      composer: composerLocation.editor,
      sendButton: sendButtonClick.sendButton,
      tail: tailSnapshot?.tail ?? [],
      matches: tailSnapshot?.matches ?? []
    }
  })

  console.log(JSON.stringify(summary, null, 2))
}

export const runChromeDebugMessengerClickReply = async (input: ChromeDebugMessengerClickReplyInput) => {
  const targets = await getChromeDebugTargets(input.port)
  const target = resolveChromeDebugPageTarget(targets, input.pageUrlSubstring)
  const webSocketDebuggerUrl = target.webSocketDebuggerUrl

  if (webSocketDebuggerUrl == null) {
    throw new Error(`Chrome page "${target.title}" does not expose a WebSocket debugger URL.`)
  }

  const summary = await runOnPage(webSocketDebuggerUrl, async (client) => {
    await client.send('Page.bringToFront')
    await client.send('Runtime.enable')

    const selectedConversationResult = await client.send<ChromeDebugEvaluateResult<MessengerConversationSelection>>(
      'Runtime.evaluate',
      {
        expression: buildSelectMessengerConversationExpression(input.conversation),
        returnByValue: true,
        awaitPromise: true
      }
    )
    const selectedConversation = selectedConversationResult.result?.value

    if (
      selectedConversation == null || selectedConversation.found !== true || selectedConversation.conversation == null
    ) {
      throw new Error(`Conversation "${input.conversation}" was not found on the current messenger page.`)
    }

    await sleep(800)

    const selectedBubbleResult = await client.send<ChromeDebugEvaluateResult<MessengerBubbleSelection>>(
      'Runtime.evaluate',
      {
        expression: buildSelectMessengerBubbleExpression(input.messageSnippet),
        returnByValue: true,
        awaitPromise: true
      }
    )
    const selectedBubble = selectedBubbleResult.result?.value

    if (selectedBubble == null || selectedBubble.found !== true || selectedBubble.bubble == null) {
      throw new Error(`Message bubble containing "${input.messageSnippet}" was not found.`)
    }

    const hoverX = Math.round(selectedBubble.bubble.rect.x + selectedBubble.bubble.rect.width - 12)
    const hoverY = Math.round(selectedBubble.bubble.rect.y + 16)
    await client.send('Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      x: hoverX,
      y: hoverY,
      button: 'none',
      buttons: 0
    })

    await sleep(400)

    await client.send('Runtime.evaluate', {
      expression: buildRevealMessengerBubbleToolbarExpression(),
      returnByValue: true,
      awaitPromise: true
    })

    await sleep(250)

    const replyButtonResult = await client.send<ChromeDebugEvaluateResult<MessengerReplyButtonClickResult>>(
      'Runtime.evaluate',
      {
        expression: buildClickMessengerReplyButtonExpression({
          bubbleRect: selectedBubble.bubble.rect,
          replyIndex: input.replyIndex
        }),
        returnByValue: true,
        awaitPromise: true
      }
    )
    const replyButton = replyButtonResult.result?.value

    if (replyButton == null || replyButton.found !== true || replyButton.replyButton == null) {
      throw new Error(`Reply button #${input.replyIndex} was not found for the selected message bubble.`)
    }

    await sleep(input.settleMs)

    const composerSnapshotResult = await client.send<ChromeDebugEvaluateResult<MessengerReplyComposerSnapshot>>(
      'Runtime.evaluate',
      {
        expression: buildMessengerReplyComposerSnapshotExpression(input.messageSnippet),
        returnByValue: true,
        awaitPromise: true
      }
    )
    const composerSnapshot = composerSnapshotResult.result?.value

    return {
      target: {
        title: target.title,
        url: target.url
      },
      conversation: selectedConversation.conversation,
      bubble: selectedBubble.bubble,
      replyButton: replyButton.replyButton,
      composerSnapshot: composerSnapshot?.bottomTexts ?? [],
      matchedSnippet: composerSnapshot?.matchedSnippet ?? false
    }
  })

  console.log(JSON.stringify(summary, null, 2))
}

export const runChromeDebugMessengerClickText = async (input: ChromeDebugMessengerClickTextInput) => {
  const targets = await getChromeDebugTargets(input.port)
  const target = resolveChromeDebugPageTarget(targets, input.pageUrlSubstring)
  const webSocketDebuggerUrl = target.webSocketDebuggerUrl

  if (webSocketDebuggerUrl == null) {
    throw new Error(`Chrome page "${target.title}" does not expose a WebSocket debugger URL.`)
  }

  const summary = await runOnPage(webSocketDebuggerUrl, async (client) => {
    await client.send('Page.bringToFront')
    await client.send('Runtime.enable')

    const selectedConversationResult = await client.send<ChromeDebugEvaluateResult<MessengerConversationSelection>>(
      'Runtime.evaluate',
      {
        expression: buildSelectMessengerConversationExpression(input.conversation),
        returnByValue: true,
        awaitPromise: true
      }
    )
    const selectedConversation = selectedConversationResult.result?.value

    if (
      selectedConversation == null || selectedConversation.found !== true || selectedConversation.conversation == null
    ) {
      throw new Error(`Conversation "${input.conversation}" was not found on the current messenger page.`)
    }

    await sleep(800)

    const clickResult = await client.send<
      ChromeDebugEvaluateResult<{
        found: boolean
        clicked?: {
          rect: {
            x: number
            y: number
            width: number
            height: number
          }
          preview: string
        }
      }>
    >('Runtime.evaluate', {
      expression: buildClickMessengerTextExpression(input.text),
      returnByValue: true,
      awaitPromise: true
    })
    const clicked = clickResult.result?.value

    if (clicked == null || clicked.found !== true || clicked.clicked == null) {
      throw new Error(`Visible text "${input.text}" was not found on the current messenger page.`)
    }

    await sleep(input.settleMs)

    const tailSnapshotResult = await client.send<ChromeDebugEvaluateResult<MessengerTailSnapshot>>('Runtime.evaluate', {
      expression: buildMessengerTailSnapshotExpression(input.text),
      returnByValue: true,
      awaitPromise: true
    })
    const tailSnapshot = tailSnapshotResult.result?.value

    return {
      target: {
        title: target.title,
        url: target.url
      },
      conversation: selectedConversation.conversation,
      clicked: clicked.clicked,
      tail: tailSnapshot?.tail ?? [],
      matches: tailSnapshot?.matches ?? []
    }
  })

  console.log(JSON.stringify(summary, null, 2))
}

export const getDefaultChromeDebugPageUrlSubstring = () => DEFAULT_PAGE_URL_SUBSTRING
