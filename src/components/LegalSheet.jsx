import { PRIVACY, TERMS } from '../content/legal.js'
import Sheet from './Sheet.jsx'

// Shows the Terms of Service or Privacy Policy.
export default function LegalSheet({ doc, onClose }) {
  const d = doc === 'privacy' ? PRIVACY : TERMS
  return (
    <Sheet title={d.title} onClose={onClose}>
      <p className="muted small">Last updated {d.updated}</p>
      {d.sections.map(([h, body]) => (
        <section className="legal" key={h}>
          <h4>{h}</h4>
          <p>{body}</p>
        </section>
      ))}
    </Sheet>
  )
}
