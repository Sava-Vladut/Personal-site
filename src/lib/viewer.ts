// Full-screen photo viewer, on PhotoSwipe (photoswipe.com): pinch or double-tap to zoom, drag to pan, swipe between
// a note's pictures, swipe down (or pinch in) to close. It grows out of the picture that was tapped and shrinks back.
import PhotoSwipe, { type SlideData } from 'photoswipe';
import 'photoswipe/style.css';
import UI from '../data/ui-icons.json';
import { svgInner } from './icons';
import { pushBack } from './router';

export interface ViewItem {
  src: string;
  w?: number;
  h?: number;
  alt?: string;
  caption?: string;
  el?: HTMLElement | null;  // the picture on the page, to zoom out of and back into
  save?: string;            // a file name: offers a Save button
  link?: string;            // the page an image came from
  album?: boolean;          // one of an album's pictures: offers taking it out
}

export interface ViewOptions {
  onRemove?: (index: number) => void;
  onTakeOut?: (index: number) => void;
}

const icon = (name: keyof typeof UI) =>
  `<svg class="pswp__icn viewer-icn" viewBox="0 0 24 24" aria-hidden="true">${svgInner('t:' + name, UI[name], 1.75)}</svg>`;

/** The size of a picture whose size the note doesn't know, read off the image itself (given up on after 4s). */
function measure(src: string) {
  return new Promise<{ w: number; h: number } | null>((resolve) => {
    const img = new Image();
    const t = setTimeout(() => resolve(null), 4000);
    img.onload = () => (clearTimeout(t), resolve({ w: img.naturalWidth, h: img.naturalHeight }));
    img.onerror = () => (clearTimeout(t), resolve(null));
    img.referrerPolicy = 'no-referrer';
    img.src = src;
  });
}

let current: PhotoSwipe | null = null;

export async function openViewer(items: ViewItem[], index: number, opts: ViewOptions = {}) {
  if (current || !items.length) return;
  const data: (SlideData & { item: ViewItem })[] = await Promise.all(
    items.map(async (item) => {
      let { w, h } = item;
      if (!w || !h) {
        const thumb = item.el?.querySelector('img');
        const s = thumb?.naturalWidth ? { w: thumb.naturalWidth, h: thumb.naturalHeight } : await measure(item.src);
        w = s?.w ?? 1200;
        h = s?.h ?? 900;
      }
      const thumb = item.el?.querySelector('img');
      return { src: item.src, msrc: thumb?.currentSrc || undefined, width: w, height: h, alt: item.alt, element: item.el ?? undefined, item };
    }),
  );

  const pswp = new PhotoSwipe({
    dataSource: data,
    index,
    bgOpacity: 1,
    showHideAnimationType: 'zoom',
    zoom: false,           // the zoom is in the fingers (and a double tap)
    imageClickAction: 'zoom',
    tapAction: 'toggle-controls',
    doubleTapAction: 'zoom',
    secondaryZoomLevel: 2.5,
    maxZoomLevel: 6,
    wheelToZoom: true,
    closeTitle: 'Close',
    closeSVG: icon('x'),
    arrowPrevTitle: 'Previous',
    arrowNextTitle: 'Next',
    errorMsg: 'This picture couldn’t be loaded',
    mainClass: 'viewer',
    paddingFn: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  });
  const slide = () => (pswp.currSlide?.data as (typeof data)[number] | undefined)?.item;

  pswp.on('uiRegister', () => {
    const button = (name: string, order: number, title: string, svg: string, show: (i: ViewItem) => boolean, click: (i: ViewItem) => void) =>
      pswp.ui!.registerElement({
        name,
        order,
        isButton: true,
        title,
        html: svg,
        onInit: (el) => {
          const sync = () => {
            const i = slide();
            (el as HTMLElement).hidden = !i || !show(i);
          };
          pswp.on('change', sync);
          sync();
        },
        onClick: () => {
          const i = slide();
          if (i) click(i);
        },
      });
    button('save', 8, 'Save', icon('download'), (i) => !!i.save, (i) => {
      const a = document.createElement('a');
      a.href = i.src;
      a.download = i.save!;
      a.click();
    });
    button('source', 8, 'Open source', icon('arrow-up-right'), (i) => !!i.link, (i) => open(i.link, '_blank', 'noopener,noreferrer'));
    if (opts.onTakeOut)
      button('takeout', 8, 'Take out of the album', icon('stack-pop'), (i) => !!i.album, () => {
        const at = pswp.currIndex;
        pswp.close();
        opts.onTakeOut!(at);
      });
    if (opts.onRemove)
      button('remove', 9, 'Remove', icon('trash'), () => true, () => {
        const at = pswp.currIndex;
        pswp.close();
        opts.onRemove!(at);
      });
    pswp.ui!.registerElement({
      name: 'caption',
      order: 9,
      isButton: false,
      appendTo: 'root',
      onInit: (el) => {
        const sync = () => {
          const c = slide()?.caption ?? '';
          el.textContent = c;
          el.hidden = !c;
        };
        pswp.on('change', sync);
        sync();
      },
    });
  });

  // The back button closes the viewer, as it does a sheet.
  let release: (() => void) | null = null;
  pswp.on('beforeOpen', () => (release = pushBack(() => pswp.close())));
  pswp.on('destroy', () => {
    current = null;
    release?.();
  });
  current = pswp;
  pswp.init();
}
