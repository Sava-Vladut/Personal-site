import asciiPortrait from '../../content/ascii.txt?raw'
import { AsciiSpinner } from '../common/AsciiSpinner.jsx'
import { RadiatingNumbers } from '../common/RadiatingNumbers.jsx'
import { renderBrain, renderGlobe, renderLaptop, renderMug } from '../../utils/ascii3d.js'
import { useAsciiScramble } from '../../hooks/useAsciiScramble.js'

export function HeroSection() {
  const { text: portrait, preRef } = useAsciiScramble(asciiPortrait)

  return (
    <section className="hero-shell" id="home" aria-label="Home">
      <div className="hero-grid">
        <div className="portrait" aria-label="Abstract ASCII portrait">
          <RadiatingNumbers />
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
            <path d="M 62 33 C 70 24, 78 18, 86 16" />
            <path d="M 38 68 C 30 76, 22 82, 14 85" />
            <path d="M 62 68 C 70 76, 78 82, 86 85" />
            <circle cx="14" cy="16" r="0.42" />
            <circle cx="86" cy="16" r="0.42" />
            <circle cx="14" cy="85" r="0.42" />
            <circle cx="86" cy="85" r="0.42" />
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
          <AsciiSpinner
            render={renderGlobe}
            ariaLabel="Rotating ASCII globe"
          />
        </div>

      </div>
    </section>
  )
}
