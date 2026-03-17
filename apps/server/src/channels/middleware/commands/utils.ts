export const splitCommand = (commandText: string) => commandText.trim().split(/\s+/).filter(Boolean)
export const dedupe = (items: string[]) => Array.from(new Set(items.filter(item => item !== '')))
