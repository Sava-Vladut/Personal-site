import { useRoute, navigate, type RouteName } from '../lib/router';
import { prepareView, viewFor } from '../lib/views';
import { t } from '../lib/i18n';
import { WHEEL } from '../data/wheel';
import { toast } from '../lib/store';
import { PageHead } from '../components/PageHead';
import { LinkRow } from '../components/learn';
import { Toasts } from '../components/Toasts';

const PAGES: RouteName[] = ['traps', 'laws', 'friends'];
export const isLearn = (name: RouteName) => PAGES.includes(name);

const LEARN = WHEEL.find((n) => n.id === 'learn')!;

function LearnIndex() {
  return (
    <div class="page lrn-page">
      <PageHead title={LEARN.name} subtitle={LEARN.sub} />
      <div class="lrn-links">
        {LEARN.kids!.map((p) => (
          <LinkRow key={p.id} hue={p.hue!} icon={p.icon} title={p.name} how={p.sub} onClick={() => navigate(p.to!)} />
        ))}
      </div>
    </div>
  );
}

/**
 * A shared Learn link (/learn#/traps…), for anyone: just the Learn pages, moving between each other as in the app, with
 * no sign-in and nothing of the journal loaded. Anywhere else (back from a page) shows the three to choose from.
 */
export function LearnPublic() {
  const route = useRoute((name) => (isLearn(name) ? prepareView(name) : undefined), () => toast(t('Couldn’t open this page. Try again.')));
  const View = isLearn(route.name) ? viewFor(route.name) : null;
  return (
    <>
      <main class={`app route-${View ? route.name : 'learn'}`}>
        {View ? <View key={route.name} id="" query={route.query} /> : <LearnIndex />}
      </main>
      <Toasts />
    </>
  );
}
