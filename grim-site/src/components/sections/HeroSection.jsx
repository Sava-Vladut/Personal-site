import asciiPortrait from '../../content/ascii.txt?raw'
import { AsciiSpinner } from '../common/AsciiSpinner.jsx'
import { renderBrain, renderLaptop, renderMug } from '../../utils/ascii3d.js'
import { profile } from '../../data/profile.js'
import { useAsciiScramble } from '../../hooks/useAsciiScramble.js'

export function HeroSection() {
  const { text: portrait, preRef } = useAsciiScramble(asciiPortrait)

  return (
    <section className="hero-shell" id="home" aria-labelledby="site-name">
      <div className="hero-grid">
        <header className="nameplate">
          <h1 id="site-name" aria-label={profile.name}>
            <span>{profile.firstName}</span>
            <span>{profile.lastName}</span>
          </h1>
        </header>

        <div className="portrait" aria-label="Abstract ASCII portrait">
          <pre ref={preRef}>
            {portrait.split('\n').map((line, index) => (
              <div className="portrait-line" key={index} style={{ '--row': index }}>
                {line || ' '}
              </div>
            ))}
          </pre>
        </div>

        <div className="spinner-stack">
          <svg className="ascii-links" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <path d="M 38 33 C 30 24, 22 18, 14 16" />
            <path d="M 66 50 C 74 50, 82 50, 89 50" />
            <path d="M 38 68 C 30 76, 22 82, 14 85" />
            <circle cx="14" cy="16" r="0.42" />
            <circle cx="89" cy="50" r="0.42" />
            <circle cx="14" cy="85" r="0.42" />
          </svg>

          <AsciiSpinner
            render={renderMug}
            ariaLabel="Rotating ASCII coffee mug"
          />
          <AsciiSpinner
            render={renderLaptop}
            ariaLabel="Rotating ASCII laptop"
          />
          <AsciiSpinner
            render={renderBrain}
            ariaLabel="Rotating ASCII brain"
          />
        </div>

      </div>
    </section>
  )
}
