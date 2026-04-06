"use client";
import { useEffect, useState } from "react";
import {
  Mic, Square, Pause, Play, Upload, X, AlertCircle, CheckCircle2,
} from "lucide-react";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { WaveformVisualizer } from "./WaveformVisualizer";
import { uploadAudio, notifyUploadComplete } from "@/lib/firebaseStorage";
import { formatDuration } from "@/lib/utils";

interface Props {
  meetingId: string;
  onDone: () => void;
  onCancel: () => void;
}

type UploadState = "idle" | "uploading" | "done" | "error";

export function AudioRecorder({ meetingId, onDone, onCancel }: Props) {
  const {
    state, duration, audioBlob, mimeType, waveformData,
    start, pause, resume, stop, reset, error,
  } = useAudioRecorder();

  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState("");

  // Auto-start recording when component mounts
  useEffect(() => {
    const timer = setTimeout(() => {
      start();
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  async function handleUpload() {
    if (!audioBlob) return;
    setUploadState("uploading");
    setUploadProgress(0);

    try {
      const fileName = `recording.${mimeType.includes("webm") ? "webm" : "mp4"}`;
      const { storagePath } = await uploadAudio(
        meetingId,
        audioBlob,
        mimeType || "audio/mp4",
        ({ percentage }) => setUploadProgress(percentage)
      );

      await notifyUploadComplete(
        meetingId,
        storagePath,
        fileName,
        mimeType || "audio/mp4",
        duration
      );

      setUploadState("done");
      setTimeout(onDone, 1000);
    } catch (e: any) {
      setUploadError(e.message || "Upload failed");
      setUploadState("error");
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-between bg-gradient-to-b from-slate-950 to-slate-900 px-6 py-12 safe-top safe-bottom">
      {/* Top: Cancel */}
      <div className="w-full flex justify-start">
        <button
          onClick={() => { stop(); reset(); onCancel(); }}
          className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-sm"
        >
          <X className="w-4 h-4" /> Cancel
        </button>
      </div>

      {/* Center: Waveform + timer */}
      <div className="flex flex-col items-center gap-6 w-full max-w-xs">
        {/* Recording indicator */}
        {state === "recording" && (
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-red-500 rounded-full record-pulse" />
            <span className="text-xs text-red-400 font-medium uppercase tracking-wider">Live</span>
          </div>
        )}
        {state === "paused" && (
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-yellow-500 rounded-full" />
            <span className="text-xs text-yellow-400 font-medium uppercase tracking-wider">Paused</span>
          </div>
        )}

        {/* Waveform */}
        <div className="w-full">
          <WaveformVisualizer data={waveformData} active={state === "recording"} />
        </div>

        {/* Timer */}
        <div className="text-4xl font-mono font-bold tabular-nums">
          {formatDuration(duration)}
        </div>

        {/* Error */}
        {(error || uploadError) && (
          <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 rounded-xl p-3 w-full">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error || uploadError}
          </div>
        )}

        {/* Upload progress */}
        {uploadState === "uploading" && (
          <div className="w-full">
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>Uploading...</span>
              <span>{uploadProgress}%</span>
            </div>
            <div className="w-full bg-slate-700 rounded-full h-1.5">
              <div
                className="bg-primary h-1.5 rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}

        {uploadState === "done" && (
          <div className="flex items-center gap-2 text-green-400 text-sm">
            <CheckCircle2 className="w-4 h-4" />
            Upload complete! Processing...
          </div>
        )}

        {/* iOS warning */}
        {state === "recording" && /iPad|iPhone|iPod/.test(navigator.userAgent) && (
          <p className="text-xs text-muted-foreground text-center">
            Keep screen on while recording. Locking your device may stop the recording.
          </p>
        )}
      </div>

      {/* Bottom: Controls */}
      <div className="flex flex-col items-center gap-4 w-full">
        {/* Primary controls */}
        {(state === "recording" || state === "paused") && (
          <div className="flex items-center justify-center gap-6">
            {/* Pause/Resume */}
            <button
              onClick={state === "recording" ? pause : resume}
              className="w-14 h-14 rounded-full bg-slate-700 hover:bg-slate-600 flex items-center justify-center transition-colors active:scale-95"
            >
              {state === "recording" ? (
                <Pause className="w-6 h-6" />
              ) : (
                <Play className="w-6 h-6" />
              )}
            </button>

            {/* Stop */}
            <button
              onClick={stop}
              className="w-20 h-20 rounded-full bg-red-500 hover:bg-red-400 flex items-center justify-center shadow-lg shadow-red-500/30 transition-colors active:scale-95"
            >
              <Square className="w-8 h-8 text-white fill-white" />
            </button>
          </div>
        )}

        {/* After stop: Upload or retry */}
        {state === "stopped" && uploadState === "idle" && (
          <div className="flex flex-col items-center gap-3 w-full max-w-xs">
            <button
              onClick={handleUpload}
              className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-2xl py-4 font-medium transition-colors active:scale-95"
            >
              <Upload className="w-5 h-5" />
              Upload & Transcribe
            </button>
            <button
              onClick={() => { reset(); start(); }}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Record again
            </button>
          </div>
        )}

        {uploadState === "error" && (
          <button
            onClick={handleUpload}
            className="flex items-center gap-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 rounded-xl px-6 py-3 text-sm transition-colors"
          >
            <Upload className="w-4 h-4" />
            Retry upload
          </button>
        )}

        {/* Start button (before recording starts) */}
        {state === "idle" && !error && (
          <button
            onClick={start}
            className="w-20 h-20 rounded-full bg-red-500 hover:bg-red-400 flex items-center justify-center shadow-lg shadow-red-500/30 transition-colors active:scale-95"
          >
            <Mic className="w-8 h-8 text-white" />
          </button>
        )}

        {state === "idle" && error && (
          <button
            onClick={start}
            className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl px-6 py-3 text-sm font-medium transition-colors"
          >
            <Mic className="w-4 h-4" />
            Try again
          </button>
        )}
      </div>
    </div>
  );
}
