export function kebabCase(str: string) {
  return str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase()
}

export function camelCase(str: string) {
  return str.replace(/[-_]([a-z])/g, (_, letter) => letter.toUpperCase())
}

export function transformAllObjectKeys(
  transformFn: (str: string) => string,
  obj: unknown
): unknown {
  const boundTransformFn = transformAllObjectKeys.bind(null, transformFn)
  if (typeof obj !== 'object') return obj
  if (Array.isArray(obj)) {
    return obj.map(boundTransformFn)
  }
  if (obj === null) {
    return null
  }
  const newObj: Record<string, unknown> = {}
  for (const key in obj) {
    newObj[transformFn(key)] = boundTransformFn(
      // @ts-ignore
      obj[key]
    )
  }
  return newObj
}

export function transformKebabKey<T>(obj: unknown) {
  return transformAllObjectKeys(kebabCase, obj) as T
}

export function transformCamelKey<T>(obj: unknown) {
  return transformAllObjectKeys(camelCase, obj) as T
}
