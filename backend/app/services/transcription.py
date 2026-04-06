import os
import tempfile
import uuid
import subprocess
from pathlib import Path
from typing import Optional
import openai
import structlog

from app.config import get_settings
from app.services.storage import StorageService
from app.services.firestore import FirestoreService

log = structlog.get_logger()


SPEAKER_COLORS = [
    "Speaker 1", "Speaker 2", "Speaker 3", "Speaker 4",
    "Speaker 5", "Speaker 6", "Speaker 7", "Speaker 8",
]


def _assign_speakers(segments: list[dict]) -> list[dict]:
    """
    Heuristic speaker diarization: group consecutive segments by silence gaps.
    Real diarization requires pyannote.audio (heavy dependency).
    This approximation groups segments separated by <0.5s as same speaker,
    and assigns new speaker labels on longer pauses.
    """
    if not segments:
        return segments

    assigned = []
    current_speaker_idx = 0
    prev_end = 0.0

    for seg in segments:
        gap = seg.get("start", 0) - prev_end
        # New speaker heuristic: gap > 1.5 seconds suggests speaker change
        if prev_end > 0 and gap > 1.5:
            current_speaker_idx = (current_speaker_idx + 1) % len(SPEAKER_COLORS)
        speaker = SPEAKER_COLORS[current_speaker_idx]
        assigned.append({**seg, "speaker": speaker})
        prev_end = seg.get("end", seg.get("start", 0))

    return assigned


def _split_audio_file(input_path: str, chunk_duration_seconds: int = 1200) -> list[str]:
    """Split audio file into chunks using ffmpeg."""
    output_dir = tempfile.mkdtemp()
    chunk_pattern = os.path.join(output_dir, "chunk_%03d.mp4")
    cmd = [
        "ffmpeg", "-i", input_path,
        "-f", "segment",
        "-segment_time", str(chunk_duration_seconds),
        "-c", "copy",
        "-reset_timestamps", "1",
        chunk_pattern,
        "-y", "-loglevel", "error"
    ]
    subprocess.run(cmd, check=True)
    chunks = sorted(Path(output_dir).glob("chunk_*.mp4"))
    return [str(c) for c in chunks]


class TranscriptionService:
    def __init__(self):
        self.settings = get_settings()
        self.client = openai.OpenAI(api_key=self.settings.openai_api_key)
        self.storage = StorageService()
        self.firestore = FirestoreService()

    def transcribe_meeting(self, meeting_id: str, audio_path: str, model: str = "whisper-1") -> dict:
        """Full pipeline: download audio, transcribe, diarize, store."""
        log.info("Starting transcription", meeting_id=meeting_id, audio_path=audio_path)

        # Update status
        self.firestore.update_meeting(meeting_id, {"status": "transcribing"})

        try:
            # Download audio from Firebase Storage
            audio_bytes = self.storage.download_to_bytes(audio_path)
            file_size_mb = len(audio_bytes) / (1024 * 1024)
            log.info("Audio downloaded", size_mb=f"{file_size_mb:.1f}")

            if file_size_mb > self.settings.whisper_max_file_size_mb:
                segments = self._transcribe_large_file(audio_bytes, audio_path, model)
            else:
                segments = self._transcribe_bytes(audio_bytes, audio_path, model)

            # Assign speakers
            segments_with_speakers = _assign_speakers(segments)

            # Build full text
            full_text = " ".join(s["text"].strip() for s in segments_with_speakers)

            # Enrich with IDs
            enriched = [
                {
                    "id": str(uuid.uuid4()),
                    "speaker": s["speaker"],
                    "text": s["text"].strip(),
                    "startTime": s.get("start", 0),
                    "endTime": s.get("end", 0),
                    "confidence": s.get("avg_logprob"),
                }
                for s in segments_with_speakers
            ]

            # Detect language from first segment
            language = "en"

            transcript_data = {
                "language": language,
                "segments": enriched,
                "fullText": full_text,
            }

            self.firestore.save_transcript(meeting_id, transcript_data)
            self.firestore.update_meeting(meeting_id, {"status": "ready"})
            log.info("Transcription complete", meeting_id=meeting_id, segments=len(enriched))
            return transcript_data

        except Exception as e:
            log.error("Transcription failed", meeting_id=meeting_id, error=str(e))
            self.firestore.update_meeting(meeting_id, {
                "status": "error",
                "errorMessage": str(e)
            })
            raise

    def _transcribe_bytes(self, audio_bytes: bytes, filename: str, model: str) -> list[dict]:
        """Transcribe audio bytes via Whisper API."""
        # Determine file extension for MIME type hint
        ext = Path(filename).suffix or ".mp4"
        with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as f:
            f.write(audio_bytes)
            tmp_path = f.name

        try:
            with open(tmp_path, "rb") as audio_file:
                response = self.client.audio.transcriptions.create(
                    model=model,
                    file=audio_file,
                    response_format="verbose_json",
                    timestamp_granularities=["segment"],
                )
            return response.segments or []
        finally:
            os.unlink(tmp_path)

    def _transcribe_large_file(self, audio_bytes: bytes, filename: str, model: str) -> list[dict]:
        """Handle files larger than Whisper's 25MB limit by splitting."""
        ext = Path(filename).suffix or ".mp4"
        with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as f:
            f.write(audio_bytes)
            tmp_path = f.name

        try:
            chunk_paths = _split_audio_file(tmp_path)
            all_segments = []
            time_offset = 0.0

            for chunk_path in chunk_paths:
                with open(chunk_path, "rb") as af:
                    resp = self.client.audio.transcriptions.create(
                        model=model,
                        file=af,
                        response_format="verbose_json",
                        timestamp_granularities=["segment"],
                    )
                for seg in (resp.segments or []):
                    adjusted = {
                        **seg.__dict__,
                        "start": seg.start + time_offset,
                        "end": seg.end + time_offset,
                    }
                    all_segments.append(adjusted)

                # Estimate chunk duration from last segment end
                if resp.segments:
                    time_offset = all_segments[-1]["end"]

            return all_segments
        finally:
            os.unlink(tmp_path)
