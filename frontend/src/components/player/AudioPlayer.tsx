"use client";
import { useRef, useEffect, useState } from "react";
import { Play, Pause, SkipBack, SkipForward } from "lucide-react";
import { formatDuration, cn } from "@/lib/utils";
import type { TranscriptSegment } from "@/types";

interface Props {
  src: string;
  segments: TranscriptSegment[];
  currentTime: number;
  onTimeUpdate: (time: number) => void;
}

export function AudioPlayer({ src, segments, currentTime, onTimeUpdate }: Props) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const seeking = useRef(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdateFn = () => {
      if (!seeking.current) onTimeUpdate(audio.currentTime);
    };
    const onLoadedMetadata = () => setDuration(audio.duration);
    const onEnded = () => setPlaying(false);
    const onProgress = () => {
      if (audio.buffered.length > 0) {
        setBuffered(audio.buffered.end(audio.buffered.length - 1));
      }
    };

    audio.addEventListener("timeupdate", onTimeUpdateFn);
    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("progress", onProgress);
    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdateFn);
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("progress", onProgress);
    };
  }, [onTimeUpdate]);

  // Sync external seek (from transcript click)
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (Math.abs(audio.currentTime - currentTime) > 0.5) {
      audio.currentTime = currentTime;
    }
  }, [currentTime]);

  function togglePlay() {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      audio.play().then(() => setPlaying(true)).catch(() => {});
    }
  }

  function handleSeek(e: React.ChangeEvent<HTMLInputElement>) {
    const time = parseFloat(e.target.value);
    seeking.current = true;
    onTimeUpdate(time);
    if (audioRef.current) audioRef.current.currentTime = time;
    setTimeout(() => { seeking.current = false; }, 100);
  }

  function skip(delta: number) {
    if (!audioRef.current) return;
    audioRef.current.currentTime = Math.max(0, Math.min(duration, audioRef.current.currentTime + delta));
  }

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferedPct = duration > 0 ? (buffered / duration) * 100 : 0;

  return (
    <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-4">
      <audio ref={audioRef} src={src} preload="metadata" />

      {/* Progress bar */}
      <div className="relative mb-3">
        <div className="w-full h-1.5 bg-slate-700 rounded-full overflow-hidden">
          <div className="h-full bg-slate-600 rounded-full" style={{ width: `${bufferedPct}%` }} />
          <div className="absolute top-0 left-0 h-full bg-primary rounded-full" style={{ width: `${progress}%` }} />
        </div>
        <input
          type="range"
          min={0}
          max={duration || 0}
          step={0.1}
          value={currentTime}
          onChange={handleSeek}
          className="absolute inset-0 w-full opacity-0 cursor-pointer h-1.5"
        />
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground tabular-nums">
          {formatDuration(currentTime)}
        </span>

        <div className="flex items-center gap-4">
          <button onClick={() => skip(-10)} className="text-muted-foreground hover:text-foreground transition-colors">
            <SkipBack className="w-5 h-5" />
          </button>

          <button
            onClick={togglePlay}
            className="w-10 h-10 rounded-full bg-primary hover:bg-primary/90 flex items-center justify-center transition-colors active:scale-95"
          >
            {playing ? (
              <Pause className="w-5 h-5 text-white" />
            ) : (
              <Play className="w-5 h-5 text-white ml-0.5" />
            )}
          </button>

          <button onClick={() => skip(10)} className="text-muted-foreground hover:text-foreground transition-colors">
            <SkipForward className="w-5 h-5" />
          </button>
        </div>

        <span className="text-xs text-muted-foreground tabular-nums">
          {formatDuration(duration)}
        </span>
      </div>
    </div>
  );
}
