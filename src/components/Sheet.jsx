import { useEffect } from 'react'
import { CloseIcon } from './Icons.jsx'

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
          <button type="button" aria-label="Close" onClick={onClose}><CloseIcon /></button>
        </div>
        <div className="sheet-b">{children}</div>
        {footer}
      </div>
    </div>
  )
}
