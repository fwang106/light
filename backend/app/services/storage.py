from firebase_admin import storage as firebase_storage
from datetime import timedelta
from app.config import get_settings
import structlog

log = structlog.get_logger()


class StorageService:
    def __init__(self):
        self.bucket = firebase_storage.bucket()

    def generate_upload_url(self, storage_path: str, content_type: str, expires_minutes: int = 15) -> str:
        """Generate a signed URL for direct browser-to-GCS upload."""
        blob = self.bucket.blob(storage_path)
        url = blob.generate_signed_url(
            version="v4",
            expiration=timedelta(minutes=expires_minutes),
            method="PUT",
            content_type=content_type,
        )
        return url

    def generate_download_url(self, storage_path: str, expires_hours: int = 1) -> str:
        """Generate a signed URL for downloading a file."""
        blob = self.bucket.blob(storage_path)
        url = blob.generate_signed_url(
            version="v4",
            expiration=timedelta(hours=expires_hours),
            method="GET",
        )
        return url

    def download_to_bytes(self, storage_path: str) -> bytes:
        """Download file to memory."""
        blob = self.bucket.blob(storage_path)
        return blob.download_as_bytes()

    def upload_bytes(self, storage_path: str, data: bytes, content_type: str) -> None:
        """Upload bytes to Firebase Storage."""
        blob = self.bucket.blob(storage_path)
        blob.upload_from_string(data, content_type=content_type)

    def delete(self, storage_path: str) -> None:
        try:
            blob = self.bucket.blob(storage_path)
            blob.delete()
        except Exception as e:
            log.warning("Failed to delete storage object", path=storage_path, error=str(e))

    def get_file_size_mb(self, storage_path: str) -> float:
        blob = self.bucket.blob(storage_path)
        blob.reload()
        return (blob.size or 0) / (1024 * 1024)

    def exists(self, storage_path: str) -> bool:
        blob = self.bucket.blob(storage_path)
        return blob.exists()
