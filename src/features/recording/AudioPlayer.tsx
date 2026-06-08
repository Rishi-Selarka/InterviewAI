'use client';

// Custom audio player for interview recordings. MediaRecorder WebM blobs lack
// duration metadata, so a native <audio controls> reports `Infinity`/`0:00` and
// the seek bar jumps/moves backwards. This component force-resolves the real
// duration (seek far past the end, then read the now-finite duration) and drives
// a custom seek bar so playback + scrubbing behave correctly.

import { useEffect, useRef, useState } from 'react';

function fmt(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function AudioPlayer({ src }: { src: string; label?: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    // Tracks the one-shot WebM duration-fix dance.
    let resolvingDuration = false;
    let durationResolved = false;

    const onLoadedMetadata = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        durationResolved = true;
        setDuration(audio.duration);
        return;
      }
      // WebM with no duration metadata: seek way past the end to force the
      // browser to compute the real duration, captured on the next timeupdate.
      if (!resolvingDuration) {
        resolvingDuration = true;
        audio.currentTime = 1e7;
      }
    };

    const onTimeUpdate = () => {
      if (resolvingDuration && !durationResolved) {
        if (Number.isFinite(audio.duration) && audio.duration > 0) {
          durationResolved = true;
          resolvingDuration = false;
          setDuration(audio.duration);
        }
        // Reset the playhead back to the start after the forced seek.
        audio.currentTime = 0;
        setCurrent(0);
        return;
      }
      setCurrent(audio.currentTime);
    };

    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnded = () => setPlaying(false);

    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('ended', onEnded);

    return () => {
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('ended', onEnded);
    };
  }, [src]);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  };

  const seek = (value: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = value;
    setCurrent(value);
  };

  return (
    <div className="flex items-center gap-3 rounded-xl bg-surface px-3 py-2">
      <audio ref={audioRef} src={src} preload="metadata" className="hidden" />

      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? 'Pause' : 'Play'}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand text-onbrand transition-colors hover:bg-brand2"
      >
        {playing ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <rect x="6" y="5" width="4" height="14" rx="1" />
            <rect x="14" y="5" width="4" height="14" rx="1" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </button>

      <span className="w-10 shrink-0 text-right font-mono text-xs tabular-nums text-muted">
        {fmt(current)}
      </span>

      <input
        type="range"
        min={0}
        max={duration || 0}
        step="any"
        value={Math.min(current, duration || 0)}
        onChange={(e) => seek(Number(e.target.value))}
        aria-label="Seek"
        className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-surface2 accent-brand"
      />

      <span className="w-10 shrink-0 font-mono text-xs tabular-nums text-muted">
        {fmt(duration)}
      </span>
    </div>
  );
}
