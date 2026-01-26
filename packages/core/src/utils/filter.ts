export const filterObject = <T extends Record<string, any>>(
  obj: T,
  rules: { include?: string[]; exclude?: string[] }
): Partial<T> => {
  const { include = [], exclude = [] } = rules

  if (include.length === 0 && exclude.length === 0) {
    return { ...obj }
  }

  const result: Partial<T> = {}

  Object.keys(obj).forEach((key) => {
    // If include list is provided, key MUST be in it
    if (include.length > 0 && !include.includes(key)) {
      return
    }
    // If key is in exclude list, it MUST NOT be in it
    if (exclude.includes(key)) {
      return
    }
    result[key as keyof T] = obj[key]
  })

  return result
}
