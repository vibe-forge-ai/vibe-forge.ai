export interface SenderEditorSelection {
  start: number
  end: number
}

export interface SenderEditorHandle {
  focus: () => void
  setSelection: (selection: SenderEditorSelection) => void
  getSelection: () => SenderEditorSelection | null
  getValue: () => string
  isDisabled: () => boolean
}
