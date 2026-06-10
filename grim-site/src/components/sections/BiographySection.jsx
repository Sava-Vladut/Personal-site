import { SectionTitle } from '../common/SectionTitle.jsx'
import { biographyColumns } from '../../data/biography.js'

export function BiographySection() {
  return (
    <section className="section biography" id="biography">
      <SectionTitle>Biography</SectionTitle>
      <div className="bio-grid">
        {biographyColumns.map((column) => (
          <p key={column.join('-')}>
            {column.map((word) => (
              <span key={word}>{word}</span>
            ))}
          </p>
        ))}
      </div>
    </section>
  )
}
