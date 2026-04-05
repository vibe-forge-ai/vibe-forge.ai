const CHAT_HISTORY_STORAGE_KEY = 'vf_chat_history'

const reportHistoryError = (action: 'read' | 'write', error: unknown) => {
  console.error(`Failed to ${action} chat history`, error)
}

export const isActivationKey = (key: string) => key === 'Enter' || key === ' '

export const readFileAsDataUrl = (file: File) => {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      resolve(typeof reader.result === 'string' ? reader.result : '')
    }
    reader.onerror = () => {
      reject(new Error('read_failed'))
    }
    reader.readAsDataURL(file)
  })
}

export const loadChatHistory = () => {
  try {
    const rawHistory = localStorage.getItem(CHAT_HISTORY_STORAGE_KEY)
    const parsedHistory = rawHistory != null ? JSON.parse(rawHistory) : []
    if (!Array.isArray(parsedHistory)) {
      return []
    }

    return parsedHistory.filter((item): item is string => typeof item === 'string')
  } catch (error) {
    reportHistoryError('read', error)
    return []
  }
}

export const saveChatHistoryEntry = (input: string) => {
  try {
    const history = loadChatHistory()
    const nextHistory = [input, ...history.filter(entry => entry !== input)].slice(0, 50)
    localStorage.setItem(CHAT_HISTORY_STORAGE_KEY, JSON.stringify(nextHistory))
  } catch (error) {
    reportHistoryError('write', error)
  }
}
