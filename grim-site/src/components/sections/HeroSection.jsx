import asciiPortrait from '../../data/ascii.txt?raw'
import { profile } from '../../data/profile.js'
import { useDecodedText } from '../../hooks/useDecodedText.js'

export function HeroSection() {
  const bootLine = useDecodedText(profile.bootLine, 900)

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
          <pre>{asciiPortrait}</pre>
        </div>

        <div className="hero-copy">
          <p>/ {profile.subtitle[0]}</p>
          <p>{profile.subtitle[1]}</p>
        </div>

        <div className="location-copy">
          <p>/ {profile.location[0]}</p>
          <p>{profile.location[1]}</p>
        </div>

        <p className="keyboard-hint">
          / use your keyboard to navigate <span className="cursor">_</span>
        </p>
      </div>
    </section>
  )
}
