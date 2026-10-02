import React, { useState, useRef, useEffect } from 'react';
import { fetchFile } from '@ffmpeg/util';
import { ffmpegEngine } from './engine/ffmpegEngine';

const ALLOWED_EXTENSIONS = ['mp4', 'webm', 'mov', 'avi', 'mkv', 'mp3', 'wav', 'ogg', 'flac'];
const ALLOWED_MIME_TYPES = [
  'video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska',
  'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/flac', 'application/octet-stream'
];

export default function App() {
  const [loaded, setLoaded] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('Initializing FFmpeg WebAssembly...');
  const [loadError, setLoadError] = useState(false);
  const [file, setFile] = useState(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState(null);
  const [mediaDuration, setMediaDuration] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const [action, setAction] = useState('convert');
  
  // Feature options
  const [outputFormat, setOutputFormat] = useState('mp4');
  const [resolution, setResolution] = useState('1280x720');
  const [trimStartSec, setTrimStartSec] = useState(0);
  const [trimEndSec, setTrimEndSec] = useState(10);
  const [speedRate, setSpeedRate] = useState('1.5');
  const [rotateMode, setRotateMode] = useState('90');

  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState('');
  const [outputUrl, setOutputUrl] = useState(null);
  const [outputName, setOutputName] = useState('');

  const fileInputRef = useRef(null);

  useEffect(() => {
    initFFmpeg();
  }, []);

  const initFFmpeg = async () => {
    try {
      const loadPromise = ffmpegEngine.load(
        (msg) => setLogs(prev => prev + '\n' + msg),
        (prog) => setProgress(Math.round(prog * 100))
      );

      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Initialization timed out after 20 seconds.')), 20000)
      );

      await Promise.race([loadPromise, timeoutPromise]);
      setLoaded(true);
    } catch (e) {
      console.error(e);
      setLoadError(true);
      setLoadingMsg(`Failed to load FFmpeg: ${e.message}`);
    }
  };

  const validateAndHandleFile = (f) => {
    if (!f) return;
    setErrorMsg('');
    
    const ext = f.name.split('.').pop().toLowerCase();
    const isExtAllowed = ALLOWED_EXTENSIONS.includes(ext);
    const isMimeAllowed = ALLOWED_MIME_TYPES.includes(f.type) || f.type === '';

    if (!isExtAllowed && !isMimeAllowed) {
      setErrorMsg(`Unsupported file format (.${ext}). Allowed formats: ${ALLOWED_EXTENSIONS.join(', ')}.`);
      return;
    }

    setFile(f);
    const url = URL.createObjectURL(f);
    setFilePreviewUrl(url);
    setOutputUrl(null);
    setLogs('');

    if (f.type.startsWith('audio') || ['mp3', 'wav', 'ogg', 'flac'].includes(ext)) {
      setOutputFormat('mp3');
      setAction('convert');
    } else {
      setOutputFormat('mp4');
      setAction('convert');
    }
  };

  const handleLoadedMetadata = (e) => {
    const dur = e.target.duration;
    if (dur && !isNaN(dur)) {
      setMediaDuration(dur);
      setTrimStartSec(0);
      setTrimEndSec(dur);
    }
  };

  const handleDragOver = (e) => e.preventDefault();
  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndHandleFile(e.dataTransfer.files[0]);
    }
  };

  const formatTime = (secs) => {
    if (isNaN(secs)) return '00:00.00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    const ms = Math.floor((secs % 1) * 1000);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0').slice(0, 2)}`;
  };

  const isAudioFile = file && (file.type.startsWith('audio') || ['mp3', 'wav', 'ogg', 'flac'].includes(file.name.split('.').pop().toLowerCase()));

  const runFFmpeg = async () => {
    if (!file || !loaded) return;
    setProcessing(true);
    setProgress(0);
    setOutputUrl(null);

    try {
      const inputName = 'input' + file.name.substring(file.name.lastIndexOf('.'));
      await ffmpegEngine.writeFile(inputName, await fetchFile(file));

      if (action === 'convert') {
        const outputName = `output.${outputFormat}`;
        await ffmpegEngine.exec(['-i', inputName, outputName]);
        const data = await ffmpegEngine.readFile(outputName);
        const mime = outputFormat === 'mp3' ? 'audio/mp3' : outputFormat === 'wav' ? 'audio/wav' : `video/${outputFormat}`;
        setOutputUrl(URL.createObjectURL(new Blob([data.buffer], { type: mime })));
        setOutputName(`converted.${outputFormat}`);
      } 
      else if (action === 'resize' && !isAudioFile) {
        const [w, h] = resolution.split('x');
        const outputName = 'output.mp4';
        await ffmpegEngine.exec(['-i', inputName, '-vf', `scale=${w}:${h}`, outputName]);
        const data = await ffmpegEngine.readFile(outputName);
        setOutputUrl(URL.createObjectURL(new Blob([data.buffer], { type: 'video/mp4' })));
        setOutputName(`resized_${resolution}.mp4`);
      } 
      else if (action === 'trim') {
        const duration = trimEndSec - trimStartSec;
        const startStr = formatTime(trimStartSec);
        const outExt = isAudioFile ? 'mp3' : 'mp4';
        const outputName = `output.${outExt}`;
        
        if (isAudioFile) {
          await ffmpegEngine.exec(['-ss', startStr, '-i', inputName, '-t', duration.toString(), outputName]);
        } else {
          await ffmpegEngine.exec(['-ss', startStr, '-i', inputName, '-t', duration.toString(), '-c', 'copy', outputName]);
        }

        const data = await ffmpegEngine.readFile(outputName);
        setOutputUrl(URL.createObjectURL(new Blob([data.buffer], { type: isAudioFile ? 'audio/mp3' : 'video/mp4' })));
        setOutputName(`trimmed.${outExt}`);
      } 
      else if (action === 'speed' && !isAudioFile) {
        const pts = 1 / parseFloat(speedRate);
        const outputName = 'output.mp4';
        await ffmpegEngine.exec(['-i', inputName, '-filter_complex', `[0:v]setpts=${pts}*PTS[v];[0:a]atempo=${speedRate}[a]`, '-map', '[v]', '-map', '[a]', outputName]);
        const data = await ffmpegEngine.readFile(outputName);
        setOutputUrl(URL.createObjectURL(new Blob([data.buffer], { type: 'video/mp4' })));
        setOutputName(`speed_${speedRate}x.mp4`);
      } 
      else if (action === 'rotate' && !isAudioFile) {
        const outputName = 'output.mp4';
        let vf = rotateMode === 'hflip' ? 'hflip' : `transpose=${rotateMode}`;
        await ffmpegEngine.exec(['-i', inputName, '-vf', vf, outputName]);
        const data = await ffmpegEngine.readFile(outputName);
        setOutputUrl(URL.createObjectURL(new Blob([data.buffer], { type: 'video/mp4' })));
        setOutputName(`transformed.mp4`);
      } 
      else if (action === 'audio') {
        const outputName = 'output.mp3';
        await ffmpegEngine.exec(['-i', inputName, '-q:a', '0', '-map', 'a', outputName]);
        const data = await ffmpegEngine.readFile(outputName);
        setOutputUrl(URL.createObjectURL(new Blob([data.buffer], { type: 'audio/mp3' })));
        setOutputName(`extracted_audio.mp3`);
      }

    } catch (e) {
      console.error(e);
      alert('Error during FFmpeg processing. Check console logs for details.');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="app-container">
      <header>
        <div className="logo">
          <span>🎬</span> FFmpeg Studio Pro
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <a
            href="https://github.com/deuxdubois/ffmpeg-studio"
            target="_blank"
            rel="noreferrer"
            style={{ color: 'var(--text-muted)', fontSize: '0.875rem', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
          >
            ⭐ GitHub Repo
          </a>
          <div style={{ fontSize: '0.875rem', color: loaded ? 'var(--success)' : loadError ? 'var(--error)' : 'var(--text-muted)' }}>
            {loaded ? '● WASM Ready' : loadError ? '✕ Load Failed' : '⏳ Initializing...'}
          </div>
        </div>
      </header>

      {/* Hidden media element to read metadata and duration */}
      {filePreviewUrl && (
        isAudioFile ? (
          <audio src={filePreviewUrl} preload="metadata" onLoadedMetadata={handleLoadedMetadata} style={{ display: 'none' }} />
        ) : (
          <video src={filePreviewUrl} preload="metadata" onLoadedMetadata={handleLoadedMetadata} style={{ display: 'none' }} />
        )
      )}

      {errorMsg && (
        <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--error)', padding: '1rem', borderRadius: '0.5rem', color: 'var(--error)', fontSize: '0.9rem' }}>
          ⚠️ {errorMsg}
        </div>
      )}

      {!file ? (
        <div
          className="dropzone"
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => validateAndHandleFile(e.target.files[0])}
            style={{ display: 'none' }}
            accept={ALLOWED_EXTENSIONS.map(ext => `.${ext}`).join(',')}
          />
          <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>📁</div>
          <div style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: '0.5rem' }}>
            Drag & Drop your video or audio here
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Allowed formats: MP4, WebM, MOV, AVI, MKV, MP3, WAV, OGG, FLAC • 100% Local
          </div>
          {!loaded && !loadError && (
            <div style={{ marginTop: '1rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              ⏳ Initializing FFmpeg background engine...
            </div>
          )}
        </div>
      ) : (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>CURRENT FILE</span>
              <div style={{ fontWeight: 600, fontFamily: 'monospace', fontSize: '1.05rem' }}>
                {file.name} ({(file.size / (1024 * 1024)).toFixed(2)} MB) {mediaDuration > 0 && `• ${mediaDuration.toFixed(1)}s`}
              </div>
            </div>
            <button className="btn" style={{ background: 'var(--bg-input)' }} onClick={() => { setFile(null); setOutputUrl(null); setMediaDuration(0); }}>
              Change File
            </button>
          </div>

          {/* Visual Preview */}
          {filePreviewUrl && !isAudioFile && (
            <div style={{ background: 'var(--bg-input)', padding: '0.5rem', borderRadius: '0.5rem', textAlign: 'center' }}>
              <video src={filePreviewUrl} controls style={{ maxHeight: '220px', width: '100%', borderRadius: '0.35rem' }} />
            </div>
          )}

          {filePreviewUrl && isAudioFile && (
            <div style={{ background: 'var(--bg-input)', padding: '1rem', borderRadius: '0.5rem', textAlign: 'center' }}>
              <audio src={filePreviewUrl} controls style={{ width: '100%' }} />
            </div>
          )}

          {/* Action Tabs - Logically filtered by file type */}
          <div className="tabs">
            <button className={`tab-btn ${action === 'convert' ? 'active' : ''}`} onClick={() => setAction('convert')}>Convert</button>
            <button className={`tab-btn ${action === 'trim' ? 'active' : ''}`} onClick={() => setAction('trim')}>Trim</button>
            
            {!isAudioFile && (
              <>
                <button className={`tab-btn ${action === 'resize' ? 'active' : ''}`} onClick={() => setAction('resize')}>Resize</button>
                <button className={`tab-btn ${action === 'speed' ? 'active' : ''}`} onClick={() => setAction('speed')}>Speed</button>
                <button className={`tab-btn ${action === 'rotate' ? 'active' : ''}`} onClick={() => setAction('rotate')}>Rotate & Flip</button>
              </>
            )}

            <button className={`tab-btn ${action === 'audio' ? 'active' : ''}`} onClick={() => setAction('audio')}>
              {isAudioFile ? 'Normalize / Transcode' : 'Extract Audio'}
            </button>
          </div>

          {/* Tab Options */}
          {action === 'convert' && (
            <div>
              <label className="label">Target Format</label>
              <select className="select" value={outputFormat} onChange={(e) => setOutputFormat(e.target.value)}>
                {isAudioFile ? (
                  <>
                    <option value="mp3">MP3 Audio</option>
                    <option value="wav">WAV Audio</option>
                    <option value="ogg">OGG Audio</option>
                  </>
                ) : (
                  <>
                    <option value="mp4">MP4 Video</option>
                    <option value="webm">WebM Video</option>
                    <option value="avi">AVI Video</option>
                    <option value="mov">MOV Video</option>
                    <option value="gif">Animated GIF</option>
                  </>
                )}
              </select>
            </div>
          )}

          {action === 'resize' && !isAudioFile && (
            <div>
              <label className="label">Resolution Chooser</label>
              <select className="select" value={resolution} onChange={(e) => setResolution(e.target.value)}>
                <option value="1920x1080">1080p (1920x1080)</option>
                <option value="1280x720">720p (1280x720)</option>
                <option value="854x480">480p (854x480)</option>
                <option value="640x360">360p (640x360)</option>
              </select>
            </div>
          )}

          {action === 'trim' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                <span>Start: <strong style={{ color: 'var(--text-main)' }}>{formatTime(trimStartSec)}</strong></span>
                <span>Duration: <strong style={{ color: 'var(--accent)' }}>{(trimEndSec - trimStartSec).toFixed(1)}s</strong></span>
                <span>End: <strong style={{ color: 'var(--text-main)' }}>{formatTime(trimEndSec)}</strong></span>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label className="label"><span>Start Time Slider (Max: {mediaDuration ? mediaDuration.toFixed(1) : '0'}s)</span></label>
                <input
                  type="range"
                  min="0"
                  max={mediaDuration || 100}
                  step="0.1"
                  value={trimStartSec}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    if (val < trimEndSec) setTrimStartSec(val);
                  }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label className="label"><span>End Time Slider (Max: {mediaDuration ? mediaDuration.toFixed(1) : '0'}s)</span></label>
                <input
                  type="range"
                  min="0"
                  max={mediaDuration || 100}
                  step="0.1"
                  value={trimEndSec}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    if (val > trimStartSec) setTrimEndSec(val);
                  }}
                />
              </div>
            </div>
          )}

          {action === 'speed' && !isAudioFile && (
            <div>
              <label className="label">
                <span>Playback Speed</span>
                <span style={{ color: 'var(--accent)', fontFamily: 'monospace' }}>{speedRate}x</span>
              </label>
              <select className="select" value={speedRate} onChange={(e) => setSpeedRate(e.target.value)}>
                <option value="0.5">0.5x (Slow Motion)</option>
                <option value="0.8">0.8x (Slightly Slower)</option>
                <option value="1.25">1.25x (Slightly Faster)</option>
                <option value="1.5">1.5x (Fast)</option>
                <option value="2.0">2.0x (Double Speed)</option>
              </select>
            </div>
          )}

          {action === 'rotate' && !isAudioFile && (
            <div>
              <label className="label">Rotation / Transformation</label>
              <select className="select" value={rotateMode} onChange={(e) => setRotateMode(e.target.value)}>
                <option value="90">90° Clockwise</option>
                <option value="180">180° Rotation</option>
                <option value="270">90° Counter-Clockwise</option>
                <option value="hflip">Horizontal Flip (Mirror)</option>
              </select>
            </div>
          )}

          {action === 'audio' && (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              {isAudioFile ? 'Transcodes audio file to high-quality MP3.' : 'Extracts the audio track from your video file into a high-quality MP3 file.'}
            </div>
          )}

          <button className="btn" onClick={runFFmpeg} disabled={!loaded || processing}>
            {!loaded ? '⏳ Connecting FFmpeg...' : processing ? `Processing (${progress}%)...` : '⚡ Run FFmpeg Operation'}
          </button>

          {processing && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${progress}%` }}></div>
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                Executing Local WASM FFmpeg... {progress}%
              </div>
            </div>
          )}

          {outputUrl && (
            <div style={{ marginTop: '1rem', padding: '1.25rem', backgroundColor: 'var(--bg-input)', borderRadius: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', border: '1px solid var(--success)' }}>
              <div style={{ fontWeight: 600, color: 'var(--success)' }}>✨ Processing Successful!</div>
              {outputName.endsWith('.mp4') || outputName.endsWith('.webm') ? (
                <video src={outputUrl} controls style={{ maxHeight: '200px', width: '100%', borderRadius: '0.35rem' }} />
              ) : null}
              {outputName.endsWith('.mp3') || outputName.endsWith('.wav') || outputName.endsWith('.ogg') ? (
                <audio src={outputUrl} controls style={{ width: '100%' }} />
              ) : null}
              <a className="btn" href={outputUrl} download={outputName} style={{ textAlign: 'center', textDecoration: 'none' }}>
                📥 Download {outputName}
              </a>
            </div>
          )}
        </div>
      )}

      {logs && (
        <div className="card">
          <div className="label">FFmpeg Console Logs</div>
          <pre style={{ background: 'var(--bg-input)', padding: '0.75rem', borderRadius: '0.5rem', fontSize: '0.75rem', fontFamily: 'monospace', maxHeight: '120px', overflowY: 'auto', color: 'var(--text-muted)' }}>
            {logs}
          </pre>
        </div>
      )}

      <footer>
        <p>
          FFmpeg Studio Pro runs 100% locally in your browser using local WASM files. No server uploads.
        </p>
        <p style={{ marginTop: '0.5rem' }}>
          ❤️ Enjoying this tool? Support development via <a href="https://buymeacoffee.com/deuxdubois" target="_blank" rel="noreferrer">Buy Me a Coffee</a>!
        </p>
      </footer>
    </div>
  );
}
