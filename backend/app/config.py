from pydantic_settings import BaseSettings
from functools import lru_cache
import os


class Settings(BaseSettings):
    # App
    app_name: str = "Meeting Transcription API"
    debug: bool = False
    environment: str = "production"

    # Firebase
    firebase_project_id: str = ""
    firebase_service_account_key: str = ""  # JSON string or path

    # GCP
    gcp_project_id: str = ""
    firebase_storage_bucket: str = ""

    # AI API Keys (loaded from Secret Manager in prod, env vars in dev)
    openai_api_key: str = ""
    anthropic_api_key: str = ""

    # Secret Manager (optional: load secrets from GCP Secret Manager)
    use_secret_manager: bool = False

    # CORS
    allowed_origins: list[str] = ["http://localhost:3000", "https://localhost:3000"]

    # Audio limits
    max_audio_size_mb: int = 500
    whisper_max_file_size_mb: int = 24  # Whisper limit is 25MB

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

    def load_from_secret_manager(self) -> None:
        """Load secrets from GCP Secret Manager if enabled."""
        if not self.use_secret_manager:
            return
        try:
            from google.cloud import secretmanager
            client = secretmanager.SecretManagerServiceClient()
            project = self.gcp_project_id or self.firebase_project_id

            def get_secret(name: str) -> str:
                resource = f"projects/{project}/secrets/{name}/versions/latest"
                resp = client.access_secret_version(request={"name": resource})
                return resp.payload.data.decode("utf-8")

            if not self.openai_api_key:
                self.openai_api_key = get_secret("openai-api-key")
            if not self.anthropic_api_key:
                self.anthropic_api_key = get_secret("anthropic-api-key")
        except Exception as e:
            import structlog
            log = structlog.get_logger()
            log.warning("Failed to load secrets from Secret Manager", error=str(e))


@lru_cache()
def get_settings() -> Settings:
    settings = Settings()
    settings.load_from_secret_manager()
    return settings
