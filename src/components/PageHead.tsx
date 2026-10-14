import type { ComponentChildren } from 'preact';
import { t } from '../lib/i18n';
import { Icon } from './icons';
import { NavWheel } from './NavWheel';

/**
 * The top of every page: a serif title, an optional line under it, and the controls on the right.
 * A page you reach from the wheel passes `wheel` (and its `world`, the colour of the wheel’s sky) and shows the wheel after its actions;
 * a page you go into passes `back` and gets the glass arrow above its title, the actions beside it.
 */
export function PageHead({ title, subtitle, back, actions, wheel, world }: {
  title: ComponentChildren;
  subtitle?: ComponentChildren;
  back?: () => void;
  actions?: ComponentChildren;
  wheel?: boolean;
  world?: string | null;
}) {
  const controls = actions || wheel ? <div class="page-actions">{actions}{wheel && <NavWheel world={world} />}</div> : null;
  return (
    <header class="page-head">
      {back && (
        <div class="page-bar">
          <button class="glass glass-btn round" onClick={back} aria-label={t('Back')}><Icon name="arrow-left" /></button>
          {controls}
        </div>
      )}
      <div class="page-title-row">
        <h1 class="title">{title}</h1>
        {!back && controls}
      </div>
      {subtitle && <p class="subtitle">{subtitle}</p>}
    </header>
  );
}
