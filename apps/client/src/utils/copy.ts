export async function copyTextWithFeedback(params: {
  failureMessage: string
  messageApi: {
    error: (content: string) => unknown
    success: (content: string) => unknown
  }
  successMessage: string
  text: string
}) {
  try {
    await navigator.clipboard.writeText(params.text)
    void params.messageApi.success(params.successMessage)
    return true
  } catch {
    void params.messageApi.error(params.failureMessage)
    return false
  }
}
