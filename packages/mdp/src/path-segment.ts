export const toPathSegment = (value: string) => (
  value
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9.-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
)

export const createUniquePathSegments = (values: string[]) => {
  const indexed = values.map((value, index) => ({
    index,
    value,
    baseSegment: toPathSegment(value) || 'item'
  }))
  const byBase = new Map<string, typeof indexed>()

  for (const entry of indexed) {
    const group = byBase.get(entry.baseSegment) ?? []
    group.push(entry)
    byBase.set(entry.baseSegment, group)
  }

  const segments = new Array<string>(values.length)

  for (const [baseSegment, group] of byBase.entries()) {
    const ordered = [...group].sort((left, right) => left.value.localeCompare(right.value) || left.index - right.index)
    for (const [offset, entry] of ordered.entries()) {
      segments[entry.index] = offset === 0 ? baseSegment : `${baseSegment}-${offset + 1}`
    }
  }

  return segments
}
