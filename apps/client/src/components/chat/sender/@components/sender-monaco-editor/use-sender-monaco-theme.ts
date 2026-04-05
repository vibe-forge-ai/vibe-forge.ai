import { useEffect, useState } from 'react'

const getThemeName = () => (document.documentElement.classList.contains('dark') ? 'vs-dark' : 'vs')

export const useSenderMonacoTheme = () => {
  const [themeName, setThemeName] = useState(getThemeName)

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setThemeName(getThemeName())
    })

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    })

    return () => {
      observer.disconnect()
    }
  }, [])

  return themeName
}
