// hls.js ships its light build (no subtitles, alternate audio or DRM: views/Watch.tsx needs none) without types of its own.
declare module 'hls.js/light' {
  import Hls from 'hls.js';
  export { FetchLoader } from 'hls.js';
  export default Hls;
}
