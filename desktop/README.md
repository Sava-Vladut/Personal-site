# My Mind for Windows

`MyMind.exe` is a tiny native Windows app: one self-contained exe of a few hundred KB, no installer, that opens a
window running https://savavlad.com in Microsoft Edge WebView2 (already part of Windows 10 and 11). The UI is the live
site, so every site deploy reaches the app at once; the exe only needs rebuilding when the shell itself changes.

- **Contract with the site:** on savavlad.com pages the app defines a read-only
  `window.myMindDesktop = Object.freeze({ platform: 'windows', version })`, `version` being the exe's (from the tag).
- **Links:** `target=_blank` and `window.open` links open in the default browser. Everything else stays in the
  window, including sign-in with GitHub and Spotify. F11 toggles fullscreen.
- **Data:** the app has its own storage under `%LOCALAPPDATA%\My Mind`, separate from Edge or Chrome. Bring the
  journal over with a sync code or a backup.
- **SmartScreen:** the exe isn't signed, so the first launch may say "Windows protected your PC": choose
  More info, then Run anyway.

## Build and release

- Release: `git tag desktop-vX.Y.Z && git push origin desktop-vX.Y.Z`. `.github/workflows/desktop.yml` builds it on
  `windows-latest` and publishes `MyMind.exe` as the latest release, served at
  https://github.com/Sava-Vladut/Personal-site/releases/latest/download/MyMind.exe
- Locally, from an x64 Native Tools Command Prompt for VS: `desktop\build.cmd 1.2.3`. It downloads the pinned
  WebView2 SDK into `desktop\build\` and links its static loader and the static CRT, so nothing ships beside the exe.
