interface KeyedOrderedItem {
  key: string
  order: number
}

export const filterUniqueStrings = (values: string[]) => Array.from(new Set(values))

export const collectVisibleRecentKeys = (
  recentKeys: string[],
  validKeys: Set<string>,
  limit: number
) => {
  const visibleKeys: string[] = []

  for (const key of filterUniqueStrings(recentKeys)) {
    if (!validKeys.has(key)) {
      continue
    }

    visibleKeys.push(key)

    if (visibleKeys.length >= limit) {
      break
    }
  }

  return visibleKeys
}

export const orderItemsByPriorityKeys = <T extends KeyedOrderedItem>(
  items: T[],
  priorityKeys: string[]
) => {
  if (priorityKeys.length === 0) {
    return items
  }

  const priorityMap = new Map(priorityKeys.map((key, index) => [key, index]))

  return [...items].sort((left, right) => {
    const leftPriority = priorityMap.get(left.key)
    const rightPriority = priorityMap.get(right.key)

    if (leftPriority != null && rightPriority != null) {
      return leftPriority - rightPriority
    }

    if (leftPriority != null) {
      return -1
    }

    if (rightPriority != null) {
      return 1
    }

    return left.order - right.order
  })
}
