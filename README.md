# FFmpeg Studio Pro 🎬

> In-browser media converter and editor powered by Local FFmpeg WebAssembly.
> Also view at https://ffmpeg-studio-bay.vercel.app.

## Features
- **100% Client-Side / Zero Server:** Runs entirely in your browser via local WebAssembly. No server uploads.
- **Drag & Drop:** Easy file dropping zone for videos and audio files with strict file type safety allowlists (`.mp4`, `.webm`, `.mov`, `.avi`, `.mkv`, `.mp3`, `.wav`, `.ogg`, `.flac`).
- **Comprehensive Media Editing Tools:**
  - **Format Conversion:** Convert videos and audio between MP4, WebM, AVI, MOV, GIF, MP3, WAV, and OGG.
  - **Resolution Chooser:** Resize videos to 1080p, 720p, 480p, or 360p.
  - **Visual Trim Sliders:** Cut video and audio clips using interactive start and end time range sliders bound to actual media duration.
  - **Playback Speed Control:** Adjust playback speed from 0.5x slow motion to 2.0x fast forward.
  - **Rotate & Flip:** 90° clockwise, 180°, 90° counter-clockwise, and horizontal mirror flip.
  - **Extract Audio:** Extract standalone MP3 tracks from video files.
- **Real-Time Progress & Logs:** Live progress bar and console output.

## Getting Started

```bash
# Install dependencies
npm install

# Run local development server
npm run dev

# Build for production
npm run build

# Preview production build locally
npm run preview
```

## Support Open Source ❤️
If FFmpeg Studio Pro helps your workflow, consider supporting development via [Buy Me a Coffee](https://buymeacoffee.com/deuxdubois).

## License
MIT
