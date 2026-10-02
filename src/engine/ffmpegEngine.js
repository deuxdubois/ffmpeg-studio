import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';

// Core files live in /public so Vite serves them from the site root.
// They MUST be the ESM build of @ffmpeg/core (dist/esm), and the .js and .wasm
// must come from the same release.
const BASE = import.meta.env.BASE_URL;

class FFmpegEngine {
  constructor() {
    this.ffmpeg = new FFmpeg();
    this.loaded = false;
    this.loadingPromise = null;
    this.onLog = null;
    this.onProgress = null;

    // Register listeners once; they forward to whatever callbacks are current.
    this.ffmpeg.on('log', ({ message }) => this.onLog?.(message));
    this.ffmpeg.on('progress', ({ progress }) => this.onProgress?.(progress));
  }

  setCallbacks(onLog, onProgress) {
    this.onLog = onLog;
    this.onProgress = onProgress;
  }

  async load(onLog, onProgress) {
    this.setCallbacks(onLog, onProgress);
    if (this.loaded) return true;
    if (this.loadingPromise) return this.loadingPromise;

    this.loadingPromise = (async () => {
      try {
        await this.ffmpeg.load({
          coreURL: await toBlobURL(`${BASE}ffmpeg-core.js`, 'text/javascript'),
          wasmURL: await toBlobURL(`${BASE}ffmpeg-core.wasm`, 'application/wasm'),
        });
        this.loaded = true;
        return true;
      } catch (err) {
        console.error('Failed to load FFmpeg engine:', err);
        this.loadingPromise = null;
        throw err;
      }
    })();

    return this.loadingPromise;
  }

  writeFile(name, data) { return this.ffmpeg.writeFile(name, data); }
  readFile(name) { return this.ffmpeg.readFile(name); }
  deleteFile(name) { return this.ffmpeg.deleteFile(name); }

  async exec(args) {
    const code = await this.ffmpeg.exec(['-y', ...args]);
    if (code !== 0) throw new Error(`ffmpeg exited with code ${code}`);
    return code;
  }
}

export const ffmpegEngine = new FFmpegEngine();
