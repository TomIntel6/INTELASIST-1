import * as React from 'react'

/**
 * Hook que sincroniza cambios en tiempo real usando localStorage y polling
 * para que múltiples pestañas/usuarios vean los cambios inmediatamente
 */
export function useSyncState<T>(
  key: string,
  initialValue: T,
  pollIntervalMs: number = 5000,
  onChangeRemote?: (newValue: T) => void
) {
  const [value, setValue] = React.useState<T>(initialValue)
  const lastVersionRef = React.useRef<number>(0)

  React.useEffect(() => {
    const storageKey = `sync-state:${key}:version`
    const dataKey = `sync-state:${key}:data`

    const checkForUpdates = () => {
      if (typeof window === 'undefined') {
        return
      }

      try {
        const remoteVersion = Number(window.localStorage.getItem(storageKey) ?? 0)
        const remoteData = window.localStorage.getItem(dataKey)

        if (remoteVersion > lastVersionRef.current && remoteData) {
          try {
            const parsed = JSON.parse(remoteData) as T
            setValue(parsed)
            lastVersionRef.current = remoteVersion
            onChangeRemote?.(parsed)
          } catch {
            // ignore parse error
          }
        }
      } catch {
        // ignore localStorage error
      }
    }

    checkForUpdates()

    const intervalId = window.setInterval(checkForUpdates, pollIntervalMs)

    return () => window.clearInterval(intervalId)
  }, [key, pollIntervalMs, onChangeRemote])

  const updateValue = React.useCallback((newValue: T | ((prev: T) => T)) => {
    if (typeof window === 'undefined') {
      return
    }

    setValue(prev => {
      const next = typeof newValue === 'function' ? (newValue as (prev: T) => T)(prev) : newValue
      const storageKey = `sync-state:${key}:version`
      const dataKey = `sync-state:${key}:data`

      try {
        const currentVersion = Number(window.localStorage.getItem(storageKey) ?? 0)
        const newVersion = currentVersion + 1

        window.localStorage.setItem(dataKey, JSON.stringify(next))
        window.localStorage.setItem(storageKey, String(newVersion))

        lastVersionRef.current = newVersion
      } catch {
        // ignore localStorage error
      }

      return next
    })
  }, [key])

  return [value, updateValue] as const
}
