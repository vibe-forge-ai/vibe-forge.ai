import { useCallback, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

import { getClientBase } from '#~/runtime-config.js'

type QueryParamKey<T> = Extract<keyof T, string>

interface QueryParamConfig<T extends Record<string, string>> {
  keys: QueryParamKey<T>[]
  defaults?: Partial<T>
  omit?: Partial<Record<QueryParamKey<T>, (value: string) => boolean>>
}

export const resolveQueryParamPathname = (rawPathname: string, clientBase: string) => {
  if (!rawPathname.startsWith(clientBase)) {
    return rawPathname === '' ? '/' : rawPathname
  }

  const relativePath = rawPathname.slice(clientBase.length)
  if (relativePath === '') {
    return '/'
  }

  return relativePath.startsWith('/') ? relativePath : `/${relativePath}`
}

export const buildQueryParamNavigationTarget = <T extends Record<string, string>>({
  clientBase,
  currentHash,
  currentPathname,
  currentSearch,
  defaults,
  keySet,
  keys,
  omit,
  patch
}: {
  clientBase: string
  currentHash: string
  currentPathname: string
  currentSearch: string
  defaults?: Partial<T>
  keySet: Set<string>
  keys: QueryParamKey<T>[]
  omit?: Partial<Record<QueryParamKey<T>, (value: string) => boolean>>
  patch: Partial<T>
}) => {
  const currentSearchParams = new URLSearchParams(currentSearch)
  const nextParams = new URLSearchParams()
  const merged = keys.reduce((acc, key) => {
    const raw = currentSearchParams.get(key)
    const fallback = defaults?.[key] ?? ''
    acc[key] = (raw ?? fallback) as T[QueryParamKey<T>]
    return acc
  }, {} as T)

  Object.assign(merged, patch)

  keys.forEach((key) => {
    const value = merged[key] ?? ''
    const shouldOmit = value === '' || (omit?.[key] ? omit[key]!(value) : false)
    if (!shouldOmit) nextParams.set(key, value)
  })

  for (const [key, value] of currentSearchParams.entries()) {
    if (!keySet.has(key)) nextParams.append(key, value)
  }

  if (nextParams.toString() === currentSearchParams.toString()) {
    return null
  }

  return {
    pathname: resolveQueryParamPathname(currentPathname, clientBase),
    search: nextParams.toString() === '' ? '' : `?${nextParams.toString()}`,
    hash: currentHash
  }
}

export const useQueryParams = <T extends Record<string, string>>({
  keys,
  defaults,
  omit
}: QueryParamConfig<T>) => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const keySet = useMemo(() => new Set<string>(keys), [keys])

  const values = useMemo(() => {
    return keys.reduce((acc, key) => {
      const raw = searchParams.get(key)
      const fallback = defaults?.[key] ?? ''
      acc[key] = (raw ?? fallback) as T[QueryParamKey<T>]
      return acc
    }, {} as T)
  }, [defaults, keys, searchParams])

  const update = useCallback((patch: Partial<T>) => {
    const currentLocation = typeof window === 'undefined'
      ? {
        hash: '',
        pathname: '/',
        search: searchParams.toString() === '' ? '' : `?${searchParams.toString()}`
      }
      : window.location
    const target = buildQueryParamNavigationTarget<T>({
      clientBase: getClientBase(),
      currentHash: currentLocation.hash,
      currentPathname: currentLocation.pathname,
      currentSearch: currentLocation.search,
      defaults,
      keySet,
      keys,
      omit,
      patch
    })

    if (target != null) {
      void navigate(target, { replace: true })
    }
  }, [defaults, keySet, keys, navigate, omit, searchParams])

  return { values, update, searchParams }
}
