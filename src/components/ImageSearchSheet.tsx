import { useEffect, useRef, useState } from 'preact/hooks';
import { imageSrc, searchImages } from '../lib/images';
import type { WebImage } from '../lib/store';
import { Icon } from './icons';
import { Sheet } from './Sheet';

/** Search Openverse and pick images. `single` picks one, with `action` as the button's label. */
export function ImageSearchSheet({ open, onClose, onAdd, single, action }: { open: boolean; onClose: () => void; onAdd: (imgs: WebImage[]) => void; single?: boolean; action?: string }) {
  const [q, setQ] = useState('');
  const [searched, setSearched] = useState('');
  const [items, setItems] = useState<WebImage[]>([]);
  const [next, setNext] = useState<number | undefined>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<WebImage[]>([]);
  const req = useRef(0);

  useEffect(() => {
    if (open) setSelected([]);
  }, [open]);

  // Searches run on submit, not while typing: Openverse allows 20 a minute without a key.
  const load = async (query: string, page?: number) => {
    const n = ++req.current;
    setBusy(true);
    setError('');
    if (!page) setItems([]);
    try {
      const res = await searchImages(query, page);
      if (n !== req.current) return;
      setItems((x) => (page ? [...x, ...res.items] : res.items));
      setNext(res.next);
    } catch (e) {
      if (n === req.current) setError((e as Error).message);
    }
    if (n === req.current) setBusy(false);
  };
  const submit = (e: Event) => {
    e.preventDefault();
    const query = q.trim();
    if (!query) return;
    (document.activeElement as HTMLElement | null)?.blur(); // closes the phone keyboard
    setSearched(query);
    load(query);
  };

  const isSel = (url: string) => selected.some((s) => s.url === url);
  const toggle = (img: WebImage) => setSelected((s) => (isSel(img.url) ? s.filter((x) => x.url !== img.url) : single ? [img] : [...s, img]));

  return (
    <Sheet
      open={open}
      onClose={onClose}
      tall
      title={<span class="row gap-s"><Icon name="photo-search" /> Find an image</span>}
      label="Find an image"
      footer={
        selected.length ? (
          <>
            <span class="foot-note">{selected.length} selected</span>
            <button class="btn btn-primary" onClick={() => { onAdd(selected); onClose(); }}>{action ?? `Add ${selected.length === 1 ? 'image' : `${selected.length} images`}`}</button>
          </>
        ) : undefined
      }
    >
      <div class="stack">
        <form class="search" onSubmit={submit} role="search">
          <Icon name="search" size={18} />
          <input type="search" enterKeyHint="search" placeholder="Rainy window, sunset, cozy café…" value={q} onInput={(e) => setQ(e.currentTarget.value)} aria-label="Search images" />
        </form>
        {items.length > 0 && (
          <div class="img-grid">
            {items.map((img) => (
              <button class="img-pick" aria-pressed={isSel(img.url)} onClick={() => toggle(img)} aria-label={img.title || 'Image'}>
                <img src={imageSrc(img, 'thumb')} alt="" loading="lazy" referrerpolicy="no-referrer" style={img.w && img.h ? { aspectRatio: `${img.w} / ${img.h}` } : undefined} />
                <span class="img-check"><Icon name="check" size={16} stroke={2.5} /></span>
              </button>
            ))}
          </div>
        )}
        {busy && <p class="hint center">Searching…</p>}
        {error && <p class="error">{error}</p>}
        {!busy && next !== undefined && <button class="btn btn-quiet block" onClick={() => load(searched, next)}>More images</button>}
        {!busy && !error && searched && !items.length && <p class="hint center">No images found. Try other words.</p>}
        {!searched && <p class="hint center">Search for a picture that fits this moment.</p>}
      </div>
      <p class="attribution">Openly licensed images from Openverse</p>
    </Sheet>
  );
}
