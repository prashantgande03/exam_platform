import React, { useEffect } from 'react'

// Anti-cheat: block copy/paste, detect tab switch (blur/visibilitychange)
export default function AntiCheatGuard({ onViolation }) {
  useEffect(() => {
    const preventCopy = (e) => {
      e.preventDefault()
      onViolation?.('copy-paste')
    }
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && ['c', 'v', 'x', 'a'].includes(e.key.toLowerCase())) {
        e.preventDefault()
        onViolation?.('copy-paste')
      }
    }
    const onBlur = () => onViolation?.('tab-switch')
    const onVisibility = () => {
      if (document.hidden) onViolation?.('tab-switch')
    }

    document.addEventListener('copy', preventCopy)
    document.addEventListener('cut', preventCopy)
    document.addEventListener('paste', preventCopy)
    document.addEventListener('keydown', onKey)
    window.addEventListener('blur', onBlur)
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      document.removeEventListener('copy', preventCopy)
      document.removeEventListener('cut', preventCopy)
      document.removeEventListener('paste', preventCopy)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('blur', onBlur)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [onViolation])

  return null
}
