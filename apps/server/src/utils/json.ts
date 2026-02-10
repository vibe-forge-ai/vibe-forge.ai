export function toSerializable(value: unknown, seen = new WeakSet<object>()): unknown {
  if (value == null) {
    return value
  }

  const valueType = typeof value

  if (valueType === 'bigint') {
    return value.toString()
  }

  if (valueType === 'symbol') {
    return value.toString()
  }

  if (valueType === 'function') {
    return '[Function]'
  }

  if (valueType !== 'object') {
    return value
  }

  if (value instanceof Date) {
    return value.toISOString()
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack
    }
  }

  if (value instanceof Map) {
    return Array.from(value.entries()).map(([k, v]) => [toSerializable(k, seen), toSerializable(v, seen)])
  }

  if (value instanceof Set) {
    return Array.from(value.values()).map(v => toSerializable(v, seen))
  }

  if (ArrayBuffer.isView(value)) {
    return Array.from(value as unknown as ArrayLike<number>)
  }

  if (value instanceof ArrayBuffer) {
    return Array.from(new Uint8Array(value))
  }

  if (Array.isArray(value)) {
    return value.map(v => toSerializable(v, seen))
  }

  const obj = value as Record<string, unknown>
  if (seen.has(obj)) {
    return '[Circular]'
  }
  seen.add(obj)

  if (typeof (obj as any).toJSON === 'function') {
    try {
      return toSerializable((obj as any).toJSON(), seen)
    } catch {
      return String(obj)
    }
  }

  const output: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(obj)) {
    output[k] = toSerializable(v, seen)
  }
  return output
}

export function safeJsonStringify(value: unknown, space = 0): string {
  try {
    const serialized = toSerializable(value)
    return JSON.stringify(serialized, null, space) ?? 'null'
  } catch {
    return JSON.stringify(String(value)) ?? 'null'
  }
}
