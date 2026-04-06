import openai
import structlog
from app.config import get_settings
from app.services.storage import StorageService
from app.services.firestore import FirestoreService

log = structlog.get_logger()


class TTSService:
    def __init__(self):
        settings = get_settings()
        self.client = openai.OpenAI(api_key=settings.openai_api_key)
        self.storage = StorageService()
        self.firestore = FirestoreService()

    def generate_voice_summary(
        self,
        meeting_id: str,
        summary_text: str,
        voice: str = "alloy",
        model: str = "tts-1",
    ) -> dict:
        """Generate TTS audio for the meeting summary and store in Firebase."""
        log.info("Generating voice summary", meeting_id=meeting_id)

        response = self.client.audio.speech.create(
            model=model,
            voice=voice,
            input=summary_text[:4096],  # TTS limit
            response_format="mp3",
        )

        audio_bytes = response.content
        storage_path = f"tts/{meeting_id}/voice_summary.mp3"

        self.storage.upload_bytes(storage_path, audio_bytes, "audio/mpeg")
        download_url = self.storage.generate_download_url(storage_path)

        # Update summary doc with TTS path
        self.firestore.update_summary(meeting_id, {
            "ttsSummaryPath": storage_path,
            "ttsSummaryUrl": download_url,
        })

        log.info("Voice summary generated", meeting_id=meeting_id, storage_path=storage_path)
        return {"storage_path": storage_path, "download_url": download_url}

    def get_voice_summary_url(self, meeting_id: str) -> str | None:
        """Get or refresh the signed URL for existing voice summary."""
        storage_path = f"tts/{meeting_id}/voice_summary.mp3"
        if self.storage.exists(storage_path):
            url = self.storage.generate_download_url(storage_path)
            self.firestore.update_summary(meeting_id, {"ttsSummaryUrl": url})
            return url
        return None
