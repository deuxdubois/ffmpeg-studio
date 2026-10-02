# FFmpeg Studio 🎬

> In-browser media converter and editor powered by FFmpeg WebAssembly.

## Features
- **100% Client-Side / Zero Server:** Runs entirely in your browser via WASM. No server upload, zero backend maintenance.
- **Drag & Drop:** Easy file dropping zone for videos and audio files.
- **Basic FFmpeg Features:**
  - **Format Conversion:** Convert MP4, WebM, AVI, MOV, GIF, MP3, WAV.
  - **Resize / Scale:** Change video resolution (1080p, 720p, 480p, 360p).
  - **Trim Video:** Cut video clips by start time and duration.
  - **Extract Audio:** Extract MP3 tracks from video files.
  - **Mute Audio:** Strip audio tracks from video.
- **Real-Time Progress & Logs:** Live progress bar and console output.

## Getting Started

```bash
# Install dependencies
npm install

# Run local development server (no COOP/COEP headers needed: uses the single-threaded core)
npm run dev

# Build for production
npm run build
```

## Project layout / FFmpeg core files
```
public/ffmpeg-core.js     <- ESM build of @ffmpeg/core 0.12.10 (dist/esm)
public/ffmpeg-core.wasm   <- matching wasm from the same release
src/engine/ffmpegEngine.js
```
The `.js` and `.wasm` must be the **ESM** build and come from the same release.
To refresh them: `cp node_modules/@ffmpeg/core/dist/esm/ffmpeg-core.* public/`
(`@ffmpeg/core` is pinned in devDependencies at 0.12.10.)

## Support Open Source ❤️
If FFmpeg Studio helps your workflow, consider supporting via:
- [GitHub Sponsors](https://github.com/sponsors/username)
- [Buy Me a Coffee](https://buymeacoffee.com/username)

## License
MIT
