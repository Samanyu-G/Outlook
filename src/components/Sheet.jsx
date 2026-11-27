import { useEffect } from 'react'
import Icon from './Icon.jsx'

// A bottom sheet that slides up over the app (comments, sign-in, profile, upload).
export default function Sheet({ title, onClose, children, footer }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div className="sheet-h">
          <h3>{title}</h3>
          <button type="button" aria-label="Close" onClick={onClose}><Icon name="close" size={18} /></button>
        </div>
        <div className="sheet-b">{children}</div>
        {footer}
      </div>
    </div>
  )
}
