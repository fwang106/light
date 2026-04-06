"use client";
import { useState, useRef, useCallback, useEffect } from "react";
import { getSupportedMimeType } from "@/lib/utils";

export type RecordingState = "idle" | "recording" | "paused" | "stopped";

export interface UseAudioRecorderResult {
  state: RecordingState;
  duration: number;
  audioBlob: Blob | null;
  audioUrl: string | null;
  mimeType: string;
  waveformData: number[];
  start: () => Promise<void>;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  reset: () => void;
  error: string | null;
}

export function useAudioRecorder(): UseAudioRecorderResult {
  const [state, setState] = useState<RecordingState>("idle");
  const [duration, setDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [waveformData, setWaveformData] = useState<number[]>(Array(32).fill(0));
  const [error, setError] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState("");

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animFrameRef = useRef<number>(0);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const durationRef = useRef(0);
  const isIOSRef = useRef(false);

  useEffect(() => {
    isIOSRef.current = /iPad|iPhone|iPod/.test(navigator.userAgent);
  }, []);

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, []);

  const cleanup = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }
    if (wakeLockRef.current) {
      wakeLockRef.current.release().catch(() => {});
    }
  }, []);

  const startWaveform = useCallback((stream: MediaStream) => {
    // Must create AudioContext inside user gesture handler
    try {
      const ctx = new AudioContext();
      audioContextRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const draw = () => {
        analyser.getByteFrequencyData(dataArray);
        const bars = Array.from(dataArray.slice(0, 32)).map((v) => v / 255);
        setWaveformData(bars);
        animFrameRef.current = requestAnimationFrame(draw);
      };
      draw();
    } catch {
      // Waveform optional; don't block recording
    }
  }, []);

  const start = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000,
        },
      });
      streamRef.current = stream;

      const type = getSupportedMimeType();
      setMimeType(type);

      // Request wake lock to prevent screen sleep
      if ("wakeLock" in navigator) {
        try {
          wakeLockRef.current = await navigator.wakeLock.request("screen");
        } catch {
          // Wake lock not critical
        }
      }

      const options: MediaRecorderOptions = type ? { mimeType: type } : {};
      const recorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: type || "audio/mp4" });
        setAudioBlob(blob);
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
      };

      // iOS Safari ignores timeslice; Android gets chunked uploads every 10s
      if (isIOSRef.current) {
        recorder.start(); // collect all in one chunk
      } else {
        recorder.start(10000); // 10s chunks for Android resilience
      }

      startWaveform(stream);

      // Duration timer
      durationRef.current = 0;
      timerRef.current = setInterval(() => {
        durationRef.current += 1;
        setDuration(durationRef.current);
      }, 1000);

      // Handle visibility change (background on iOS)
      document.addEventListener("visibilitychange", handleVisibilityChange);

      setState("recording");
    } catch (e: any) {
      const msg =
        e.name === "NotAllowedError"
          ? "Microphone permission denied. Please allow microphone access."
          : e.name === "NotFoundError"
          ? "No microphone found."
          : `Recording error: ${e.message}`;
      setError(msg);
    }
  }, [startWaveform]);

  const handleVisibilityChange = useCallback(() => {
    if (document.visibilityState === "hidden" && mediaRecorderRef.current?.state === "recording") {
      // On iOS this may pause; request data before suspend
      try {
        mediaRecorderRef.current.requestData();
      } catch {
        // Not critical
      }
    }
  }, []);

  const pause = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.pause();
      if (timerRef.current) clearInterval(timerRef.current);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      setWaveformData(Array(32).fill(0));
      setState("paused");
    }
  }, []);

  const resume = useCallback(() => {
    if (mediaRecorderRef.current?.state === "paused") {
      mediaRecorderRef.current.resume();

      timerRef.current = setInterval(() => {
        durationRef.current += 1;
        setDuration(durationRef.current);
      }, 1000);

      if (analyserRef.current) {
        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        const draw = () => {
          analyserRef.current!.getByteFrequencyData(dataArray);
          setWaveformData(Array.from(dataArray.slice(0, 32)).map((v) => v / 255));
          animFrameRef.current = requestAnimationFrame(draw);
        };
        draw();
      }

      setState("recording");
    }
  }, []);

  const stop = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    setWaveformData(Array(32).fill(0));

    document.removeEventListener("visibilitychange", handleVisibilityChange);

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
    }
    if (wakeLockRef.current) {
      wakeLockRef.current.release().catch(() => {});
    }

    setState("stopped");
  }, [handleVisibilityChange]);

  const reset = useCallback(() => {
    cleanup();
    setAudioBlob(null);
    setAudioUrl(null);
    setDuration(0);
    durationRef.current = 0;
    setWaveformData(Array(32).fill(0));
    setError(null);
    chunksRef.current = [];
    setState("idle");
  }, [cleanup]);

  return {
    state,
    duration,
    audioBlob,
    audioUrl,
    mimeType,
    waveformData,
    start,
    pause,
    resume,
    stop,
    reset,
    error,
  };
}
