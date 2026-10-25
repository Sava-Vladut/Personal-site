import type { ComponentChildren } from 'preact';
import { t } from '../lib/i18n';
import { Icon } from './icons';
import { NavWheel } from './NavWheel';
import { CountdownButton } from './CountdownButton';

/**
 * The top of every page: a serif title, an optional line under it, and the controls on the right.
 * A page you reach from the wheel passes `wheel` (and its `world`, the colour of the wheel’s sky) and shows the wheel after its actions (and the countdown's button beside it, while it lasts);
 * a page you go into passes `back` and gets the glass arrow above its title, the actions beside it;
 * `stack` sets the controls on a bar above the title, so a long title (the journal's date) keeps the full width.
 */
export function PageHead({ title, subtitle, back, actions, wheel, world, stack }: {
  title: ComponentChildren;
  subtitle?: ComponentChildren;
  back?: () => void;
  actions?: ComponentChildren;
  wheel?: boolean;
  world?: string | null;
  stack?: boolean;
}) {
  const controls = actions || wheel ? <div class="page-actions">{actions}{wheel && <CountdownButton />}{wheel && <NavWheel world={world} />}</div> : null;
  return (
    <header class="page-head">
      {(back || (stack && controls)) && (
        <div class="page-bar">
          {back && <button class="glass glass-btn round" onClick={back} aria-label={t('Back')}><Icon name="arrow-left" /></button>}
          {controls}
        </div>
      )}
      <div class="page-title-row">
        <h1 class="title">{title}</h1>
        {!back && !stack && controls}
      </div>
      {subtitle && <p class="subtitle">{subtitle}</p>}
    </header>
  );
}
