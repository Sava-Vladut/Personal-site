import { useEffect, useState } from 'preact/hooks';
import {
  connectPinterest, listBoards, listPins, pinStatus, resolvePin, sized,
  type Board, type Pin, type PinStatus,
} from '../lib/pinterest';
import type { PinImage } from '../lib/store';
import { Icon } from './icons';
import { Sheet } from './Sheet';

type View = { kind: 'boards' } | { kind: 'pins'; board: Board | null };

export function PinterestSheet({ open, onClose, onAdd }: { open: boolean; onClose: () => void; onAdd: (imgs: PinImage[]) => void }) {
  const [tab, setTab] = useState<'link' | 'boards'>('link');
  const [status, setStatus] = useState<PinStatus | null>(null);
  const [selected, setSelected] = useState<PinImage[]>([]);

  useEffect(() => {
    if (!open) return;
    setSelected([]);
    pinStatus().then((s) => {
      setStatus(s);
      if (s.connected) setTab('boards');
    });
  }, [open]);

  const toggle = (img: PinImage) =>
    setSelected((s) => (s.some((x) => x.url === img.url) ? s.filter((x) => x.url !== img.url) : [...s, img]));
  const add = (imgs: PinImage[]) => {
    onAdd(imgs);
    onClose();
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      tall
      title={<span class="row gap-s"><Icon name="brand-pinterest" /> Pinterest</span>}
      label="Add from Pinterest"
      footer={
        tab === 'boards' && selected.length ? (
          <>
            <span class="foot-note">{selected.length} selected</span>
            <button class="btn btn-primary" onClick={() => add(selected)}>Add {selected.length === 1 ? 'image' : `${selected.length} images`}</button>
          </>
        ) : undefined
      }
    >
      <div class="seg" role="tablist">
        <button role="tab" aria-selected={tab === 'link'} onClick={() => setTab('link')}>Paste a link</button>
        <button role="tab" aria-selected={tab === 'boards'} onClick={() => setTab('boards')}>My boards</button>
      </div>
      {tab === 'link' ? <LinkTab onAdd={(img) => add([img])} /> : <BoardsTab status={status} selected={selected} onToggle={toggle} />}
    </Sheet>
  );
}

function LinkTab({ onAdd }: { onAdd: (img: PinImage) => void }) {
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<PinImage | null>(null);

  const fetchPin = async (e?: Event) => {
    e?.preventDefault();
    if (!url.trim()) return;
    setBusy(true);
    setError('');
    setPreview(null);
    try {
      setPreview(await resolvePin(url));
    } catch (err) {
      setError((err as Error).message);
    }
    setBusy(false);
  };
  const paste = async () => {
    try {
      const t = await navigator.clipboard.readText();
      if (t) setUrl(t.trim());
    } catch {}
  };

  return (
    <form class="stack" onSubmit={fetchPin}>
      <p class="hint">In Pinterest, tap <b>Share → Copy link</b> on a pin, then paste it here.</p>
      <div class="row gap-s">
        <input
          class="input grow"
          type="url"
          inputMode="url"
          placeholder="pin.it/… or pinterest.com/pin/…"
          value={url}
          onInput={(e) => setUrl(e.currentTarget.value)}
          aria-label="Pin link"
        />
        {'clipboard' in navigator && !url && (
          <button type="button" class="btn btn-quiet" onClick={paste}>Paste</button>
        )}
      </div>
      <button class="btn btn-primary block" disabled={busy || !url.trim()}>{busy ? 'Finding image…' : 'Get image'}</button>
      {error && <p class="error">{error}</p>}
      {preview && (
        <div class="pin-preview">
          <img src={sized(preview.url, 474)} alt={preview.title || 'Pinterest image'} referrerpolicy="no-referrer" />
          {preview.title && <p class="hint">{preview.title}</p>}
          <button type="button" class="btn btn-primary block" onClick={() => onAdd(preview)}>Add image</button>
        </div>
      )}
    </form>
  );
}

function BoardsTab({ status, selected, onToggle }: { status: PinStatus | null; selected: PinImage[]; onToggle: (i: PinImage) => void }) {
  const [view, setView] = useState<View>({ kind: 'boards' });
  const [boards, setBoards] = useState<Board[]>([]);
  const [pins, setPins] = useState<Pin[]>([]);
  const [bookmark, setBookmark] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = async (v: View, more = false) => {
    setBusy(true);
    setError('');
    try {
      if (v.kind === 'boards') {
        const page = await listBoards(more ? bookmark : undefined);
        setBoards((b) => (more ? [...b, ...page.items] : page.items));
        setBookmark(page.bookmark);
      } else {
        const page = await listPins(v.board?.id ?? null, more ? bookmark : undefined);
        setPins((p) => (more ? [...p, ...page.items] : page.items));
        setBookmark(page.bookmark);
      }
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
  };

  useEffect(() => {
    if (status?.connected) load(view);
  }, [status?.connected, view]);

  if (!status) return <p class="hint">Checking Pinterest…</p>;
  if ((status as { offline?: boolean }).offline)
    return <p class="empty-note">Board browsing needs the app’s server. Start it with <code>npm start</code>, or paste a pin link instead.</p>;
  if (!status.configured)
    return (
      <div class="empty-note">
        <p>To browse your boards, add a Pinterest app key to the server’s <code>.env</code> file (<code>PINTEREST_APP_ID</code> and <code>PINTEREST_APP_SECRET</code>). The README has the steps.</p>
        <p>Pasting a pin link works without it.</p>
      </div>
    );
  if (!status.connected)
    return (
      <div class="empty-note center">
        <p>Connect your Pinterest account to pick images from your boards.</p>
        <button class="btn btn-primary" onClick={connectPinterest}><Icon name="brand-pinterest" size={18} /> Connect Pinterest</button>
      </div>
    );

  const isSel = (url: string) => selected.some((s) => s.url === url);

  return (
    <div class="stack">
      {view.kind === 'pins' && (
        <button class="back-link" onClick={() => { setPins([]); setView({ kind: 'boards' }); }}>
          <Icon name="chevron-left" size={18} /> {view.board?.name ?? 'All pins'}
        </button>
      )}
      {view.kind === 'boards' ? (
        <div class="board-grid">
          <button class="board" onClick={() => setView({ kind: 'pins', board: null })}>
            <span class="board-cover is-empty"><Icon name="layout-grid" size={22} /></span>
            <span class="board-name">All my pins</span>
          </button>
          {boards.map((b) => (
            <button class="board" onClick={() => setView({ kind: 'pins', board: b })}>
              <span class="board-cover">{b.cover ? <img src={b.cover} alt="" loading="lazy" referrerpolicy="no-referrer" /> : <Icon name="photo" size={22} />}</span>
              <span class="board-name">{b.name}</span>
              <span class="board-count">{b.count} pins</span>
            </button>
          ))}
        </div>
      ) : (
        <div class="pin-grid">
          {pins.map((p) => (
            <button class="pin" aria-pressed={isSel(p.url)} onClick={() => onToggle({ url: p.url, w: p.w, h: p.h, link: p.link, title: p.title })}>
              <img src={p.thumb} alt={p.title || ''} loading="lazy" referrerpolicy="no-referrer" style={p.w && p.h ? { aspectRatio: `${p.w} / ${p.h}` } : undefined} />
              <span class="pin-check"><Icon name="check" size={16} stroke={2.5} /></span>
            </button>
          ))}
        </div>
      )}
      {busy && <p class="hint center">Loading…</p>}
      {error && <p class="error">{error}</p>}
      {!busy && bookmark && <button class="btn btn-quiet block" onClick={() => load(view, true)}>Load more</button>}
      {!busy && !error && view.kind === 'pins' && !pins.length && <p class="hint center">No pins here yet.</p>}
    </div>
  );
}
