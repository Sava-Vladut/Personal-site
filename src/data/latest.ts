import type { Release } from './changelog';

declare const __LATEST_RELEASE__: Release;
/** The newest release, written in by the build (vite.config.ts), so nothing loads the whole changelog just for it. */
export const LATEST = __LATEST_RELEASE__;
