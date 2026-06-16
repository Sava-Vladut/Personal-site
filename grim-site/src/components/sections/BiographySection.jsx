import { biographyColumns } from '../../data/biography.js'

// Connective words read as quiet "ligatures" between the load-bearing keywords,
// so they're dimmed wherever they appear rather than at fixed grid positions.
const CONNECTIVES = new Set(['FOR', 'IN', 'WITH', 'A', 'THE', 'OF', 'TO', 'AND'])

export function BiographySection() {
  return (
    <section className="section biography" id="biography">
      <div className="bio-grid">
        {biographyColumns.map((column, index) => (
          <article className="bio-col" key={column.join('-')}>
            <span className="bio-index" aria-hidden="true">
              {String(index + 1).padStart(2, '0')}
            </span>
            <p className="bio-phrase">
              {column.map((word) => (
                <span
                  key={word}
                  className={CONNECTIVES.has(word) ? 'is-dim' : undefined}
                >
                  {word}
                </span>
              ))}
            </p>
          </article>
        ))}
      </div>
    </section>
  )
}
