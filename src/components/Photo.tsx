import type { JSX } from 'preact';
import { usePhotoUrl, type Photo } from '../lib/photos';

/** A photo stored on this device. Keeps its shape while the file loads from IndexedDB. */
export function PhotoImg({ photo, class: cls, alt = '', fit = true, ...rest }: { photo: Photo; class?: string; alt?: string; fit?: boolean } & Omit<JSX.HTMLAttributes<HTMLImageElement>, 'src'>) {
  const url = usePhotoUrl(photo.id);
  const style = fit ? { aspectRatio: `${photo.w} / ${photo.h}` } : undefined;
  if (!url) return <span class={`photo-ph ${cls ?? ''}`} style={style} aria-label={alt || undefined} />;
  return <img class={cls} src={url} alt={alt} style={style} {...rest} />;
}
