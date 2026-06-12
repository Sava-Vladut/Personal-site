import asciiPortrait from '../../content/ascii.txt?raw'
import { AsciiSpinner } from '../common/AsciiSpinner.jsx'
import { renderBrain, renderLaptop, renderMug } from '../../utils/ascii3d.js'
import { profile } from '../../data/profile.js'
import { useAsciiScramble } from '../../hooks/useAsciiScramble.js'
import { useDecodedText } from '../../hooks/useDecodedText.js'

export function HeroSection() {
  const bootLine = useDecodedText(profile.bootLine, 900)
  const { text: portrait, preRef } = useAsciiScramble(asciiPortrait)

  return (
    <section className="hero-shell" id="home" aria-labelledby="site-name">
      <div className="hero-grid">
        <header className="nameplate">
          <p className="system-line">{bootLine}</p>
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

        <div className="hero-copy">
          <p>/ {profile.subtitle[0]}</p>
          <p>{profile.subtitle[1]}</p>
        </div>

        <div className="spinner-stack">
          <AsciiSpinner
            render={renderMug}
            label="caffeine"
            note="primary fuel source"
            ariaLabel="Rotating ASCII coffee mug"
          />
          <AsciiSpinner
            render={renderLaptop}
            label="code"
            note="daily output"
            ariaLabel="Rotating ASCII laptop"
          />
          <AsciiSpinner
            render={renderBrain}
            label="ideas"
            note="always compiling"
            ariaLabel="Rotating ASCII brain"
          />
        </div>

      </div>
    </section>
  )
}
