import type { JSX } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { watchView } from '../lib/inView';
import { usePhotoUrl, type Photo } from '../lib/photos';

/** A photo stored on this device. Keeps its shape while the file loads from IndexedDB. `card`: shown small, in a list,
 * so a smaller copy is enough (lib/photos.ts). */
export function PhotoImg({ photo, class: cls, alt = '', fit = true, card = false, ...rest }: { photo: Photo; class?: string; alt?: string; fit?: boolean; card?: boolean } & Omit<JSX.HTMLAttributes<HTMLImageElement>, 'src'>) {
  const ref = useRef<HTMLSpanElement>(null);
  const [near, setNear] = useState(false);
  const url = usePhotoUrl(photo.id, near, card);
  useEffect(() => {
    if (near || !ref.current) return;
    return watchView(ref.current, (on) => { if (on) setNear(true); });
  }, [near, photo.id]);
  const style = fit ? { aspectRatio: `${photo.w} / ${photo.h}` } : undefined;
  if (!url) return <span ref={ref} class={`photo-ph ${cls ?? ''}`} style={style} aria-label={alt || undefined} />;
  return <img class={cls} src={url} alt={alt} style={style} loading="lazy" decoding="async" {...rest} />;
}
