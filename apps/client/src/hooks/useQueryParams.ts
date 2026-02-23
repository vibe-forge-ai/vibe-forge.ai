import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'

type QueryParamConfig<T extends Record<string, string>> = {
  keys: Array<keyof T & string>
  defaults?: Partial<T>
  omit?: Partial<Record<keyof T & string, (value: string) => boolean>>
}

export const useQueryParams = <T extends Record<string, string>>({
  keys,
  defaults,
  omit
}: QueryParamConfig<T>) => {
  const [searchParams, setSearchParams] = useSearchParams()
  const keySet = useMemo(() => new Set(keys), [keys])

  const values = useMemo(() => {
    return keys.reduce((acc, key) => {
      const raw = searchParams.get(key)
      const fallback = defaults?.[key] ?? ''
      acc[key] = (raw ?? fallback) as T[keyof T]
      return acc
    }, {} as T)
  }, [defaults, keys, searchParams])

  const update = useCallback((patch: Partial<T>) => {
    const nextParams = new URLSearchParams()
    const merged = keys.reduce((acc, key) => {
      const raw = searchParams.get(key)
      const fallback = defaults?.[key] ?? ''
      acc[key] = (raw ?? fallback) as T[keyof T]
      return acc
    }, {} as T)

    Object.assign(merged, patch)

    keys.forEach((key) => {
      const value = merged[key] ?? ''
      const shouldOmit = value === '' || (omit?.[key] ? omit[key]!(value) : false)
      if (!shouldOmit) nextParams.set(key, value)
    })

    for (const [key, value] of searchParams.entries()) {
      if (!keySet.has(key)) nextParams.append(key, value)
    }

    if (nextParams.toString() !== searchParams.toString()) {
      setSearchParams(nextParams, { replace: true })
    }
  }, [defaults, keySet, keys, omit, searchParams, setSearchParams])

  return { values, update, searchParams }
}
