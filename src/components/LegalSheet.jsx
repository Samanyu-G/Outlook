import { PRIVACY, TERMS } from '../content/legal.js'
import Sheet from './Sheet.jsx'

// Shows the Terms of Service or the Privacy Policy, with a contents list for quick jumping.
export default function LegalSheet({ doc, onClose }) {
  const d = doc === 'privacy' ? PRIVACY : TERMS
  const id = (h) => `${doc}-${h.split('.')[0]}`
  return (
    <Sheet title={d.title} onClose={onClose}>
      <article className="legal-doc" aria-label={d.title}>
        <p className="legal-meta">Version {d.version} · Effective {d.effective}</p>
        <nav className="legal-toc" aria-label="Contents">
          {d.sections.map(([h]) => <a key={h} href={`#${id(h)}`}>{h}</a>)}
        </nav>
        {d.sections.map(([h, blocks]) => (
          <section className="legal" key={h} id={id(h)}>
            <h4>{h}</h4>
            {blocks.map((b, i) => (typeof b === 'string'
              ? (b.length < 40 && !b.endsWith('.') && !b.endsWith(':') ? <h5 key={i}>{b}</h5> : <p key={i}>{b}</p>)
              : <ul key={i}>{b.list.map((li) => <li key={li}>{li}</li>)}</ul>))}
          </section>
        ))}
      </article>
    </Sheet>
  )
}
