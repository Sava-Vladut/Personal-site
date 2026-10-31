// The intro: a brain drawn in letters turns in a sky of letter clouds, its regions taking turns to light up; enter and
// it bursts toward you as the journal comes back. Always dark, whatever the theme: the letters glow better. It's at
// #/intro to look at (opening the app plays lib/opening.ts instead).
import { useEffect, useLayoutEffect, useMemo, useState } from 'preact/hooks';
import { AsciiBrain, DIVE_MS, type Word } from '../components/AsciiBrain';
import { CloudTitle } from '../components/cloud';
import { Icon } from '../components/icons';
import { Sky } from '../components/Sky';
import { CORES, shortName } from '../data/emotions';
import { introSeen, markIntroSeen } from '../lib/auth';
import { ZONES } from '../lib/brainShape';
import { LANGS, lang, setLang, t } from '../lib/i18n';
import { goBack } from '../lib/router';
import '../styles/intro.css';

export interface IntroProps {
  id?: string;
  query?: URLSearchParams;
  /** Signed out at startup: called once signed in, with the dive the app should wait for. Without it, Enter goes back. */
  onEnter?: (dive: Promise<void>) => void;
}

/** Feelings for the ring around the brain: two from each world, the worlds taking turns. */
function ringWords(): Word[] {
  const out: Word[] = [];
  for (let k = 0; k < 2; k++)
    for (const core of CORES) {
      const feeling = core.families[k * 2]?.feelings[k];
      if (feeling) out.push({ text: feeling.name.toLowerCase(), world: core.id });
    }
  out.splice(4, 0, { text: t('name it to tame it'), world: 'calm-safety' });
  out.splice(13, 0, { text: t('write it down'), world: 'hope-interest' });
  return out;
}

export function Intro({ onEnter }: IntroProps) {
  const quick = useMemo(introSeen, []);
  const words = useMemo(ringWords, []);
  const [diving, setDiving] = useState(false);
  const [about, setAbout] = useState(false);
  const [spot, setSpot] = useState<string | null>(null);

  useEffect(markIntroSeen, []);

  // always dark in here; the page's own theme comes back on the way out
  useLayoutEffect(() => {
    const root = document.documentElement, meta = document.querySelector('meta[name="theme-color"]');
    const theme = root.dataset.theme, color = meta?.getAttribute('content');
    root.dataset.theme = 'dark';
    meta?.setAttribute('content', '#09090c');
    return () => {
      if (theme) root.dataset.theme = theme;
      if (color) meta?.setAttribute('content', color);
    };
  }, []);

  const enter = () => {
    setDiving(true);
    const dive = new Promise<void>((done) => setTimeout(done, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : DIVE_MS));
    if (onEnter) onEnter(dive);
    else void dive.then(() => goBack(''));
  };

  return (
    <div class={diving ? 'intro diving' : 'intro'}>
      <div class="intro-sky" aria-hidden="true"><Sky /></div>

      <header class="intro-top">
        <span class="intro-mark">my&nbsp;mind<span class="intro-cursor">_</span></span>
        <div class="intro-langs" role="group" aria-label={t('Language')}>
          {LANGS.map(([id, name]) => (
            <button key={id} aria-pressed={lang === id} onClick={() => setLang(id)} title={name}>{id}</button>
          ))}
        </div>
      </header>

      <div class="intro-stage">
        <AsciiBrain
          words={words}
          label={t('A brain drawn in letters, turning slowly')}
          diving={diving}
          quick={quick}
          onSpot={setSpot}
        />
        <p class="intro-spot" aria-live="polite" style={spot ? { '--c': `var(--emo-${spot})` } : undefined}>
          {spot && <><i />{ZONES[spot].name}<span> · {shortName(spot)}</span></>}
        </p>
      </div>

      <div class="intro-copy">
        <CloudTitle text="My Mind" />
        <p class="intro-tag">{t('A private journal for feelings, people and the things that fill your days.')}</p>

        <div class="intro-actions">
          <button class="btn btn-primary intro-go" onClick={enter} disabled={diving}>
            {t('Enter')} <Icon name="chevron-right" size={18} />
          </button>
        </div>

        <button class="intro-about-toggle" aria-expanded={about} onClick={() => setAbout(!about)}>
          <Icon name="info-circle" size={16} /> {t('What is this?')}
        </button>
        {about && (
          <ul class="intro-about">
            <li><b>{t('Journal')}</b> {t('Notes and check-ins, day by day, with photos, places and the weather.')}</li>
            <li><b>{t('Feelings')}</b> {t('Name what you feel from 48 feelings in eight worlds.')}</li>
            <li><b>{t('People and media')}</b> {t('The people, books and music that fill your days.')}</li>
            <li><b>{t('Repos')}</b> {t('Code you’ve written, rated and journaled.')}</li>
            <li><b>{t('Stats and your brain')}</b> {t('The patterns between all of it, drawn as a brain like this one.')}</li>
            <li class="muted">{t('Your journal stays in your browser unless you share it. Sync is end-to-end encrypted.')}</li>
          </ul>
        )}
      </div>

      <footer class="intro-foot">{t('drag to spin · tap a region to light it')}</footer>
    </div>
  );
}
